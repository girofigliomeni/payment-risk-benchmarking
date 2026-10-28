# Phase 8: Protected PayPal sandbox checkout and reconciliation

Status: proposed, unimplemented. Requires user acceptance of Phase 7 before implementation. Build only this phase, then stop.

## Goal

Connect durable protection enforcement to a generic sandbox purchase with explicit consumer capture approval.

Read [project](../project-doc.md), [architecture](../protection-architecture.md), [consumer policy](../consumer-dashboard.md), [SDK/API](../developer-sdk.md), [evaluation](../evaluation-methodology.md) and [PayPal constraints](../paypal-constraints.md) as relevant. These linked documents define the shared contracts.

## Scope

- Reuse/harden the existing provider adapter through the durable intent path, separate create/capture keys and persisted order correlation.
- Implement provider approval verification, second policy/consent check and durable capture dispatch at the documented linearization point, plus independent completed-capture GET verification.
- Authenticate/deduplicate webhooks durably and reconcile response/webhook/worker to one unique fact and one reservation commit; retain uncertain outcomes across restart.
- Isolate the legacy process-local checkout as operator-only outside protection or disable it in the protected demo configuration. Test that it cannot bypass enrolled protected checkout.
- Document exact existing PayPal environment setup and verify current endpoint permissions/idempotency retention; no new secret names without implementation need.

## Acceptance and automated tests

- Mocked transport covers denial before dispatch, amount/payee/owner mismatch, stale policy, cooling-off and revocation races, pending/timeout, crash after provider success and webhook-first/duplicate/out-of-order delivery.
- Multiple worker/process retries cannot create a new logical capture or double-count budget; unknown capture is never released on timer, cancel or generic 404.
- Verified capture alone yields success; fake callbacks/fixtures never become PayPal facts. Restart preserves intent/correlation and recovery. Missing credentials is setup-required.
- Run npm run typecheck, npm run lint, npm run build, then npm test and any phase-specific storage/concurrency/contract checks above. Report commands/results and blockers truthfully. Do not weaken existing tests.

## Deliverables

Protected checkout routes, durable PayPal adapter/reconciler, failure tests, sandbox verification runbook and legacy-route isolation decision.

## User acceptance

User configures PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID in PayPal Developer Dashboard > Sandbox > Apps & Credentials, following paypal-sandbox.md. With explicit approval complete one generic sandbox checkout, verify capture/amount and duplicate delivery, and retain redacted evidence. Test denial and cooling-off without a provider call. No actual provider check is claimed by mocks.

## Out of scope

Production payments/gambling onboarding, arbitrary blocking, reporting-history ingestion, AI and SDK publication.

Preserve Phases 1–4 acceptance records and implementations. No following-phase work until explicit acceptance. Local mocks do not establish external-account or browser acceptance.
