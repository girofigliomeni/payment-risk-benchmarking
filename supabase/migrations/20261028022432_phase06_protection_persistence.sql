-- Phase 6 only: no budget ledger, provider dispatch or research-data changes.
create schema protection;
revoke all on schema protection from public, anon, authenticated;
grant usage on schema protection to service_role;

create domain protection.minor as bigint check (value between 0 and 9007199254740991);
create domain protection.version as bigint check (value between 1 and 9007199254740991);
create domain protection.millis as bigint check (value between 0 and 8640000000000000);

create table protection.subjects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  source text not null check (source in ('synthetic','paypal_sandbox')),
  status text not null default 'active' check (status in ('active','closure_pending','closed')),
  current_version protection.version not null default 1,
  consent_version bigint not null default 0 check (consent_version between 0 and 9007199254740991),
  enrolled boolean not null default false, ai_consent boolean not null default false,
  created_at timestamptz not null default clock_timestamp(), unique(owner_id,source), unique(id,source),
  check (not ai_consent or enrolled)
);
create table protection.policy_versions (
  subject_id uuid not null references protection.subjects(id), version protection.version not null,
  predecessor bigint, day_minor protection.minor not null, week_minor protection.minor not null,
  cooling_off_until protection.millis, effective_at protection.millis not null,
  pending_day protection.minor, pending_week protection.minor,
  confirmed_at protection.millis, activates_at protection.millis, change_id uuid,
  reason text not null check (reason in ('enrollment','caps','cancel','cooling_off','activation')),
  created_at timestamptz not null default clock_timestamp(),
  primary key(subject_id,version),
  foreign key(subject_id,predecessor) references protection.policy_versions(subject_id,version),
  check (((version=1 and predecessor is null) or predecessor=version-1) is true),
  check ((pending_day is null and pending_week is null and confirmed_at is null and activates_at is null and change_id is null)
    or (pending_day is not null and pending_week is not null and confirmed_at is not null and activates_at is not null and change_id is not null
      and pending_day >= day_minor and pending_week >= week_minor and (pending_day > day_minor or pending_week > week_minor)
      and activates_at-confirmed_at=86400000))
);
alter table protection.subjects add foreign key(id,current_version)
  references protection.policy_versions(subject_id,version) deferrable initially deferred;
create table protection.policy_change_requests (
  id uuid primary key, subject_id uuid not null references protection.subjects(id),
  expected_version protection.version not null, resulting_version protection.version not null,
  requested_day protection.minor not null, requested_week protection.minor not null,
  confirmed_at protection.millis not null, activates_at protection.millis,
  status text not null check (status in ('effective','pending','activated','canceled','superseded')),
  foreign key(subject_id,resulting_version) references protection.policy_versions(subject_id,version) deferrable initially deferred,
  unique(subject_id,id), check (activates_at is null or activates_at-confirmed_at=86400000)
);
alter table protection.policy_versions add foreign key(subject_id,change_id)
  references protection.policy_change_requests(subject_id,id) deferrable initially deferred;
