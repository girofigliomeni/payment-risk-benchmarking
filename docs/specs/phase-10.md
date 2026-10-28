# Phase 10: Consumer dashboard and advisory early warnings

Status: proposed, unimplemented. Requires user acceptance of Phase 9 before implementation. Build only this phase, then stop.

## Goal

Build the consent-driven consumer experience and evidence-linked optional warnings.

Read [project](../project-doc.md), [architecture](../protection-architecture.md), [consumer policy](../consumer-dashboard.md), [SDK/API](../developer-sdk.md), [evaluation](../evaluation-methodology.md) and [PayPal constraints](../paypal-constraints.md) as relevant. These linked documents define the shared contracts.

## Scope

- Implement the screens and accessibility states in consumer-dashboard.md through the public API; keep research views separate and preserve source labels.
- Implement bounded asynchronous server-side OpenAI warning generation over minimal observables with separate AI consent, schema/evidence validation, prompt/model versions, timeouts, limited retries, usage and cache isolation.
- Define a deterministic behavioral warning comparator and any rules+AI advisory combination as new warning versions; never repurpose rules-v1 or policy outputs.
- Add privacy-safe dismissal/export/deletion controls, stale/unavailable indicators and no-key behavior. No model may mutate policy or checkout authority.

## Acceptance and automated tests

- Automated API/component checks cover consent separation, revoked AI consent, owner isolation, delayed changes, cooling-off and no bypass from warnings.
- Mocked AI rejects invented IDs, future evidence, malformed output, prompt injection instructions and unsupported claims; missing key/timeouts show unavailable with policies still enforced.
- Keyboard/semantic checks run where automated; no hardcoded capture success, balances or metrics. Scope/provenance remains visible in all relevant screens.
- Run npm run typecheck, npm run lint, npm run build, then npm test and any phase-specific storage/concurrency/contract checks above. Report commands/results and blockers truthfully. Do not weaken existing tests.

## Deliverables

Consumer dashboard, advisory warning service, minimal prompt contract, redaction/consent tests and exact manual walkthrough.

## User acceptance

Inspect keyboard/screen-reader usability, warning tone/evidence and privacy choices. Configure OPENAI_API_KEY server-side from the OpenAI API project dashboard only for an explicitly bounded live run; record actual results or mark live warning acceptance blocked. Never paste the key in chat.

## Out of scope

Clinical claims, automatic freezing, model payment authority, new evaluation results without Phase 11 and unrelated visual redesign.

Preserve Phases 1–4 acceptance records and implementations. No following-phase work until explicit acceptance. Local mocks do not establish external-account or browser acceptance.
