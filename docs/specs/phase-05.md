# Phase 5 — AI-assisted and hybrid detectors

**Goal.** Evaluate an AI-assisted detector and a hybrid detector on the same observable evidence as the rules baseline.

## Build

- One server-side OpenAI client with model/config versioning, Zod output validation, timeouts, retries with limits, and explicit error states.
- Define bounded feature summaries and evidence event IDs. Send only necessary fictional/sandbox metadata; no sensitive payment payloads or hidden labels.
- AI detector outputs score, classification, evidence references, explanation, latency, token usage/cost estimate, and model version.
- Hybrid detector combines rules and AI with a fixed, documented fusion strategy and threshold; do not tune against test labels.
- Cache by normalized feature input, model version, and prompt version. Keep deterministic fixtures for tests.
- Include a no-key state that blocks live AI evaluation while leaving rules usable.

## Constraints

- No labels or scenario names in AI prompts, input features, logs, or caches.
- No invented event IDs or claims about real fraud. Invalid references are rejected.
- AI never captures, blocks, refunds, or changes payments.
- AI model stochasticity must be acknowledged; capture outputs and versions for reproducibility, not promise identical live calls.

## Codex checks

Mocked AI tests for schema violations, invented evidence, timeout, rate limit, missing key, cache behavior, and hybrid threshold boundaries. Run the same feature fixture through all detectors and report results.

## My acceptance check

Provide OpenAI key securely, run a small bounded experiment, inspect explanations against referenced event IDs, and confirm that removing the key produces an honest unavailable state rather than fake AI results.

## Not in this phase

Claiming AI beats rules, benchmarking on test labels, automatic financial actions.
