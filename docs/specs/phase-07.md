# Phase 7: Atomic budgets and durable checkout intents

Status: proposed, unimplemented. Requires user acceptance of Phase 6 before implementation. Build only this phase, then stop.

## Goal

Allocate budget atomically across participating flows with no real provider calls.

Read [project](../project-doc.md), [architecture](../protection-architecture.md), [consumer policy](../consumer-dashboard.md), [SDK/API](../developer-sdk.md), [evaluation](../evaluation-methodology.md) and [PayPal constraints](../paypal-constraints.md) as relevant. These linked documents define the shared contracts.

## Scope

- Add reservation/intent/idempotency/dispatch/job accounting entities and transactional commands with fixed subject-first lock ordering.
- Implement trusted immutable quotes, previews, checkout reservation, safe unsent cancellation/expiry and persistent state reads; aggregate both windows across integrations within a source namespace.
- Add durable outbox leases/fencing and explicit pending/unknown states; provider transport remains mocked. Persistence of intent precedes dispatch.
- Integrate policy transitions and consent revocation under the same subject lock as reservation and capture authorization; do not treat preview as permission.

## Acceptance and automated tests

- Real isolated PostgreSQL multi-connection tests and multiple API instances cannot allocate above either cap under concurrent requests. Process-local mocks alone do not pass this gate.
- Same key/body produces one resource/reservation; changed payload conflicts. Both windows update atomically and no synthetic/sandbox mixing occurs.
- Unknown/dispatched reservations do not expire automatically. Crash/retry, stale worker and policy-change races match documented ordering. Existing source-isolation and Phase 4 tests remain valid.
- Run npm run typecheck, npm run lint, npm run build, then npm test and any phase-specific storage/concurrency/contract checks above. Report commands/results and blockers truthfully. Do not weaken existing tests.

## Deliverables

Atomic budget service, durable state machine/worker primitives, mocked provider seam and concurrency/failure evidence.

## User acceptance

Inspect reserved/committed balances and repeated request results using owned fictional fixtures; review race semantics and held-unknown budget behavior. No real checkout acceptance yet.

## Out of scope

Live sandbox capture, public merchant onboarding, consumer UI polish and AI.

Preserve Phases 1–4 acceptance records and implementations. No following-phase work until explicit acceptance. Local mocks do not establish external-account or browser acceptance.
