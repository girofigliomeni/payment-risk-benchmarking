import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { createApp } from "../apps/api/dist/app.js";
import {
  SupabaseProtectionStore,
  credentialHash,
} from "../apps/api/dist/protection/store.js";
import {
  ProtectionStateSchema,
  editProtectionCaps,
  startProtectionCoolingOff,
  cancelProtectionRelaxation,
  advanceProtection,
} from "../packages/core/dist/index.js";

// Starts an isolated loopback-only cluster; never reads .env or accepts a remote database URL.
if (!process.env.PHASE6_PG_PACKAGE || !process.env.PHASE6_PG_CLIENT)
  throw new Error(
    "Set PHASE6_PG_PACKAGE and PHASE6_PG_CLIENT to external test-tool entrypoints",
  );
const binaries = await import(
  pathToFileURL(process.env.PHASE6_PG_PACKAGE).href
);
const { default: pg } = await import(
  pathToFileURL(process.env.PHASE6_PG_CLIENT).href
);
const directory = await mkdtemp(join(tmpdir(), "payment-risk-phase06-pg-"));
const reserve = createServer();
await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
const port = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
execFileSync(
  binaries.initdb,
  [
    "-D",
    directory,
    "-U",
    "postgres",
    "-A",
    "trust",
    "--encoding=UTF8",
    "--locale=C",
  ],
  { windowsHide: true, stdio: "pipe" },
);
const child = spawn(
  binaries.postgres,
  [
    "-D",
    directory,
    "-p",
    String(port),
    "-h",
    "127.0.0.1",
    "-c",
    "fsync=off",
    "-c",
    "max_connections=30",
  ],
  { windowsHide: true, stdio: "ignore" },
);
const connection = {
  host: "127.0.0.1",
  port,
  user: "postgres",
  database: "postgres",
  connectionTimeoutMillis: 1000,
};
const pools = [],
  servers = [];
let admin,
  checks = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const sa = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sb = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ia = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  ib = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const token = (owner, session) =>
  `fixture.${Buffer.from(JSON.stringify({ sub: owner, session_id: session, amr: [{ method: "password", timestamp: 1 }], iat: 9999999999 })).toString("base64url")}.fixture`;
const tokenA = token(a, sa),
  tokenB = token(b, sb);
const credA = `${ia}.${"a".repeat(43)}`,
  credB = `${ib}.${"b".repeat(43)}`;
