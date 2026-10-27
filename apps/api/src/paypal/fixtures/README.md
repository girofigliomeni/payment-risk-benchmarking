# Documentation-derived mock fixture, not recorded payment evidence

Source: [PayPal's webhook postback example](https://developer.paypal.com/api/rest/webhooks/rest/), accessed 2026-10-27.

`documentation-example.json` is a reduced example: provider identifiers and capture timestamp come from that public example. Personal/payee details and unrelated fields were removed; the amount was changed from 500.00 USD to the demo's 1.00 USD. Tests adapt this shape to simulate failures and mismatches. Order mocks use the [Orders v2 schema](https://developer.paypal.com/api/orders/v2) with the same correlated IDs and a test-only custom_id.

No actual delivery, signature, OAuth token, account, order creation, or capture has been recorded by this project. Signature success/failure is injected by a mock provider. These tests cannot establish that credentials or real webhook delivery work. Recorded redacted sandbox evidence remains a manual acceptance item, per the user's approved substitution.
