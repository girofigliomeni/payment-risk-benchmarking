# PayPal capabilities and constraints

Official sources checked 2026-10-27. Recheck API behavior, permissions and jurisdiction-specific policies before implementation/deployment. The following are capability constraints, not approval to operate gambling.

## Scope of authority

[Orders v2](https://developer.paypal.com/api/orders/v2) supports creating a merchant order, approval and capture; [capture](https://developer.paypal.com/api/orders/v2/orders-capture) is an operation on a specific approved order. This does not provide an API to impose our consumer policy on arbitrary payments to other merchants. Consequently our product can withhold capture only in a participating flow controlled by its server. Sandbox credentials do not create universal blocking authority.

[Transaction Search](https://developer.paypal.com/api/transaction-search/v1/search-get) uses a reporting scope and client-credentials authorization; it does not grant this app a consumer-wide history feed. Authorized account reporting is not access to every user's purchases. The MVP requests no reporting/history integration and makes no claim of comprehensive gambling spend. Consumer consent alone does not create provider permissions. Future delegated merchant/reporting integrations would need capability verification and separate scope.

Reporting can lag by up to three hours, covers the previous three years and limits each query to 31 days according to that reference. Therefore even authorized reporting is unsuitable as synchronous capture-time budget authority. Use our own durable participating-flow ledger and verified order/capture reconciliation.

## Payment lifecycle constraints

[PayPal idempotency](https://developer.paypal.com/api/rest/reference/idempotency/) supports retrying some POST operations with PayPal-Request-Id while the provider retains the key. Support and retention are endpoint-specific, and simultaneous same-key calls may fail for one caller. Persist separate create/capture request IDs; serialize local dispatch; verify current endpoint retention before choosing retry limits. Do not treat provider idempotency as indefinite or as a substitute for database uniqueness and accounting.

[Webhook overview](https://developer.paypal.com/api/rest/webhooks) and [verification guidance](https://developer.paypal.com/api/rest/webhooks/rest/) describe app-scoped subscriptions and signature verification. Webhooks are asynchronous, can retry and are not a universal event feed. They cannot prevent a capture already executed. Verify every delivery, deduplicate durably and reconcile using authenticated provider reads; do not require webhook arrival to retain an uncertain budget.

Order approval is distinct from completed capture; our explicit confirmation is an additional application requirement. A pending capture, return URL or JS callback is not settlement evidence. Local cancellation is not a guarantee that a PayPal order was voided. Our internal budget reservation is not a PayPal hold or authorization. MVP excludes partial/multi-capture, multiple purchase units, FX, payouts, automatic refunds and production onboarding.

## Gambling and data limitations

[PayPal gambling policy](https://www.paypal.com/us/cshelp/article/what-gambling-activities-does-paypal-prohibit-help391) requires merchant approval for gambling payments in permitted jurisdictions. A sandbox demo or protection overlay does not establish that approval, licensing, age verification or legal compliance. Keep the demonstration a generic sandbox purchase; describe gambling-like behavior only in explicitly synthetic scenarios. Do not misclassify actual gambling payments as generic purchases.

The API does not establish user intent, addiction, harm, net gambling loss or reliable gambling categorization. Participating-flow classification is operator configuration separate from immutable verified payment facts. Sandbox data is test evidence; synthetic data is simulation; neither is real-world gambling history.

## Implementation verification required

Before Phase 8, confirm the actual sandbox app's credentials, webhook registration, permitted endpoints and documented idempotency retention without exposing secrets. External-account/browser checks remain user tasks. Before any real-money expansion, verify current regional policies and obtain appropriate approvals; that expansion is outside this roadmap.
