# Payment Risk Lab

A developer platform for reproducible payment-risk experiments. The product reasoning lives in `docs/project-doc.md`. This file is the permanent operating contract for Codex.

## How we work

Spec-driven. Read this file, the relevant sections of `docs/project-doc.md`, and only the current `docs/specs/phase-NN.md`. Build that phase and stop. Do not implement future phases or quietly expand scope. If resuming without context, inspect the specs and git log; never assume a phase passed because code exists.

Before implementing, identify a genuine ambiguity only if it blocks progress. Ask one specific question, include your recommended answer and reason, then stop. Do not invent missing secrets, accounts, webhook payloads, transaction results, metrics, or deployment URLs.

After implementation run typecheck, lint, build, and relevant automated tests. Report failures truthfully. Browser, PayPal dashboard, external-account, and human-judgment acceptance checks belong to the user; never report them as passed without evidence. Give a short report: behavior built, commands and results, blockers, exact manual checks. Do not create a new phase until the user accepts the previous one.

## Stack

TypeScript strict, Node.js, React + Vite, Express, npm workspaces, Zod, Vitest, Supabase PostgreSQL, PayPal sandbox Orders API, OpenAI API, Render backend, Vercel frontend. Use stable compatible package versions. Avoid unnecessary frameworks. An API contract and typed SDK are deliverables, not prerequisites to every phase.

## Architecture invariants

- Synthetic data and PayPal-verified sandbox events are distinct types with immutable provenance. Never label simulated data as real PayPal activity.
- The simulator is deterministic under a seed, with virtual timestamps. No network, database, or model calls in its core.
- The risk rules and metric calculations are pure functions; their outputs can be independently verified.
- Ground truth is hidden from detectors at inference time. Train/tune and test data are separated by scenario templates and seeds. Report leakage risks.
- AI may classify/analyze or explain; it must not manufacture evidence, alter labels, initiate payments, or make irreversible financial decisions.
- No live-money wagering, casino operation, personalized slot odds, or player-targeted exploitation. Use fictional identities and sandbox accounts only.
- PayPal secrets and database privileged credentials stay on the server. Never log access tokens, secrets, full payment payloads, or personal payment data.
- Payment captures require explicit user approval, verified server-side order state, idempotency, and authenticated webhook handling. No fake success state.
- Monetary values use integer minor units or precise decimal strings, never floating-point arithmetic for settlement.
- Do not treat PayPal sandbox as a source of historical gambling transactions, and do not imply production gambling payment approval.
- Store minimal data. Limit and authorize all API reads/writes. Migrations are versioned. Never expose privileged database keys to browsers.

## Conventions

Strict types; no `any` without documented justification. Comments explain decisions, not syntax. One obvious implementation beats elaborate abstraction. Prefer small, deterministic tests. Do not weaken tests to make them pass. No hidden fallbacks. Document environment variables in `.env.example`, never commit `.env` files. Ask before installing major unplanned dependencies or changing providers.

## Communication

Be concise and precise. When a human must configure a service, give the exact variable name, the dashboard where it comes from, and the next verification step, then stop at that blocker. Never ask the user to paste secrets into chat. Treat missing external access as a blocker, not a reason to simulate a successful integration.
