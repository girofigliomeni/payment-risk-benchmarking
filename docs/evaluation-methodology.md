# Evaluation methodology proposal

Status: no new datasets, warnings, metrics or results have been produced. Synthetic warning quality is not clinically validated harm prevention.

## Separate questions

1. Does protection-policy-v1 enforce the enrolled user's specified policy correctly under timing, concurrency and failures?
2. Do advisory behavioral warnings identify predefined synthetic behavioral patterns early and explain them accurately?
3. What latency, cost and failure rates does the integrated system exhibit?

rules-v1 remains a frozen research comparator for its original anomaly target. Original benign/anomalous actor-template labels are not harm labels and cannot silently become the new warning target. Report the original task separately. If comparing rules, AI and an advisory rules+AI warning strategy, fix a common explicit observable warning target and disclose any mapping limitations. No warning strategy controls eligibility.

## Datasets and leakage

Retain original development-v1/train files and hashes unchanged. Introduce versioned synthetic trajectories covering benign high-frequency behavior, sparse history, escalating spend/attempts, repeated failures, approaching user-chosen limits, cooling-off and policy changes. Policy scenarios have independent hand-authored expected decisions/state transitions. Warning labels describe operational pattern onset/eligible warning windows, not addiction or future harm; record annotator/rubric and disagreements.

Split by disjoint template families/variants, seeds and complete actor trajectories. Freeze split manifests and hashes before tuning; near-duplicate and identifier/amount/timing correlation audits prevent generator leakage. Original templates influenced rules-v1: disclose this and exclude them from unbiased confirmation. Model projection omits scenario name, labels, seed, dataset IDs and future events. Tune thresholds/prompts on train/development only; lock versions and budget before one held-out evaluation. Any revision requires new held-out data.

Verified PayPal sandbox events demonstrate integration correctness, not warning accuracy or real gambling behavior. They are not pooled with synthetic samples. No real-world cohort is assumed; future external validity studies require separate consent, governance and protocol.

## Warning measurements

Fix the unit (actor-window and episode) and window size before evaluation. Report support and TP/FP/TN/FN; precision, recall, F1, false-positive rate FP/(FP+TN), and false warnings per benign actor-day. Zero denominators are unavailable with counts, never silently zero. Separate failed/missing predictions from negative predictions and report coverage/abstention rates.

Define onset and a fixed eligible pre-onset horizon in the evaluation rubric. Lead time = onset timestamp minus first evidence-supported warning timestamp within that horizon; positive is early, negative is late. Show missed episodes, alerts outside horizon and late alerts separately; do not report only successful warnings. Report median/distribution and denominator; use virtual timestamps for synthetic lead time, wall-clock timestamps for request latency. Deduplicate alerts using a fixed cooldown and score both alert and episode counts.

Explanations must reference existing prior observable evidence and contain no unsupported facts or diagnoses. Measure schema/evidence validity, unsupported-claim rate and consistency with the stated observation. Human reviewers assess clarity, tone and usefulness under a recorded rubric; report as human review, not automated clinical validation. Compare against an explicit deterministic warning baseline; negative AI results are acceptable.

## Policy and system measurements

Independent oracle fixtures cover equality, zero caps, overlapping windows, exact boundary exclusion, UTC transitions, safe integer overflow, mixed edits, delayed activation, active cooling-off, revocation/re-enrollment, duplicate keys, partial failures, cross-integration budgets and source isolation. Policy correctness is expected versus actual decisions and state transitions, never a classifier score.

Use real isolated PostgreSQL transactions and multiple API/worker instances to test N simultaneous requests with total requests above the cap. Assert no oversubscription at reservation/capture authorization, unique facts, no duplicate allocation, no release of unknown captures and no unauthorized state change. Include process crash before/after dispatch, provider success before database failure, webhook-first and duplicate/out-of-order delivery, stale worker fencing and retention-window expiry. Report observed invariant violations explicitly; release gate is zero violations in the defined suite, not a universal proof.

Measure p50/p95/p99 wall-clock latency separately for preview, atomic reserve, capture authorization excluding provider time, end-to-end provider reconciliation and asynchronous AI warning. Record concurrency, environment, sample counts, warm/cold state and failures. Proposed demo targets: p95 reserve <= 500 ms at 10 concurrent clients; p95 advisory generation <= 10 s when provider succeeds. These are targets, not observed results; revise before test freeze with explanation.

Record actual model identifiers, prompt/schema versions, token usage, retries, cache hits, failure/timeout rates and priced-at-date cost per successful warning, attempted warning and experiment. Separate cached and uncached latency/cost; cost estimates cite pricing and unavailable usage stays unavailable. Fix a configurable maximum run spend and stop when reached; missing key blocks live inference, never simulates output.

## Artifacts and acceptance

Immutable manifests include code revision, engine/rules/model/prompt versions, datasets/splits/hashes, policy snapshots, thresholds, rubric, input/output hashes, timestamps, run environment, counts, failures, latency, usage and pricing date. Keep hidden labels in restricted evaluation storage. Store redacted warnings within consent/retention rules. Reproduce deterministic parts exactly; retain live AI output as recorded evidence without claiming byte-identical reruns.

Deliver hand-calculated metric fixtures, leakage checks, concurrency/failure test reports and JSON/Markdown results derived from actual outputs. Human acceptance inspects false positives, misses, explanations and limitations. No invented benchmark numbers or implied real-world harm reduction.
