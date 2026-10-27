# Payment Risk Lab

The product decisions behind this build. Read the relevant section before each phase. The reasons matter because they decide how to handle forks not explicitly specified.

## What it is

A developer-facing experimentation platform for testing payment-risk detection systems against reproducible synthetic payment activity, with a separate PayPal sandbox integration that demonstrates how verified payment lifecycle events enter the same normalized event pipeline. Developers compare a rules baseline, an AI-assisted detector, and a hybrid detector through an API, dashboard, and typed TypeScript SDK.

## The research question

Can an AI-assisted or hybrid detector improve on a deterministic rules baseline for specified synthetic payment-risk scenarios, measured on held-out simulations? We do not assume the answer is yes. Negative results and false positives are findings. This is a controlled benchmark, not a validated real-world fraud product.

## Who it is for

Developers, payment-integrations engineers, and researchers who need to test risk logic before using real transaction data. Gambling-like deposits and withdrawals are synthetic event categories, not real wagers or casino payments.

## The rule everything rests on

**Evidence and provenance before model output.** Each observation is traceable to either a reproducible synthetic event or a verified PayPal sandbox event. A model can analyze evidence, but cannot invent it. Labels for synthetic scenarios are ground truth for evaluation only and never shown to detectors while scoring.

## Why PayPal is central

The platform demonstrates a genuine sandbox checkout: create an order, approve, capture, verify the payment state, and process verified webhooks. These events are normalized into the same schema the risk detectors consume. The bulk simulation does not make thousands of PayPal API calls; it produces clearly marked synthetic data. A demo shows a verified sandbox event passing through ingestion and analysis. The experiment results never imply that PayPal endorses gambling activity or that synthetic events came from PayPal.

## Scope

- Seeded, deterministic simulator with virtual time and configurable scenarios.
- Event schema with immutable provenance, event IDs, timestamps, amounts, currency, actor IDs, and status.
- PayPal sandbox order and capture flow, verified webhook ingestion, idempotency, and event correlation.
- Rules-only, AI-assisted, and hybrid detectors with comparable scoring outputs.
- Held-out benchmark evaluation: precision, recall, F1, false-positive rate, confusion matrices, and detection latency where meaningful.
- Experiment history and audit trail in Supabase.
- React dashboard with side-by-side model comparisons, scenario exploration, and individual event evidence.
- Documented REST API and typed TypeScript SDK.
- Reproducible demo, tests, deployment, and submission assets.

## Out of scope, and why

- Real-money gambling, casino wallets, player deposits, payouts, or slot outcome manipulation: inappropriate for a sandbox research tool and introduces licensing and fairness risks.
- Automatic denial, freezing, or punitive action on a real person's payment: model outputs are research signals, not financial decisions.
- Claims of detecting real-world gambling harm or fraud: synthetic benchmarks cannot establish external validity.
- Ingesting real personal financial histories: no access, consent, or necessity for the MVP.
- Production multi-merchant onboarding, marketplace payouts, live PayPal processing: outside the hackathon MVP.
- PYUSD, Solana, Elastic, and AG Grid as mandatory dependencies: only add after the core system is validated.
- An LLM inventing ground-truth labels or selecting the test scenarios it later evaluates: causes evaluation leakage.

## Core event and evaluation contracts

Events distinguish `source: synthetic | paypal_sandbox`, `eventType`, `eventId`, `occurredAt`, `actorId`, `amountMinor`, `currency`, `status`, and provenance details. Synthetic events may carry scenario labels in a separate evaluation-only store. PayPal events must have provider identifiers and verification status. Unverified provider events never become trusted payment facts.

Detectors receive the same observable feature set, without ground truth or scenario names. Every detector returns score, decision, evidence event IDs, and model/rules version. Evaluation is done only after scoring, with a held-out test set and fixed thresholds. Report sample counts and uncertainty, not just percentages.

## Where this can go wrong

- Artificially easy synthetic anomalies produce misleadingly strong model scores. Include subtle and overlapping scenarios, hold out scenario variants, and publish limitations.
- AI may be slow, expensive, inconsistent, or fail to beat rules. Use a small bounded inference budget, record versions, and treat failures as measured outcomes.
- PayPal sandbox and simulator may be conflated. Enforce provenance in types, storage, API, and UI.
- Capture and webhook may both report the same payment. Correlate and deduplicate; never double-count.
- A plausible dashboard can hide broken math. Verify metrics with hand-computed fixtures and seeded reruns.

## Interface

A restrained developer research tool. Experiment setup and run status on the left; comparative metrics and charts in the center; event evidence and provenance on the right. Every displayed metric has a denominator and a way to inspect underlying examples. No animated gambling imagery, casino branding, or claims of guaranteed AI superiority.

## What must be true before submission

A seed reproduces the same dataset; labels never reach inference; baseline and AI use the same test events; metrics agree with hand-worked examples; a real PayPal sandbox capture is verifiable server-side; webhooks are authenticated and deduplicated; simulated and sandbox events are distinguishable everywhere; the SDK drives the real API; a second developer can run the project using documentation; no secrets are committed.
