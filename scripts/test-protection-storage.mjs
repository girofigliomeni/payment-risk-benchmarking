import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import {
  advanceProtection,
  editProtectionCaps,
  startProtectionCoolingOff,
  cancelProtectionRelaxation,
} from "../packages/core/dist/index.js";

// No hosted connection. Optional existing external PostgreSQL-compatible verifier.
if (!process.env.PHASE4_PGLITE_MODULE)
  throw new Error(
    "Set PHASE4_PGLITE_MODULE to an installed @electric-sql/pglite entrypoint",
  );
const { PGlite } = await import(
  pathToFileURL(process.env.PHASE4_PGLITE_MODULE).href
);
const db = new PGlite();
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const sa = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sb = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ia = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  ib = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const hashA = "a".repeat(64),
  hashB = "b".repeat(64);
let serial = 0,
  checks = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
const query = (sql, params = []) => db.query(sql, params);
const value = async (sql, params = []) =>
  (await query(sql, params)).rows[0].value;
async function call({
  owner = a,
  session = sa,
  integration = null,
  hash = null,
  source = "synthetic",
  action = "read",
  key = null,
  data = {},
} = {}) {
  await db.exec("set role service_role");
  try {
    return await value(
      "select public.protection_command($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as value",
      [
        owner,
        session,
        integration,
        hash,
        source,
        action,
        key,
        JSON.stringify(data),
      ],
    );
  } finally {
    await db.exec("reset role");
  }
}
const mutate = (action, data = {}, options = {}) =>
  call({ action, key: `test-${++serial}`, data, ...options });
