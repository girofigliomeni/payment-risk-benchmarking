# Phase 6 consent, persistence and authorization

Status, 2026-10-30: **ACCEPTED — BACKEND/STORAGE SCOPE ONLY**, by explicit human reviewer approval reported by the user. Evidence: 114 hosted checks with zero failures, 36 focused local tests, 86 storage assertions and preserved historical research data/security permissions. This is scoped milestone acceptance, not production readiness. See [human decision and deferrals](phase06-human-acceptance.md). No deferred criterion is PASS, and Phase 7 requires separate explicit authorization.

Implemented by Codex on 2026-10-27 following explicit user authorization, acceptance of Phase 5, and approval of the authentication contract. Hosted migration 20261028022432 was subsequently applied to ymsbiagwhgxultjoryzf under separate explicit approval; read-only structural verification and historical preservation checks passed. See [deployment evidence, CLI role renewal and advisor findings](phase06-hosted-deployment.md). No payment, API/frontend deployment, Auth-setting change or AI call was performed; separately authorized acceptance records are documented below. Stop before Phase 7.

The 2026-10-27 authorized [hosted acceptance attempt](phase06-hosted-acceptance.md) confirmed actual API exclusion of the private schema and anonymous privileged-RPC denial; Auth-dependent tests stopped and protection tables remained empty at that time. On 2026-10-30, the two existing confirmed accounts completed 106 main hosted assertions plus 8 follow-up checks, including real 15-minute enforcement. Authorized synthetic acceptance records, including User B's closure_pending state, are retained. Explicitly deferred and NOT VERIFIED: real hosted 24-hour authentication rejection; real elapsed-time delayed activation; real elapsed-time export expiry and exact deadline/duration assertions; interactive Phase 6 consumer UI testing; production retention and final-erasure lifecycle. Scoped acceptance does not certify these items or change existing retention behavior.

## Authentication decision and verification

The approved method is existing Supabase Auth email/password sign-in with fictional test users. Protected `/v1` consumer access requires original authentication age **strictly below 24 hours**. Sensitive grants require age **strictly below 15 minutes**. Equal-to-boundary, future, missing, expired or unverified session timestamps require fresh sign-in. Signing in again, refreshing tokens, expiration and re-enrollment never replace retained policy state.

