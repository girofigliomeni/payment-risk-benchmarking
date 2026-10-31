# Phase 5 policy semantics

Implemented locally for Phase 5; accepted by the user on 2026-10-27. This reference does not certify the preserved Phase 1–4 pending checks. No database, checkout, SDK client, dashboard or AI behavior is added by Phase 5.

## Contracts and authority

`packages/core/src/protection.ts` exports strict Zod schemas and pure functions. Times are explicit nonnegative UTC epoch milliseconds, bounded to the JavaScript date range. Monetary values are nonnegative safe integer USD minor units. Sources are `synthetic` or `paypal_sandbox`; each evaluation has one policy/source namespace. The caller must authenticate the subject, validate trusted quotes and provenance, and supply a complete, consistent source-specific snapshot. These functions do not establish that authority.

`evaluateProtection` accepts effective consent/policy, authoritative time, quote, committed gross captures and active reservations. Pending policy changes are resolved separately by `advanceProtection`. Future captures, future-effective policy, duplicate IDs within a snapshot collection, unknown fields, malformed policies and unsafe inputs throw `ZodError`; a wrapper must treat invalid policy as an error/invalid_policy and never authorize. Authority/dependency failure is unavailable, not a fabricated policy denial.

Committed input contains only immutable verified completed gross captures (or isolated synthetic equivalents), never refunds, reversals, winnings or withdrawals. Adjustments cannot restore headroom. Active reservations count in full in both windows regardless of age; only later authoritative orchestration may release or replace them. Do not supply a committed capture and its replaced reservation together. When rechecking an existing reservation, the caller excludes exactly that reservation and uses its immutable amount as the quote; all other reservations remain included. No automatic expiry/release is implemented here.

Windows are `(now - duration, now]`, for 86,400,000 and 604,800,000 milliseconds. UTC elapsed time avoids daylight-saving calendar ambiguity. Other-source rows are excluded; integrations are deliberately not a budget partition. Remaining headroom is `max(0, cap - committed - reserved)` **before** the requested amount. Equality is allowed, including a zero-valued request at zero caps; any positive spend at zero caps is denied. A tightened cap below existing consumption produces zero remaining, without reversing prior payments.

Sums/comparisons use BigInt. If consumption plus quote exceeds the safe integer range in either window, deny without returning imprecise window totals (`windows: null`). Version and transition-time overflow also fail validation.

## Decision precedence

After structural validation, the first matching reason wins:

1. `consent_required`: protection enrollment absent/revoked; no unprotected fallback.
2. `unsupported_currency`: quote currency is not USD.
3. `cooling_off_active`: now is strictly before coolingOffUntil.
4. `arithmetic_overflow`: unsafe aggregate in either window.
5. `limit_exceeded`: either window would exceed its cap.
6. `allowed`: all checks pass.

Decisions include engine, policy/consent versions, source, evaluation time and both applicable windows (unless aggregate overflow). AI consent has no eligibility effect. No model output or detector score is accepted. Existing rules-v1 research contracts, thresholds and outputs remain separate and unchanged.

## Version transitions

All transitions receive time explicitly and first materialize due pending caps. Callers must compare expectedVersion to this resulting version, then reread/reconfirm on conflict. Each successful edit, cancellation, cooling-off action or delayed activation increments the policy version; no-op submissions also create a new version. Overflow fails rather than wrapping.

`editProtectionCaps` receives the complete desired pair of caps. Lower values take effect immediately. Higher fields remain at their old values until exactly confirmation + 24 hours. Mixed edits combine these rules. A complete new edit explicitly supersedes the old pending pair; resubmission restarts the delay. `cancelProtectionRelaxation` removes pending increases immediately and keeps effective caps. `advanceProtection` applies due caps at their scheduled activation timestamp, with no current-clock access.

`startProtectionCoolingOff` accepts only 1, 7 or 30 elapsed days, starting immediately. The end is max(existing end, now + duration), so it cannot shorten or cancel a period. This transition preserves pending caps and their original delay, rebinding them to the new policy version. At now >= end the cooling-off restriction expires; other checks remain active. Revocation/re-enrollment must preserve the policy state, pending delay and ledger; consent persistence is Phase 6 work.

## Hand-worked fixtures and verification

The independent fixtures in `packages/core/src/protection.test.ts` use virtual time t=10 days, daily cap 100 and weekly cap 200 minor units:

| Committed | Reserved | Request | Expected |
| --- | --- | --- | --- |
| 60 at t | 0 | 40 | allow; remaining before request 40 daily / 140 weekly |
| 61 at t | 0 | 40 | limit_exceeded daily |
| 160 at t-2 days | 0 | 40 | allow, weekly equality |
| 161 at t-2 days | 0 | 40 | limit_exceeded weekly |
| 60 at t-1 day, 200 at t-7 days | 0 | 40 | allow; oldest excluded from both, 60 only in week |
| 30 at t | 31 | 40 | limit_exceeded daily |
| 200 in other source | 200 in other source | 40 | allow; isolated namespace remains empty |

Transition oracle: editing caps 100/200 to 50/300 at t creates version 2 with 50/200 effective and 50/300 pending. At t+24h-1ms it remains unchanged; at t+24h version 3 has 50/300. Tests also cover one millisecond inside each window, overflow, stale versions, cooling-off expiry/extension, cancellation, revocation and repeatability.

## Future capture integration contract

This result is informational, never a reservation, payment authorization or authority token. Later phases must lock the subject, materialize policy changes and evaluate a consistent database snapshot atomically with reservation/capture-dispatch persistence. The commit of the persisted capture dispatch under current consent/policy versions is the capture authorization linearization point. Earlier revocation/tightening wins; later changes cannot reliably recall already-dispatched operations. Uncertain operations retain budget until verified reconciliation. Phase 5 provides no storage/concurrency or provider guarantee, and requires no browser/provider checks.

## Local verification record — 2026-10-27

Implemented by Codex at the user's explicit Phase 5 request. `npm run typecheck`, `npm run lint`, `npm run build` and `npm test` passed. Vitest reports 12 files / 108 tests, including 28 new Phase 5 tests and the 80 existing regression tests. Build and test initially encountered sandbox subprocess `EPERM`; both passed when rerun with authorized subprocess access. Build emitted non-failing third-party Zod annotation warnings. `git diff --check` passed.

The optional existing `npm run test:storage` could not start: `PHASE4_PGLITE_MODULE` is unset. To rerun that local verifier, set this shell variable to the absolute entrypoint of an installed `@electric-sql/pglite` package, then run the command. No SQL, hosted account or infrastructure was changed. This limitation does not establish or invalidate historical hosted acceptance; its pending checks remain unchanged.

The user accepted the examples, rolling windows, 24-hour relaxation delay, gross-spend accounting and revocation semantics on 2026-10-27 by replying “I accept” to the explicit acceptance question. Phase 6 was separately authorized by the user's implementation request. This acceptance does not resolve historical Phase 1–4 checks or establish hosted/browser verification.
