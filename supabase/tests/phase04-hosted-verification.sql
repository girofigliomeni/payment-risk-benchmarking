-- Read-only: safe before and after deployment. Keep application writes paused when comparing fingerprints.
begin read only;
select count(*) as events,
  count(*) filter (where (e.payload->'provenance'->>'source' = e.source) is not true) as invalid_source,
  count(*) filter (where e.source='paypal_sandbox' and
    (e.payload->'provenance'->>'verificationStatus' = 'verified') is not true) as invalid_verification,
  count(*) filter (where e.source='synthetic' and
    (e.payload->'provenance'->>'datasetId' is distinct from x.dataset_id or
     (e.payload->'provenance'->>'seed')::bigint is distinct from x.seed)) as invalid_synthetic
from public.events e join public.experiments x on x.id=e.experiment_id;

with rows as (
  select 'experiments' as table_name, to_jsonb(t)::text as value from public.experiments t union all
  select 'events', to_jsonb(t)::text from public.events t union all
  select 'provider_references', to_jsonb(t)::text from public.verified_provider_references t union all
  select 'detector_runs', to_jsonb(t)::text from public.detector_runs t union all
  select 'scores', to_jsonb(t)::text from public.scores t union all
  select 'labels', to_jsonb(t)::text from evaluation.labels t
), names(table_name) as (values ('experiments'),('events'),('provider_references'),('detector_runs'),('scores'),('labels'))
select n.table_name, count(r.value) as row_count,
  md5(coalesce(string_agg(r.value, E'\n' order by r.value collate "C"),'')) as fingerprint
from names n left join rows r using(table_name) group by n.table_name order by n.table_name;

select conname, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid='public.events'::regclass and conname in ('events_check1','events_check2');
select prosecdef as security_definer, proconfig, proacl,
  position('is distinct from experiment.dataset_id' in pg_get_functiondef(oid)) > 0 as hardened_dataset,
  position('is distinct from experiment.seed' in pg_get_functiondef(oid)) > 0 as hardened_seed
from pg_proc where oid='public.lab_command(uuid,uuid,text,jsonb)'::regprocedure;

-- No rows means the optional managed function is absent. Otherwise both role
-- checks must be false and restricted_execute_grants must be zero.
select p.oid::regprocedure as function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  (select count(*) from aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a
    where a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)
      and a.privilege_type='EXECUTE') as restricted_execute_grants
from pg_proc p where p.oid=to_regprocedure('public.rls_auto_enable()');
commit;
