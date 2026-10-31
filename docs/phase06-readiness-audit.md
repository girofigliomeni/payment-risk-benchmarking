# Phase 6 hosted readiness and acceptance audit

Audit date: 2026-10-27, America/Toronto. Performed by Codex at the user's explicit audit request. Phase 6 remains **unaccepted**. No Phase 7 work, hosted migration, hosted data write, Auth configuration change, integration provisioning or payment was performed. Hosted inspection used only migration-list, SELECT metadata and security-advisor tools against the locally linked project `ymsbiagwhgxultjoryzf`.

Overall acceptance: **NOT VERIFIED**. The reviewed local implementation and defined local suites pass. No deployment-blocking defect was identified in the audited paths. Hosted functional acceptance and a reviewed migration dry run remain outstanding; this report does not convert local tests into hosted evidence.

The baseline commit is `ca2b6f67c354bf369e16eb28f75538a422f5ed54` with the existing uncommitted Phase 6 working tree. Phase 6 files include untracked additions; HEAD alone does not identify the audited implementation. The reviewed migration is `20261028022432_phase06_protection_persistence.sql`, SHA-256 `BAB0E22EE83E44C90BCF046AF033A18AFB4412F12FB9B56A7EB44913C7D7444E`. Freeze/review the complete change set before deployment and repeat affected checks if it changes. This audit adds this report and an ignored local test probe; it does not repair or change application/migration behavior.

**Schema and permission inventory**

One additive migration introduces:

| Object | Purpose / authority |
| --- | --- |
| Private schema `protection` | PUBLIC/anon/authenticated schema access revoked; service_role receives USAGE. Must remain outside exposed Data API schemas. |
| Domains `minor`, `version`, `millis` | Bounded integer money, policy/consent version and epoch-time storage. |
| `subjects` | Stable authenticated owner/source identity, status, current policy/consent versions, independent enrollment/AI flags. Unique owner/source; Auth owner FK. |
| `policy_versions` | Append-only effective/pending caps, activation times, cooling-off, predecessor and reason. Deferred current-policy/change FKs handle atomic transitions. |
| `policy_change_requests` | Expected/resulting versions, requested pair, confirmation/activation time and pending/effective/canceled/superseded/activated status. |
| `consent_records` | Append-only purpose/terms/acceptance/version/time/participating-flow coverage. Separate protection and AI purposes. |
| `integration_clients` | Operator-provisioned sandbox identity/source/scopes, enabled flag and SHA-256 credential hash. |
| `link_invitations` | Integration/pseudonym, 15-minute expiry and single-use consumption. |
| `integration_links` | Consumer-approved integration binding, protection-consent reference, active/revoked state. Composite FKs enforce source and invitation/integration consistency. |
| `audit_records` | Append-only consumer/system action, versions, correlation ID and timestamp; identity sequence. |
| `lifecycle_requests` | Owned export/deletion status, export snapshot/cutoff/expiry, optional-purge request and retention reasons. |
| `retention_holds` | Explicit unresolved-operation/accounting/security retention exclusions; no payment objects are created. |
| `idempotency_records` | Principal/operation/key uniqueness, canonical payload hash, replay response or permanent tombstone. |
| `quotas` | Database-serialized per-principal rate window/counter; also serializes initial enrollment and idempotency resolution. |
| Two explicit indexes | Active integration/pseudonym binding uniqueness and subject/link paging. PK/unique constraints add their supporting indexes. |
| `protection.authentication_time(uuid,uuid)` | Narrow private SECURITY DEFINER lookup of matching Auth session creation time and not_after. Empty search path, UTC, service-only execution. |
| `protection.snapshot(uuid)` | Service-only invoker snapshot, not a public owner-authority endpoint. |
| `public.protection_command(...)` | Service-only invoker transactional consumer/integration command boundary, fixed search path/UTC and five-second lock timeout. |
| `public.protection_operator(...)` | Service-only invoker provision/rotate/disable/response-retirement operations. No Express operator route. |

All 12 new tables enable RLS with no browser policies or table grants. service_role receives SELECT/INSERT on the new tables, UPDATE on subjects/change requests/clients/invitations/links/lifecycle/holds/quotas, and only column-level UPDATE(result) on idempotency records. It receives sequence USAGE and execution of the four new functions. Policy/consent/audit history has no service UPDATE/DELETE grants. There are no DELETE/TRUNCATE grants. PUBLIC, anon and authenticated function execution is explicitly revoked, including both public RPCs.

RLS is intentionally **not** the owner-enforcement mechanism for service_role: the hosted role has BYPASSRLS, as expected. Verified identities plus explicit owner/source/link checks in the backend/RPC are the authority boundary. Possession of privileged service credentials remains outside consumer/integrator trust. The Auth session helper avoids granting this role broad SELECT on auth.sessions; hosted metadata confirms that broad grant is currently absent.