create table protection.consent_records (
  subject_id uuid not null references protection.subjects(id), version protection.version not null,
  purpose text not null check (purpose in ('protection','ai_analysis')),
  terms_version text not null, accepted boolean not null,
  coverage text not null default 'participating_flows_only' check (coverage='participating_flows_only'),
  created_at timestamptz not null default clock_timestamp(),
  primary key(subject_id,version), unique(subject_id,version,purpose),
  check ((purpose='protection' and terms_version='protection-terms-v1') or (purpose='ai_analysis' and terms_version='ai-analysis-terms-v1'))
);
create table protection.integration_clients (
  id uuid primary key, name text not null check (length(name) between 1 and 100),
  source text not null check (source in ('synthetic','paypal_sandbox')),
  environment text not null default 'sandbox' check (environment='sandbox'),
  credential_hash text not null unique check (credential_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] not null check (scopes <@ array['links:invite','links:read']::text[]),
  enabled boolean not null default true, created_at timestamptz not null default clock_timestamp(), unique(id,source)
);
create table protection.link_invitations (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references protection.integration_clients(id),
  external_reference text not null check (external_reference ~ '^[A-Za-z0-9_-]{1,100}$'),
  expires_at timestamptz not null, consumed_by uuid references protection.subjects(id),
  created_at timestamptz not null default clock_timestamp(), unique(id,integration_id), check (expires_at=created_at+interval '15 minutes')
);
create table protection.integration_links (
  id uuid primary key default gen_random_uuid(), subject_id uuid not null references protection.subjects(id),
  integration_id uuid not null references protection.integration_clients(id),
  invitation_id uuid not null unique references protection.link_invitations(id),
  external_reference text not null check (external_reference ~ '^[A-Za-z0-9_-]{1,100}$'),
  source text not null, consent_version protection.version not null,
  consent_purpose text not null default 'protection' check (consent_purpose='protection'),
  active boolean not null default true, created_at timestamptz not null default clock_timestamp(), revoked_at timestamptz,
  foreign key(subject_id,consent_version,consent_purpose) references protection.consent_records(subject_id,version,purpose),
  foreign key(subject_id,source) references protection.subjects(id,source),
  foreign key(integration_id,source) references protection.integration_clients(id,source),
  foreign key(invitation_id,integration_id) references protection.link_invitations(id,integration_id),
  check (active = (revoked_at is null))
);
create unique index protection_active_binding on protection.integration_links(integration_id,external_reference) where active;
create index protection_links_subject on protection.integration_links(subject_id,id);
create table protection.audit_records (
  subject_id uuid not null references protection.subjects(id), sequence bigint generated always as identity,
  action text not null, policy_version protection.version not null, consent_version bigint not null,
  actor text not null check (actor in ('consumer','system')), request_id uuid not null,
  created_at timestamptz not null default clock_timestamp(), primary key(subject_id,sequence)
);
create table protection.lifecycle_requests (
  id uuid primary key default gen_random_uuid(), subject_id uuid not null references protection.subjects(id),
  kind text not null check (kind in ('export','deletion')),
  status text not null check (status in ('pending','retained','completed','expired')),
  optional_purge_requested_at timestamptz,
  retention_reasons text[] not null default '{}',
  export_snapshot jsonb, export_cutoff timestamptz,
  created_at timestamptz not null default clock_timestamp(), expires_at timestamptz,
  check (kind <> 'deletion' or optional_purge_requested_at is not null),
  check (kind <> 'export' or status='expired' or (export_snapshot is not null and export_cutoff is not null))
);
-- Future unresolved operations must reference a hold. No future payment objects are created here.
create table protection.retention_holds (
  subject_id uuid not null references protection.subjects(id), operation_id uuid not null,
  reason text not null check (reason in ('unresolved_operation','accounting','security')),
  created_at timestamptz not null default clock_timestamp(), resolved_at timestamptz,
  primary key(subject_id,operation_id)
);
create table protection.idempotency_records (
  principal text not null, operation text not null, key text not null check (length(key) between 1 and 128),
  payload_hash bytea not null, result jsonb, created_at timestamptz not null default clock_timestamp(),
  primary key(principal,operation,key)
);
create table protection.quotas (
  principal text primary key, window_start timestamptz not null, count integer not null check (count between 1 and 121)
);

-- The only definer helper has narrow, service-only session lookup authority. Do not grant
-- service_role SELECT on auth.sessions or expose this schema through PostgREST.
create function protection.authentication_time(p_owner uuid, p_session uuid)
returns timestamptz language sql volatile security definer set search_path='' set timezone='UTC' as $$
  select s.created_at::timestamptz from auth.sessions s
  where s.id=p_session and s.user_id=p_owner
    and (s.not_after is null or s.not_after > clock_timestamp())
$$;
revoke all on function protection.authentication_time(uuid,uuid) from public, anon, authenticated;
grant execute on function protection.authentication_time(uuid,uuid) to service_role;