const consent = (accept, expectedConsentVersion, caps) => ({
  source: "synthetic",
  purpose: "protection",
  termsVersion: "protection-terms-v1",
  accept,
  expectedConsentVersion,
  ...(caps ? { caps } : {}),
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    const client = new pg.Client(connection);
    try {
      await client.connect();
      admin = client;
      break;
    } catch {
      await client.end();
      await pause(100);
    }
  }
  if (!admin) throw new Error("Isolated PostgreSQL failed to start");
  await admin.query(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz,not_after timestamptz,refreshed_at timestamptz);
    grant usage on schema public to service_role;alter default privileges in schema public grant all on tables to service_role,anon,authenticated;`);
  for (const name of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await admin.query(
      await readFile(
        new URL(`../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  }
  await admin.query(`insert into auth.users values('${a}'),('${b}');
    insert into auth.sessions(id,user_id,created_at) values('${sa}','${a}',clock_timestamp()),('${sb}','${b}',clock_timestamp());`);
  for (const [id, credential] of [
    [ia, credA],
    [ib, credB],
  ])
    await admin.query(`select public.protection_operator($1,'provision',$2)`, [
      id,
      {
        name: "Fictional integration",
        source: "synthetic",
        credentialHash: credentialHash(credential),
      },
    ]);
  const urls = [],
    transports = [];
  for (let instance = 0; instance < 2; instance++) {
    const pool = new pg.Pool({ ...connection, max: 10 });
    pools.push(pool);
    const transport = async (url, init) => {
      if (String(url).endsWith("/auth/v1/user")) {
        const auth = init.headers.Authorization;
        return auth === `Bearer ${tokenA}` || auth === `Bearer ${tokenB}`
          ? new Response(
              JSON.stringify({
                id: auth === `Bearer ${tokenA}` ? a : b,
                email: "fictional@example.test",
                is_anonymous: false,
              }),
            )
          : new Response("{}", { status: 401 });
      }
      assert.equal(
        String(url),
        "https://fixture.test/rest/v1/rpc/protection_command",
      );
      const body = JSON.parse(init.body),
        client = await pool.connect();
      try {
        await client.query("set role service_role");
        const result = await client.query(
          "select public.protection_command($1,$2,$3,$4,$5,$6,$7,$8) as result",
          [
            body.p_owner,
            body.p_session,
            body.p_integration,
            body.p_credential_hash,
            body.p_source,
            body.p_action,
            body.p_key,
            body.p_data,
          ],
        );
        return new Response(JSON.stringify(result.rows[0].result));
      } catch (error) {
        return new Response(JSON.stringify({ code: error.code }), {
          status: 400,
        });
      } finally {
        await client.query("reset role");
        client.release();
      }
    };
    transports.push(transport);
    const server = createServer(
      createApp(
        undefined,
        undefined,
        new SupabaseProtectionStore(
          "https://fixture.test",
          "fixture-service-key",
          transport,
        ),
      ),
    );
    servers.push(server);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    urls.push(`http://127.0.0.1:${server.address().port}`);
  }
  let serial = 0;
  async function send(
    path,
    body,
    { token = tokenA, key = `key-${++serial}`, instance = serial % 2 } = {},
  ) {
    const response = await fetch(`${urls[instance]}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  const read = async (options = {}) =>
    (await send("/v1/me/protection?source=synthetic", undefined, options)).body
      .data;
  const enroll = consent(true, 0, { dayMinor: 100, weekMinor: 200 });
  const enrolls = await Promise.all([
    send("/v1/me/consents", enroll, { key: "enroll", instance: 0 }),
    send("/v1/me/consents", enroll, { key: "enroll", instance: 1 }),
  ]);
  check(
    enrolls[0],
    enrolls[1],
    "Concurrent enrollment/key replay across processes",
  );
  check(enrolls[0].status, 200);
  check((await send("/v1/me/consents", enroll, { token: tokenB })).status, 200);
  const caps = {
    source: "synthetic",
    expectedVersion: 1,
    caps: { dayMinor: 50, weekMinor: 300 },
  };
  const edits = await Promise.all(
    Array.from({ length: 8 }, (_, instance) =>
      send("/v1/me/policy-changes", caps, {
        key: `edit-${instance}`,
        instance: instance % 2,
      }),
    ),
  );
  check(
    edits.filter((r) => r.status === 200).length,
    1,
    "Only one contender can consume expectedVersion",
  );
  check(
    edits.filter((r) => r.status === 409).length,
    7,
    "Stale contenders conflict",
  );
  let state = await read();
  ProtectionStateSchema.parse(state.state);
  const pendingId = state.pendingChangeId;
  const raced = await Promise.all([
    send(
      "/v1/me/policy-changes",
      {
        source: "synthetic",
        expectedVersion: 2,
        caps: { dayMinor: 25, weekMinor: 400 },
      },
      { instance: 0 },
    ),
    send(
      `/v1/me/policy-changes/${pendingId}/cancel`,
      { source: "synthetic", expectedVersion: 2 },
      { instance: 1 },
    ),
    send(
      "/v1/me/cooling-off",
      { source: "synthetic", expectedVersion: 2, days: 7 },
      { instance: 0 },
    ),
    send("/v1/me/consents", consent(false, 1), { instance: 1 }),
  ]);
  check(
    raced.filter((r, i) => i < 3 && r.status === 200).length,
    1,
    "Mixed resubmission/cancellation/cooling-off consumes one version",
  );
  check(
    raced[3].status,
    200,
    "Revocation serializes independently of policy edits",
  );
  const revoked = await read();
  check([revoked.enrolled, revoked.aiConsent], [false, false]);
  ProtectionStateSchema.parse(revoked.state);
  const replayBody = {
    source: "synthetic",
    expectedVersion: revoked.state.policy.version,
    caps: { dayMinor: 10, weekMinor: 100 },
  };
  const replays = await Promise.all([
    send("/v1/me/policy-changes", replayBody, { key: "same", instance: 0 }),
    send("/v1/me/policy-changes", replayBody, { key: "same", instance: 1 }),
  ]);
  check(
    replays[0],
    replays[1],
    "Concurrent duplicate policy payload replays exact original envelope",
  );
  check(
    (
      await send(
        "/v1/me/policy-changes",
        { ...replayBody, caps: { dayMinor: 9, weekMinor: 100 } },
        { key: "same" },
      )
    ).status,
    409,
    "Changed payload under shared key conflicts",
  );
  state = await read();
  check(
    (await send("/v1/me/consents", consent(true, state.consentVersion))).status,
    200,
  );
  check(
    (await read()).state,
    state.state,
    "Reenrollment retains active restrictions under concurrent history",
  );
  // Independent oracle replays every successful policy history snapshot in version order.
  const snapshots = (
    await admin.query(
      "select * from protection.policy_versions where subject_id=$1 order by version",
      [state.subjectId],
    )
  ).rows;
  const asState = (row) => ({
    policy: {
      version: Number(row.version),
      source: "synthetic",
      currency: "USD",
      caps: {
        dayMinor: Number(row.day_minor),
        weekMinor: Number(row.week_minor),
      },
      coolingOffUntil:
        row.cooling_off_until === null ? null : Number(row.cooling_off_until),
      effectiveAt: Number(row.effective_at),
    },
    pending:
      row.activates_at === null
        ? null
        : {
            baseVersion: Number(row.version),
            caps: {
              dayMinor: Number(row.pending_day),
              weekMinor: Number(row.pending_week),
            },
            confirmedAt: Number(row.confirmed_at),
            activatesAt: Number(row.activates_at),
          },
  });
  for (let i = 1; i < snapshots.length; i++) {
    const row = snapshots[i],
      before = asState(snapshots[i - 1]),
      actual = asState(row),
      at = actual.policy.effectiveAt;
    let expected;
    if (row.reason === "caps") {
      const request = (
        await admin.query(
          "select * from protection.policy_change_requests where subject_id=$1 and resulting_version=$2",
          [row.subject_id, row.version],
        )
      ).rows[0];
      expected = editProtectionCaps(
        before,
        {
          dayMinor: Number(request.requested_day),
          weekMinor: Number(request.requested_week),
        },
        at,
        before.policy.version,
      );
    } else if (row.reason === "cancel")
      expected = cancelProtectionRelaxation(before, at, before.policy.version);
    else if (row.reason === "cooling_off")
      expected = startProtectionCoolingOff(
        before,
        7,
        at,
        before.policy.version,
      );
    else expected = advanceProtection(before, at);
    check(
      actual,
      expected,
      "Concurrent committed snapshots agree with pure Phase 5 oracle",
    );
  }
  check(
    (await read({ token: tokenB })).state.policy.version,
    1,
    "Second user policy unchanged",
  );
  const invitation = (
    await send(
      "/v1/integrations/link-invitations",
      { externalReference: "single-use" },
      { token: credA },
    )
  ).body.data.invitationId;
  const approvals = await Promise.all([
    send(
      "/v1/me/integration-links",
      { source: "synthetic", invitationId: invitation },
      { token: tokenA, instance: 0 },
    ),
    send(
      "/v1/me/integration-links",
      { source: "synthetic", invitationId: invitation },
      { token: tokenB, instance: 1 },
    ),
  ]);
  check(
    approvals.filter((r) => r.status === 200).length,
    1,
    "Invitation consumed once across two subject locks",
  );
  check(approvals.filter((r) => r.status === 404).length, 1);
  check(
    (await send("/v1/integrations/links", undefined, { token: credB })).body
      .data,
    [],
    "Second integration sees no other links",
  );
  // Hold the stable subject row in an independent transaction, prove an API mutation waits.
  await admin.query("begin");
  await admin.query(
    "select id from protection.subjects where id=$1 for update",
    [state.subjectId],
  );
  let completed = false;
  const blocked = send("/v1/me/cooling-off", {
    source: "synthetic",
    expectedVersion: (await read({ token: tokenB })).state.policy.version,
    days: 1,
  }).then((r) => {
    completed = true;
    return r;
  });
  await pause(100);
  check(
    completed,
    false,
    "API mutation waits for subject lock held by another connection",
  );
  await admin.query("commit");
  await blocked;
  // Stop one server and construct a fresh application/store over the retained database.
  const persisted = await read({ instance: 0 });
  await new Promise((resolve) => servers[0].close(resolve));
  const restarted = createServer(
    createApp(
      undefined,
      undefined,
      new SupabaseProtectionStore(
        "https://fixture.test",
        "fixture-service-key",
        transports[0],
      ),
    ),
  );
  servers[0] = restarted;
  await new Promise((resolve) => restarted.listen(0, "127.0.0.1", resolve));
  urls[0] = `http://127.0.0.1:${restarted.address().port}`;
  check(
    await read({ instance: 0 }),
    persisted,
    "Application/store restart preserves policy, pending delays, cooling and consent",
  );
  await admin.query("begin");
  await admin.query(
    "select id from protection.subjects where id=$1 for update",
    [persisted.subjectId],
  );
  let logoutCompleted = false;
  const logoutRace = send(
    "/v1/me/policy-changes",
    {
      source: "synthetic",
      expectedVersion: persisted.state.policy.version,
      caps: { dayMinor: 0, weekMinor: 0 },
    },
    { instance: 0 },
  ).then((result) => {
    logoutCompleted = true;
    return result;
  });
  await pause(100);
  check(
    logoutCompleted,
    false,
    "Logout-race mutation reached the subject lock",
  );
  await admin.query("delete from auth.sessions where id=$1", [sa]);
  await admin.query("commit");
  check(
    (await logoutRace).status,
    401,
    "Session revocation while waiting is rechecked before mutation",
  );
  check(
    Number(
      (
        await admin.query(
          "select current_version from protection.subjects where id=$1",
          [persisted.subjectId],
        )
      ).rows[0].current_version,
    ),
    persisted.state.policy.version,
    "Revoked waiter cannot alter policy",
  );
  console.log(
    `Phase 6 real PostgreSQL 17: ${checks} assertions passed across two API instances and independent pooled connections. Auth transport is fixture-only; hosted sign-in/browser acceptance remains pending.`,
  );
} catch (error) {
  console.error("Phase 6 PostgreSQL contention failed:", error.message);
  process.exitCode = 1;
} finally {
  if (admin) {
    await admin.query("rollback").catch(() => {});
    await admin.end();
  }
  await Promise.all(
    servers.map((s) => new Promise((resolve) => s.close(resolve))),
  );
  await Promise.all(pools.map((pool) => pool.end()));
  try {
    execFileSync(
      binaries.pg_ctl,
      ["-D", directory, "-m", "immediate", "-w", "stop"],
      { windowsHide: true, stdio: "pipe" },
    );
  } catch {
    child.kill();
  }
}
