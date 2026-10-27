-- All data access is through the authorized server. No browser table grants.
create schema if not exists evaluation;
revoke all on schema evaluation from public, anon, authenticated, service_role;
create table public.experiments (
  id uuid primary key, owner_id uuid not null references auth.users(id),
  name text not null check (length(name) between 1 and 120),
  dataset_id text not null, seed bigint not null check (seed between 0 and 9007199254740991),
  sealed boolean not null default false, created_at timestamptz not null default now()
);
create index experiments_owner on public.experiments(owner_id);
create table public.events (
  experiment_id uuid not null references public.experiments(id), event_id text not null,
  source text not null check (source in ('synthetic','paypal_sandbox')), payload jsonb not null,
  primary key (experiment_id,event_id),
  check (payload->>'eventId' = event_id and payload->>'source' = source),
  check ((payload->'provenance'->>'source' = source) is true),
  check (source <> 'paypal_sandbox' or (payload->'provenance'->>'verificationStatus' = 'verified') is true)
);
create table evaluation.labels (
  experiment_id uuid not null, event_id text not null,
  scenario_template_id text not null, label text not null check (label in ('benign','anomalous')),
  split text not null check (split in ('train','tune','test')),
  primary key(experiment_id,event_id),
  foreign key(experiment_id,event_id) references public.events(experiment_id,event_id)
);
create table public.verified_provider_references (
  experiment_id uuid not null, event_id text not null,
  provider_capture_id text not null, provider_order_id text not null, provider_event_id text not null,
  verified_at timestamptz not null,
  primary key(experiment_id,event_id), unique(experiment_id,provider_capture_id),
  foreign key(experiment_id,event_id) references public.events(experiment_id,event_id)
);
create table public.detector_runs (
  experiment_id uuid not null references public.experiments(id), version text not null,
  detector_id text not null check (detector_id = 'rules'), created_at timestamptz not null default now(),
  primary key(experiment_id,version)
);
create table public.scores (
  experiment_id uuid not null, version text not null, event_id text not null, decision jsonb not null,
  primary key(experiment_id,version,event_id),
  foreign key(experiment_id,version) references public.detector_runs(experiment_id,version),
  foreign key(experiment_id,event_id) references public.events(experiment_id,event_id)
);
alter table public.experiments enable row level security;
alter table public.events enable row level security;
alter table public.verified_provider_references enable row level security;
alter table public.detector_runs enable row level security;
alter table public.scores enable row level security;
alter table evaluation.labels enable row level security;
revoke all on public.experiments, public.events, public.verified_provider_references, public.detector_runs, public.scores from public, anon, authenticated, service_role;
revoke all on evaluation.labels from public, anon, authenticated, service_role;
grant select, insert, update on public.experiments to service_role;
grant select, insert on public.events, public.verified_provider_references, public.detector_runs, public.scores to service_role;

