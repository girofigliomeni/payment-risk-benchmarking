# Phase 11: Protection and warning evaluation

Status: proposed, unimplemented. Requires user acceptance of Phase 10 before implementation. Build only this phase, then stop.

## Goal

Measure correctness, warning quality, lead time, latency and cost without harm-prevention claims.

Read [project](../project-doc.md), [architecture](../protection-architecture.md), [consumer policy](../consumer-dashboard.md), [SDK/API](../developer-sdk.md), [evaluation](../evaluation-methodology.md) and [PayPal constraints](../paypal-constraints.md) as relevant. These linked documents define the shared contracts.

## Scope

- Create versioned held-out synthetic trajectories, separate operational warning labels and independent policy oracle fixtures per evaluation-methodology.md; preserve original development outputs.
- Freeze thresholds/prompts/versions/splits before test scoring. Evaluate warning strategies separately from rules-v1's original research task.
- Implement hand-verifiable metrics, coverage/failure reporting, lead-time rubric, concurrency/fault harness and immutable manifests; export actual JSON/Markdown results.
- Measure latency distributions and token/cost accounting with sample sizes, environment, cache separation and pricing date; enforce bounded spend.

## Acceptance and automated tests

- Hand-worked confusion matrices, zero denominators, missed/late warnings and lead time match calculations. Missing model predictions never silently become negatives.
- Leakage tests exclude labels/future observations and check template/seed/actor separation; all policy invariant tests pass without observed violations.
- Reports contain actual outputs/support/failures and limitations; sandbox events remain integration evidence, not warning ground truth. No fabricated live-model results when access is absent.
- Run npm run typecheck, npm run lint, npm run build, then npm test and any phase-specific storage/concurrency/contract checks above. Report commands/results and blockers truthfully. Do not weaken existing tests.

## Deliverables

Versioned scenarios/manifests, evaluation runner, metric tests, correctness/concurrency report and warning-quality/latency/cost results with limitations.

## User acceptance

Review false positives/misses, explanation usefulness and leakage risks; reproduce deterministic results and inspect recorded AI version/output. Worse-than-baseline results are acceptable; human judgment is reported separately.

## Out of scope

Clinical validation, real-world data collection, tuning on held-out test and new consumer features.

Preserve Phases 1–4 acceptance records and implementations. No following-phase work until explicit acceptance. Local mocks do not establish external-account or browser acceptance.
