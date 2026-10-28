# Phase 7 — Dashboard, API, and TypeScript SDK

**Goal.** A developer can create experiments, inspect evidence, compare detectors, and reproduce a run without reading internal code.

## Build

- React dashboard with experiment creation, seeded configuration, run status, side-by-side metrics, confusion matrices, event table, and evidence detail view.
- Clearly mark each event as synthetic or verified PayPal sandbox. Show denominators and methodology next to metrics.
- API endpoints for creating/listing experiments, ingesting synthetic fixtures, running detectors, reading metrics, and exporting results. Protect expensive operations with limits.
- Typed `@payment-risk-lab/sdk` client with methods for experiment creation, simulation, evaluation, and results retrieval; no privileged secrets in SDK.
- OpenAPI 3.1 spec and Postman collection matching actual routes; minimal quickstart using the SDK against the running API.
- Add an integration test that runs a complete small experiment through the public API.

## Constraints

- The SDK calls real endpoints; no demo-only fake results after integration.
- Do not expose raw ground-truth labels to detector execution APIs. Evaluation outputs can disclose aggregate labels and examples after scoring.
- Do not build an actual gambling UI. Keep dashboard focused on payment-event research.
- Avoid introducing Elastic/AG Grid unless needed and approved.

## Codex checks

Typecheck/lint/build, API contract tests, SDK integration test, pagination/limits, unauthorized access checks, and basic accessibility checks.

## My acceptance check

Create an experiment in the browser, run it, inspect event provenance, compare all three detectors, export results, and reproduce the experiment using the SDK quickstart. Confirm no demo metric is hardcoded.

## Not in this phase

Production billing, live fraud decisions, extra integrations for logos.
