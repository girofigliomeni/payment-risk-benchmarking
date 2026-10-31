# Phase 6 hosted migration deployment evidence

Deployed by Codex on 2026-10-27 (America/Toronto) under the user's explicit approval of this migration and target. This records database application and read-only verification only. Phase 6 hosted Auth/browser and human acceptance remain pending; no Phase 7 work is authorized.

**Application: PASS**

- Target project: `ymsbiagwhgxultjoryzf`, confirmed against the linked project reference before application.
- Migration: `20261028022432_phase06_protection_persistence.sql`.
- SHA-256 before and after: `BAB0E22EE83E44C90BCF046AF033A18AFB4412F12FB9B56A7EB44913C7D7444E`, matching the approved [preparation record](phase06-deployment-preparation.md).
- A fresh pre-application snapshot matched the saved preparation baseline's fingerprints, table/function permissions, Auth-session permissions, event constraints and three-entry migration history. No protection schema or public protection RPC already existed.
- A new linked dry run proposed only `20261028022432_phase06_protection_persistence.sql`; seeds and role-migration arrays were empty.
- Apply command: `npx --yes supabase db push --linked --skip-vault --yes`. The final `--yes` confirmed the already approved single-migration prompt; it did not broaden the migration set.
- Exit code: **0**. The CLI reported this exact migration applied, with no seed or role migrations. Vault configuration updates were skipped.

Exact application output:

```text
Initialising login role...
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 20261028022432_phase06_protection_persistence.sql
 [Y/n] y
Applying migration 20261028022432_phase06_protection_persistence.sql...
{"upToDate":false,"dryRun":false,"migrations":["20261028022432_phase06_protection_persistence.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push."}
```

No reset, truncate, deletion, research rewrite, manual permission repair, Auth configuration change, user/integration provisioning, acceptance-record mutation, PayPal call, API/frontend deployment or additional migration was performed. All 12 protection tables were counted after deployment and contain **zero rows**, including audit, quota and idempotency tables. No protection_command/operator mutation was invoked for acceptance testing.

**Read-only hosted verification: PASS for structure and grants**

Every statement from `supabase/tests/phase06-hosted-verification.sql` was run through the connected SQL tool. Additional SELECTs checked owners, constraints, domains, empty table counts and role metadata. The first local runner attempt serialized the input incorrectly; the next split a semicolon inside a SQL comment and produced a read-only syntax error. The runner was corrected to remove full-line comments before splitting, and all ten documented statements then succeeded. These were verification orchestration errors, not migration errors; the migration was not reapplied and no hosted corrective write was attempted.

| Check | Observed result |
| --- | --- |
| Migration history | Original three Phase 4 versions plus `20261028022432 phase06_protection_persistence`; no unexpected version |
| Schema objects | 12 protection tables, three domains (`minor`, `version`, `millis`), four protection functions |
| Object ownership | All 12 new tables and four functions owned by postgres |
| RLS | Enabled on every protection table; zero browser policies, intentionally matching server-mediated access |
| Browser privileges | anon/authenticated cannot use protection schema, access its tables or execute the four functions |
| Service access | Intended schema usage/RPC execution present; no broad auth.sessions SELECT |
| Function authority | Only protection.authentication_time is SECURITY DEFINER; empty search path and UTC. Other functions are invokers; command also has five-second lock timeout |
| History immutability | Service UPDATE denied on policy, consent and audit history; tested DELETE privileges denied; idempotency payload-hash UPDATE denied while result-only UPDATE is allowed |
| Auth schema | Session id/user_id UUID; created_at/not_after timestamptz |
| Relational integrity | All 73 protection-schema constraints validated, including stable owner/source, current/predecessor policy versions, consent purpose, invitation/integration and link/source bindings |
| Invalid state counters | Invalid source links = 0; AI without protection = 0; unresolved retention holds = 0 |
| Test-data boundary | Every protection table has exact count 0; no fictional acceptance data created |

These observations establish structural ownership restrictions and the deployed service/browser permission boundary. They do **not** establish real two-user route isolation, password sign-in/refresh/logout behavior or browser acceptance. service_role intentionally bypasses RLS; backend/RPC ownership checks remain necessary. The actual API exposed-schema allowlist was not established by the null session-level pgrst.db_schemas setting and remains a separate read-only configuration check. No Auth tokens/session rows were exported.

