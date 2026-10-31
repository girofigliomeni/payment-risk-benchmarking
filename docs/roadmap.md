# Revised roadmap and product decisions

Status, 2026-10-30: Phase 5 is implemented and accepted by the user. Phase 6 is **ACCEPTED — BACKEND/STORAGE SCOPE ONLY**, following explicit human reviewer approval reported by the user. Evidence: 114 hosted checks with zero failures, 36 focused local tests, 86 storage assertions and preserved historical research data/security permissions. See [scoped decision and deferrals](phase06-human-acceptance.md) and [deployment evidence and advisor findings](phase06-hosted-deployment.md). This is milestone acceptance, not production readiness. Phases 7–12 remain proposals requiring separate explicit authorization; Phase 7 is not authorized. Phases 1–4 retain their historical evidence and pending checks.

## Implementation order

| Phase | Deliverable and dependency |
| --- | --- |
| [5](specs/phase-05.md) | Deterministic protection contracts and policy engine; first implementation gate |
| [6](specs/phase-06.md) | Consent, policy persistence and authorization; ACCEPTED — BACKEND/STORAGE SCOPE ONLY |
| [7](specs/phase-07.md) | Atomic budgets and durable checkout intents; follows scoped Phase 6 acceptance but requires separate explicit approval, not granted |
| [8](specs/phase-08.md) | Protected PayPal sandbox checkout and reconciliation; follows accepted Phase 7 |
| [9](specs/phase-09.md) | Public API contract and typed developer SDK; follows accepted Phase 8 |
| [10](specs/phase-10.md) | Consumer dashboard and advisory early warnings; follows accepted Phase 9 |
| [11](specs/phase-11.md) | Protection and warning evaluation; follows accepted Phase 10 |
| [12](specs/phase-12.md) | Deployment, verification and hackathon submission; follows accepted Phase 11 |

The sequence deliberately establishes policy contracts, identity and durable accounting before connecting payment capture. The SDK then exposes tested server behavior; the dashboard and advisory warnings follow; held-out evaluation precedes deployment/submission.

Phase 6 explicitly deferred criteria remain **NOT VERIFIED**: real hosted 24-hour authentication rejection; real elapsed-time delayed activation; real elapsed-time export expiry and exact deadline/duration assertions; interactive Phase 6 consumer UI testing; production retention and final-erasure lifecycle. None is promoted to PASS by scoped acceptance. Existing synthetic acceptance records, including User B's closure_pending state, remain isolated and retained. The closure authorizes no hosted changes, cleanup, implementation or merge.

## Defaults proposed for approval

- USD-only rolling 24-hour and 7-day gross-spend caps chosen by the consumer; both enforced across linked participating integrations within an isolated source namespace.
- Immediate tightening and cooling-off; higher limits wait 24 hours. Cooling-off choices are 24 hours, 7 days and 30 days, without early cancellation.
- Consent withdrawal immediately stops new protected authorization and optional processing; no unprotected fallback. Necessary already-dispatched reconciliation continues.
- Reservations expire after 15 minutes only when no operation can still capture; unknown outcomes hold budget until verified.
- Refunds/reversals do not restore gross-spend headroom. No FX, net-loss estimates, payouts, automatic refunds or real-world history ingestion.
- Optional AI warnings never control eligibility; new deterministic policy engine stays separate from frozen rules-v1.
- Proposed retention: 90-day minimal payment/audit metadata, 30-day warnings, 24-hour transient summaries, with unresolved-operation exceptions and explicit disclosure.

These values are product defaults for a fictional sandbox demonstration, not evidence-based clinical settings. Approval establishes implementation semantics; later changes require versioned documentation and tests.

## Unresolved decisions and gates

| Decision | Recommendation | Needed by |
| --- | --- | --- |
| Accept policy defaults and revocation semantics | Approve the explicit defaults above, especially no silent unprotected checkout and already-dispatched capture caveat | Before Phase 5 |
| Existing acceptance gaps | Review current rules-storage.md/paypal-sandbox.md/README evidence with the user; do not rewrite past records or assume pending checks passed | Before relying on the affected integration in Phase 8 |
| Consumer sign-in and recent-auth mechanism | Approved 2026-10-27: existing Supabase email/password; protected API original authentication age < 24 hours; sensitive grants/increases require < 15 minutes. Refresh never resets age. Verified token session_id maps to auth.sessions.created_at; unverifiable/missing/expired/future sessions require fresh sign-in. Tightening, cooling-off, cancellation and revocation use normal authorized access. See [implementation and verification](phase06-storage.md). | Backend/storage scope accepted; real hosted 24-hour rejection deferred, NOT VERIFIED |
| Legacy checkout in public demo | Disable its capture routes in protected deployment; retain Phase 3 historical behavior/tests as isolated operator scope | Phase 8, finalized Phase 12 |
| Provider-specific retry window | Confirm current Orders create/capture retention from official docs; configure bounded retry, query-only after expiry | Phase 8 |
| AI model, run budget and data handling | Choose a currently supported model after bounded dev comparison; record provider retention settings and per-run budget without sending secrets | Before live calls in Phase 10 |
| Warning rubric and time horizon | Use operational synthetic pattern labels and a fixed pre-onset horizon; expert/human clarity review stays separately reported | Before evaluation freeze in Phase 11 |
| Retention/deletion and backups | Validate proposed periods, outstanding-operation exceptions and provider/backup retention before public enrollment; sandbox-only until then | Phase 12 |
| Hackathon identity and rules | User identifies the event; verify official current rules and deadline then, with no eligibility claim now | Before Phase 12 submission work |
| Any production/real-world rollout | Separate legal/privacy/provider approval and empirical validation work; outside these phases | Outside roadmap |

No unknown credential, deployment URL, real-world dataset or fabricated metric is required to implement the pure Phase 5 engine. Live service availability becomes an explicit blocker only for the phase that needs it.

## Documentation change record

Phase 6 scoped closure, 2026-10-30: recorded the human reviewer's approval reported by the user as ACCEPTED — BACKEND/STORAGE SCOPE ONLY. The 114 hosted checks, 36 focused local tests and 86 storage assertions support that decision; historical data and permissions remain preserved. The five explicit deferrals above remain NOT VERIFIED, and known security/operational findings remain open. This documentation-only closure does not establish production readiness or authorize Phase 7, hosted changes or merging. Earlier dated records below remain historical evidence.

Phase 6 decision and implementation, 2026-10-27: the user explicitly accepted Phase 5, authorized Phase 6, and approved the authentication contract above. Protection state persists independently of sessions; expiration, refresh, new sign-in and re-enrollment cannot reset it. A narrow private session lookup supplies the original authentication timestamp; neither refreshed JWT iat nor account-wide last_sign_in_at is used. The remaining change record below describes the earlier documentation pivot, not the later Phase 5/6 implementation.

Updated AGENTS.md and project-doc.md to the responsible gambling protection objective. Added architecture/data-model, consumer, SDK/API, evaluation and PayPal-constraint proposals. Replaced old future Phases 5–8 with the first four steps of the new sequence and added Phases 9–12. Archived the previous objective and future specs byte-for-byte. README now distinguishes current implementation from future product work while retaining historical instructions/verification text.

Unchanged: Phase 1–4 specs, rules-storage.md, paypal-sandbox.md, application/package source, manifests, migrations, SQL tests, infrastructure configuration and credentials. No implementation, database operation, deployment or external payment was performed.
