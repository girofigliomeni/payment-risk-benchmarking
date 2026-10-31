# Backend API and developer SDK proposal

Status: the Phase 6 consent/policy/link/lifecycle subset is implemented locally; its exact routes and setup are in [Phase 6 storage](phase06-storage.md). Remaining paths and SDK methods below are target contracts. Preserve existing /experiments and /sandbox research contracts; protection uses /v1. Deliver OpenAPI 3.1 plus generated/validated shared schemas and a real HTTP SDK in Phase 9.

## Authentication and authorization

Consumer methods use verified Supabase user tokens and derive owner server-side. Integrator methods use rotated, revocable, hashed-at-rest server credentials with per-integration scopes. Never expose those credentials in browser SDK builds. An approved link maps the merchant's pseudonymous subject reference to an authenticated consenting consumer; a supplied owner UUID alone is not authority. One integration cannot read another's quotes, intents or links. Return only necessary eligibility reason, policy version and checkout status to integrators, never warning/history/other-merchant details.

MVP supports operator-provisioned sandbox integrations only. Approved Phase 6 consumer auth uses existing Supabase email/password sign-in, original session age < 24 hours and recent auth < 15 minutes for sensitive grants/increases. Refresh does not renew age. Tightening, cancellation, cooling-off and revocation require normal authorized access. Original auth time is verified against auth.sessions.created_at for the verified token's session_id/owner; unavailable timestamps require fresh sign-in. This approved contract refines the proposed table's generic recent-auth labels. An integrator cannot enroll users, increase their limits, revoke consent or initiate capture without recorded consumer confirmation.

## Proposed endpoints

All money is safe integer USD minor units. Unknown fields rejected. All mutations require Idempotency-Key; same canonical payload/key returns the same logical resource, changed payload is 409. Policy edits also require expectedVersion (409 on stale version). Responses include request/correlation ID and server timestamps, never credentials.

| Method/path | Principal and contract |
| --- | --- |
| GET /v1/me/protection | Consumer: coverage, effective/pending policy, source-specific balances, consent and refresh time. |
| POST /v1/me/consents | Consumer recent-auth: purpose, termsVersion, accept/revoke; server records time. Optional AI separate. |
| POST /v1/me/policy-changes | Consumer recent-auth: expectedVersion and requested caps; returns immediate/delayed effects. |
| POST /v1/me/policy-changes/:id/cancel | Consumer: cancel pending relaxation only. |
| POST /v1/me/cooling-off | Consumer recent-auth: duration selection and expectedVersion; start/extend only. |
| GET /v1/me/activity | Consumer: source filter, opaque cursor, pageSize <= 100; minimal owned evidence. |
| GET /v1/me/warnings | Consumer: cursor, pageSize <= 100; advisory evidence-linked warnings. |
| POST /v1/me/warnings/:id/dismiss | Consumer: presentation preference, no policy side effect. |
| POST /v1/me/integration-links | Consumer: approve a server-issued, single-use, expiring integration invitation; bind identity. |
| POST /v1/me/integration-links/:id/revoke | Consumer: stop new integrated authorizations, retain needed reconciliation. |
| POST /v1/me/export-requests | Consumer recent-auth: bounded asynchronous owned-data export; authenticated retrieval by request ID. |
| GET /v1/me/export-requests/:id | Consumer: status and authenticated export content when ready; no public download URL. |
| POST /v1/me/deletion-requests | Consumer recent-auth: stop new protected activity, schedule optional-data purge and necessary reconciliation. |
| POST /v1/integrations/link-invitations | Integrator: scoped pseudonymous reference; expiring invitation, no enrollment bypass. |
| POST /v1/integrations/quotes | Integrator: trusted checkout reference, amountMinor, currency USD; immutable quote/expiry. |
| POST /v1/protection/previews | Integrator: own link/quote; informational decision only, no authority token. |
| POST /v1/checkouts | Integrator: own link/quote; atomic policy decision + reservation + durable intent, or denial. |
| POST /v1/checkouts/:id/order | Integrator: own reserved intent; server creates/retrieves PayPal sandbox order. |
| POST /v1/me/checkouts/:id/confirm | Consumer: owned intent, confirm true; explicit approval and capture authorization via server verification. |
| GET /v1/checkouts/:id | Owning integrator or consumer: minimal state, verified capture reference when available. |
| POST /v1/checkouts/:id/cancel | Owning integrator or consumer: cancel only if safe, otherwise pending reconciliation. |
| POST /v1/providers/paypal/webhook | PayPal signature authentication; durable verified reconciliation, no caller-submitted verification flag. |

Denial is a successful evaluated resource result with decision: deny and reason; it is not a capture success. Validation 400, unauthenticated 401, unauthorized/not-owned 404, state/version/idempotency conflict 409, quota 429, dependency 503. Pending/unknown checkout can return 202 with resource state. SDK exposes typed errors plus distinct denial/pending types. Final OpenAPI locks exact envelopes and retry semantics before client implementation.

## SDK shape and integration order

Keep current workspace identifier @payment-risk/sdk unless a later approved rename is necessary. createConsumerClient accepts API base URL, user-token callback and injected fetch; createIntegratorClient is a server-only entrypoint accepting scoped credential and fetch. Methods map one-to-one to routes, return validated discriminated unions and support AbortSignal. Consumer methods: getProtection, setConsent, requestPolicyChange, cancelPolicyChange, startCoolingOff, listActivity, listWarnings, dismissWarning, approveLink, revokeLink, requestExport, getExport, requestDeletion and confirmCapture. Integrator methods: createLinkInvitation, createQuote, previewProtection, createCheckout, createOrder, getCheckout and cancelCheckout.

Participating server creates quote/link -> optionally previews -> creates checkout with a stable key -> requests order -> sends approval URL to consumer -> consumer approves in PayPal and explicitly confirms -> backend verifies and captures -> integrator polls status. Only verified completed state is payment success. Do not accept browser prices or use preview as authorization. Show the quote/amount to the consumer before confirmation.

SDK retries only documented transient 429/503/network failures with bounded backoff and the same mutation key/body. Capture confirmation never creates a fresh key after uncertainty. A timeout or AbortSignal cancels local waiting, not a dispatched provider operation. Read state to reconcile. No client-side policy enforcement, model calls, privileged keys, fake responses or automatic hidden fallback. No automatic capture on approval callback.

Deliver a runnable server-integration example and consumer example, API error catalog, pagination/quota documentation and integration tests against the real local API with mocked provider transport. Separate optional live sandbox walkthrough requires explicit user approval.
