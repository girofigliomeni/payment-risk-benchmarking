# Phase 5: Deterministic protection contracts and policy engine

Status: implemented with explicit user authorization; local automated verification complete, human acceptance pending. No following-phase implementation is authorized.

Implementation update, 2026-10-27: the user explicitly authorized Phase 5. Core implementation and local automated verification are complete; human acceptance remains pending. See [policy semantics and verification record](../protection-policy-v1.md). The original proposal below is retained; no following-phase work has begun.

## Goal

Establish pure protection-policy-v1 independently of rules-v1; no persistence or payment changes.

Read [project](../project-doc.md), [architecture](../protection-architecture.md), [consumer policy](../consumer-dashboard.md), [SDK/API](../developer-sdk.md), [evaluation](../evaluation-methodology.md) and [PayPal constraints](../paypal-constraints.md) as relevant. These linked documents define the shared contracts.

## Scope

- Define strict consent, policy/version, rolling-window, quote, reservation-snapshot and decision schemas in a separate core module; avoid changing existing research contracts.
- Implement pure checks for enrollment, USD caps, active reservations, cooling-off, tightening, delayed relaxations and explicit time boundaries from the consumer specification.
- Document reason codes, safe arithmetic, version transitions and the capture-authorization linearization contract; create independent hand-worked fixtures.

## Acceptance and automated tests

- Exact cap equality, zero limits, overflow, 24-hour/7-day boundaries, mixed edits, 24-hour increase delay, cooling-off expiry/extension and source isolation agree with independent expected outputs.
- Identical inputs/time produce identical outputs; no network, storage, current-clock or model calls in the engine. Existing rules-v1 tests/results remain unchanged.
- Run npm run typecheck, npm run lint, npm run build, then npm test and any phase-specific storage/concurrency/contract checks above. Report commands/results and blockers truthfully. Do not weaken existing tests.

## Deliverables

Core contracts/engine, policy semantics reference and deterministic test fixtures.

## User acceptance

Review policy examples and approve default windows, 24-hour relaxation delay, gross-spend accounting and revocation behavior. Browser/provider checks are not applicable.

## Out of scope

Database migrations, authenticated dashboard, SDK HTTP client, PayPal changes and AI.

Preserve Phases 1–4 acceptance records and implementations. No following-phase work until explicit acceptance. Local mocks do not establish external-account or browser acceptance.
