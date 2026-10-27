# Phase 3 — PayPal sandbox payment lifecycle

**Goal.** One real, verified PayPal sandbox payment can be ingested as a trusted sandbox event.

## Build

- Server-only PayPal OAuth and Orders API integration: create, approve through hosted PayPal checkout, capture, verify status, correlate order/capture IDs.
- Minimal sandbox checkout page explicitly labeled test-only; show a genuine capture ID only after successful provider verification.
- Server-verified webhook endpoint with signature verification, replay/idempotency protection, safe logging, and event normalization.
- Distinguish `paypal_sandbox` events from synthetic events at type, API, and UI levels. Correlate capture response and webhook without double-counting.
- Mockable provider adapter and automated tests for successful, declined, canceled, repeated, and invalid-signature flows.
- Document precise setup: PayPal developer app, sandbox business and personal accounts, webhook registration, environment variables, local webhook exposure.

## Constraints

- Do not run real-money payments or represent a gambling merchant to PayPal. The sandbox demo is a generic test purchase, not a wager or deposit.
- No secret or bearer token in client bundle, logs, screenshots, or repository.
- Server sets amount and currency from an authorized test-session configuration; client cannot arbitrarily change capture amount.
- Never trust a client success callback as proof of capture. Webhooks must be verified before trust.
- Missing credentials produce an explicit setup-required state, not a fake successful payment.

## Codex checks

Unit/integration tests using recorded redacted fixtures and mocked provider responses. Verify invalid webhook signatures rejected, duplicates ignored, capture retried safely, and amount mismatch rejected. Run typecheck/lint/build.

## My acceptance check

Supply sandbox credentials through local environment settings, configure webhook, complete checkout with sandbox buyer, and verify the order/capture in PayPal developer dashboard. Trigger duplicate delivery and confirm only one logical payment event. If credentials are unavailable, mark phase blocked, not complete.

## Not in this phase

Production merchant onboarding, gambling payments, mass PayPal transactions, risk models.
