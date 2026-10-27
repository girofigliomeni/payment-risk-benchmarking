# Phase 4: rules baseline and experiment storage

The baseline is a deterministic research signal. It does not approve, decline, capture or reverse payments. Synthetic decisions do not demonstrate real-world detection performance. There are no AI calls, benchmark metrics or detector comparisons.

## Features and rules (`rules-v1`)

The detector accepts only `ObservablePaymentEvent`: no seed, dataset, generator metadata, scenario name, label or split. Events sort by parsed virtual timestamp, then event ID using ordinal string comparison. Equal timestamps use this ID order; later IDs at that timestamp are unavailable to earlier decisions. Duplicate inference IDs are rejected. History is partitioned by actor, currency and source. Amounts are never compared across currencies or between synthetic and sandbox history.

| Feature / rule ID | Definition and inclusive flag threshold |
| --- | --- |
| Transaction velocity / `velocity` | Count completed or failed attempts (deposit, withdrawal or capture) in the preceding 300 seconds, including the current terminal attempt. Flag at **5 or more**. Pending, cancelled and order-created events do not count. |
| Failure ratio / `failure_ratio` | Failed attempts divided by the same 300-second terminal-attempt count. Flag at **at least 1/2**, with **at least 4** attempts. Zero/insufficient history does not flag. |
| Amount deviation / `amount_deviation` | Current completed terminal amount compared with the mean of prior completed events of the same event type in the preceding 24 hours. Require **at least 3** prior events and a positive mean. Flag at **at least 3 times** that mean. Compare integer sums by BigInt cross multiplication, without rounding or floating-point money arithmetic. Current amount is excluded from its baseline. |
| Timing / `rapid_withdrawal` | Current completed withdrawal following a completed deposit within **30 seconds**, including simultaneous timestamps when the deposit precedes it in canonical ordering. Failed/pending deposits do not count. |

Each decision contains `detectorId`, version, event ID, score, decision, evidence IDs, four explicit rule evaluations and structured triggered reasons. Every evaluation contains its rule ID, observed value, threshold, supporting event IDs and trigger status, including for pass decisions. Pass decisions have an empty triggered reasons list; their evaluations explain insufficient history or unmet thresholds. Score is the number of triggered rules divided by four; any triggered rule flags. This score is an ordinal rule signal, not a probability of fraud. Threshold changes require a new rules version. No local clock or external service affects rule results.

The hand-designed development templates influenced these rules. This is a leakage risk for any later benchmark using those templates. Current saved labels are training/development labels; no held-out evaluation or performance claim is made here.

## Storage and access

Migration: `supabase/migrations/20261027182656_phase04_experiment_storage.sql`.

Incremental hardening: `supabase/migrations/20261027194705_phase04_provenance_hardening.sql`.

Final permission cleanup: `supabase/migrations/20261027200515_phase04_rls_auto_enable_permissions.sql` records the already-performed hosted revocation of `EXECUTE` on `public.rls_auto_enable()` from `PUBLIC`, `anon` and `authenticated`. Reapplying it is safe. If the optional managed function is absent, it does nothing. It preserves the function definition, identity, ownership, event trigger and all other grants; it does not use `CASCADE`. Isolated regression coverage checks absence, initial revocation, repeat application, effective browser permissions and preservation of other grants and trigger metadata. This file has not been applied to the hosted database by Codex.

### Final cleanup acceptance status (2026-10-27)

The user reports provenance hardening deployed and verified: both constraints validated, dataset/seed validation hardened, 39 events, RLS on all five public experiment tables, no direct anon/authenticated table privileges, and `rls_auto_enable()` execution revoked from the three restricted roles. The only reported advisor warning is leaked password protection disabled. These are user-provided hosted results, separate from local test evidence. The deployment instructions below are retained as the provenance-hardening procedure, not a request to repeat the deployment.

No saved pre-deployment fingerprint output was found in repository files or local `artifacts`/`state` files during cleanup. Event count alone cannot establish content preservation. If the saved SQL Editor output is available elsewhere, compare every count and fingerprint from `supabase/tests/phase04-hosted-verification.sql` with that baseline while application writes are paused. Do not reconstruct a supposed pre-deployment baseline from current rows.

For the remaining PayPal import retry acceptance:

