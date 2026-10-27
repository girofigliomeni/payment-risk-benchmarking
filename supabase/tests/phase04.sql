-- Run against a disposable/local database after migrations. Always rolls back fixtures.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set local role service_role;
do $$
declare
  alice uuid := '11111111-1111-4111-8111-111111111111';
  bob uuid := '22222222-2222-4222-8222-222222222222';
  a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  e jsonb := '{"eventId":"e1","actorId":"fictional-a","occurredAt":"2026-01-01T00:00:00Z","source":"synthetic","eventType":"deposit","status":"completed","amountMinor":100,"currency":"USD","provenance":{"source":"synthetic","datasetId":"dataset","seed":42,"generatorVersion":"synthetic-v1"}}';
  p jsonb := '{"eventId":"paypal_sandbox:capture:CAPTURE","actorId":"fictional-p","occurredAt":"2026-01-01T00:00:00Z","source":"paypal_sandbox","eventType":"capture","status":"completed","amountMinor":100,"currency":"USD","provenance":{"source":"paypal_sandbox","providerCaptureId":"CAPTURE","providerOrderId":"ORDER","providerEventId":"CAPTURE","verificationStatus":"verified","verifiedAt":"2026-01-01T00:00:00Z"}}';
  result jsonb;
  run jsonb := '{"version":"rules-v1","decisions":[{"eventId":"e1","detectorId":"rules","version":"rules-v1","score":0,"decision":"pass","reasons":[],"evidenceEventIds":["e1"]}]}';
begin
  perform public.lab_command(alice,a,'create','{"name":"A","datasetId":"dataset","seed":42}');
  perform public.lab_command(bob,b,'create','{"name":"B","datasetId":"dataset","seed":42}');
  perform public.lab_command(alice,a,'ingest',jsonb_build_object('events',jsonb_build_array(e,e)));
  perform public.lab_command(alice,a,'ingest',jsonb_build_object('events',jsonb_build_array(e)));
  if (select count(*) from public.events where experiment_id=a) <> 1 then raise exception 'duplicate ingestion'; end if;
  begin
    perform public.lab_command(alice,b,'read','{}');
    raise exception 'cross-owner read allowed';
  exception when no_data_found then null; end;
  begin
    perform public.lab_command(bob,a,'ingest',jsonb_build_object('events',jsonb_build_array(e)));
    raise exception 'cross-owner write allowed';
  exception when no_data_found then null; end;
  begin
    perform public.lab_command(alice,a,'ingest',jsonb_build_object('events',jsonb_build_array(
      jsonb_set(e,'{eventId}','"new"'),jsonb_set(e,'{amountMinor}','101'))));
    raise exception 'conflict accepted';
  exception when unique_violation then null; end;
  if (select count(*) from public.events where experiment_id=a) <> 1 then raise exception 'partial batch persisted'; end if;
  begin
    perform public.lab_command(alice,a,'ingest',jsonb_build_object('events',jsonb_build_array(jsonb_set(jsonb_set(e,'{eventId}','"mismatch"'),'{provenance,seed}','43'))));
    raise exception 'mixed seed accepted';
  exception when check_violation then null; end;
  result := public.lab_command(bob,b,'read','{}');
  if result <> '{"events":[]}'::jsonb then raise exception 'experiment isolation failed'; end if;
  perform public.lab_command(alice,a,'snapshot','{}');
  perform public.lab_command(alice,a,'ingest',jsonb_build_object('events',jsonb_build_array(e)));
  begin
    perform public.lab_command(alice,a,'ingest',jsonb_build_object('events',jsonb_build_array(jsonb_set(e,'{eventId}','"late"'))));
    raise exception 'late mutation accepted';
  exception when check_violation then null; end;
  result := public.lab_command(alice,a,'save',run);
  if public.lab_command(alice,a,'save',run) <> result then raise exception 'non-idempotent run'; end if;
  if (select count(*) from public.detector_runs where experiment_id=a) <> 1 or
     (select count(*) from public.scores where experiment_id=a) <> 1 then raise exception 'duplicate run'; end if;
  begin
    perform public.lab_command(alice,a,'save',jsonb_set(run,'{decisions,0,score}','1'));
    raise exception 'inconsistent score accepted';
  exception when unique_violation then null; end;
  perform public.lab_command(bob,b,'ingest',jsonb_build_object('events',jsonb_build_array(p)));
  perform public.lab_command(bob,b,'ingest',jsonb_build_object('events',jsonb_build_array(p)));
  if (select count(*) from public.verified_provider_references where experiment_id=b) <> 1 then raise exception 'duplicate capture'; end if;
  begin
    perform public.lab_command(bob,b,'ingest',jsonb_build_object('events',jsonb_build_array(jsonb_set(p,'{eventId}','"other-capture-record"'))));
    raise exception 'capture identity alias accepted';
  exception when unique_violation then null; end;
  if (select count(*) from public.events where experiment_id=b) <> 1 then raise exception 'provider alias partially persisted'; end if;
  begin
    perform 1 from evaluation.labels;
    raise exception 'scoring service can read labels';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
do $$
declare t text;
begin
  foreach t in array array['experiments','events','verified_provider_references','detector_runs','scores'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'missing RLS: %',t; end if;
    if has_table_privilege('anon','public.'||t,'SELECT') or has_table_privilege('authenticated','public.'||t,'INSERT') then raise exception 'browser table access: %',t; end if;
  end loop;
  if has_table_privilege('service_role','public.events','UPDATE') or
     has_table_privilege('service_role','public.events','DELETE') then raise exception 'mutable event grants'; end if;
  if has_function_privilege('anon','public.lab_command(uuid,uuid,text,jsonb)','EXECUTE') or
     has_function_privilege('authenticated','public.lab_command(uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'public RPC execution'; end if;
end;
$$;
rollback;