create function protection.snapshot(p_subject uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('subjectId',s.id,'source',s.source,'status',s.status,
    'coverage','participating_flows_only','consentVersion',s.consent_version,
    'enrolled',s.enrolled,'aiConsent',s.ai_consent,
    'state',jsonb_build_object('policy',jsonb_build_object('version',p.version,'source',s.source,'currency','USD',
      'caps',jsonb_build_object('dayMinor',p.day_minor,'weekMinor',p.week_minor),
      'coolingOffUntil',p.cooling_off_until,'effectiveAt',p.effective_at),
      'pending',case when p.activates_at is null then null else jsonb_build_object('baseVersion',p.version,
        'caps',jsonb_build_object('dayMinor',p.pending_day,'weekMinor',p.pending_week),
        'confirmedAt',p.confirmed_at,'activatesAt',p.activates_at) end),
    'pendingChangeId',p.change_id)
  from protection.subjects s join protection.policy_versions p on p.subject_id=s.id and p.version=s.current_version where s.id=p_subject
$$;

-- Operator RPC is not mounted in HTTP. Provision/rotate/disable from a local privileged CLI.
create function public.protection_operator(p_id uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if p_action='provision' then
    insert into protection.integration_clients(id,name,source,credential_hash,scopes)
    values(p_id,p_data->>'name',p_data->>'source',p_data->>'credentialHash',array['links:invite','links:read']);
  elsif p_action='rotate' then
    update protection.integration_clients set credential_hash=p_data->>'credentialHash' where id=p_id;
    if not found then raise no_data_found; end if;
  elsif p_action='disable' then
    update protection.integration_clients set enabled=false where id=p_id;
    if not found then raise no_data_found; end if;
  elsif p_action='retire_responses' then
    -- Keep canonical hashes and principal/operation/key tombstones indefinitely in this phase.
    update protection.idempotency_records set result=null where created_at<clock_timestamp()-interval '90 days' and result is not null;
    update protection.lifecycle_requests set status='expired',export_snapshot=null where kind='export' and expires_at<=clock_timestamp();
  else raise invalid_parameter_value;
  end if;
  return jsonb_build_object('integrationId',p_id,'action',p_action);
end $$;

-- p_owner/p_session are derived only after /auth/v1/user verifies the same bearer token.
-- p_credential_hash is derived server-side, never supplied in public request JSON.
create function public.protection_command(p_owner uuid,p_session uuid,p_integration uuid,p_credential_hash text,
  p_source text,p_action text,p_key text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' set lock_timeout='5s' as $$
declare
  s protection.subjects; p protection.policy_versions; c protection.integration_clients;
  invitation protection.link_invitations; link protection.integration_links; life protection.lifecycle_requests;
  previous protection.idempotency_records; auth_at timestamptz; t timestamptz; ms bigint;
  actor_key text; op text; h bytea; result jsonb; data jsonb; request_id uuid:=gen_random_uuid();
  n integer; v bigint; target_day bigint; target_week bigint; change uuid; recent boolean;
  mutation boolean:=p_action not in ('read','history','links','export_read','lifecycle_read','integration_links');
begin
  if p_owner is not null and p_integration is null then
    auth_at:=protection.authentication_time(p_owner,p_session);
    if auth_at is null or auth_at > clock_timestamp() or clock_timestamp()-auth_at >= interval '24 hours' then
      return jsonb_build_object('status',401,'error','fresh_authentication_required');
    end if;
    actor_key:='consumer:'||p_owner::text;
  elsif p_owner is null and p_integration is not null then
    select * into c from protection.integration_clients where id=p_integration for share;
    if not found or not c.enabled or c.credential_hash is distinct from p_credential_hash then
      return jsonb_build_object('status',401,'error','integration_auth_required');
    end if;
    if (p_action='invite' and not ('links:invite'=any(c.scopes))) or (p_action='integration_links' and not ('links:read'=any(c.scopes)))
      or p_action not in ('invite','integration_links') then
      return jsonb_build_object('status',404,'error','not_found');
    end if;
    actor_key:='integration:'||p_integration::text;
  else return jsonb_build_object('status',401,'error','authentication_required'); end if;

  -- Transactional per-principal quotas work across API processes; serialize key resolution too.
  t:=clock_timestamp();
  insert into protection.quotas values(actor_key,t,1) on conflict(principal) do update
    set count=case when protection.quotas.window_start <= t-interval '1 minute' then 1 else least(121,protection.quotas.count+1) end,
      window_start=case when protection.quotas.window_start <= t-interval '1 minute' then t else protection.quotas.window_start end
    returning count into n;
  if n>120 then return jsonb_build_object('status',429,'error','protection_rate_limited'); end if;
  if p_owner is not null then
    auth_at:=protection.authentication_time(p_owner,p_session);
    if auth_at is null or auth_at>clock_timestamp() or clock_timestamp()-auth_at>=interval '24 hours' then
      return jsonb_build_object('status',401,'error','fresh_authentication_required'); end if;
  end if;
  op:=coalesce(p_source,c.source,'')||':'||p_action;
  if mutation then
    if p_key is null or length(p_key) not between 1 and 128 then raise invalid_parameter_value; end if;
    h:=sha256(convert_to(p_data::text,'UTF8'));
    select * into previous from protection.idempotency_records where principal=actor_key and operation=op and key=p_key;
    if found then
      if previous.payload_hash<>h then return jsonb_build_object('status',409,'error','idempotency_conflict'); end if;
      return coalesce(previous.result,jsonb_build_object('status',409,'error','idempotency_key_retired'));
    end if;
  end if;

  if p_integration is not null then
    if p_action='invite' then
      insert into protection.link_invitations(integration_id,external_reference,created_at,expires_at)
        values(c.id,p_data->>'externalReference',t,t+interval '15 minutes') returning * into invitation;
      data:=jsonb_build_object('invitationId',invitation.id,'integrationId',c.id,'integrationName',c.name,'source',c.source,'expiresAt',invitation.expires_at);
    else
      select coalesce(jsonb_agg(x),'[]') into data from
        (select id as "linkId",external_reference as "externalReference",active from protection.integration_links
          where integration_id=c.id and id::text>coalesce(p_data->>'after','') order by id limit 100) x;
    end if;
  else
    if p_source is null or p_source not in ('synthetic','paypal_sandbox') then raise invalid_parameter_value; end if;
    -- The per-owner quota lock also serializes first enrollment across both namespaces.
    if p_action='consent' and p_data->>'purpose'='protection' and (p_data->>'accept')::boolean then
      if p_data->>'termsVersion'<>'protection-terms-v1' then raise invalid_parameter_value; end if;
      insert into protection.subjects(owner_id,source) values(p_owner,p_source) on conflict(owner_id,source) do nothing;
    end if;
    select * into s from protection.subjects where owner_id=p_owner and source=p_source for update;
    if not found then return jsonb_build_object('status',404,'error','not_found'); end if;
    t:=clock_timestamp(); ms:=floor(extract(epoch from t)*1000)::bigint;
    auth_at:=protection.authentication_time(p_owner,p_session);
    if auth_at is null or auth_at>t or t-auth_at>=interval '24 hours' then
      return jsonb_build_object('status',401,'error','fresh_authentication_required'); end if;
    recent:=auth_at<=t and t-auth_at<interval '15 minutes';
    select * into p from protection.policy_versions where subject_id=s.id and version=s.current_version;
    if not found then
      if not recent then raise exception 'fresh authentication required' using errcode='PT401'; end if;
      if (p_data->>'expectedConsentVersion')::bigint is distinct from 0 or not (p_data ? 'caps') then raise invalid_parameter_value; end if;
      insert into protection.policy_versions(subject_id,version,day_minor,week_minor,effective_at,reason)
        values(s.id,1,(p_data->'caps'->>'dayMinor')::bigint,(p_data->'caps'->>'weekMinor')::bigint,ms,'enrollment') returning * into p;
    elsif p.activates_at is not null and ms>=p.activates_at then
      insert into protection.policy_versions(subject_id,version,predecessor,day_minor,week_minor,cooling_off_until,effective_at,reason)
        values(s.id,p.version+1,p.version,p.pending_day,p.pending_week,p.cooling_off_until,p.activates_at,'activation');
      update protection.policy_change_requests set status='activated' where id=p.change_id;
      update protection.subjects set current_version=p.version+1 where id=s.id returning * into s;
      select * into p from protection.policy_versions where subject_id=s.id and version=s.current_version;
      insert into protection.audit_records(subject_id,action,policy_version,consent_version,actor,request_id)
        values(s.id,'activation',p.version,s.consent_version,'system',request_id);
    end if;

    if p_action='read' then data:=protection.snapshot(s.id);
    elsif p_action='history' then
      select coalesce(jsonb_agg(x),'[]') into data from
        (select a.sequence,a.action,a.policy_version as "policyVersion",a.consent_version as "consentVersion",a.created_at as "createdAt",
          (select to_jsonb(pv) from protection.policy_versions pv where pv.subject_id=s.id and pv.version=a.policy_version) as policy,
          (select to_jsonb(cr) from protection.consent_records cr where cr.subject_id=s.id and cr.version=a.consent_version) as consent
          from protection.audit_records a where a.subject_id=s.id and a.sequence>coalesce((p_data->>'after')::bigint,0)
          order by a.sequence limit least(100,greatest(1,coalesce((p_data->>'pageSize')::int,50)))) x;
    elsif p_action='links' then
      select coalesce(jsonb_agg(x),'[]') into data from
        (select l.id as "linkId",l.integration_id as "integrationId",ic.name as "integrationName",l.active,l.created_at as "createdAt"
          from protection.integration_links l join protection.integration_clients ic on ic.id=l.integration_id
          where l.subject_id=s.id and l.id::text>coalesce(p_data->>'after','') order by l.id limit 100) x;
    elsif p_action in ('export_read','lifecycle_read') then
      select * into life from protection.lifecycle_requests where id=(p_data->>'id')::uuid and subject_id=s.id;
      if not found then return jsonb_build_object('status',404,'error','not_found'); end if;
      if life.kind='export' and life.expires_at<=t then
        update protection.lifecycle_requests set status='expired',export_snapshot=null where id=life.id returning * into life;
      end if;
      -- Exports are paginated live owned records, never stored public objects or secrets.
      if p_action='export_read' and life.kind<>'export' or p_action='lifecycle_read' and life.kind<>'deletion' then
        return jsonb_build_object('status',404,'error','not_found'); end if;
      data:=to_jsonb(life)-array['subject_id','export_snapshot'];
      if life.kind='export' and life.status<>'expired' then
        if coalesce(p_data->>'section','audit')='policies' then
          select coalesce(jsonb_agg(x),'[]') into data from (select pv.* from protection.policy_versions pv
            where pv.subject_id=s.id and pv.created_at<=life.export_cutoff and pv.version>coalesce((p_data->>'after')::bigint,0)
            order by pv.version limit 100) x;
        elsif p_data->>'section'='consents' then
          select coalesce(jsonb_agg(x),'[]') into data from (select cr.* from protection.consent_records cr
            where cr.subject_id=s.id and cr.created_at<=life.export_cutoff and cr.version>coalesce((p_data->>'after')::bigint,0)
            order by cr.version limit 100) x;
        elsif p_data->>'section'='links' then
          select coalesce(jsonb_agg(x),'[]') into data from (select l.id,l.integration_id,l.external_reference,l.created_at,
            case when l.revoked_at<=life.export_cutoff then l.revoked_at end as revoked_at
            from protection.integration_links l where l.subject_id=s.id and l.created_at<=life.export_cutoff
            and l.id::text>coalesce(p_data->>'afterLink','') order by l.id limit 100) x;
        else
          select coalesce(jsonb_agg(x),'[]') into data from (select a.* from protection.audit_records a
            where a.subject_id=s.id and a.created_at<=life.export_cutoff and a.sequence>coalesce((p_data->>'after')::bigint,0)
            order by a.sequence limit 100) x;
        end if;
        data:=(to_jsonb(life)-array['subject_id','export_snapshot'])||jsonb_build_object('protection',life.export_snapshot,
          'section',coalesce(p_data->>'section','audit'),'records',data);
      end if;
    elsif s.status<>'active' then return jsonb_build_object('status',409,'error','account_closure_pending');
    elsif p_action='consent' then
      if (p_data->>'expectedConsentVersion')::bigint is distinct from s.consent_version then
        return jsonb_build_object('status',409,'error','consent_version_conflict'); end if;
      if (p_data->>'accept')::boolean and not recent then return jsonb_build_object('status',401,'error','recent_authentication_required'); end if;
      if p_data ? 'caps' and s.consent_version>0 then return jsonb_build_object('status',409,'error','reenrollment_preserves_policy'); end if;
      if p_data->>'purpose'='ai_analysis' and (p_data->>'accept')::boolean and not s.enrolled then
        return jsonb_build_object('status',409,'error','protection_consent_required'); end if;
      insert into protection.consent_records(subject_id,version,purpose,terms_version,accepted)
        values(s.id,s.consent_version+1,p_data->>'purpose',p_data->>'termsVersion',(p_data->>'accept')::boolean);
      update protection.subjects set consent_version=s.consent_version+1,
        enrolled=case when p_data->>'purpose'='protection' then (p_data->>'accept')::boolean else enrolled end,
        ai_consent=case when p_data->>'purpose'='ai_analysis' then (p_data->>'accept')::boolean
          when not (p_data->>'accept')::boolean then false else ai_consent end where id=s.id returning * into s;
      if p_data->>'purpose'='protection' and not s.enrolled then
        if exists(select 1 from protection.consent_records where subject_id=s.id and purpose='ai_analysis' and accepted order by version desc limit 1) then
          -- Record the forced AI withdrawal separately, even though protection eligibility is independent.
          insert into protection.consent_records(subject_id,version,purpose,terms_version,accepted)
            values(s.id,s.consent_version+1,'ai_analysis','ai-analysis-terms-v1',false);
          update protection.subjects set consent_version=consent_version+1 where id=s.id returning * into s;
        end if;
        update protection.integration_links set active=false,revoked_at=t where subject_id=s.id and active;
      end if;
      data:=protection.snapshot(s.id);
    elsif p_action in ('caps','cancel','cooling_off') then
      if (p_data->>'expectedVersion')::bigint is distinct from p.version then return jsonb_build_object('status',409,'error','policy_version_conflict'); end if;
      target_day:=p.day_minor; target_week:=p.week_minor; change:=null;
      if p_action='caps' then
        target_day:=(p_data->'caps'->>'dayMinor')::bigint; target_week:=(p_data->'caps'->>'weekMinor')::bigint;
        if (target_day>p.day_minor or target_week>p.week_minor) and not recent then return jsonb_build_object('status',401,'error','recent_authentication_required'); end if;
        if (target_day>p.day_minor or target_week>p.week_minor) and not s.enrolled then return jsonb_build_object('status',409,'error','protection_consent_required'); end if;
        change:=gen_random_uuid();
        insert into protection.policy_change_requests values(change,s.id,p.version,p.version+1,target_day,target_week,ms,
          case when target_day>p.day_minor or target_week>p.week_minor then ms+86400000 end,
          case when target_day>p.day_minor or target_week>p.week_minor then 'pending' else 'effective' end);
      elsif p_action='cancel' and p.change_id is distinct from (p_data->>'id')::uuid then return jsonb_build_object('status',409,'error','pending_change_conflict');
      elsif p_action='cooling_off' and coalesce((p_data->>'days')::int,0) not in (1,7,30) then raise invalid_parameter_value;
      end if;
      if p_action in ('caps','cancel') and p.change_id is not null then
        update protection.policy_change_requests set status=case when p_action='cancel' then 'canceled' else 'superseded' end where id=p.change_id;
      end if;
      insert into protection.policy_versions(subject_id,version,predecessor,day_minor,week_minor,cooling_off_until,effective_at,
        pending_day,pending_week,confirmed_at,activates_at,change_id,reason)
      values(s.id,p.version+1,p.version,least(target_day,p.day_minor),least(target_week,p.week_minor),
        case when p_action='cooling_off' then greatest(coalesce(p.cooling_off_until,0),ms+(p_data->>'days')::bigint*86400000) else p.cooling_off_until end,ms,
        case when p_action='cooling_off' then p.pending_day when target_day>p.day_minor or target_week>p.week_minor then target_day end,
        case when p_action='cooling_off' then p.pending_week when target_day>p.day_minor or target_week>p.week_minor then target_week end,
        case when p_action='cooling_off' then p.confirmed_at when target_day>p.day_minor or target_week>p.week_minor then ms end,
        case when p_action='cooling_off' then p.activates_at when target_day>p.day_minor or target_week>p.week_minor then ms+86400000 end,
        case when p_action='cooling_off' then p.change_id when target_day>p.day_minor or target_week>p.week_minor then change end,
        p_action);
      update protection.subjects set current_version=p.version+1 where id=s.id returning * into s;
      data:=protection.snapshot(s.id)||jsonb_build_object('changeId',change);
    elsif p_action='approve_link' then
      if not recent then return jsonb_build_object('status',401,'error','recent_authentication_required'); end if;
      if not s.enrolled then return jsonb_build_object('status',409,'error','protection_consent_required'); end if;
      -- Subject first, invitation second. Invitations can be consumed only once across users/processes.
      select * into invitation from protection.link_invitations where id=(p_data->>'invitationId')::uuid for update;
      if not found or invitation.expires_at<=clock_timestamp() or invitation.consumed_by is not null then return jsonb_build_object('status',404,'error','invitation_unavailable'); end if;
      select * into c from protection.integration_clients where id=invitation.integration_id for share;
      if not c.enabled or c.source<>s.source then return jsonb_build_object('status',404,'error','invitation_unavailable'); end if;
      if invitation.expires_at<=clock_timestamp() then return jsonb_build_object('status',404,'error','invitation_unavailable'); end if;
      auth_at:=protection.authentication_time(p_owner,p_session);
      if auth_at is null or clock_timestamp()-auth_at>=interval '15 minutes' then
        return jsonb_build_object('status',401,'error','recent_authentication_required'); end if;
      if exists(select 1 from protection.integration_links where integration_id=c.id and external_reference=invitation.external_reference and active) then
        return jsonb_build_object('status',409,'error','binding_conflict'); end if;
      insert into protection.integration_links(subject_id,integration_id,invitation_id,external_reference,source,consent_version)
        values(s.id,c.id,invitation.id,invitation.external_reference,s.source,
          (select version from protection.consent_records where subject_id=s.id and purpose='protection' and accepted order by version desc limit 1)) returning * into link;
      update protection.link_invitations set consumed_by=s.id where id=invitation.id;
      data:=jsonb_build_object('linkId',link.id,'integrationId',c.id,'integrationName',c.name,'active',true);
    elsif p_action='revoke_link' then
      update protection.integration_links set active=false,revoked_at=coalesce(revoked_at,t) where id=(p_data->>'id')::uuid and subject_id=s.id returning * into link;
      if not found then return jsonb_build_object('status',404,'error','not_found'); end if;
      data:=jsonb_build_object('linkId',link.id,'active',false);
    elsif p_action in ('export','deletion') then
      if not recent then return jsonb_build_object('status',401,'error','recent_authentication_required'); end if;
      if p_action='deletion' then
        update protection.subjects set status='closure_pending',enrolled=false,ai_consent=false,consent_version=consent_version+1 where id=s.id returning * into s;
        insert into protection.consent_records(subject_id,version,purpose,terms_version,accepted) values(s.id,s.consent_version,'protection','protection-terms-v1',false);
        update protection.subjects set consent_version=consent_version+1 where id=s.id returning * into s;
        insert into protection.consent_records(subject_id,version,purpose,terms_version,accepted) values(s.id,s.consent_version,'ai_analysis','ai-analysis-terms-v1',false);
        update protection.integration_links set active=false,revoked_at=t where subject_id=s.id and active;
      end if;
      insert into protection.lifecycle_requests(subject_id,kind,status,optional_purge_requested_at,retention_reasons,expires_at,export_snapshot,export_cutoff)
        values(s.id,p_action,case when p_action='export' then 'completed' else 'retained' end,
          case when p_action='deletion' then t end,
          case when p_action='deletion' then array['policy_anti_reset','idempotency_tombstones','security_audit']||
            array(select distinct reason from protection.retention_holds where subject_id=s.id and resolved_at is null) else '{}'::text[] end,
          case when p_action='export' then t+interval '24 hours' end,
          case when p_action='export' then protection.snapshot(s.id) end,
          case when p_action='export' then clock_timestamp() end) returning * into life;
      data:=to_jsonb(life)-array['subject_id','export_snapshot'];
    else raise invalid_parameter_value;
    end if;
    if mutation then
      insert into protection.audit_records(subject_id,action,policy_version,consent_version,actor,request_id)
        values(s.id,p_action,s.current_version,s.consent_version,'consumer',request_id);
    end if;
  end if;
  result:=jsonb_build_object('status',200,'requestId',request_id,'serverTime',floor(extract(epoch from clock_timestamp())*1000)::bigint,'data',data);
  if mutation then insert into protection.idempotency_records values(actor_key,op,p_key,h,result,t); end if;
  return result;
end $$;

-- Append-only authority history; even the backend role cannot rewrite past snapshots.
do $$ declare name text; begin
  for name in select tablename from pg_tables where schemaname='protection' loop
    execute format('alter table protection.%I enable row level security',name);
    execute format('revoke all on protection.%I from public, anon, authenticated, service_role',name);
  end loop;
end $$;
grant select,insert on all tables in schema protection to service_role;
grant update on protection.subjects,protection.policy_change_requests,protection.integration_clients,
  protection.link_invitations,protection.integration_links,protection.lifecycle_requests,
  protection.retention_holds,protection.quotas to service_role;
grant update(result) on protection.idempotency_records to service_role;
grant usage on all sequences in schema protection to service_role;
revoke all on all functions in schema protection from public,anon,authenticated;
grant execute on all functions in schema protection to service_role;
revoke all on function public.protection_command(uuid,uuid,uuid,text,text,text,text,jsonb),public.protection_operator(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.protection_command(uuid,uuid,uuid,text,text,text,text,jsonb),public.protection_operator(uuid,text,jsonb) to service_role;