1. Keep the API process and the original checkout browser session running. Use the original hostname/origin (`http://127.0.0.1:5173` by default). Obtain the **existing imported experiment UUID** from prior acceptance evidence; do not run `artifacts/import-verified-browser.js`, which creates a new experiment.
2. Confirm `GET /sandbox/session` with same-origin credentials still returns a verified sandbox event. If the cookie/session expired or the API restarted, stop and mark the browser retry pending; use persisted evidence for read-only inspection. Do not initiate another payment for this check.
3. Obtain a valid **owning user's** `EXPERIMENT_ACCESS_TOKEN` locally through Supabase Auth (Authentication > Users identifies the test account; the sign-in procedure below uses its local credentials). Never use the service-role key or share tokens. Read `GET /experiments/<existing-id>` with that bearer token and record its `events.length` as the current total; record the existing event/reference counts in the SQL Editor.
4. From the original browser origin, send `POST /sandbox/experiments/<existing-id>/verified` **twice**, each with `credentials: 'same-origin'`, `Authorization: Bearer <user token>`, `Content-Type: application/json` and body `{}`. Both must succeed and return the original total `eventCount`, including when the experiment is already sealed. Inspect the owned experiment again: the same event must retain `paypal_sandbox` and verified provenance. Event/reference counts must be unchanged, with one reference for that capture in that experiment.
5. Send `POST /sandbox/experiments/<existing-id>/baseline` with the same headers, credentials and `{}` twice through the Vite proxy; compare complete returned decisions for equality. Confirm one stored detector run per version and one score per event/version. Retain the actual response/count evidence. This cleanup did not execute browser acceptance.

The permission migration still needs a future user-authorized deployment to record migration history, even though the hosted ACL repair is already reported complete. Review a dry run before that deployment. Leaked password protection is a separate Supabase Auth dashboard configuration warning, not fixed by this SQL migration.

The provenance-hardening migration replaces only `events_check1`, `events_check2` and the `lab_command` definition. Provenance source and sandbox verification checks require SQL true; synthetic dataset/seed comparisons use `IS DISTINCT FROM` to reject missing fields. It does not rewrite data, recreate tables, alter keys, change grants or change retry/count semantics. The function remains `SECURITY INVOKER` with an empty search path, the same signature and existing execution grants. Constraint validation scans existing events and briefly locks the table; schedule a quiet deployment window. The migration is transactional and fails rather than repairing incompatible records. Do not reapply or edit the original hosted migration.

### Deploy provenance hardening (only after approval)

On 2026-10-27, read-only hosted inspection found 39 events and zero violations of the intended provenance source, verification or synthetic dataset/seed checks. Hosted history contained only `20261027182656`. Recheck immediately before deployment; this snapshot is not deployment evidence.

1. Pause API/CLI ingestion and baseline writes during the comparison. In the project SQL Editor, run `supabase/tests/phase04-hosted-verification.sql` and save the results locally. All three `invalid_*` counts must be zero; any query error (including malformed seeds) blocks deployment. The file returns counts and fingerprints, not event bodies or labels. It requires an administrative database role, never the scoring service role.
2. Authenticate the CLI locally with `npx supabase login` if needed. Then run:

```powershell
npx supabase link --project-ref ymsbiagwhgxultjoryzf
npx supabase migration list --linked
npx supabase db push --linked --skip-vault --dry-run
```

The dry run must list **only** `20261027194705_phase04_provenance_hardening.sql`. Stop if it proposes the original migration or anything else; do not reset the database or repair migration history to force it through.

3. After approval, apply and inspect history:

```powershell
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db advisors --linked --type security
```

4. Rerun `supabase/tests/phase04-hosted-verification.sql` in the SQL Editor. Counts and fingerprints for all six tables must exactly match the saved results. Both constraints must be validated and include `IS TRUE`; `hardened_dataset` and `hardened_seed` must be true. `security_definer` must remain false, the search path empty, and execution grants unchanged (service role only among API roles). Both migration versions must appear in history. Review actual advisor results; do not assume a pass.
5. Resume the API. With the existing verified checkout session, retry the same verified import twice: both responses must retain the existing total `eventCount`, with unchanged event/reference counts. Rerun the saved baseline twice and compare decisions; retain the prior browser/idempotency acceptance evidence. Do not initiate a fresh payment just to repeat this check. If the session expired, use read-only stored evidence and report the browser retry as pending.

Do not run the fixture suites `phase04.sql` or `phase04-upgrade.sql` on the hosted project. `npm run test:storage` runs them in isolated PostgreSQL and checks upgrade data preservation plus function owner/grant preservation.