Before implementation, Codex checked the [Supabase sessions documentation](https://supabase.com/docs/guides/auth/sessions) and [Auth session model](https://github.com/supabase/auth/blob/master/internal/models/sessions.go). Supabase associates the verified JWT `session_id` with `auth.sessions.id`; the session has an original `created_at`. Refresh changes refresh information, not that original timestamp. The existing documented password grant establishes a session; the existing experiment authentication only called `/auth/v1/user` and did not itself establish an age clock. Phase 6 adds the database lookup rather than treating JWT issuance time as recent authentication. The [changelog](https://supabase.com/changelog) was checked; current TLS deprecations do not require a change to this Node HTTPS flow.

For every consumer request, the backend verifies the **same bearer token** through Supabase `/auth/v1/user`, requires a non-anonymous email user, matching token subject, password AMR and a session UUID, then passes only the derived owner/session to the service-only RPC. `protection.authentication_time` returns only that matching session's `created_at`, subject to `not_after`. It has fixed empty search path and UTC timezone, and is the sole narrow `SECURITY DEFINER` helper because the API role must not receive access to the full Auth session table. All other protection functions use invoker rights. No `user_metadata`, JWT `iat`, account-wide `last_sign_in_at` or refresh timestamp establishes authentication age. A missing/revoked/unknown session yields `401 fresh_authentication_required`; unreachable Auth/storage yields `503`, with no cached authority or fallback. Missing/incompatible managed Auth schema blocks migration or yields unavailable, never a substituted timestamp.

The original timestamp is rechecked using database time after the subject lock for consumers. Tightening, cooling-off activation/extension, pending cancellation, protection/AI withdrawal and link revocation require normal authorized access, without the 15-minute gate. Accepting consent, initial/re-enrollment, AI opt-in, any cap increase (including mixed edits), link approval, export and deletion require recent authentication. A mixed edit rejected for old authentication applies no partial change; submit a separate tightening-only edit if desired. No sign-in UI is added in this phase; use the local password-grant procedure in [rules-storage.md](rules-storage.md), repeating sign-in for a new session rather than refreshing it to satisfy recent auth.

These checks are exercised against local Auth/session fixtures, not the hosted Auth service. Hosted sign-in, refresh and logout validation remains an explicit manual check below.

## Storage and authority

Additive CLI-created migration: `supabase/migrations/20261028022432_phase06_protection_persistence.sql` (filename uses CLI UTC time). Existing migrations and stored research records are preserved.

The private `protection` schema contains subjects, immutable policy/consent snapshots, policy change requests, integration clients/invitations/links, append-only audit, persistent idempotency records, lifecycle requests, retention holds and transactional quotas. All tables enable RLS. No browser schema/table/RPC grants exist; authenticated consumers and integrations use Express only. Do not add `protection` to PostgREST exposed schemas. Service credentials remain server-side in the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; no new application environment variable is needed.

The verified owner and source namespace identify one stable subject. Consumer-provided owner IDs, timestamps, policy state and integration credential hashes are rejected by strict Zod request schemas. Subjects/clients/links have composite source constraints; synthetic and sandbox state cannot be joined into a link or pooled. No research import becomes a protection payment fact. Integrations have only sandbox `links:invite` and `links:read` scopes; they cannot read policies/consent histories or alter consumer protections.

All consumer mutations lock the subject. Database quota locks also serialize first enrollment/idempotency resolution per owner across API instances. Integration requests lock the enabled credential record and their quota; approval locks subject, then single-use invitation, then checks the integration. Quotas allow 120 requests per principal per database minute, across API instances; there is no IP-based trust. Lock waits are bounded to five seconds; failed storage operations return unavailable. No network/model calls run inside transactions.

SQL transitions match the unchanged Phase 5 pure engine. Immediate tightening, mixed changes, explicit resubmission, cancellation, cooling-off and delayed activation preserve its version rules. Due changes materialize under lock **before** checking `expectedVersion`; an ensuing 409 retains the activation and tells the caller to reread/reconfirm. Successful no-op policy edits still increment versions. Pending increases require explicit resubmission to restart their 24-hour delay; cooling-off preserves that delay. Policy and consent versions are bounded safe integers; caps are nonnegative safe integer USD minor units.

Initial enrollment requires explicit current protection terms and both user-selected caps. Subsequent re-enrollment omits caps, retains active caps/cooling-off/pending activation and does not restore revoked links or AI consent. Consent mutations use `expectedConsentVersion` independently of policy versions. Protection withdrawal disables enrollment and AI processing, records withdrawal, revokes links and preserves policy; it never enables an unprotected fallback. Necessary dispatched reconciliation is a future-phase responsibility, not implemented here. Optional AI consent has its own purpose/terms/history and never changes eligibility. No AI processing or payment dispatch exists in Phase 6.

All POSTs require `Idempotency-Key` (1–128 letters/digits/`._:-`). Principal + source + operation + key identifies the command, with a canonical JSONB SHA-256 payload hash. Successful duplicates replay the stored envelope across sessions/processes; changed payloads conflict. Source is part of the namespace; resource IDs are part of the payload. Validation/auth/state failures do not reserve a key. A replay is a historical response, so reread current state before displaying it or confirming another edit; it is never a payment authority token. Retired successful responses retain key/hash tombstones and return 409 rather than permitting reuse.

## Phase 6 HTTP contracts

Consumer requests use `Authorization: Bearer <user access token>`. Integrator requests use a server credential instead. Success: `{ status: 200, requestId, serverTime, data }`, with serverTime in UTC epoch milliseconds. Safe error bodies contain an error code. Validation 400; authentication/recent authentication 401; origin rejection 403; not-owned/unknown 404; stale/state/idempotency conflicts 409; quota 429; unavailable/setup 503. No-store responses, a 16 KiB JSON body bound, exact supplied-origin validation and bearer-only authentication apply. Cookies do not authenticate protection routes; browser preflights permit Idempotency-Key only for `/v1`.

Every consumer body/query includes `source: synthetic | paypal_sandbox`; unknown keys are rejected. GET query values are URL parameters. All mutation fields below are required unless marked optional.

| Route | Additional input / result |
| --- | --- |
| GET `/v1/me/protection` | Current coverage/status, effective/pending state and combined consent version; no balances/payment claims. No subject before enrollment gives 404. |
| GET `/v1/me/protection/history` | Optional `after` sequence (default 0), `pageSize` 1–100 (default 50); audit entries with referenced policy/consent. Continue after the last sequence. |
| POST `/v1/me/consents` | `purpose: protection | ai_analysis`, matching `termsVersion: protection-terms-v1 | ai-analysis-terms-v1`, `accept: boolean`, `expectedConsentVersion`; `caps: {dayMinor, weekMinor}` required only on initial protection enrollment. |
| POST `/v1/me/policy-changes` | `expectedVersion`, full desired `caps`; returns immediate/pending state and changeId. |
| POST `/v1/me/policy-changes/:id/cancel` | `expectedVersion`; ID must equal current pendingChangeId. |
| POST `/v1/me/cooling-off` | `expectedVersion`, `days: 1 | 7 | 30`. |
| GET `/v1/me/integration-links` | Optional `after` link UUID; up to 100 owned links including integration name. |
| POST `/v1/me/integration-links` | `invitationId`; recent consumer approval binds the operator-selected integration/source to the current protection-consent record. |
| POST `/v1/me/integration-links/:id/revoke` | Source only; owner checked; stops new link authority. |
| POST `/v1/me/export-requests` | Source only; creates an owned bounded export with snapshot/cutoff and 24-hour retrieval lifetime. |
| GET `/v1/me/export-requests/:id` | Optional `section: policies | consents | links | audit` (default audit), `after` version/sequence (default 0), `afterLink` UUID for links; up to 100 records. Empty page ends that section. |
| POST `/v1/me/deletion-requests` | Source only; closure_pending, withdrawal of both purposes, link revocation, optional purge request and explicit retention reasons. |
| GET `/v1/me/deletion-requests/:id` | Source only; owned lifecycle/retention record. |
| POST `/v1/integrations/link-invitations` | Integrator-only `{externalReference}`: opaque fictional pseudonym, 1–100 letters/digits/underscore/hyphen. No owner/source override. Invitation expires after 15 minutes and is single-use. |
| GET `/v1/integrations/links` | Integrator-only, optional `after` UUID; up to 100 own minimal binding/status rows. No policy, warning or other-integration data. |

There are no Phase 6 quote, balance, reservation, preview, checkout, provider, warning or polished dashboard routes. The existing sandbox research checkout is preserved and remains outside protection enforcement. Phase 8 must isolate/disable its capture path before protected-demo use.

## Operator provisioning

Only the local operator CLI holds service authority. No public provisioning route exists. On a locally configured/disposable database after applying the migration, build, then run:

```powershell
npm run protection:operator -- provision fictional-integration synthetic
# Or paypal_sandbox for that isolated namespace.
npm run protection:operator -- rotate <integration-UUID>
npm run protection:operator -- disable <integration-UUID>
```

Provision/rotate deliberately emits the credential once to the local terminal; store it in the participating server's secret storage, never browser variables, transcripts, source control or chat. The database holds only SHA-256 of the cryptographically random 256-bit secret credential, its scopes and enabled state. Rotation immediately rejects the previous hash. Disable rejects all further integration authentication. Names, source and scopes cannot be supplied by a public merchant. Use invitation/approval for binding, never a merchant-supplied owner UUID. Integration credential provisioning is an external configuration action when targeting hosted Supabase and has not been performed by Codex.

## Export, deletion and retention boundaries

Exports return authenticated, owned, normalized policy/consent/link/audit pages at the request cutoff, plus the policy snapshot. Independent policy and consent sections include every transition, including forced AI withdrawal. No integration secrets, auth session records, raw provider payloads, hidden labels or other owners' data are exported. Research experiment exports and future payment activity are outside this protection-only phase. The export snapshot is removed on retrieval after expiry or by operator maintenance; subsequent pages are unavailable after 24 hours. Records underlying export remain subject to their own retention rules.

Deletion is deliberately a lifecycle request, **not completed erasure**. It immediately closes new authority for that owner/source, withdraws optional processing and records `optional_purge_requested_at`. No AI artifacts exist yet to purge. Retained restrictions/history, minimal security evidence and permanent idempotency tombstones prevent a delete/re-enroll reset while closure is pending. Minimal unresolved/accounting/security holds remain until resolved; a test fixture proves unresolved-operation exclusion. No actual unresolved payment operation is claimed. Future accounting must create/resolve holds under the same subject lock before erasure can be considered. Closure affects the selected source; request deletion separately for each enrolled namespace.

The 90-day general metadata, 30-day warning and 24-hour transient-summary periods remain the proposed future retention defaults. Policy anti-reset records, tombstones and unresolved-operation exclusions are explicit exceptions. Phase 6 does not schedule a blanket purge, delete Supabase Auth accounts, erase research evidence, certify backup erasure or finalize public enrollment/privacy terms. Those unresolved decisions remain gated in Phase 12. Closure stays pending for operator review and cannot re-enroll. Export snapshots expire in 24 hours; stored mutation response bodies can be retired after 90 days while preserving hashes/keys:

```powershell
npm run protection:operator -- retire_responses
```

Schedule/review that maintenance locally or in a later authorized deployment. No hosted job/configuration was created here. A worker for future AI-artifact purge and final deletion must consume these lifecycle records and respect holds; there is no simulated worker completion.

## Automated verification record — 2026-10-27

`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:storage`, `npm run test:protection-storage`, `npm run test:protection-concurrency` and `git diff --check` passed. Application tests: 13 files / 116 tests (108 preserved tests plus 8 Phase 6 tests). Isolated Phase 6 storage: 86 assertions. Real PostgreSQL contention: 24 assertions across two API instances and multiple independent pooled connections, including logout while a mutation waits on the subject lock; the committed mixed-edit/cancellation/resubmission/cooling-off history also matches the pure Phase 5 oracle. No invariant violation was observed in these defined runs; this is not a universal concurrency proof.

Storage checks preserve original experiment/event/reference/label/run/score contents, grants/RLS and the original lab_command definition across the additive migration and subsequent operations. Existing Phase 4 assertions are unchanged; their standalone runner adds only the minimal Auth-session scaffold needed to compile the new migration. Local PostgreSQL roles/Auth tables and Auth HTTP responses are fixtures. These results do not verify hosted PostgREST/Auth defaults, session timestamps, security advisors, browser flows or external accounts. Build initially hit sandbox esbuild `EPERM` and passed with authorized subprocess access; third-party Zod annotation warnings were non-failing.

Reproduce after `npm run build` using optional test tools outside the repository (no application dependency changes):

```powershell
$phase6Pglite = Join-Path $env:TEMP 'payment-risk-phase04-verifier'
# If absent: npm install --prefix $phase6Pglite --no-save --package-lock=false @electric-sql/pglite@0.3.14
$env:PHASE4_PGLITE_MODULE = Join-Path $phase6Pglite 'node_modules/@electric-sql/pglite/dist/index.js'
npm run test:storage
npm run test:protection-storage

$phase6Verifier = Join-Path $env:TEMP 'payment-risk-phase06-verifier'
# Windows x64 tools used for this run:
# npm install --prefix $phase6Verifier --no-save --package-lock=false --ignore-scripts @embedded-postgres/windows-x64@17.10.0-beta.17 pg@8.16.3
$env:PHASE6_PG_PACKAGE = Join-Path $phase6Verifier 'node_modules/@embedded-postgres/windows-x64/dist/index.js'
$env:PHASE6_PG_CLIENT = Join-Path $phase6Verifier 'node_modules/pg/lib/index.js'
npm run test:protection-concurrency
```

The host is Windows ARM64. npm rejected the x64 package's platform declaration, so the test-only pinned binaries were installed with `--force` and ran successfully through Windows x64 compatibility. The runner starts a fresh temporary loopback-only PostgreSQL 17 cluster, creates fictional fixtures, starts two local APIs, then stops the APIs/database; it never loads `.env` or accepts a hosted connection string. Test clusters remain in the OS temporary directory. Other platforms require compatible external PostgreSQL binary/client entrypoints. PGlite serializes queries and cannot substitute for the real multi-connection runner.

## Deferred verification and historical acceptance procedure

The migration dry run/application and read-only database checks below are recorded in [hosted deployment evidence](phase06-hosted-deployment.md); do not reapply the migration. The original checklist is retained as the historical procedure, not a new instruction to repeat completed tests or accept deferred criteria. The later hosted run and explicit scoped reviewer approval are recorded in the linked acceptance evidence. Remaining deferrals stay NOT VERIFIED; further hosted actions need their own applicable authorization. The prior local verification record above remains historical, not a claim that it performed hosted application.

1. Review the Phase 6 migration and a future linked migration **dry run**. Do not apply it without explicit approval. Account for any previously unapplied Phase 4 permission migration in history; never repair history or replay old migrations to force a push. Preserve pre/post historical table counts/fingerprints and grants using the existing Phase 4 verification SQL. No hosted dry run or application was performed in this implementation.
2. After separately approved hosted application, run `supabase/tests/phase06-hosted-verification.sql` in the project's SQL Editor as an administrator and save the results; check migration history and security advisors. All protection tables must have RLS and no browser privileges; browser schema usage/RPC/helper execution must be false. Only authentication_time should be a definer function; service_role must lack broad Auth-session SELECT and history UPDATE/DELETE. Invalid source links and AI-without-protection counts must be zero. A narrow session lookup helper is intentional; it must not acquire public execution grants. Existing advisor warnings remain separate pending evidence.
3. In **Supabase Authentication > Users**, configure two fictional email/password test users. Keep the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in local server `.env` only. Sign in with each user's password grant using the project's publishable API key as documented in rules-storage.md; never submit passwords/tokens to chat. Verify fresh sessions have a matching `auth.sessions.id/user_id/created_at` in the project SQL Editor without exporting token/session data. If schema/timestamp cannot be verified, stop and require fresh auth or fix the narrow lookup; never substitute JWT iat.
4. With fresh A/B bearer tokens, enroll each source explicitly with user-selected caps/current terms; read policies/history and try altered owner fields and B access to A's links/export/deletion IDs. Unknown owner input must be 400; non-owned resources must be 404. Verify direct browser Data API table/RPC access is denied.
5. After 15 minutes, verify reads/tightening/cooling-off/cancellation/revocation still work, while increases/re-enrollment/AI opt-in/link approval/export/deletion require new sign-in. Refresh the same session and confirm it remains non-recent; after 24 hours it must fail protected API access. Check logout removes session authority even if an access token has not expired. A new password sign-in must restore authorized access while preserving caps, cooling-off and pending timestamps.
6. Provision two fictional sandbox integrations only with separate authorization for hosted configuration. Create invitations, approve as a consenting owner within 15 minutes, confirm expiration/single-use, integration isolation, credential rotation/disable and link withdrawal. Use opaque pseudonyms only. Restart the API and verify identical policy/consent/link history persists. No PayPal action is required.
7. Review immediate/delayed edits, stale-version reread/reconfirmation, AI independence, export sections/cutoff/expiry and deletion retained/closure_pending explanations. Verify historical Phase 1–4 acceptance records remain intact. Accept Phase 6 explicitly before considering Phase 7.
