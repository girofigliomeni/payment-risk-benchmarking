# Phase 2 — Deterministic simulation engine

**Goal.** Generate reproducible, realistic-enough synthetic payment streams with explicit known labels.

## Build

- Standalone simulator: input seed, population size, virtual duration, scenario mix, and amount ranges; output typed events and evaluation-only labels.
- Include normal activity, deposit velocity, repeated failures, abrupt amount changes, and unusual withdrawal timing. All are fictional and do not model actual casino users.
- Virtual timestamps, deterministic PRNG, stable ordering, unique IDs, reproducible manifests, and dataset hash.
- Generate observable events separately from scenario labels; preserve the distinction in serialized outputs.
- CLI that writes JSONL/summary to a local directory, supports `--seed`, and reports counts by scenario and event type.
- Document assumptions, deliberately overlapping scenarios, and dataset limitations.

## Constraints

- Pure local computation; no PayPal calls, OpenAI calls, DB, network, or real user information.
- Do not include scenario labels, hidden risk flags, or generator settings in detector-visible records.
- Same inputs produce byte-identical outputs. Different seeds should meaningfully differ.
- Avoid simplistic label leakage through event IDs or actor names.

## Codex checks

Run twice with the same seed and compare hashes; run with a different seed; validate all records; check chronological order and unique IDs; assert that inference exports contain no labels. Report counts and runtime for a medium-size fixture.

## My acceptance check

Run the CLI with the documented command. Inspect a few records and the separate labels file. Confirm provenance reads `synthetic`, scenario labels are absent from inference records, and rerunning a seed yields the same hash.

## Not in this phase

Risk models, PayPal, dashboards, persistent database.
