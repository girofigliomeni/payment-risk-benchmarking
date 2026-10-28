# Revised roadmap and product decisions

Status: documentation proposal dated 2026-10-27; no feature implementation authorized. Phases 1–4 remain preserved with historical evidence and its pending checks. The user must approve this pivot before Phase 5, and accept each implementation before the next.

## Implementation order

| Phase | Deliverable and dependency |
| --- | --- |
| [5](specs/phase-05.md) | Deterministic protection contracts and policy engine; first implementation gate |
| [6](specs/phase-06.md) | Consent, policy persistence and authorization; follows accepted Phase 5 |
| [7](specs/phase-07.md) | Atomic budgets and durable checkout intents; follows accepted Phase 6 |
| [8](specs/phase-08.md) | Protected PayPal sandbox checkout and reconciliation; follows accepted Phase 7 |
| [9](specs/phase-09.md) | Public API contract and typed developer SDK; follows accepted Phase 8 |
| [10](specs/phase-10.md) | Consumer dashboard and advisory early warnings; follows accepted Phase 9 |
| [11](specs/phase-11.md) | Protection and warning evaluation; follows accepted Phase 10 |
| [12](specs/phase-12.md) | Deployment, verification and hackathon submission; follows accepted Phase 11 |

The sequence deliberately establishes policy contracts, identity and durable accounting before connecting payment capture. The SDK then exposes tested server behavior; the dashboard and advisory warnings follow; held-out evaluation precedes deployment/submission.

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
| Consumer sign-in UX and recent-auth mechanism | Use existing Supabase Auth with fictional test users; select a supported method and exact session/re-auth lifetime during Phase 6 planning | Phase 6 |
| Legacy checkout in public demo | Disable its capture routes in protected deployment; retain Phase 3 historical behavior/tests as isolated operator scope | Phase 8, finalized Phase 12 |
| Provider-specific retry window | Confirm current Orders create/capture retention from official docs; configure bounded retry, query-only after expiry | Phase 8 |
| AI model, run budget and data handling | Choose a currently supported model after bounded dev comparison; record provider retention settings and per-run budget without sending secrets | Before live calls in Phase 10 |
| Warning rubric and time horizon | Use operational synthetic pattern labels and a fixed pre-onset horizon; expert/human clarity review stays separately reported | Before evaluation freeze in Phase 11 |
| Retention/deletion and backups | Validate proposed periods, outstanding-operation exceptions and provider/backup retention before public enrollment; sandbox-only until then | Phase 12 |
| Hackathon identity and rules | User identifies the event; verify official current rules and deadline then, with no eligibility claim now | Before Phase 12 submission work |
| Any production/real-world rollout | Separate legal/privacy/provider approval and empirical validation work; outside these phases | Outside roadmap |

No unknown credential, deployment URL, real-world dataset or fabricated metric is required to implement the pure Phase 5 engine. Live service availability becomes an explicit blocker only for the phase that needs it.

## Documentation change record

Updated AGENTS.md and project-doc.md to the responsible gambling protection objective. Added architecture/data-model, consumer, SDK/API, evaluation and PayPal-constraint proposals. Replaced old future Phases 5–8 with the first four steps of the new sequence and added Phases 9–12. Archived the previous objective and future specs byte-for-byte. README now distinguishes current implementation from future product work while retaining historical instructions/verification text.

Unchanged: Phase 1–4 specs, rules-storage.md, paypal-sandbox.md, application/package source, manifests, migrations, SQL tests, infrastructure configuration and credentials. No implementation, database operation, deployment or external payment was performed.