- `public.experiments`: UUID, authenticated owner, name, immutable dataset ID/seed, sealing state, creation timestamp.
- `public.events`: composite experiment/event identity, explicit source and validated minimal normalized event JSON, including provenance.
- `evaluation.labels`: separate evaluation-only labels, template and split, joined by composite experiment/event foreign key. The browser and API service role have **no access**, including SELECT. This phase provides the restricted schema; it provides no label import/read route. Original simulator labels remain in their separate local file. A database administrator can load evaluation records separately; detectors cannot.
- `public.verified_provider_references`: order/capture/event IDs and verification time for adapter-verified records only. Capture identity is unique within an experiment.
- `public.detector_runs` and `public.scores`: unique experiment/version runs and unique experiment/version/event decisions, with event foreign keys.

All tables enable RLS; there are no browser table policies or grants. Browser Data API reads/writes and RPC execution are denied. `lab_command` uses invoker rights, is executable only by the server service role, and checks authenticated ownership for every operation. The server obtains user identity from Supabase Auth `/auth/v1/user`, never from a supplied owner field or decoded unverified token. Service credentials stay on the server. See [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

The experiment row lock serializes ingestion, sealing and saving across server processes. An exact duplicate event is a no-op; changed content under the same ID is a conflict. A conflicting batch rolls back completely. Synthetic dataset ID and seed must match the experiment. A capture cannot be inserted under multiple event IDs. A baseline snapshot seals a nonempty experiment before scoring; new events are then rejected, while identical retries remain valid. Use a new experiment for a changed dataset. A failed score/save can be retried against the sealed snapshot. Repeated identical saves return the same decisions; changed decisions under the same version are rejected. Counts are capped at 10,000 events per experiment, 500 per ingestion, 1 MiB per HTTP body and 120 requests/minute per mounted router per server process. This is local research scope, not production quota enforcement.

## Setup (human configuration required)

1. Create a Supabase PostgreSQL project. In the project's **Connect** dialog, obtain its project URL for `SUPABASE_URL`; in **Settings > API Keys > Legacy API Keys**, obtain `service_role` for `SUPABASE_SERVICE_ROLE_KEY`. Put both in root `.env`, never in a `VITE_` variable. Do not share credentials in chat. Without either, experiment routes return `503 experiment_setup_required`; checkout and health continue to work.
2. Apply the versioned migration using the CLI. These commands require your own project reference and dashboard authentication. `init` creates local CLI configuration; it does not change the database. Review the dry run before the push. Do not recreate tables manually in the dashboard.

```sh
npx supabase init
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list --linked
npx supabase db advisors --linked --type security
```

3. In **Authentication > Users**, create two test users. Obtain each user's Supabase Auth access token through a local Auth sign-in. `EXPERIMENT_ACCESS_TOKEN` must be a **user** access token, not the service-role key. For a password test user, this PowerShell example prompts locally and never prints the token (use the project's publishable key from **Settings > API Keys**):

```powershell
$labUrl = Read-Host 'Project URL'
$labPublishableKey = Read-Host 'Publishable API key'
$labCredential = Get-Credential -Message 'Supabase test user email and password'
$labSession = Invoke-RestMethod -Method Post -Uri "$labUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $labPublishableKey } -ContentType 'application/json' -Body (@{ email = $labCredential.UserName; password = $labCredential.GetNetworkCredential().Password } | ConvertTo-Json)
$env:EXPERIMENT_ACCESS_TOKEN = $labSession.access_token
Remove-Variable labSession,labCredential
```

4. `EXPERIMENT_API_URL` defaults to `http://127.0.0.1:3001`; remote APIs require HTTPS. Build and start the API after configuring `.env`. Tokens expire; repeat local sign-in when necessary. The CLI reads root `.env` and process environment; it never reads labels or manifests.

## API and CLI

All experiment routes require `Authorization: Bearer <Supabase user access token>`. No public route accepts an owner ID or user-supplied provider verification. All writes happen server-side. Error responses omit database/provider payloads.

| Method / path | Body and behavior |
| --- | --- |
| `POST /experiments` | `{ experimentId: UUID, name, datasetId, seed }`. Same content/ID retries safely. |
| `POST /experiments/:id/events` | `{ events: SyntheticPaymentEvent[] }`. Strict synthetic-only input; hidden labels and unknown fields rejected. |
| `GET /experiments/:id` | Owned experiment's normalized events, with explicit source/provenance; no labels. |
| `POST /experiments/:id/baseline` | `{}`. Seal, project observables, score and persist decisions. |
| `POST /sandbox/experiments/:id/verified` | `{}` plus the existing HttpOnly `sandbox_session` cookie and user bearer token. Copies only the event already verified by the checkout adapter. Does not create/capture an order or trust submitted event JSON. |

