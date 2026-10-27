# Phase 4 — Rules baseline and experiment storage

**Goal.** A deterministic risk baseline can score both synthetic and verified sandbox events, and experiments persist safely.

## Build

- Implement pure feature extraction over event windows: transaction velocity, failure ratio, amount deviations, timing patterns. Document every feature.
- Rules detector with explicit thresholds and reasons tied to event IDs; no access to hidden labels.
- Supabase SQL migrations for experiments, events, evaluation labels (restricted), detector runs, scores, and verified provider references.
- Server-side authorization for experiment ownership; least-privilege policies where browser access is enabled. Keep evaluation labels inaccessible to scoring routes.
- Ingestion endpoint validates events, provenance, size limits, and duplicate IDs. Provider events can only enter through verified provider adapter, not a public `source` field.
- CLI to run baseline on a saved seeded experiment and report decisions.

## Constraints

- No AI yet. Rules are deterministic and independently testable.
- Do not mark user-submitted JSON as verified PayPal activity.
- All privileged writes happen server-side; database service credentials never go to the browser.
- Schema changes via migrations, not manual dashboard edits.

## Codex checks

Test hand-constructed windows, boundaries, duplicate ingestion, cross-experiment isolation, and label-access denial. Typecheck/lint/build. Report actual migration/test results or credential blockers.

## My acceptance check

Create a Supabase project, configure keys locally, apply migrations, create two experiments, and verify events remain isolated. Run the baseline twice and confirm identical results. Confirm verified sandbox records are distinguishable from synthetic ones.

## Not in this phase

AI detection, metric comparisons, polished dashboard, production access.