The migration contains no DROP, TRUNCATE or DELETE statement and no ALTER/UPDATE of existing research records/tables/functions or managed Auth records. ALTERs/FKs/RLS/grants affect new protection objects. Defining the operator function does not execute its response-retirement updates. Those future operations intentionally null old response bodies and expired export snapshots only in the new schema. The new Auth-owner FK can prevent deletion of an enrolled Auth user while retained records exist, consistent with the documented pending-closure lifecycle; do not bypass it through cascading deletion.

**Local versus hosted migration history**

| Version | Local file | Hosted migration history |
| --- | --- | --- |
| `20261027182656` | phase04_experiment_storage | Present, matching name |
| `20261027194705` | phase04_provenance_hardening | Present, matching name |
| `20261027200515` | phase04_rls_auto_enable_permissions | Present, matching name |
| `20261028022432` | phase06_protection_persistence | Absent; only pending local migration |

Hosted PostgreSQL reports version 17.11. The protection schema and both public protection RPCs are absent. No unexpected hosted migration version appeared. This is a version/name comparison, not a byte-for-byte comparison of historical migration bodies. No CLI push/dry run or history repair was run. The earlier Phase 4 permission-migration deployment gap is now resolved **in hosted migration history**, based on this new read-only observation; older historical records are left intact.

Hosted metadata confirms RLS on all five public research tables, no anon/authenticated table access, no browser lab_command execution, no service SELECT on evaluation.labels, and no PUBLIC execution grant on rls_auto_enable(). This is current permission evidence, not a reconstruction of an old data fingerprint baseline.