For browser imports, prefer the existing Vite `/sandbox` proxy: send the request to the relative URL `/sandbox/experiments/:id/verified` from `http://127.0.0.1:5173` with `credentials: 'same-origin'`, the user bearer token, JSON content type and body `{}`. The proxy forwards to `VITE_API_BASE_URL` (default `http://127.0.0.1:3001`) and keeps the existing cookie path. Direct requests to port 3001 require `credentials: 'include'`. API CORS permits only the exact `CHECKOUT_ORIGIN` (default `http://127.0.0.1:5173`), with credentials, GET/POST/OPTIONS and Authorization/Content-Type. Preflights run before authentication; actual requests still require the token and checkout session. Use the same hostname for checkout and import; `localhost` and `127.0.0.1` are different sites. Restarting the API loses process-local checkout sessions, so a fresh explicitly approved checkout may be needed before retrying an import.

For a saved seeded synthetic experiment (choose a fresh directory and UUID; `--population 100` stays under the storage cap):

```powershell
npm run build
npm run simulate -- --seed 42 --population 100 --out artifacts/phase04-seed42
$labExperiment = [guid]::NewGuid().ToString()
npm run baseline -- --experiment $labExperiment --events artifacts/phase04-seed42/events.jsonl
npm run baseline -- --experiment $labExperiment
```

The first command creates/imports the saved evidence in retryable chunks before sealing; a failed multi-chunk upload can be retried. Each chunk is atomic, not the entire file. Repeating `--events` with the same file is safe even after sealing. CLI stdout contains only versioned decisions. It never reports benchmark accuracy.

## Verification and manual acceptance

Terminal checks: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`. Build before tests because CLI tests run built entrypoints.

`supabase/tests/phase04.sql` tests storage duplicates, atomic rollback, seed mismatch, owner isolation, source references, immutable runs and label/browser access denial. It rolls back test fixtures and should be run only on a disposable/local project. `npm run test:storage` can execute migrations and those assertions in isolated PostgreSQL via PGlite. Install the optional test tool outside this repository, then point at its absolute entrypoint:

```powershell
$labVerifier = Join-Path $env:TEMP 'payment-risk-phase04-verifier'
npm install --prefix $labVerifier --no-save --package-lock=false @electric-sql/pglite@0.3.14
$env:PHASE4_PGLITE_MODULE = Join-Path $labVerifier 'node_modules/@electric-sql/pglite/dist/index.js'
npm run test:storage
```

This verifies PostgreSQL behavior with minimal Auth/role scaffolding; it does not verify hosted Supabase Auth, PostgREST, project grants/defaults or dashboard configuration.

Manual acceptance remains pending:

1. Apply the migration to your project, check migration history and security advisors, and start the API with the two server variables. Confirm `/health` and existing checkout still work.
2. Sign in as user A and run the saved-file CLI commands. Compare returned JSON from two baseline runs; verify one run and one score per event in the database. Retry the same upload, then try a changed event under an existing ID: expect a conflict and unchanged rows.
3. Create a second experiment as user B. Try `GET /experiments/<A-id>` and an ingestion into A using B's bearer token: both must fail with 404. B's own read must contain only B's events. Direct anon/authenticated Data API table/RPC access must fail; labels must be inaccessible to the server service role too.
4. Complete the existing explicitly approved sandbox checkout using [the PayPal guide](paypal-sandbox.md). From the same browser session, POST `{}` to `/sandbox/experiments/<owned-unsealed-id>/verified` with your user bearer header. Inspect the stored `paypal_sandbox` source, verified provenance and provider reference. Retry: one event/reference remains. Submitted provider JSON to `/experiments/:id/events` must fail. Never treat the mocked adapter tests as evidence of an actual capture.
5. Restart the API and rerun the saved experiment baseline: stored events/decisions remain unchanged. Checkout session state itself remains process-local as documented in Phase 3; import verified events before restart. Existing persisted sandbox evidence survives restart. Confirm synthetic records still carry synthetic provenance.

No hosted migration, real sandbox capture, browser acceptance, or security-advisor pass is claimed by local tests.
