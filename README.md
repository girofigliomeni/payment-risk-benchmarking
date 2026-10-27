# Payment Risk Lab

A developer research workspace for reproducible payment-risk experiments. Phase 1 provides the monorepo foundation, shared validated contracts, API health, and a dashboard with explicitly synthetic sample data. No experiments or payments are executed.

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
