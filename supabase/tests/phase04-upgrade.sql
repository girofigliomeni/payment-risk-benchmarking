-- Isolated verifier fixture ONLY: recreate the legacy checks and function comparison.
alter table public.events
  drop constraint events_check1, drop constraint events_check2,
  add constraint events_check1 check (payload->'provenance'->>'source' = source),
  add constraint events_check2 check (source <> 'paypal_sandbox' or payload->'provenance'->>'verificationStatus' = 'verified');
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.lab_command(uuid,uuid,text,jsonb)'::regprocedure);
  definition := replace(definition, 'is distinct from experiment.dataset_id', '<> experiment.dataset_id');
  definition := replace(definition, 'is distinct from experiment.seed', '<> experiment.seed');
  execute definition;
end;
$$;
insert into auth.users(id) values ('33333333-3333-4333-8333-333333333333');
insert into public.experiments(id,owner_id,name,dataset_id,seed,sealed)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','Upgrade fixture','dataset',42,true);
insert into public.events values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','synthetic','synthetic','{"eventId":"synthetic","source":"synthetic","provenance":{"source":"synthetic","datasetId":"dataset","seed":42}}'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','paypal_sandbox:capture:CAPTURE','paypal_sandbox','{"eventId":"paypal_sandbox:capture:CAPTURE","source":"paypal_sandbox","provenance":{"source":"paypal_sandbox","verificationStatus":"verified"}}');
insert into public.verified_provider_references values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','paypal_sandbox:capture:CAPTURE','CAPTURE','ORDER','CAPTURE','2026-01-01T00:00:00Z');
insert into evaluation.labels values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','synthetic','fixture','benign','train');
insert into public.detector_runs values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','rules-v1','rules',default);
insert into public.scores values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','rules-v1','synthetic','{"decision":"pass"}');