-- Row lock serializes ingestion/sealing/saving across processes. Every operation checks ownership.
-- Invoker rights and service-only execution keep verification claims out of public RPC access.
create function public.lab_command(p_owner uuid, p_experiment uuid, p_action text, p_data jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  experiment public.experiments;
  item jsonb;
  existing jsonb;
  result jsonb;
  n integer;
begin
  if p_action = 'create' then
    insert into public.experiments(id,owner_id,name,dataset_id,seed)
      values(p_experiment,p_owner,p_data->>'name',p_data->>'datasetId',(p_data->>'seed')::bigint)
      on conflict(id) do nothing;
  end if;
  select * into experiment from public.experiments where id=p_experiment and owner_id=p_owner for update;
  if not found then raise exception 'experiment not found' using errcode='P0002'; end if;
  if p_action = 'create' then
    if experiment.name <> p_data->>'name' or experiment.dataset_id <> p_data->>'datasetId' or experiment.seed <> (p_data->>'seed')::bigint then
      raise exception 'experiment conflict' using errcode='23505';
    end if;
    return jsonb_build_object('experimentId',experiment.id,'datasetId',experiment.dataset_id,'seed',experiment.seed,'sealed',experiment.sealed);
  elsif p_action = 'ingest' then
    if jsonb_typeof(p_data->'events') <> 'array' or jsonb_array_length(p_data->'events') not between 1 and 500 then
      raise exception 'invalid batch' using errcode='22023';
    end if;
    for item in select value from jsonb_array_elements(p_data->'events') loop
      select payload into existing from public.events where experiment_id=p_experiment and event_id=item->>'eventId';
      if found then
        if existing <> item then raise exception 'event conflict' using errcode='23505'; end if;
        continue;
      end if;
      if experiment.sealed then raise exception 'experiment sealed' using errcode='23514'; end if;
      if item->>'source' = 'synthetic' and
        (item->'provenance'->>'datasetId' is distinct from experiment.dataset_id or (item->'provenance'->>'seed')::bigint is distinct from experiment.seed) then
        raise exception 'dataset mismatch' using errcode='23514';
      end if;
      insert into public.events values(p_experiment,item->>'eventId',item->>'source',item);
      if item->>'source' = 'paypal_sandbox' then
        insert into public.verified_provider_references values(p_experiment,item->>'eventId',
          item->'provenance'->>'providerCaptureId',item->'provenance'->>'providerOrderId',
          item->'provenance'->>'providerEventId',(item->'provenance'->>'verifiedAt')::timestamptz);
      end if;
    end loop;
    select count(*) into n from public.events where experiment_id=p_experiment;
    if n>10000 then raise exception 'experiment limit' using errcode='23514'; end if;
    return jsonb_build_object('eventCount',n);
  elsif p_action in ('read','snapshot') then
    if p_action='snapshot' then
      if not exists(select 1 from public.events where experiment_id=p_experiment) then raise exception 'empty experiment' using errcode='23514'; end if;
      update public.experiments set sealed=true where id=p_experiment;
    end if;
    select coalesce(jsonb_agg(payload order by (payload->>'occurredAt')::timestamptz,event_id),'[]'::jsonb) into result
      from public.events where experiment_id=p_experiment;
    return jsonb_build_object('events',result);
  elsif p_action='save' then
    if not experiment.sealed or p_data->>'version' <> 'rules-v1' then raise exception 'invalid run' using errcode='23514'; end if;
    select count(*) into n from public.events where experiment_id=p_experiment;
    if jsonb_array_length(p_data->'decisions') <> n or
      (select count(distinct value->>'eventId') from jsonb_array_elements(p_data->'decisions')) <> n then
      raise exception 'incomplete run' using errcode='23514';
    end if;
    insert into public.detector_runs values(p_experiment,p_data->>'version','rules',default) on conflict do nothing;
    for item in select value from jsonb_array_elements(p_data->'decisions') loop
      if item->>'version' <> p_data->>'version' or item->>'detectorId' <> 'rules' then raise exception 'invalid decision' using errcode='23514'; end if;
      select decision into existing from public.scores where experiment_id=p_experiment and version=p_data->>'version' and event_id=item->>'eventId';
      if found then
        if existing <> item then raise exception 'decision conflict' using errcode='23505'; end if;
      else
        insert into public.scores values(p_experiment,p_data->>'version',item->>'eventId',item);
      end if;
    end loop;
    select jsonb_agg(decision order by (e.payload->>'occurredAt')::timestamptz,s.event_id) into result
      from public.scores s join public.events e using(experiment_id,event_id)
      where s.experiment_id=p_experiment and s.version=p_data->>'version';
    return jsonb_build_object('version',p_data->>'version','decisions',result);
  end if;
  raise exception 'unknown action' using errcode='22023';
end;
$$;
revoke all on function public.lab_command(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.lab_command(uuid,uuid,text,jsonb) to service_role;
