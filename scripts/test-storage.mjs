import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

// Optional isolated PostgreSQL verifier; no project/runtime dependency or hosted writes.
// Supply the absolute entrypoint of an installed @electric-sql/pglite package.
if (!process.env.PHASE4_PGLITE_MODULE)
  throw new Error(
    "Set PHASE4_PGLITE_MODULE to an installed @electric-sql/pglite entrypoint",
  );
const { PGlite } = await import(
  pathToFileURL(process.env.PHASE4_PGLITE_MODULE).href
);
const db = new PGlite();
try {
  // Minimal Supabase role/auth scaffolding, not a replacement for hosted acceptance.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    -- New protection migrations compile against the managed Auth session table.
    -- No sessions are needed by the unchanged Phase 4 assertions below.
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id), created_at timestamptz, not_after timestamptz);
    grant usage on schema public to service_role;
    alter default privileges in schema public grant all on tables to service_role, anon, authenticated;`);
  for (const file of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (file.endsWith("_phase04_rls_auto_enable_permissions.sql")) {
      const migration = await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      );
      // Optional managed function absent on a plain PostgreSQL installation.
      await db.exec(migration);
      await db.exec(`create role rls_maintainer;
        create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin end $$;
        grant execute on function public.rls_auto_enable() to anon, authenticated, service_role, rls_maintainer;
        create event trigger phase04_rls_fixture on ddl_command_end execute function public.rls_auto_enable();`);
      const definition = () =>
        db.query(`select oid, proowner, pg_get_functiondef(oid) as definition
        from pg_proc where oid='public.rls_auto_enable()'::regprocedure`);
      const triggers = () =>
        db.query("select * from pg_event_trigger order by oid");
      const grants = () =>
        db.query(`select a.* from pg_proc p,
        lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a
        where p.oid='public.rls_auto_enable()'::regprocedure
          and a.grantee not in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)
        order by a.grantee, a.grantor, a.privilege_type`);
      const beforeDefinition = await definition();
      const beforeTriggers = await triggers();
      const beforeGrants = await grants();
      for (let attempt = 0; attempt < 2; attempt++) {
        await db.exec(migration);
        const denied =
          await db.query(`select count(*)::int as count from pg_proc p,
          lateral aclexplode(p.proacl) a where p.oid='public.rls_auto_enable()'::regprocedure
          and a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)
          and a.privilege_type='EXECUTE'`);
        assert.equal(
          denied.rows[0].count,
          0,
          "PUBLIC and browser roles must have no execution grants",
        );
        for (const role of ["anon", "authenticated"]) {
          const access = await db.query(
            `select has_function_privilege('${role}', 'public.rls_auto_enable()', 'EXECUTE') as allowed`,
          );
          assert.equal(
            access.rows[0].allowed,
            false,
            `${role} must not inherit execution`,
          );
        }
        assert.deepEqual(
          await definition(),
          beforeDefinition,
          "Function identity, owner and definition must survive",
        );
        assert.deepEqual(
          await triggers(),
          beforeTriggers,
          "Event trigger must survive unchanged",
        );
        assert.deepEqual(
          await grants(),
          beforeGrants,
          "All other grants must survive unchanged",
        );
      }
      continue;
    }
    if (file.endsWith("_phase04_provenance_hardening.sql")) {
      // Reproduce the deployed pre-hardening schema, even when the original local file is hardened.
      await db.exec(
        await readFile(
          new URL("../supabase/tests/phase04-upgrade.sql", import.meta.url),
          "utf8",
        ),
      );
      const hostedVerification = await readFile(
        new URL(
          "../supabase/tests/phase04-hosted-verification.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await db.exec(hostedVerification);
      const tables = [
        "public.experiments",
        "public.events",
        "public.verified_provider_references",
        "public.detector_runs",
        "public.scores",
        "evaluation.labels",
      ];
      const snapshot = () =>
        Promise.all(
          tables.map((table) =>
            db.query(`select * from ${table} order by 1,2`),
          ),
        );
      const before = await snapshot();
      const access = () =>
        db.query(
          "select proowner, proacl, prosecdef, proconfig from pg_proc where oid='public.lab_command(uuid,uuid,text,jsonb)'::regprocedure",
        );
      const beforeAccess = await access();
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
      assert.deepEqual(
        await snapshot(),
        before,
        "Incremental migration must preserve every stored row",
      );
      assert.deepEqual(
        await access(),
        beforeAccess,
        "Function owner, grants, invoker rights and search path must remain unchanged",
      );
      await db.exec(hostedVerification);
      // Fixtures are local only; remove them before running the independent storage suite.
      await db.exec(
        "truncate public.experiments, public.events, public.verified_provider_references, public.detector_runs, public.scores, evaluation.labels; delete from auth.users;",
      );
      continue;
    }
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  }
  await db.exec(
    await readFile(
      new URL("../supabase/tests/phase04.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log(
    "Phase 4 migration and storage assertions passed on isolated PostgreSQL (PGlite). Hosted Supabase acceptance remains required.",
  );
} finally {
  await db.close();
}