Security advisors return six INFO notices for RLS-enabled research tables without policies; that matches the intentionally server-mediated access model. The pre-existing WARN **Leaked Password Protection Disabled** remains open. No setting was changed. Review it separately before public enrollment; the Phase 6 audit neither fixes nor waives it. [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The informational RLS notice has [this explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

**Acceptance matrix**

PASS means evidence for the stated boundary exists; it does not imply the corresponding hosted flow passed. FAIL means an observed criterion violation. NOT VERIFIED means evidence is outstanding. No FAIL was observed in the reviewed/tested scope.

| Criterion | Result | Evidence / remaining boundary |
| --- | --- | --- |
| Additive, forward-only Phase 6 schema | PASS | Single new migration; no destructive existing-schema/data operations. No new Phase 5 database migration is needed. |
| Phase 1–5 compatibility | PASS locally | Upgrade fixture preserves six historical tables' contents/ACLs/RLS and lab_command definition; existing regression suites and unchanged pure policy engine pass. Actual hosted post-deployment preservation is NOT VERIFIED. |
| Migration history alignment | PASS | Three matching hosted/local Phase 4 versions; Phase 6 alone pending. |
| Hosted Auth schema compatibility | PASS | auth.sessions id/user_id are UUID; created_at/not_after are timestamptz. refreshed_at is timestamp without timezone and is not used for authority. |
| Original authentication time cannot be supplied by consumers | PASS | Exact bearer verified via /auth/v1/user before decoding matching sub/session_id/password AMR; strict bodies reject owner/time overrides; private helper selects session ID + verified owner. Hosted browser roles lack Auth-session SELECT/INSERT/UPDATE/DELETE and created_at UPDATE. No iat/AMR timestamp/user_metadata/last_sign_in_at age fallback exists. |
| 24-hour API and 15-minute sensitive-change limits | PASS locally | Database-time age checks; equality rejected; future/missing timestamps rejected; tightening/cooling-off/cancellation/revocation remain available below 24 hours without recent auth. |
| Token refresh preserves original age | PASS locally | Fresh iat/refreshed_at cannot renew the age in fixture tests. Actual hosted password-grant/refresh behavior is NOT VERIFIED. |
| Logout, missing session, expired session | PASS locally | Missing/mismatched/null/future session and not_after expiry fail closed. Real PostgreSQL test deletes the session while a mutation waits, proving post-lock recheck prevents the policy edit. Actual hosted logout is NOT VERIFIED. |
| AUTH/storage failure behavior | PASS locally | Missing configuration returns unavailable; verification/storage failure never grants cached authority. |
| Private RLS/least privilege/definer safety | PASS locally | Denied browser table/RPC/helper paths and immutable history grants; helper is the only definer, qualified static SQL, empty search path and explicit service-only execution. Deployed Phase 6 ACLs/function owner/Data API schema allowlist are NOT VERIFIED. |
| Consumer and integration isolation | PASS locally | Verified owner/source filters; non-owned link/export denial; two integrations cannot inspect each other's links or policies; strict input rejects owner injection. |
| Invitations and credentials | PASS locally | Consumer recent-auth approval, source match, single use under lock, 15-minute expiry; hashed random credential, scope/enable checks, rotation and disable tested. No hosted integration was provisioned. |
| Protection and optional AI consent | PASS locally | Independent purposes; protection withdrawal disables both and revokes active links without erasing policy; no automatic AI/link restoration or unprotected fallback. Payment enforcement remains outside Phase 6. |
| Re-enrollment preserves restrictions | PASS | Implementation updates consent only; dedicated additional local probe retained exact caps, active cooling-off and pending activation through revoke/re-enroll. Re-enrollment caps replacement is rejected. |
| Policy versions/idempotency/concurrency | PASS locally | Subject locks, expectedVersion after due activation, mixed edits/cancel/resubmission oracle, duplicate replay, changed-payload conflict and response-retirement tombstones tested across independent connections/API instances. |
| Export/deletion lifecycle within Phase 6 scope | PASS locally | Owned bounded cutoff exports, independent consent history, 24-hour retrieval expiry, no secrets/labels; deletion withdraws authority, revokes links and stays retained/closure_pending with unresolved-operation exceptions. This is not completed erasure. |
| Automatic retention/purge and final erasure | NOT VERIFIED / deferred | Expiry blocks retrieval, but physical snapshot cleanup is lazy or operator-triggered; response retirement needs operator maintenance. No scheduler, AI-artifact worker, Auth-account deletion or backup-erasure guarantee exists. These documented limits are not tested as implemented automation. |
| Hosted dry run and migration execution | NOT VERIFIED | CLI options were inspected only. No push, temporary login-role initialization or migration application was requested through the CLI. |
| Real hosted Auth/browser/two-user/two-integration acceptance | NOT VERIFIED | Fixture tests cannot establish these results. Requires explicitly authorized bounded acceptance writes and local credentials. |
| Historical hosted data preservation | NOT VERIFIED | Needs a new pre-deployment baseline with writes paused and an equal post-deployment comparison; this audit did not fabricate an old fingerprint baseline. |
| Human Phase 6 acceptance | NOT VERIFIED | Remains pending; no acceptance status changed. |

Implementation evidence: [migration](../supabase/migrations/20261028022432_phase06_protection_persistence.sql), [verified identity/RPC adapter](../apps/api/src/protection/store.ts), [strict routes](../apps/api/src/protection/routes.ts), [shared schemas](../packages/core/src/protection-storage.ts), [operator tool](../apps/api/src/protection/operator.ts), [original guide](phase06-storage.md).

**Retention and audit qualifications**

Successful idempotency replays return a historical response before reevaluating the requested mutation; they do not reactivate consent or links. Callers must reread current policy. Retiring response bodies preserves key/hash tombstones. Source is part of the operation namespace. Failed requests do not consume an idempotency key.

Protection withdrawal records forced AI withdrawal when applicable and revokes active links; re-enrollment does not restore either. The compact history route references the latest consent version for each audit action. A forced pair of protection/AI withdrawals can therefore appear as one action referencing its final AI record; the export's independent consent section contains both immutable transitions. Review that distinction during human acceptance; the compact audit view is not the complete consent-record export.

Deletion is source-specific and remains pending/retained, preserving anti-reset controls and necessary audit/idempotency/correlation records. Request each enrolled source separately. New mutations, including a new export request, are rejected after closure_pending; an existing unexpired export can still be read. If a consumer needs an export, request it before deletion. Final closure/erasure, backup/provider retention and a future worker remain separate decisions, not hidden completed work. No live unresolved operation or AI artifact is implied by local retention fixtures.

**Commands and observed results**

| Check | This audit run |
| --- | --- |
| `npm run typecheck` | PASS, all workspaces |
| `npm run lint` | PASS |
| `npm run build` | PASS with authorized local subprocess access; non-failing third-party Zod annotation warnings |
| `npm test` | PASS, 13 files / 116 tests |
| `npm run test:storage` | PASS, existing isolated Phase 4 assertions |
| `npm run test:protection-storage` | PASS, 86 assertions |
| `npm run test:protection-concurrency` | PASS, 24 assertions using isolated PostgreSQL 17, two APIs and pooled independent connections |
| `node artifacts/phase06-audit-probes.mjs` | PASS, 88 assertions: original 86 plus active-pending fixture/preservation checks across revoke/re-enroll |
| `git diff --check` | PASS |
| Hosted migration-list/metadata/advisors | Read-only observations described above; no credentials or Auth session rows retrieved |

The extra probe is an ignored copy of the isolated storage verifier with two additional assertions; application source, migrations and existing tests were not changed by the audit. Tests use fixture Auth tables/responses, not real hosted tokens. Temporary local PostgreSQL clusters were stopped after testing. These runs establish no hosted/browser/payment success.

**Ordered hosted deployment and acceptance plan**

1. Freeze the reviewed local change set and verify the migration hash above. Confirm the target is `ymsbiagwhgxultjoryzf`, hosted history still has exactly the three Phase 4 entries, and no protection schema/function collision has appeared. Do not use include-all, history repair, reset or seed flags to force a mismatch through. Keep the service key only in backend `.env`; keep `CHECKOUT_ORIGIN` exact. Do not expose the protection schema through the Data API or configure a VITE service credential.
2. Prepare a new administrative pre-deployment record using `supabase/tests/phase04-hosted-verification.sql`, with ingestion/baseline writes paused for the comparison. Save actual counts/fingerprints and ACL/function/constraint results. Review backup/recovery availability for this sandbox project. This establishes a fresh baseline, not missing historical evidence. Use current CLI help to review a linked dry run with **vault updates skipped**:

   ```powershell
   npx supabase migration list --linked
   npx supabase db push --linked --skip-vault --dry-run
   ```

   The dry run must propose **only** `20261028022432_phase06_protection_persistence.sql`. Stop on any additional/replayed migration, mismatch, unexpected role/configuration operation or missing local CLI access. Do not request secrets in chat. No dry run has been executed by this audit; review CLI authentication/temporary-role behavior before using it under the current no-hosted-changes restriction.
3. **Explicit approval gate before any hosted change.** Present the exact dry-run output, reviewed migration and baseline. Obtain approval specifically for this migration. Account/Auth settings changes, fixture provisioning, integration provisioning and acceptance mutations are separate scopes; do not infer their approval from migration approval. The eventual command is `npx supabase db push --linked --skip-vault`, with no role/seed/include-all flags. It is a plan, not an executed command.
4. After approved application, inspect hosted history and run `supabase/tests/phase06-hosted-verification.sql` as administrator. Save all results. Require RLS on 12 new tables; no browser schema/table/function authority; service-only RPC/helper execution; only authentication_time as SECURITY DEFINER; qualified fixed-path helper; immutable policy/consent/audit grants; no broad Auth-session SELECT; and zero invalid source links/AI-without-protection rows. Verify the helper owner has the intended narrow managed-session read authority. Confirm protection is absent from the exposed-schema allowlist. Re-run security advisors and explicitly distinguish expected no-policy INFO notices and pre-existing password-protection WARN from new findings.
5. Re-run the Phase 4 verification SQL while comparison writes remain paused. All six historical table counts/fingerprints and intended grants/RLS/constraints/function properties must match the saved baseline. Stop new protection enrollment if checks fail; investigate and use an additive forward fix. Do not delete retained data, cascade-drop the schema, rewrite old migrations or repair migration history as a rollback shortcut. Resume research writes only after comparing evidence.
6. For functional acceptance, obtain separate authorization for bounded fictional test-user/integration and protection-record writes. Use **Supabase Authentication > Users** for two email/password identities, and local password grants with the publishable key. Keep passwords, access/refresh tokens and service/integrator credentials local. Check the fresh token's matching session ID/owner and original created_at privately, without exporting rows/tokens. Start the local built API against the approved hosted schema using existing server variables; do not deploy API/frontend services as part of database approval.
7. Execute the guide's two-user tests: explicit initial consent/caps in each source, strict owner-field rejection (400), non-owned link/export/deletion denial (404), direct browser table/RPC denial, independent AI consent, expectedVersion conflict/reread and due activation. After 15 minutes, confirm fresh sensitive grants/increases fail while protective edits remain available. Refresh the same session and prove neither clock renews. At 24 hours verify API denial; verify hosted logout removes authority despite an unexpired token, and a fresh password sign-in preserves policy. Do not edit hosted timestamps or use a short timer as proof of the actual 24-hour check.
8. With separately approved operator provisioning, test two scoped integrations, pseudonymous invitations, 15-minute expiry, single-use approval, cross-integration isolation, revoke/rotate/disable, and API restart persistence. Preserve pending increase timestamps and active cooling-off across revocation/re-enrollment. Inspect owned policy/consent history. No PayPal action is needed or authorized.
9. Review export sections/paging/cutoff/24-hour access expiry; request exports before deletion. Confirm deletion reports retained/closure_pending, disables enrollment/AI/links, prevents reenrollment reset and preserves necessary records/holds. Review physical-cleanup/operator maintenance and final-erasure limitations with the user. Do not invent unresolved payments or claim a future purge worker ran.
10. Present actual hosted command/status results, advisor output and manual acceptance evidence. The user must accept Phase 6 explicitly. Stop before Phase 7; no future phase is authorized by migration success or this audit.

This audit supplies the concrete migration and deployment/verification boundaries for review. Hosted changes remain on hold pending the stated explicit approval gate.
