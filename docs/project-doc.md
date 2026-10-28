# Responsible Gambling Payment Protection

Status, 2026-10-27: Phase 5 was explicitly authorized and implemented; local automated verification is complete and human acceptance remains pending. Phases 6–12 remain unimplemented proposals requiring phase-by-phase approval. Repository/package identifiers remain unchanged.

## Objective

An opt-in consumer dashboard provides visibility into gambling-related spending recorded by participating flows, self-selected budgets, behavioral early warnings and cooling-off controls. A backend API and TypeScript SDK let participating developers enforce those protections before initiating payment capture.

The hackathon product uses fictional identities, synthetic gambling scenarios and a protected **generic PayPal sandbox test purchase**. It does not operate gambling, process live money or diagnose gambling harm. Protection means declining to initiate an integrated checkout under an enrolled user's deterministic policy. It does not mean freezing PayPal funds, controlling unrelated merchants or seeing a consumer's entire financial history. A merchant can bypass this integration outside our authority; disclose that limitation.

Success is demonstrable policy correctness and evidence-linked warnings on explicit test cases. No clinical harm-prevention, comprehensive coverage or production compliance claim follows from this demo.

## Preserved foundation

Phases [1](specs/phase-01.md), [2](specs/phase-02.md), [3](specs/phase-03.md) and [4](specs/phase-04.md), their implementations, tests and migrations remain unchanged. The pivot treats them as the completed foundation; existing records still contain pending human checks. This proposal does not resolve those checks or retroactively certify acceptance. Preserve [rules/storage evidence](rules-storage.md), [sandbox setup and evidence](paypal-sandbox.md), and README historical verification sections.

Current architecture: React/Vite apps/dashboard shows health, synthetic sample evidence and checkout; Express apps/api mounts health, sandbox and owned experiment routes; packages/core holds Zod contracts, pure rules-v1 and the separate pure protection-policy-v1 engine; packages/simulator generates deterministic local files; packages/sdk exports types only. Supabase experiment storage is server-mediated with restricted evaluation labels. Checkout sessions, locks and webhook deduplication are process-local, **not durable protection enforcement**.

The [history index](history/README.md) preserves the previous objective and superseded future phases. Keep rules-v1 thresholds, outputs, labels and experiment records unchanged. Its flag/pass result remains a research signal. The separate protection-policy-v1 engine evaluates consent, budgets and cooling-off; the behavioral warning service remains advisory. Separate types, versions, storage and UI prevent interchange.

## Proposed specifications

- [Architecture and data model](protection-architecture.md): server authority, atomic reservations, race semantics and reconciliation.
- [Consumer dashboard](consumer-dashboard.md): consent, policy defaults, privacy and UI.
- [API and developer SDK](developer-sdk.md): authenticated boundaries and protected integration.
- [Evaluation](evaluation-methodology.md): warning quality, policy correctness, latency and cost.
- [PayPal constraints](paypal-constraints.md): official sources and product implications.
- [Roadmap](roadmap.md): implementation order and unresolved decisions.

Keep TypeScript strict, Node.js, React + Vite, Express, npm workspaces, Zod, Vitest, Supabase PostgreSQL, PayPal sandbox Orders API, OpenAI API, Render backend and Vercel frontend. Extend existing workspaces without a new framework/provider. OpenAPI 3.1 and a real typed client are future deliverables.

## Evidence and safety

Synthetic evidence retains seeded virtual time and immutable source: synthetic. Verified sandbox evidence retains source: paypal_sandbox, provider IDs and verification metadata: it is a test purchase, not verified gambling. Protection category is separate trusted integration configuration, never rewritten provider provenance. Source-specific views and ledger namespaces prevent pooled synthetic/sandbox totals. Real-world ingestion is outside scope; no real-world data is currently available or assumed.

Labels, generator metadata and scenario names remain evaluation-only. AI receives a minimal observable projection and evidence IDs, never labels, identity, credentials or full provider payloads. It can explain observations and suggest voluntary action; it cannot modify policy, labels, reservations or payments. Model failure leaves policies in force and warnings visibly unavailable.

Money uses bounded safe integer minor units on the wire and checked integer arithmetic/storage. USD only; no FX, net-loss inference, payouts or automatic refunds. Reservations allocate internal budget, not funds or escrow.

## Delivery gate

Phase 5 implementation and local automated verification are complete; see the [Phase 5 specification](specs/phase-05.md) and [policy verification record](protection-policy-v1.md). Human acceptance remains pending. Wait for that acceptance and explicit Phase 6 approval before proceeding. Implement one accepted-scope phase at a time; run typecheck, lint, build and relevant tests; report manual checks and stop for acceptance. Existing pending evidence must be reviewed without implicitly initiating payment or deployment.
