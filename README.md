# Responsible Gambling Payment Protection

This project is pivoting to an opt-in consumer spending dashboard plus a developer API/SDK for enforcing user-defined protections in participating payment flows. The protected demonstration will remain a generic PayPal sandbox purchase; gambling-related scenarios are explicitly synthetic.

Phase 5's pure policy engine is implemented and accepted. On 2026-10-30, the user reported human reviewer approval of Phase 6 as **ACCEPTED — BACKEND/STORAGE SCOPE ONLY**: 114 hosted checks passed with zero failures, 36 focused local tests and 86 storage assertions passed, and historical research data/security permissions were preserved. See [scoped acceptance and NOT VERIFIED deferrals](docs/phase06-human-acceptance.md), [Phase 6 setup](docs/phase06-storage.md) and [hosted deployment evidence/advisor findings](docs/phase06-hosted-deployment.md). This milestone is not production readiness. Phases 7–12, warnings, the consumer dashboard and SDK client remain proposals requiring separate explicit approval. Phases 1–4 acceptance records and pending checks are preserved. Product authority remains in the [project specification](docs/project-doc.md) and [roadmap](docs/roadmap.md).

Current implementation: seeded simulator, pure rules-v1 research baseline, authorized experiment persistence, separate protection-policy-v1 and Phase 6 protection storage/API routes. The sandbox checkout remains process-local and is not connected to protection enforcement. The SDK currently exports types only. No real-world gambling history, universal PayPal blocking or clinically validated harm prevention is claimed.

The following content is retained verbatim as historical Phase 1–4 setup and verification documentation. Statements such as “no database routes” and “credentials are unused” refer to the named historical phase, not the complete current repository. For current storage/checkout setup follow [rules-storage.md](docs/rules-storage.md) and [paypal-sandbox.md](docs/paypal-sandbox.md). Historical acceptance status is not changed by this pivot.

---

# Payment Risk Lab

Phase 4 adds the deterministic rules baseline, authorized experiment API, server-only Supabase persistence and saved-experiment CLI. See [rules, database setup and acceptance](docs/rules-storage.md). Hosted Supabase and browser acceptance require user configuration; local test results do not establish real-world detection performance.

A developer research workspace for reproducible payment-risk experiments. Phase 1 provides the monorepo foundation, shared validated contracts, API health, and a dashboard with explicitly synthetic sample data. Phase 2 adds a standalone, local synthetic simulator. The simulator executes no actual payments. Phase 3 adds a separate, explicitly authorized PayPal sandbox test checkout; see the setup guide below.

## Local setup

Use Node.js 24 LTS (recommended), Node.js 22.13 or newer within 22.x, or Node.js 26+, and npm.

```sh
npm install
npm run build
npm run dev
```

