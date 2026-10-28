# Phase 6 — Benchmarking and research results

**Goal.** Produce defensible comparisons between rules, AI, and hybrid detectors on held-out synthetic experiments.

## Build

- Create train/development/test splits with disjoint seeds and scenario variants; store split manifests and dataset hashes.
- Lock model prompts, rule thresholds, and hybrid fusion before evaluating held-out test data.
- Compute TP/FP/TN/FN, precision, recall, F1, false-positive rate, support, and detection latency when event-level timestamps permit it. Handle zero denominators explicitly.
- Include per-scenario results, sample counts, cost/latency of AI, failure rates, and limitations.
- Persist immutable evaluation run manifests: dataset hash, code version, model version, thresholds, prompt version, run time, and outputs.
- Export JSON and Markdown research summary generated from actual stored results, with no fabricated numbers.

## Constraints

- Ground truth used only by evaluation after detector outputs are frozen.
- Do not select best model on held-out test set and then report the same set as unbiased confirmation.
- No performance claim without measured data and denominators. Synthetic results do not establish real-world accuracy.
- Explicitly distinguish simulation anomalies from legally or clinically meaningful harm labels.

## Codex checks

Hand-calculate a tiny confusion matrix and compare outputs; test zero positives, zero predictions, missing events, and split leakage; rerun fixed seed and compare deterministic portions. Report exact sample sizes and any nonreproducible AI variance.

## My acceptance check

Run the benchmark on a fixed dataset, inspect false positives and missed cases, confirm the report cites actual stored results, and verify the methodology explains synthetic limitations. A worse-than-rules AI result is acceptable.

## Not in this phase

Marketing claims, production fraud certification, dashboard redesign.
