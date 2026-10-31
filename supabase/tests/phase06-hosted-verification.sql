-- Read-only administrative inspection after a separately approved hosted migration.
-- No fixture writes, tokens, credentials, owner IDs or payment payloads are returned.
-- Save actual results; this file is not evidence that hosted acceptance passed.
select version from supabase_migrations.schema_migrations
where version='20261028022432';

select table_name,column_name,data_type from information_schema.columns
where table_schema='auth' and table_name='sessions'
and column_name in ('id','user_id','created_at','not_after') order by column_name;

select c.relname as table_name,c.relrowsecurity as rls_enabled,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_table_access,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_table_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='protection' and c.relkind='r' order by c.relname;

select r.rolname,has_schema_privilege(r.rolname,'protection','USAGE') as private_schema_usage
from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by r.rolname;

select p.oid::regprocedure as function_name,p.prosecdef as security_definer,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='protection' or (n.nspname='public' and p.proname in ('protection_command','protection_operator'))
order by n.nspname,p.proname;

select has_table_privilege('service_role','protection.policy_versions','UPDATE') as mutable_policy_history,
  has_table_privilege('service_role','protection.consent_records','UPDATE') as mutable_consent_history,
  has_table_privilege('service_role','protection.audit_records','UPDATE') as mutable_audit_history,
  has_table_privilege('service_role','protection.consent_records','DELETE') as deletable_consent_history,
  has_table_privilege('service_role','auth.sessions','SELECT') as broad_auth_session_access;

select source,status,count(*) as subject_count from protection.subjects group by source,status order by source,status;
select count(*) as invalid_source_links from protection.integration_links l
join protection.subjects s on s.id=l.subject_id join protection.integration_clients c on c.id=l.integration_id
where l.source<>s.source or l.source<>c.source;
select count(*) as ai_without_protection from protection.subjects where ai_consent and not enrolled;
select count(*) as unresolved_retention_holds from protection.retention_holds where resolved_at is null;