Open the dashboard URL printed by Vite (normally http://127.0.0.1:5173). The API health endpoint is http://127.0.0.1:3001/health. No credentials or environment file are required. Build once before development so consumers can resolve the core workspace; the dev command watches core, API, and dashboard together.

For separate terminals, run `npm run dev -w @payment-risk/core`, `npm run dev -w @payment-risk/api`, and `npm run dev -w @payment-risk/dashboard` after the initial build. Use separate terminals for the API shutdown acceptance check.

Optionally copy `.env.example` to `.env` at the repository root. `HOST` and `PORT` configure the API; `VITE_API_BASE_URL` configures the dashboard. Restart development processes after changing these values. Vite variables are public: never prefix secrets with `VITE_`. Future server credentials are listed empty and are neither required nor used. No service configuration is needed for this phase.

## Workspaces and contracts

- `apps/api`: Express, `GET /health`; no database or payment routes. The public health response permits cross-origin reads for local dashboard use.
- `apps/dashboard`: React and Vite, health polling with a three-second timeout and five-second interval after each request; truthful connection errors and experiment empty state.
- `packages/core`: single Zod schema source and inferred types, with readonly events and provenance frozen during parsing.
- `packages/sdk`: reserved workspace exporting shared types; no client implementation in Phase 1.

Money uses nonnegative safe integer minor units and three uppercase currency letters (format validation, not an ISO registry). Events form a source-discriminated union: synthetic provenance carries dataset, generator version, and seed; PayPal sandbox provenance requires provider identifiers and verified metadata. Schema validation enforces shape, not actual provider authentication; there is no provider ingestion in this phase. Strict objects reject unknown properties. Scenario labels and data splits live in a separate evaluation-only schema and cannot be added to detector-visible events. Provenance contains no scenario names or labels.

`packages/core/fixtures/sample-synthetic.json` is a hand-authored sample, not simulator output or payment evidence. Its pending status makes no claim of successful processing. Future detectors must receive an explicitly selected observable feature set without evaluation records; dataset IDs and seeds must not become inference features. No evaluation or benchmark claims exist in this phase.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
npm test
```

CI uses `npm ci` and runs these same checks. Tests cover invalid money, missing/mismatched provenance, rejected evaluation metadata, provider verification shape, configuration, and the HTTP health endpoint. For production-mode local API startup after building: `npm run start -w @payment-risk/api`.

## Phase 1 manual acceptance

1. Start the API and frontend in separate terminals using the commands above.
2. Open the Vite dashboard. Confirm API health becomes connected and the experiment list is empty.
3. Confirm the fixture is titled **Synthetic sample data**, its source is `synthetic`, and its provenance is inspectable. It must not imply live PayPal activity.
4. Stop the API only. Within approximately eight seconds, confirm a connection error replaces the connected status.
5. Restart the API and confirm the connection recovers.

Browser and human acceptance remain manual. Later phases require explicit acceptance; Phase 1 includes no simulator, storage, AI, payment processing, charts, authentication, or deployments.

## Phase 2: synthetic simulation

Build once, then run from the repository root (no credentials or running API needed):

```sh
npm run build
npm run simulate -- --seed 42 --population 1000 --duration-seconds 604800 --out artifacts/seed-42-a
npm run simulate -- --seed 42 --population 1000 --duration-seconds 604800 --out artifacts/seed-42-b
npm run simulate -- --seed 43 --population 1000 --duration-seconds 604800 --out artifacts/seed-43
```

Each output directory must be new. If verification artifacts already exist, choose fresh directory names (for example `artifacts/manual-42-a` and `artifacts/manual-42-b`). Runs refuse to overwrite existing work. The console reports scenario actor/event counts, event-type counts, hashes, output directory, and measured runtime. Runtime and machine paths are deliberately excluded from saved files. `artifacts/` is gitignored. `npm run simulate -- --help` lists options.

To set scenario weights and integer amount ranges, use the checked-in configuration:

```sh
npm run simulate -- --config packages/simulator/example.config.json --seed 7 --out artifacts/custom-seed-7
```

CLI seed/population/duration override the config file. Unknown properties, invalid ranges, zero-total weights, and out-of-bounds sizes fail validation. Defaults: seed 42, 100 fictional actors, seven virtual days, USD, and 100?50000 minor units for both event types. Population is bounded at 10000, duration at 3600?31536000 seconds, seed at unsigned 32-bit, and amounts at 1?1000000000 minor units. Currency validates format only. Scenario weights are relative probabilities per actor, not exact quotas; small runs may omit a scenario.

The four serialized outputs have distinct roles:

| File | Purpose |
| --- | --- |
| `events.jsonl` | Typed synthetic evidence with immutable-on-parse Phase 1 provenance, including dataset ID, generator version, and seed. Not detector input. |
| `inference.jsonl` | Shared observable contract: event ID, time, fictional actor ID, integer amount, currency, event type, status, and source only. No provenance settings, labels, or scenario identifiers. |
| `labels.jsonl` | Evaluation-only labels joined by event ID; scenario template and benign/anomalous designation. |
| `manifest.json` | Resolved configuration, generator version, virtual epoch, counts, three SHA-256 file hashes, and dataset hash. Never supplied to detectors. |

`datasetHash` is SHA-256 of the compact JSON object containing the events, inference, and labels file hashes in that order. File hashes cover exact UTF-8 bytes with LF separators and a final newline. Configuration is included indirectly through each evidence event's dataset ID, computed from canonical validated config plus generator version. Same inputs yield identical bytes across all four files. A future generator behavior change must bump its version. IDs are opaque hashes of seed and actor/event sequence, with no scenario or label components. Event IDs are unique within a dataset; identify evidence across differently configured datasets by dataset ID plus event ID.

The pure `simulate` and `serializeSimulation` functions live in `packages/simulator`; only `cli.ts` performs file I/O or measures runtime. Generation uses Mulberry32, a fixed virtual epoch of 2026-01-01 UTC, and no global randomness, current time, network, database, model, or provider access. Events sort by virtual time and then ID for deterministic ties. Each actor has 8?16 events. Simulated completed/failed statuses describe fictional events only and never represent verified payment outcomes.

### Assumptions and limitations

- Normal activity includes failures, occasional close deposits, broad amount ranges, and varying withdrawals. Velocity adds deposit bursts; repeated failures adds clustered failed events; abrupt amount change moves from the configured deposit range's low end to its high end; unusual withdrawal timing alternates deposits and withdrawals 1?10 seconds apart. These patterns deliberately overlap normal observations. Narrow amount ranges can eliminate an amount-change signal; no hidden override expands them.
- Each fictional actor is assigned one template. All events from that actor carry its evaluation-only template label, including context events that may look normal individually. Labels describe injected stream behavior, not observed fraud, intent, harm, or financial truth.
- These are small hand-designed development templates, not calibrated casino-user models. There is no balance ledger, settlement, actual payment approval, or real user data. Counts and synthetic data do not support production detection claims.
- All current labels use `split: train` and `development-v1` templates. This phase does not create a held-out benchmark. Before evaluation, later work must introduce disjoint test template variants and disjoint seeds; merely changing the seed with these templates does not establish template holdout. Labels, manifests, seeds, and dataset IDs must remain outside inference. Keep actor streams together when splitting, and audit correlations and near duplicates for leakage.
- No detector, metrics, API simulation routes, dashboard changes, provider integration, or storage were added in Phase 2.

### Phase 2 manual acceptance

1. Run the three documented CLI commands into fresh directories. Inspect the console counts and runtime.
2. Inspect the first few lines of `events.jsonl` and `inference.jsonl`. Both must say `source: synthetic`. Only the evidence file has generator provenance; inference must have no labels, scenario names, seed, or generator settings.
3. Inspect `labels.jsonl` separately; join an event by ID. These are fictional development labels, not actual payment results.
4. Compare both seed-42 manifests: their `datasetHash` and all other saved contents must match. Seed 43 must differ. For example, in PowerShell:

```powershell
(Get-Content artifacts/seed-42-a/manifest.json -Raw | ConvertFrom-Json).datasetHash
(Get-Content artifacts/seed-42-b/manifest.json -Raw | ConvertFrom-Json).datasetHash
(Get-Content artifacts/seed-43/manifest.json -Raw | ConvertFrom-Json).datasetHash
Get-FileHash artifacts/seed-42-a/inference.jsonl
Get-FileHash artifacts/seed-42-b/inference.jsonl
```

Automated CLI tests require a preceding build, as in CI. Phase 2 stops here for manual acceptance.

### Recorded Phase 2 terminal verification

On Node.js 24.22.1, 1000 actors over seven virtual days with default weights/ranges:

| Scenario | Actors (seed 42) | Events (seed 42) |
| --- | ---: | ---: |
| Normal | 570 | 6670 |
| Deposit velocity | 100 | 1213 |
| Repeated failures | 97 | 1155 |
| Abrupt amount change | 113 | 1373 |
| Unusual withdrawal timing | 120 | 1451 |

Seed 42 produced 11862 events (9142 deposits, 2720 withdrawals), in 166 ms and 169 ms including serialization and writing. All four files were byte-identical across the two runs. Dataset hash: `2374b7101fd1b8389c3443c089f9a1389ac25864b45add75da7f731f78e0d804`.

Seed 43 produced 12164 events (9287 deposits, 2877 withdrawals) in 175 ms. Dataset hash: `638eed3379067db539c7586e649201263912f3fb0539d75cdf709a98600a1e9c`. Every saved record in all three runs passed shared-schema validation, label joins, chronological ordering, uniqueness, and file-hash checks. Runtime is a local observation, not a performance guarantee.

Typecheck, lint, build, and all 34 tests passed. Build/test worker processes required running outside the Windows process-restricted sandbox; the build retained existing Zod dependency-comment warnings. Manual acceptance has not been claimed.

## Phase 3: PayPal sandbox checkout

See [PayPal sandbox setup and acceptance](docs/paypal-sandbox.md) for exact environment variables, hosted approval/capture, webhook registration, local exposure, API behavior, and process-local limitations. The browser checkout is test-only and remains separate from synthetic samples. Missing server configuration produces setup-required. Documentation-derived mock tests do not establish a genuine sandbox capture; external acceptance remains pending.

For the local PayPal webhook tunnel on Windows: `npm run tunnel:install`, set `NGROK_AUTHTOKEN` in `.env` from [your ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken), then run `npm run tunnel:check` and `npm run tunnel` alongside the API. Register the assigned HTTPS forwarding URL plus `/sandbox/webhook` in PayPal. Never commit the token or binary.
