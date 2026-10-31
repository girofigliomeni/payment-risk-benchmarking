# Phase 6 deployment preparation evidence

Prepared by Codex on 2026-10-27 (America/Toronto), under the user's authorization for read-only baseline capture and linked migration dry run only. No migration was applied, no test users/integrations/acceptance data were created, no Auth setting or application grant was changed manually, and no Phase 7 work was performed. Phase 6 acceptance remains pending.

**Reviewed target and frozen change set**

- Linked project reference: `ymsbiagwhgxultjoryzf`, confirmed from local Supabase link metadata and hosted migration queries.
- Migration: `supabase/migrations/20261028022432_phase06_protection_persistence.sql`.
- Version: `20261028022432`.
- SHA-256: `BAB0E22EE83E44C90BCF046AF033A18AFB4412F12FB9B56A7EB44913C7D7444E`.
- Hash matches the [readiness audit](phase06-readiness-audit.md). The migration still defines the same 12 private tables, three domains and four functions, with the audited service-only authority and no destructive historical-data operation.
- A hash manifest covers 12 relevant documentation, migration, core/auth/storage/router/operator/bootstrap and verification files. All hashes matched after the dry run. Files were frozen by content manifest, not by changing file permissions, committing, stashing or overwriting the existing working tree.
- Baseline HEAD remains `ca2b6f67c354bf369e16eb28f75538a422f5ed54` plus the existing uncommitted Phase 6 change set. HEAD alone does not contain or identify all reviewed additions.

**Fresh hosted baseline**

A single read-only SELECT captured a consistent statement snapshot at `2026-10-28T03:27:18.245549Z` (2026-10-27 23:27:18 America/Toronto). It returned counts/fingerprints and metadata, not raw event bodies, labels, credentials or Auth session rows. Application processes were not stopped or reconfigured; this is a fresh observed snapshot, not an assertion that unrelated writers were paused.

| Historical table | Count | MD5 fingerprint using the existing Phase 4 row serialization/order |
| --- | ---: | --- |
| experiments | 7 | `5747ae39e45040dcb409e1bc8ad5ea1a` |
| events | 39 | `ce183366343e516d11b4363d5b3fab55` |
| provider_references | 3 | `dee31d96c003946f304275af147b66d7` |
| detector_runs | 4 | `f2b5139cdda4994892c33393c29513f0` |
| scores | 35 | `173631325b5872c6bb77bccbea0fa77f` |
| labels | 0 | `d41d8cd98f00b204e9800998ecf8427e` |

All three invalid-provenance counters were zero. Both event provenance constraints were validated. Table owners/ACLs/RLS, lab_command and rls_auto_enable definitions' hashes/owners/ACLs/configuration, Auth session column types and session-table permissions were captured. RLS was enabled on all six historical tables; browser table/RPC authority remained denied and service_role could not read labels or Auth sessions. The protection schema/public protection RPCs were absent.

Hosted migration history before and after the dry run contained exactly:

```text
20261027182656 phase04_experiment_storage
20261027194705 phase04_provenance_hardening
20261027200515 phase04_rls_auto_enable_permissions
```

The only pending local version was `20261028022432`. Hosted PostgreSQL reports 17.11. Required auth.sessions columns remain compatible. The session-level `pgrst.db_schemas` setting was null in this inspection, so it does not establish the actual exposed-schema allowlist; that dashboard/API configuration remains a later verification step.

Security advisors before and after the dry run returned the same categories/counts: six INFO notices for RLS without browser policies, plus the existing WARN for leaked password protection disabled. No settings were changed. See [password-protection remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [RLS informational notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). These are advisor observations, not a complete export of Auth configuration.

**Exact dry-run command and output**

The installed CLI help confirmed `--dry-run` does not apply migrations and that `--skip-vault` avoids updating vault configuration. The command was invoked through npx, using the existing linked project, without role/seed/include-all flags:

```powershell
npx --yes supabase db push --linked --skip-vault --dry-run
```

Exit code: **0**. Captured CLI output:

```text
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Would push these migrations:
 • 20261028022432_phase06_protection_persistence.sql
{"upToDate":false,"dryRun":true,"migrations":["20261028022432_phase06_protection_persistence.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push."}
```

The target was the existing linked `ymsbiagwhgxultjoryzf` project. Exactly the expected filename was proposed. No unexpected migration, seed or role migration was listed; vault updates were skipped. No apply command was run.

**Post-run comparison and caveat**

At `2026-10-28T03:28:38.769484Z`, a second read-only snapshot matched all six historical counts/fingerprints, table security metadata, existing function definitions/ACLs/configuration, Auth session permissions and migration history. Protection schema existence remained false and public protection RPC count remained zero. All 12 frozen local file hashes remained unchanged. No discrepancy with the reviewed migration or pending-version set was found.

The CLI did print `Initialising login role...`. A post-run metadata query observed a non-superuser, non-BYPASSRLS `cli_login_postgres` login role with `valid_until = 2026-10-28T03:32:53.898829Z`. Its state was not captured before the run, so this evidence cannot prove that CLI authentication initialization had zero transient role/credential side effects. No credential value was inspected or recorded, and no manual role creation, permission change or cleanup was attempted. The empty `roles` array refers to proposed role migrations; it does not prove the absence of CLI authentication setup. This caveat qualifies any blanket claim of zero hosted role effects; verified application/data/schema ACLs and migration state remained unchanged.

**Saved local evidence**

These files are under the existing ignored artifacts directory; retain them locally for the eventual pre/post deployment comparison:

- `artifacts/phase06-deployment-preparation/frozen-files.json`
- `artifacts/phase06-deployment-preparation/hosted-baseline.json`
- `artifacts/phase06-deployment-preparation/dry-run.txt`
- `artifacts/phase06-deployment-preparation/post-dry-run.json`
- `artifacts/phase06-deployment-preparation/comparison.json`

Preparation checks: migration hash/audit match PASS; only expected pending version PASS; linked target match PASS; dry-run exit/output PASS; historical/application permission and fingerprint comparisons PASS; local frozen-file comparison PASS; `git diff --check` PASS. Application checks were not rerun because this preparation made no implementation change; their prior audit results remain separately attributed. Hosted functional and human acceptance remain NOT VERIFIED.

**Approval gate**

Stop here. Applying `20261028022432_phase06_protection_persistence.sql` to `ymsbiagwhgxultjoryzf` requires explicit deployment approval. That approval must not be interpreted as approval for Auth settings changes, integration/user provisioning, acceptance-data writes, API/frontend deployment or Phase 7. Recheck target/history/hash and capture a new baseline if time or concurrent writes make this snapshot stale before any future approved application. Follow the audit's post-migration verification plan; do not repair migration history, replay old migrations or erase retained records to force deployment.
