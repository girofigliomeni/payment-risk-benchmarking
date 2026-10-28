# Architecture and data model proposal

Status: unimplemented design. No SQL, application changes or infrastructure changes are authorized by this document.

## Existing versus proposed structure

| Area | Existing foundation (preserve) | Proposed addition |
| --- | --- | --- |
| apps/dashboard | Health, sample evidence, sandbox checkout | Authenticated consumer screens; isolated research view |
| apps/api | Health, sandbox adapter/session routes, owned experiment API | /v1 consumer/integrator API, policy orchestration, durable checkout and reconciliation worker |
| packages/core | Event/provenance contracts and rules-v1 | Separate protection-policy-v1 pure function/contracts and warning observable projection |
| packages/simulator | Seeded development templates and separate labels | Versioned protection/warning scenario fixtures without changing old outputs |
| packages/sdk | Type exports only | Typed HTTP client with separate consumer and server-integrator interfaces |
| Supabase | experiments/events, labels, runs, scores, provider references | Separate protection schema; no rewrite/relabel of research data |

Consumer -> authenticated Express API -> policy orchestration -> PostgreSQL transaction -> durable intent -> PayPal adapter. Verified provider response/webhook -> reconciliation -> accounting -> consumer read model. Optional warning job reads a minimal projection; no write authority to policy/payment tables.

Use PostgreSQL row locks and bounded transactions for authority, with a database-backed outbox/work queue polled by the existing backend runtime. No new queue provider. Server processes and workers can restart without losing intents. Do not hold a database transaction open across a provider network request. A database transaction and PayPal are not a distributed atomic transaction: use durable intent, idempotency and reconciliation, not an exactly-once external execution promise.

## Proposed entities and constraints

All identities are UUIDs unless provider IDs. Monetary amounts are bounded nonnegative integers; counters use checked arithmetic. UTC timestamps are server-generated. New migrations are additive and versioned in a later approved phase. Browser direct table/RPC access denied; server operations explicitly authorize subject and integration, even with privileged credentials. RLS on exposed tables and private-schema defense in depth; restricted function execution, fixed search paths, invoker rights where feasible. Do not reuse lab_command for protection authority.

| Entity | Minimal fields and invariants |
| --- | --- |
| protection_subjects | Auth owner, source namespace, account status, current policy version; unique owner/namespace. Single stable row locks all policy/payment writes for that subject. |
| integration_clients | Approved sandbox integration, hashed credential, scopes, environment, enabled state. Operator-created only; no public merchant signup. |
| integration_links | Consumer, integration, pseudonymous external subject binding, active status and consent reference; binding requires authenticated consumer approval, never merchant-supplied owner alone. |
| consent_records | Immutable purpose/terms version, accepted/revoked timestamp, coverage; separate protection and AI consent. |
| policy_versions | Immutable caps, currency USD, coolingOffUntil, effectiveAt, createdAt, author and predecessor. |
| policy_change_requests | Expected version, immediate/delayed fields, confirmedAt, activatesAt, canceled/superseded state. Never reset active delay implicitly. |
| checkout_intents | Consumer/link/integration/environment, trusted quote ID/hash, amount/currency, state/version, approval confirmation, provider order ID, create/capture request IDs. Quote immutable after reservation. |
| budget_reservations | Unique intent, amount/currency, createdAt/expiresAt, active/released/committed state, captured linkage. Counts across both rolling windows while active. |
| capture_dispatches | Unique intent/operation, policy/consent versions, dispatch authorization time, durable request ID, lease/fencing generation, reconciliation state. |
| payment_facts | Unique provider + environment + capture ID; immutable minimal verified order/capture references, occurredAt, amount/currency, verification method/time and source. No raw payloads. |
| provider_deliveries | Unique app/environment/webhook event ID, verified digest, state and retry metadata. A duplicate digest conflict is quarantined, not overwritten. |
| idempotency_records | Unique principal + integration + route/operation + key, canonical payload hash, resource ID/result state. Changed payload is 409. Persistent terminal tombstone prevents key reuse after response-body retention. |
| reconciliation_jobs | Unique operation, nextAttemptAt, bounded retries/backoff, lease and unresolved/escalated status. Never silently drop a job at retry exhaustion. |
| policy_decisions/audit_records | Append-only reason codes, versions, decision time, correlation IDs, actor/purpose; no secrets or raw personal/provider data. |
| behavioral_warnings | Owner/source, observation interval, referenced evidence IDs, message/code, model/prompt version, status, usage/latency, expiry and dismissal; advisory only. |
| evaluation artifacts | Separate restricted labels and immutable manifests/results; scoring cannot read labels. Existing research schema remains unchanged. |

Unique/composite foreign keys bind intent, reservation, capture, integration, consumer and environment together. Never trust a source/verification field from the public request. Inference uses an allowlisted observable projection. Historical experiment imports are not retroactively authoritative budget spend; explicit verified new protection intents alone establish protection accounting. Any future backfill requires separate reviewed mapping and deduplication.

## Pure decision contract