const current = async (options = {}) => (await call(options)).data;
const consent = (accept, version, caps) => ({
  purpose: "protection",
  termsVersion: "protection-terms-v1",
  accept,
  expectedConsentVersion: version,
  ...(caps ? { caps } : {}),
});
async function denied(sql) {
  let failed = false;
  try {
    await db.exec(sql);
  } catch {
    failed = true;
  } finally {
    await db.exec("reset role");
  }
  check(failed, true, "Database ACL/constraint must reject request");
}
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz,not_after timestamptz,refreshed_at timestamptz);
    grant usage on schema public to service_role;
    alter default privileges in schema public grant all on tables to service_role,anon,authenticated;`);
  const migrations = (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations.filter((f) => !f.includes("phase06")))
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    await readFile(
      new URL("../supabase/tests/phase04-upgrade.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261027194705_phase04_provenance_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const tables = [
    "public.experiments",
    "public.events",
    "public.verified_provider_references",
    "public.detector_runs",
    "public.scores",
    "evaluation.labels",
  ];
  const snapshot = async () => ({
    rows: await Promise.all(
      tables.map((t) => query(`select * from ${t} order by 1,2`)),
    ),
    acl: await query(
      `select oid,relacl,relrowsecurity from pg_class where oid=any($1::regclass[]) order by oid`,
      [tables],
    ),
    rpc: await query(
      `select proowner,proacl,prosecdef,proconfig,pg_get_functiondef(oid) from pg_proc where oid='public.lab_command(uuid,uuid,text,jsonb)'::regprocedure`,
    ),
  });
  const before = await snapshot();
  for (const file of migrations.filter((f) => f.includes("phase06")))
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  check(
    await snapshot(),
    before,
    "Phase 6 upgrade preserves historical data, grants, labels and baseline function",
  );
  await db.exec(`create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text);
    insert into supabase_migrations.schema_migrations values('20261028022432')`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/tests/phase06-hosted-verification.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL("../supabase/tests/phase04.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(`insert into auth.users values('${a}'),('${b}');
    insert into auth.sessions(id,user_id,created_at) values('${sa}','${a}',clock_timestamp()),('${sb}','${b}',clock_timestamp());`);
  check((await call()).status, 404, "Reads never imply enrollment");
  const enrollment = consent(true, 0, { dayMinor: 100, weekMinor: 200 });
  const first = await mutate("consent", enrollment, { key: "enroll" });
  check(first.status, 200, "Explicit enrollment");
  check(
    await mutate("consent", enrollment, { key: "enroll" }),
    first,
    "Persistent idempotent enrollment replay",
  );
  check(
    (
      await mutate(
        "consent",
        { ...enrollment, caps: { dayMinor: 200, weekMinor: 300 } },
        { key: "enroll" },
      )
    ).status,
    409,
    "Changed payload/key conflict",
  );
  check(
    (await call({ owner: b, session: sb })).status,
    404,
    "Second user cannot read first subject",
  );
  await mutate("consent", enrollment, { owner: b, session: sb });
  check((await current()).state.policy.caps, { dayMinor: 100, weekMinor: 200 });
  await db.exec(
    `update auth.sessions set created_at=clock_timestamp()-interval '15 minutes' where id='${sa}'`,
  );
  check(
    (
      await mutate("caps", {
        expectedVersion: 1,
        caps: { dayMinor: 101, weekMinor: 200 },
      })
    ).status,
    401,
    "Exactly 15-minute boundary requires fresh auth",
  );
  await db.exec(
    `update auth.sessions set created_at=clock_timestamp()-interval '14 minutes' where id='${sa}'`,
  );

  let state = (await current()).state;
  let result = await mutate("caps", {
    expectedVersion: 1,
    caps: { dayMinor: 50, weekMinor: 300 },
  });
  check(
    result.data.state,
    editProtectionCaps(
      state,
      { dayMinor: 50, weekMinor: 300 },
      result.data.state.policy.effectiveAt,
      1,
    ),
    "SQL mixed-edit parity with Phase 5",
  );
  state = result.data.state;
  const originalDelay = state.pending.activatesAt;
  result = await mutate("cooling_off", { expectedVersion: 2, days: 7 });
  check(
    result.data.state,
    startProtectionCoolingOff(
      state,
      7,
      result.data.state.policy.effectiveAt,
      2,
    ),
    "SQL cooling-off parity",
  );
  check(
    result.data.state.pending.activatesAt,
    originalDelay,
    "Cooling-off does not restart delay",
  );
  state = result.data.state;
  result = await mutate("cancel", {
    expectedVersion: 3,
    id: result.data.pendingChangeId,
  });
  check(
    result.data.state,
    cancelProtectionRelaxation(state, result.data.state.policy.effectiveAt, 3),
    "SQL cancellation parity",
  );
  check(
    (
      await mutate("caps", {
        expectedVersion: 3,
        caps: { dayMinor: 1, weekMinor: 1 },
      })
    ).status,
    409,
    "Stale policy rejected",
  );
  check(
    (await current({ owner: b, session: sb })).state.policy.version,
    1,
    "Other owner unchanged",
  );

  await db.exec(
    `update auth.sessions set created_at=clock_timestamp()-interval '16 minutes',refreshed_at=clock_timestamp() where id='${sa}'`,
  );
  check(
    (
      await mutate("caps", {
        expectedVersion: 4,
        caps: { dayMinor: 60, weekMinor: 300 },
      })
    ).status,
    401,
    "Refresh cannot make increase recent",
  );
  check(
    (
      await mutate("caps", {
        expectedVersion: 4,
        caps: { dayMinor: 40, weekMinor: 150 },
      })
    ).status,
    200,
    "Tightening available without recent auth",
  );
  check(
    (await mutate("cooling_off", { expectedVersion: 5, days: 1 })).status,
    200,
    "Cooling-off available without recent auth",
  );
  result = await mutate("consent", consent(false, 1));
  check(
    result.data.enrolled,
    false,
    "Revocation available without recent auth",
  );
  check(
    (await mutate("consent", consent(true, result.data.consentVersion))).status,
    401,
    "Reenrollment requires fresh auth",
  );
  await db.exec(
    `update auth.sessions set created_at=clock_timestamp()-interval '24 hours',refreshed_at=clock_timestamp() where id='${sa}'`,
  );
  check(
    (await call()).status,
    401,
    "24-hour original age expires despite refresh",
  );
  await db.exec(
    `update auth.sessions set created_at=clock_timestamp()-interval '23 hours 59 minutes' where id='${sa}'`,
  );
  check(
    (await call()).status,
    200,
    "Normal authorized reads remain available just below 24 hours",
  );
  check(
    (await call({ session: sb })).status,
    401,
    "Session must belong to authenticated owner",
  );
  await db.exec(`update auth.sessions set created_at=null where id='${sa}'`);
  check(
    (await call()).status,
    401,
    "Missing original timestamp requires fresh sign-in",
  );
  await db.exec(
    `update auth.sessions set created_at=clock_timestamp()+interval '1 hour' where id='${sa}'`,
  );
  check((await call()).status, 401, "Future original timestamp rejected");
  await db.exec(
    `update auth.sessions set created_at=clock_timestamp(),not_after=clock_timestamp()-interval '1 second' where id='${sa}'`,
  );
  check((await call()).status, 401, "Provider session expiry enforced");
  await db.exec(`update auth.sessions set not_after=null where id='${sa}'`);
  const retained = (await current()).state;
  result = await mutate("consent", consent(true, result.data.consentVersion));
  check(
    result.data.state,
    retained,
    "Reenrollment does not reset caps/cooling-off",
  );
  check(
    (
      await mutate(
        "consent",
        consent(true, result.data.consentVersion, {
          dayMinor: 1000,
          weekMinor: 1000,
        }),
      )
    ).status,
    409,
    "Reenrollment cannot replace initial caps",
  );

  result = await mutate("caps", {
    expectedVersion: 6,
    caps: { dayMinor: 60, weekMinor: 300 },
  });
  const pendingId = result.data.pendingChangeId;
  const beforeResubmit = result.data.state;
  result = await mutate("caps", {
    expectedVersion: 7,
    caps: { dayMinor: 60, weekMinor: 300 },
  });
  check(
    result.data.state,
    editProtectionCaps(
      beforeResubmit,
      { dayMinor: 60, weekMinor: 300 },
      result.data.state.policy.effectiveAt,
      7,
    ),
    "Resubmission restarts delay",
  );
  check(
    await value(
      "select status as value from protection.policy_change_requests where id=$1",
      [pendingId],
    ),
    "superseded",
  );
  // Admin-only fixture ages a pending policy; runtime role cannot rewrite immutable history.
  await db.exec(`update protection.policy_versions set confirmed_at=floor(extract(epoch from clock_timestamp())*1000)::bigint-86400001,
    activates_at=floor(extract(epoch from clock_timestamp())*1000)::bigint-1 where subject_id='${result.data.subjectId}' and version=8;`);
  const aged = await value("select protection.snapshot($1) as value", [
    result.data.subjectId,
  ]);
  const due = await mutate("caps", {
    expectedVersion: 8,
    caps: { dayMinor: 1, weekMinor: 1 },
  });
  check(due.status, 409, "Due activation precedes expectedVersion comparison");
  const advanced = await current();
  check(
    advanced.state,
    advanceProtection(aged.state, advanced.state.policy.effectiveAt),
    "Due policy activation parity and commit on stale edit",
  );

  const aiVersion = advanced.consentVersion;
  result = await mutate("consent", {
    purpose: "ai_analysis",
    termsVersion: "ai-analysis-terms-v1",
    accept: true,
    expectedConsentVersion: aiVersion,
  });
  check(result.data.aiConsent, true, "Independent AI opt-in");
  check(result.data.state, advanced.state, "AI consent cannot change policy");
  result = await mutate("consent", consent(false, result.data.consentVersion));
  check(
    [result.data.enrolled, result.data.aiConsent],
    [false, false],
    "Protection withdrawal also stops optional AI",
  );
  const version = result.data.consentVersion;
  result = await mutate("consent", consent(true, version));
  check(
    result.data.aiConsent,
    false,
    "Reenrollment does not implicitly grant AI",
  );
  await mutate("consent", consent(true, 0, { dayMinor: 5, weekMinor: 10 }), {
    source: "paypal_sandbox",
  });
  check(
    (await current({ source: "paypal_sandbox" })).state.policy.caps,
    { dayMinor: 5, weekMinor: 10 },
    "Source namespaces isolated",
  );
  check((await current()).state.policy.caps, { dayMinor: 60, weekMinor: 300 });

  await db.exec("set role service_role");
  for (const [id, hash] of [
    [ia, hashA],
    [ib, hashB],
  ])
    await query(`select public.protection_operator($1,'provision',$2::jsonb)`, [
      id,
      JSON.stringify({
        name: "Fictional integration",
        source: "synthetic",
        credentialHash: hash,
      }),
    ]);
  await db.exec("reset role");
  const integrate = (id, hash, action, data = {}, key = null) =>
    call({
      owner: null,
      session: null,
      integration: id,
      hash,
      source: null,
      action,
      data,
      key,
    });
  check(
    (await integrate(ib, hashA, "integration_links")).status,
    401,
    "Other integration credential rejected",
  );
  check(
    (await integrate(ia, hashA, "read")).status,
    404,
    "Integrators cannot read policy",
  );
  const invite = await integrate(
    ia,
    hashA,
    "invite",
    { externalReference: "fictional-ref" },
    "invite-1",
  );
  check(
    await integrate(
      ia,
      hashA,
      "invite",
      { externalReference: "fictional-ref" },
      "invite-1",
    ),
    invite,
    "Invitation replay",
  );
  result = await mutate("approve_link", {
    invitationId: invite.data.invitationId,
  });
  check(result.status, 200, "Consumer approves invitation");
  const linkId = result.data.linkId;
  check(
    (
      await mutate(
        "approve_link",
        { invitationId: invite.data.invitationId },
        { owner: b, session: sb },
      )
    ).status,
    404,
    "Single use across consumers",
  );
  check(
    (await integrate(ib, hashB, "integration_links")).data,
    [],
    "Second integration cannot read first links",
  );
  check((await integrate(ia, hashA, "integration_links")).data.length, 1);
  check(
    (await mutate("revoke_link", { id: linkId }, { owner: b, session: sb }))
      .status,
    404,
    "Other consumer cannot revoke link",
  );
  check((await current({ owner: b, session: sb, action: "links" })).length, 0);
  check((await mutate("revoke_link", { id: linkId })).status, 200);
  const newHash = "c".repeat(64);
  await query(`select public.protection_operator($1,'rotate',$2::jsonb)`, [
    ib,
    JSON.stringify({ credentialHash: newHash }),
  ]);
  check(
    (await integrate(ib, hashB, "integration_links")).status,
    401,
    "Rotation invalidates old integration credential",
  );
  check(
    (await integrate(ib, newHash, "integration_links")).status,
    200,
    "Rotated credential works",
  );
  await query(`select public.protection_operator($1,'disable','{}')`, [ib]);
  check(
    (await integrate(ib, newHash, "integration_links")).status,
    401,
    "Disabled integration cannot read links",
  );
  const expiring = await integrate(
    ia,
    hashA,
    "invite",
    { externalReference: "expires" },
    "invite-2",
  );
  await db.exec(
    `update protection.link_invitations set created_at=clock_timestamp()-interval '16 minutes',expires_at=clock_timestamp()-interval '1 minute' where id='${expiring.data.invitationId}'`,
  );
  check(
    (await mutate("approve_link", { invitationId: expiring.data.invitationId }))
      .status,
    404,
    "Expired invitations rejected",
  );
  const wrongSource = await integrate(
    ia,
    hashA,
    "invite",
    { externalReference: "wrong-source" },
    "invite-3",
  );
  check(
    (
      await mutate(
        "approve_link",
        { invitationId: wrongSource.data.invitationId },
        { source: "paypal_sandbox" },
      )
    ).status,
    404,
    "Invitation source is operator trusted",
  );

  const exportRequest = await mutate("export");
  check(exportRequest.data.status, "completed", "Minimal export lifecycle");
  check(
    (await call({ action: "export_read", data: { id: exportRequest.data.id } }))
      .data.records.length > 0,
    true,
    "Authenticated owned export history",
  );
  for (const section of ["policies", "consents", "links"]) {
    const exported = await call({
      action: "export_read",
      data: { id: exportRequest.data.id, section },
    });
    check(exported.data.records.length > 0, true, `Owned ${section} export`);
    check(exported.data.records.length <= 100, true, "Export page bounded");
    check(
      JSON.stringify(exported).includes("credential_hash"),
      false,
      "No integration credentials in export",
    );
  }
  check(
    (
      await call({
        owner: b,
        session: sb,
        action: "export_read",
        data: { id: exportRequest.data.id },
      })
    ).status,
    404,
    "Cross-user export denied",
  );
  await db.exec(
    `insert into protection.retention_holds(subject_id,operation_id,reason) values('${advanced.subjectId}',gen_random_uuid(),'unresolved_operation')`,
  );
  result = await mutate("deletion");
  check(
    result.data.retention_reasons.includes("unresolved_operation"),
    true,
    "Unresolved operation exclusion disclosed",
  );
  check(
    result.data.retention_reasons.includes("policy_anti_reset"),
    true,
    "Restrictive policy remains retained",
  );
  check(
    (await current()).status,
    "closure_pending",
    "Deletion stops new protected activity",
  );
  check(
    (await mutate("consent", consent(true, (await current()).consentVersion)))
      .status,
    409,
    "Closure cannot reset/re-enroll",
  );
  check(
    (await current()).state,
    advanced.state,
    "Deletion retains restrictions",
  );
  await db.exec(
    `update protection.lifecycle_requests set expires_at=clock_timestamp()-interval '1 second' where id='${exportRequest.data.id}'`,
  );
  const expired = await call({
    action: "export_read",
    data: { id: exportRequest.data.id },
  });
  check(expired.data.status, "expired", "Export content expires at 24 hours");
  check("records" in expired.data, false, "Expired export contains no content");
  check(
    await value(
      "select export_snapshot is null as value from protection.lifecycle_requests where id=$1",
      [exportRequest.data.id],
    ),
    true,
    "Expired export snapshot purged",
  );
  await db.exec(
    "update protection.idempotency_records set created_at=clock_timestamp()-interval '91 days'",
  );
  await query(`select public.protection_operator($1,'retire_responses','{}')`, [
    ia,
  ]);
  check(
    (await mutate("consent", enrollment, { key: "enroll" })).error,
    "idempotency_key_retired",
    "Response expiry never makes the key reusable",
  );
  check(
    (
      await mutate(
        "consent",
        { ...enrollment, caps: { dayMinor: 1, weekMinor: 1 } },
        { key: "enroll" },
      )
    ).error,
    "idempotency_conflict",
    "Tombstone keeps canonical payload conflict",
  );

  const rls = await value(
    `select bool_and(relrowsecurity) as value from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='protection' and relkind='r'`,
  );
  check(rls, true, "RLS on every protection table");
  for (const role of ["anon", "authenticated"]) {
    await denied(`set role ${role}; select * from protection.subjects`);
    await denied(
      `set role ${role}; select public.protection_command(null,null,null,null,'synthetic','read',null,'{}')`,
    );
    await denied(
      `set role ${role}; select public.protection_operator('${ia}','disable','{}')`,
    );
  }
  await denied("set role service_role; select * from auth.sessions");
  await denied(
    "set role service_role; update protection.policy_versions set day_minor=1",
  );
  await denied("set role service_role; delete from protection.consent_records");
  await denied(
    `insert into protection.policy_versions(subject_id,version,day_minor,week_minor,effective_at,reason) values('${advanced.subjectId}',999,1,1,1,'caps')`,
  );
  check(
    await snapshot(),
    before,
    "Research foundation preserved after all protection operations",
  );
  console.log(
    `Phase 6 isolated storage: ${checks} assertions passed, including upgrade preservation, engine parity, ownership, auth age, links and lifecycle. PGlite serializes queries; multi-connection contention requires the separate PostgreSQL runner.`,
  );
} catch (error) {
  console.error("Phase 6 isolated storage failed:", error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
