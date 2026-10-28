# Consumer dashboard and policy specification

Status: unimplemented. Defaults below are proposed product choices requiring proposal approval, not clinical or legal recommendations.

## Enrollment and consent

Use authenticated Supabase accounts and fictional demo identities. Before opt-in explain participating-flow coverage and missing external activity. No automatic gambling classification from PayPal; a trusted integration config assigns protection scope while the underlying payment remains a generic sandbox purchase.

Enrollment requires an unchecked consent control, current terms version, explicit USD limits for both windows and confirmation. Record user, purpose, terms version, server timestamp and coverage. Separate unchecked AI consent permits minimal summaries to the model provider; withdrawal immediately stops optional inference without weakening deterministic protection. No marketing or merchant access to warning history. Require recent authentication for consent/policy changes; protect cookie-authenticated mutations against CSRF and validate origins.

Protection-consent revocation immediately stops new reservations and capture authorization, optional AI and new collection except necessary reconciliation/security records. Cancel unsent checkouts; reconcile in-flight operations. Revocation cannot recall a dispatched provider request. No silent unprotected fallback. Re-enrollment on a retained account preserves budgets, active cooling-off and pending delays. Cross-account evasion is an acknowledged limitation.

## Deterministic policy defaults

| Control | Proposed MVP semantics |
| --- | --- |
| Limits | User selects nonnegative safe integer USD minor units for rolling 24-hour and rolling 7-day gross-spend caps. Both apply across linked participating integrations. Zero blocks spending; do not choose a monetary default for the user. |
| Consumption | Verified completed gross captures plus all active reservations. Refunds, reversals, withdrawals and winnings never replenish gross-spend headroom. Verified adjustments may be displayed separately; automatic refunds are out of scope. |
| Time | Authoritative database UTC time, windows (t-duration, t]. Captures use verified provider capture time; reservations count in full until definitively released or replaced. Simulations use isolated virtual time. |
| Boundary | Permit exact equality; reject committed + reserved + requested above either cap, unsupported currency or overflow. |
| Cooling-off | User selects 24 hours, 7 days or 30 days; immediate start, no shortening/canceling, immediate extension. Expires at now >= endsAt; all other protections still apply. |
| Tightening | Lower caps apply immediately even below current spending; block new allocations without reversing payments. |
| Relaxation | Higher caps activate 24 hours after explicit confirmation. Pending values provide no headroom. Cancel pending increases immediately; resubmission restarts the delay. |
| Mixed edits | Apply tighter fields immediately; delay relaxed fields. New edits explicitly supersede conflicting pending values under version checks. |
| Coverage | One policy per consumer and source namespace, aggregating participating integrations. Synthetic and sandbox never share balances. No FX. |

A reservation not dispatched for capture expires after 15 minutes, but release requires proof no operation is in flight. Uncertain outcomes override expiry. Remaining budget displayed in the UI is a snapshot, never guaranteed authorization.

## Screens

1. **Overview:** persistent source badge and coverage notice; recorded gross spend, committed/reserved/remaining per window, last refresh and unresolved reconciliation. No combined source total or inferred gambling loss. Empty data never means zero spending everywhere.
2. **Activity:** paginated owned records, source filter, verified status, amount and timestamp. Detail explains reservation/capture correlation. No full payloads or other users' activity.
3. **My protections:** effective/pending versions, exact activation times with UTC and localized display, limit editor, cooling-off and cancel-pending controls. Confirm immediate versus delayed effects; no bypass.
4. **Warnings:** observations such as increased attempt frequency or approaching a chosen cap, evidence IDs, observation window and limitations. Offer voluntary policy review/cooling-off. No diagnosis, gambling encouragement, shame or gamification. Show unavailable/stale states. Dismissal preferences cannot change policy.
5. **Privacy:** terms history, separate AI toggle, export, deletion, sign out and consent revocation with precise effects.
6. **Protected sandbox checkout:** trusted server quote, deterministic decision/reasons/version, reservation, hosted approval, explicit capture confirmation and verified result. Pending/unknown never appears successful. Explain when a cooling-off action follows an already dispatched capture.

Require keyboard access, semantic labels, visible focus, screen-reader status and text alongside color. Distinguish unauthorized, denied, pending, unavailable and stale states. Version conflicts reread policy before reconfirmation. Client checks and provider success callbacks never authorize or prove capture.

## Privacy defaults

Propose 90-day retention for minimal payment/reservation/decision/audit metadata, 30 days for warnings/redacted model outputs and 24 hours for transient summaries. Never retain raw provider payloads. Do not expire unresolved operation, idempotency or correlation records while they affect accounting. Purge optional AI artifacts promptly on withdrawal/deletion; disclose minimal outstanding/security records and reasons. Export owned normalized activity, policy and consent history, never secrets or hidden labels.

Delete or pseudonymize identity links when reconciliation permits. Closing accounts cannot re-enroll/reset controls while closure is pending. Different accounts remain outside the anti-evasion guarantee. Backup erasure, model-provider retention and final retention terms require validation before public use; no guaranteed-erasure claim. Revocation permits bounded necessary reconciliation, never continued behavioral profiling.