protection-policy-v1 takes effective consent/policy, authoritative time, bounded source-isolated committed history, active reservations and requested quote. Returns allow/deny with reason codes, versions, remaining-budget calculation and applicable windows. It has no network/DB/LLM calls. Caller supplies time; database orchestration resolves pending policies and obtains a consistent snapshot under lock.

Preview is informational. Only a persisted reservation can allocate headroom. Denials include consent_required, cooling_off_active, limit_exceeded, unsupported_currency or invalid_policy; dependency failure is unavailable, not a fabricated policy denial. Policy changes do not use rules-v1 scores or warning severity.

## Atomic reservation and capture protocol

1. Authenticate consumer/integrator and validate link, scope, source, trusted server quote and idempotency key. Lock subject then intent/reservation in a fixed order. Materialize due policy changes at DB time; resolve existing key before allocating anything.
2. In one transaction compute both windows' committed gross spending plus all active reservations; evaluate policy; create exactly one intent/reservation and decision, or persist denial. Concurrent requests across merchants share the subject lock. Separate keys cannot oversubscribe; retries do not allocate twice.
3. Persist create-order dispatch/request ID before the external call. Store returned provider order correlation durably before handing its approval URL to the consumer. Uncertain creation is reconciled under its original key; never invent another order/key to recover. Validate expected payee, amount, currency and trusted quote correlation.
4. Consumer approves on hosted sandbox PayPal and separately confirms capture to our API. Browser query strings/callbacks are untrusted. Fetch provider order server-side and verify approved state, exact amount, USD, expected merchant, single purchase unit and intent binding.
5. Reacquire subject/intent lock. Recheck consent, effective policy, cooling-off, reservation/quote and approval. Exclude this reservation once when testing its own allocated amount; include all others. Lowered limits may deny even a previously reserved checkout. If accepted, persist a capture dispatch and audit under the current versions, then commit. This commit is the **capture authorization linearization point**. A prior cooling-off/revocation wins; a later one cannot reliably recall this dispatched operation. Explain this race in UI.
6. Only the dispatch worker may call PayPal capture, using the durable operation request ID. Lease/fence local dispatch and reconciliation so competing workers cannot issue a fresh logical operation; an expired lease causes reconciliation first. Reuse identical provider key only within the documented retention window. A late resumed worker must revalidate its fencing ownership before dispatch. Residual network/provider races are resolved by the stable key and unique verified capture identity.
7. Independently GET the order/capture and verify final completed state, order/payee/amount/currency/intent correlation. In one locked transaction insert the unique verified fact and replace the reservation with committed spending; never count both. A verified response and verified webhook converge on the same capture record.
8. On pending status, timeout, process crash or DB save failure after capture dispatch: retain active budget, mark outcome unknown/pending and enqueue reconciliation. No success screen, new capture key or expiry release. A duplicate HTTP request returns the same resource/state. After provider idempotency retention, query/reconcile only; do not automatically POST again.
9. Release unsent expired/canceled reservations only under lock with proof no dispatch can still execute. Dispatched operations release only on verified terminal non-capture and fencing of further execution. A local cancel or generic provider 404/timeout does not prove no funds moved. Retry exhaustion becomes a visible unresolved operator task with budget held, not automatic release.
10. Verify every webhook signature against the configured app; bound body/header sizes, authenticate before trusting facts, correlate persisted intent and GET provider state. Unknown/unmatched events do not become trusted activity; retain minimal bounded retry/quarantine metadata to resolve ordering races. Persist processed status and accounting atomically before acknowledging; duplicate/out-of-order events cannot downgrade completed facts or double-count. Reconcile without requiring webhook arrival.

For source-isolated rolling budgets, replace reservation at verified capture time. A late verified capture may place actual spend above a newly lowered cap; record truth, block subsequent allocations and surface discrepancy. Never rewrite provider time/status to hide an overage. Restriction changes do not reverse an already authorized provider operation.

## Fail-safe and security behavior

| Condition | Required behavior |
| --- | --- |
| Storage/auth/policy authority unavailable | 503; do not create/reserve/authorize new capture. No cached allow. |
| Warning model unavailable, invalid output, AI consent absent | Warnings unavailable/off; deterministic protection continues. |
| Provider unavailable/uncertain | Durable pending/unknown with reservation held and bounded recovery. |
| Stale UI/SDK allow or tampered amount/subject | Revalidate authoritative quote/policy server-side; reject mismatch. |
| Duplicate/concurrent request | Same logical resource or conflict; never an extra allocation/capture. |
| Consent withdrawn/policy tightened | Stop new authorization under subject lock; reconcile already dispatched work. |

Use HTTPS, exact origins, no-store sensitive responses, verified user tokens, recent authentication for sensitive changes, scoped server credentials, per-consumer/integration distributed quotas, body/pagination limits, safe errors and redacted audit records. Existing per-process rate limits are not sufficient global protection. No arbitrary callback URLs or browser-held integrator secrets. Treat event descriptions as untrusted data in prompts.

Atomic guarantees depend on every participating capture using this path. The preserved Phase 3 checkout must be isolated as a legacy operator-only test route and clearly outside enrolled protection, or disabled in the protected demo deployment; never silently expose it as a bypass. The selected deployment configuration must be tested in Phase 8 and finalized in Phase 12.
