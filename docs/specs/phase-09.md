# Phase 9: Public API contract and typed developer SDK

Status: proposed, unimplemented. Requires user acceptance of Phase 8 before implementation. Build only this phase, then stop.

## Goal

Deliver a usable protected integration API and real HTTP client.

Read [project](../project-doc.md), [architecture](../protection-architecture.md), [consumer policy](../consumer-dashboard.md), [SDK/API](../developer-sdk.md), [evaluation](../evaluation-methodology.md) and [PayPal constraints](../paypal-constraints.md) as relevant. These linked documents define the shared contracts.

## Scope

- Finalize OpenAPI 3.1 request/response/error schemas for consumer/integrator boundaries in developer-sdk.md and reconcile paths against actual approved-phase routes.
- Implement separate consumer/server-only integrator SDK entrypoints with injected fetch/token callback, AbortSignal, typed denial/pending/error states and stable-key bounded retries.
- Complete owned paginated activity/status reads and export/deletion request handling; no public export URLs or merchant warning history.
- Provide runnable participating-server and consumer examples driving quote -> reserve -> order -> explicit consumer confirm -> status. Include request quota and privacy guidance.

## Acceptance and automated tests

- Contract tests match real local routes; SDK integration runs the full flow with provider transport mocked, including denial and pending reconciliation.
- Unauthorized/cross-integration access, stale versions, changed idempotency payloads, unsupported currency and pagination limits fail correctly.
- Timeout/abort cannot falsely cancel provider work or introduce a fresh capture key. Browser bundles contain no integrator/provider/database secrets.
- Run npm run typecheck, npm run lint, npm run build, then npm test and any phase-specific storage/concurrency/contract checks above. Report commands/results and blockers truthfully. Do not weaken existing tests.

## Deliverables

OpenAPI 3.1, typed SDK client, integration examples, API error catalog and public-flow tests.

## User acceptance

Run the quickstart against the local API and inspect true source/verification and denial states. Real sandbox use requires the separate explicitly approved Phase 8 procedure.

## Out of scope

SDK registry publication, new providers, public merchant registration, AI or dashboard styling.

Preserve Phases 1–4 acceptance records and implementations. No following-phase work until explicit acceptance. Local mocks do not establish external-account or browser acceptance.