**Historical preservation: PASS against the saved baseline**

The post-deployment snapshot at `2026-10-28T03:35:08.452294Z` (2026-10-27 23:35:08 America/Toronto) matches both the fresh pre-deployment snapshot and the saved preparation baseline for all six historical table counts/fingerprints:

| Table | Count | Fingerprint |
| --- | ---: | --- |
| experiments | 7 | `5747ae39e45040dcb409e1bc8ad5ea1a` |
| events | 39 | `ce183366343e516d11b4363d5b3fab55` |
| provider_references | 3 | `dee31d96c003946f304275af147b66d7` |
| detector_runs | 4 | `f2b5139cdda4994892c33393c29513f0` |
| scores | 35 | `173631325b5872c6bb77bccbea0fa77f` |
| labels | 0 | `d41d8cd98f00b204e9800998ecf8427e` |

Historical table owners/ACLs/RLS, lab_command and rls_auto_enable owners/definitions/configuration/ACLs, Auth-session permissions and both validated event provenance constraints are unchanged. No original acceptance evidence is retroactively certified by this comparison. Other application writers were not paused or reconfigured; the evidence is equality of the observed snapshots.

**CLI role investigation**

The pre-application snapshot captured the existing `cli_login_postgres` role with valid_until `2026-10-28T03:32:53.898829Z`. After the CLI dry-run/application sequence its valid_until was `2026-10-28T03:37:37.777438Z`. This expiry renewal was the **only visible pg_roles metadata change**. No role was added or removed, and all pg_auth_members memberships were identical before/after. The role has LOGIN, no direct SUPERUSER/BYPASSRLS flag, and existing membership in postgres granted by supabase_admin with admin_option false. It must therefore not be described as an unprivileged consumer role merely because its direct flags are false.

This is the observed CLI authentication bootstrap side effect behind `Initialising login role...`; the empty role-migration list does not mean authentication roles are untouched. Credential values were neither read nor compared, so credential rotation cannot be ruled out. No manual role cleanup, privilege change or expiry adjustment was attempted. Historical application grants and Auth-session grants remained unchanged. The role's expiration does not imply that its catalog row will be automatically deleted.

**Advisor results and unresolved findings**

Security advisors returned:

- **18 INFO** RLS-enabled tables without policies: the original six plus the 12 new server-mediated protection tables. Browser grants are denied, so these notices match the approved design. [Explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- **1 WARN** leaked password protection disabled, pre-existing and unchanged. No Auth setting was changed or warning waived. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Performance advisors returned:

- **12 INFO** unindexed foreign keys: 11 on new protection tables and the existing public.scores experiment/event FK. New findings concern integration_links (four), lifecycle_requests (one), link_invitations (two), policy_change_requests (one), policy_versions (two), and subjects (one). [Explanation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- **1 INFO** unused index `protection_links_subject`; newly empty tables have no acceptance workload yet. Do not remove it merely because it has no recorded use. [Explanation](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

These are recorded follow-up findings, not an all-clear advisor result or measured performance claim. No index, schema or grant remediation was authorized or performed after the approved migration. A future fix requires separate review/authorization and an additive migration; never edit the applied migration to hide these results.

**Evidence and remaining gate**

Saved local artifacts (ignored directory): `artifacts/phase06-hosted-deployment/pre-deployment.json`, `dry-run.txt`, `apply.txt`, `hosted-verification.json`, `post-deployment.json`, `comparison.json`, `additional-verification.json`, `integrity-and-counts.json`, `security-advisors.json`, and `performance-advisors.json`. The earlier preparation baseline remains intact. `git diff --check` and documentation consistency checks passed. Application tests were not rerun because application/migration source was unchanged; local implementation test results remain attributed to the prior audit.

Migration application and documented structural read-only verification are complete. Hosted Auth/browser functional acceptance, exposed-schema configuration confirmation, explicit advisor review and human acceptance remain outstanding. Wait for separate authorization before creating test users, integrations, invitations, links, policies or other acceptance data. Stop before Phase 7.

Subsequent evidence: controlled hosted acceptance testing was separately authorized, and [the acceptance attempt](phase06-hosted-acceptance.md) confirmed private-schema exclusion through real HTTP probes. Auth-dependent tests stopped at the email-confirmation prerequisite; no identities or protection records were created and human acceptance remains pending. The deployment record above is retained as the original deployment evidence.
