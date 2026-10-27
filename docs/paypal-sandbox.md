# Phase 3: generic PayPal sandbox test purchase

This is a test-only purchase with fictional local actor IDs. It is not a wager, casino deposit, live-money checkout, or production merchant integration. Synthetic datasets remain in the simulator; the checkout only emits `source: paypal_sandbox` after provider verification.

## Setup and next verification steps

1. Sign in to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/), select **Sandbox**, then **Apps & Credentials**. Create/select a REST app associated with your sandbox business account. Put its **Client ID** in `PAYPAL_CLIENT_ID` and its **Secret** in `PAYPAL_CLIENT_SECRET` in the repository-root `.env`. Do not use live credentials or any `VITE_` prefix. These values are server-only. Next: finish webhook registration below, restart the API, and confirm the UI leaves setup-required. The first order request will test OAuth; readiness alone does not verify credentials. [Official credential setup](https://developer.paypal.com/api/get-started/).
2. In **Testing Tools > Sandbox Accounts**, locate/create a **Business** seller and a separate **Personal** buyer. Use **View/Edit Account** to get the sandbox login information. These account passwords belong only in PayPal's sandbox login pages, never in this application's configuration. Next: use the Personal account during hosted approval and the Business account to inspect the transaction.
3. Generate a random local access code of at least 32 characters (maximum 256), for example with your password manager, and set `CHECKOUT_ACCESS_KEY` in `.env`. This is a local operator authorization code, not a PayPal credential. Enter it only in the local checkout password field; the page clears it after use. Never include codes, tokens, credentials, or personal sandbox login details in screenshots, chat, or committed files. Next: authorize a local test session.
4. Keep `CHECKOUT_ORIGIN=http://127.0.0.1:5173` and open that exact URL, not `localhost`. The origin has no trailing slash. Leave `CHECKOUT_AMOUNT_MINOR=100` for a 1.00 USD test purchase. This is a server-only integer configuration restricted to 1 to 10000 minor units; currency is fixed to USD. Restart after changes; create a fresh session if changing the amount.
5. Start the app with `npm run build` followed by `npm run dev`. Vite proxies `/sandbox` to `VITE_API_BASE_URL` (default `http://127.0.0.1:3001`); cookie-authenticated checkout requests use this same-origin path. Health polling keeps its existing API URL behavior. Vite's strict port prevents a silent origin change. In a hosted environment, supply an equivalent same-origin reverse proxy and an exact HTTPS `CHECKOUT_ORIGIN`; hosted deployment is not part of this phase.
6. Expose the API's local port through an HTTPS tunnel, using the repo-local ngrok setup: run `npm run tunnel:install` on Windows, add `NGROK_AUTHTOKEN` from [your ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken) to the ignored root `.env`, then run `npm run tunnel:check` and `npm run tunnel` in a separate terminal. On other operating systems install the official ngrok CLI on PATH. The launcher follows `PORT` (default 3001), disables request inspection/local inspector logging, and does not pass PayPal/database/model credentials to ngrok. The Windows installer stores the official binary under gitignored `.tools/ngrok`, without changing your system PATH. Follow [ngrok's local-sharing setup](https://ngrok.com/docs/getting-started/) for installation/account configuration. Register the **actual assigned HTTPS URL** with `/sandbox/webhook` appended. Do not substitute a fabricated deployment URL. Only webhook delivery needs the public URL; keep browser checkout local with the configured origin. Disable request/body inspection or retention on the tunnel so personal provider payloads and verification headers are not retained in tunnel logs. Do not copy tunnel request dumps into the repository.
7. Under the same **Sandbox REST app**, add a webhook using that URL and subscribe to **PAYMENT.CAPTURE.COMPLETED**. Copy the resulting webhook ID to `PAYPAL_WEBHOOK_ID` in `.env`; it is not the client ID or an event ID. Restart the API. Next: make a real sandbox purchase and inspect delivery in the Developer Dashboard. [Official webhook registration/verification guide](https://developer.paypal.com/api/rest/webhooks/rest/).

Missing `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, or `CHECKOUT_ACCESS_KEY` produces an explicit `setup_required` state. Empty values are not replaced with mock credentials. Invalid nonempty configuration fails startup with names only. Never paste secrets into chat. No external payment or webhook checks are claimed by local automated tests.

## Flow and trust boundaries

Authorize a test session, create the fixed-price order, and follow the returned hosted PayPal sandbox link. After approving on PayPal, return and explicitly select **Confirm and capture test purchase**. Nothing captures merely because a URL contains `checkout=approved`, `token`, or `PayerID`. Return parameters are removed from browser history and are never evidence.

The server verifies the order ID, `intent: CAPTURE`, approved state, single purchase unit, session-owned `custom_id`, USD currency, and exact decimal amount before initiating capture. It then performs another authenticated PayPal order GET and requires a completed order with exactly one completed, final capture of the expected amount. Only then does it expose a capture ID and normalized event. Provider errors/declines, pending status, malformed responses, and amount/ownership mismatches never generate a success event. If the outcome is uncertain, refresh or retry the same session; do not create another order to work around an error.

Each session gets different UUID request IDs for create and capture; retries reuse the original ID. Operations on a session are serialized, so concurrent clicks cannot send competing capture calls. After an uncertain POST, GET reconciliation may discover the completed capture without another POST. [PayPal idempotency reference](https://developer.paypal.com/api/rest/reference/idempotency/).

The webhook endpoint retains raw JSON bytes for postback verification with the configured webhook ID and all five PayPal transmission headers. It checks header presence, bounded size, a PayPal HTTPS certificate URL, and a transmission timestamp no more than three days old/five minutes in the future. Only PayPal's `SUCCESS` verification result is trusted. Documentation/example fixtures cannot pass the real verifier. PayPal's standalone webhook simulator does not support postback verification; use an actual event from this sandbox REST app for acceptance.

A verified completed webhook must belong to a known local order whose capture was explicitly initiated, match the configured amount/currency, and match the capture ID returned by an authenticated order GET. Capture response and webhook resolve to the same event ID (`paypal_sandbox:capture:<capture ID>`), not two payments. Provenance keeps actual order and capture IDs; `providerEventId` is the capture resource ID verified by GET, while webhook envelope IDs are tracked separately. Provenance remains immutable after creation. Unknown event types/orders are acknowledged and ignored without importing provider facts. Repeated verified event IDs with identical bodies are acknowledged as duplicates; a changed body under the same ID is rejected. Every delivery, including duplicates, must pass signature verification.

Cancellation is local: it prevents this session from initiating capture and does not pretend to void a PayPal order. Cancellation is refused after capture has started, including uncertain outcomes. A cancelled session can be inspected; clear the `sandbox_session` cookie (browser storage tools) or wait for expiry before authorizing a fresh checkout.

## Local API

| Route | Authorization and behavior |
| --- | --- |
| `GET /sandbox/config` | Public setup state, missing variable names, fixed amount, source; no credential values. |
| `POST /sandbox/session` | Exact configured Origin plus JSON `{ "accessKey": "<local access code>" }`; issues HttpOnly/SameSite=Strict cookie, Secure for HTTPS. Reauthorization preserves an active session. |
| `GET /sandbox/session` | Session cookie; only this session's order, approval URL, verified event, and webhook count. |
| `POST /sandbox/orders` | Session cookie and Origin; empty JSON object; create/retrieve this session's single order. Client amount/currency fields rejected. |
| `POST /sandbox/capture` | Session cookie and Origin; exactly `{ "confirm": true }`; server checks approval then captures/reconciles. |
| `POST /sandbox/cancel` | Session cookie and Origin; empty JSON object; local cancellation only. |
| `POST /sandbox/webhook` | Provider signature authentication, not a browser session; raw application/json up to 64 KiB. |

All sandbox routes have no-store responses and a global per-process 120-requests/minute limit. Browser JSON is limited to 1 KiB. No general event-list API or privileged client key exists. Only safe error codes are returned; raw provider payloads, payer details, tokens, secrets, and request headers are not logged. HTTP-only cookies are never embedded in JS bundles or URLs.

## Process-local limits

This phase deliberately has no database. Sessions expire for browser access after one hour, within PayPal's documented idempotency retention window. Keep one API process running through checkout and webhook acceptance. It retains up to 1000 session/order correlations and up to 100 unique verified webhook IDs per session; capacity exhaustion fails explicitly rather than evicting payment state. Expired browser sessions remain available for correlating delayed verified webhooks in the same process.

A restart loses local sessions/events and deduplication records. Old cookies/orders become unknown and cannot be captured through this process; unmatched webhooks are ignored. Do not restart or hot-reload the API during the manual payment lifecycle. This is not durable payment storage or a multi-instance design; no cross-restart history, global exactly-once guarantee, or production readiness is claimed. Check uncertain pre-restart orders in PayPal before starting a new session.

## Automated and manual acceptance

`npm run typecheck`, `npm run lint`, `npm run build`, and `npm test` cover the existing phases plus mock successful/declined/cancelled flows, unauthenticated/cross-origin access, explicit capture consent, amount/currency/ownership mismatch, pending capture, safe retries, timeout reconciliation, webhook signature failures, duplicates/replay conflicts, correlation, request bounds, and secret-safe responses. Fixtures are reduced/adapted [official documentation examples](../apps/api/src/paypal/fixtures/README.md), **not recorded sandbox activity**, as approved by the user. Tests make no real provider requests.

Manual checks, which remain pending:

1. Without credentials, confirm **Setup required**, no fake event, and the unchanged synthetic sample section.
2. Configure the app/accounts/tunnel/webhook above. Authorize a local session, create an order, and log in with the sandbox Personal buyer on the hosted **sandbox** checkout. Approve, return, and confirm the UI has not claimed a capture yet.
3. Explicitly confirm capture. Verify the order and capture ID, amount, currency, and completed status in PayPal's Developer Dashboard/API call history and sandbox Business transaction details. Match the displayed IDs. Do not screenshot access codes or personal details.
4. Wait for the actual registered-app webhook, then select **Refresh verified status**. Confirm one logical sandbox payment, verified webhook count 1, and `source: paypal_sandbox` with order/capture provenance. Synthetic sample data must remain separately labeled.
5. Resend that same event through the Developer Dashboard webhook event view. Refresh: the logical payment stays 1 and the webhook ID count stays 1. Repeating the capture request must return the same capture/event ID.
6. In a fresh session, cancel through PayPal's hosted flow, then cancel locally. Confirm no verified capture ID or success appears. Return-query tampering or calling capture before PayPal approval must not produce an event.
7. Record a **redacted** acceptance note containing only relevant sandbox order/capture/event IDs, verification outcome, and duplicate observation. Do not check in raw payloads, signatures, personal account details, or credentials. The documentation-derived fixture cannot stand in for this evidence.

Phase 3 is not accepted/complete until a genuine sandbox capture and verified duplicate delivery have passed these human checks. No Phase 4 work is included.
