# Phase 1 — Foundation and contracts

**Goal.** A working monorepo and a single agreed event contract, with no external credentials required.

## Build

- Initialize npm workspaces for API, React dashboard, shared core, and eventual SDK. TypeScript strict throughout.
- Create an Express health endpoint and Vite dashboard that shows API connection status and a clear empty state.
- Define Zod schemas and inferred types for money, actor, payment event, provenance, scenario labels (evaluation-only), detector output, and experiment metadata.
- Add environment validation with safe local defaults only for nonsecret configuration; `.env.example` lists future secrets without inventing values.
- Configure lint, typecheck, build, Vitest, and CI. Add README with local startup commands.
- Provide a small checked-in synthetic fixture strictly labeled as sample data to exercise the shared schema.

## Constraints

- No Supabase schema, PayPal requests, OpenAI calls, or simulated payment success.
- Never place ground truth in the detector-visible event type. Provider verification metadata is separate from synthetic scenario metadata.
- One event schema shared across packages; do not duplicate incompatible interfaces.
- The demo must visibly say sample data rather than implying live activity.

## Codex checks

Run install, typecheck, lint, build, and schema unit tests. Verify invalid money and missing provenance fail validation.

## My acceptance check

Start API and frontend locally. The dashboard loads, health status is correct, and the sample event is explicitly marked synthetic. Shut down the API and confirm the UI shows a truthful connection error.

## Not in this phase

Simulation generation, database, AI, payment processing, charts, or authentication.
