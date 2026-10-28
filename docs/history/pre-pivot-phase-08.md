# Phase 8 — Deployment, verification, and submission

**Goal.** A reviewer can inspect a deployed, reproducible project and see genuine PayPal sandbox integration plus defensible AI benchmarking.

## Build

- Deploy API to Render and dashboard to Vercel; configure environment validation, CORS, webhook public URL, and health/readiness checks.
- CI runs typecheck, lint, build, and tests. Verify no secrets in Git history or client bundles.
- Add security checks for auth, request limits, payload size, webhook verification, idempotency, provenance integrity, and restricted evaluation labels.
- Produce polished GitHub README, architecture diagram source, setup guide, research-methodology document, reproducibility instructions, and known limitations.
- Prepare demo script showing: generic PayPal sandbox checkout -> verified event -> normalized ingestion -> seeded simulation -> rules/AI/hybrid comparison -> evidence -> SDK API call.
- Draft Devpost description and a submission checklist; verify official eligibility, deadline, judging rules, partner requirements, and payment-policy constraints from current official resources before claiming compliance.

## Constraints

- No fabricated deployments, test results, PayPal transaction IDs, AI metrics, partner credits, or hackathon compliance claims.
- No production PayPal credentials or real gambling transactions.
- If live AI evaluation is unavailable during demo, label recorded outputs with model/version and time; do not imply they are live.
- A public demo must not allow anonymous users to incur unlimited AI or infrastructure costs.

## Codex checks

Run full CI locally, smoke-test documented URLs where available, verify configuration and migrations, run test suite, and produce an explicit pass/fail/blocker report. Check links and command examples.

## My acceptance check

Verify the live demo, complete one real sandbox checkout, confirm capture in PayPal dashboard, inspect a reproducible benchmark, run the SDK quickstart, record the demo video, and personally submit through Devpost. Review current hackathon rules and PayPal policies before submission.

## Not in this phase

New product features, production casino integrations, unsupported claims of real-world fraud performance.
