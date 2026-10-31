# Responsible Gambling Payment Protection

An opt-in consumer dashboard and developer enforcement API/SDK built on the preserved Payment Risk Lab foundation. Product authority lives in docs/project-doc.md and its linked architecture, consumer, SDK, evaluation and roadmap specifications.

## How we work

Spec-driven. Before implementation read this file, relevant product sections and only the current docs/specs/phase-NN.md. The documentation pivot reads all phases by explicit request. Preserve Phases 1–4 source, migrations, tests and historical acceptance evidence. Never infer acceptance from code or erase pending checks. docs/history contains superseded plans, not current instructions.

Phase 5 was explicitly authorized, implemented and accepted by the user on 2026-10-27. On 2026-10-30, the user reported the human reviewer's approval of Phase 6 as ACCEPTED — BACKEND/STORAGE SCOPE ONLY, supported by 114 hosted checks with zero failures, 36 focused local tests, 86 storage assertions and preserved historical data/security permissions. Hosted migration 20261028022432 on ymsbiagwhgxultjoryzf remains as deployed; see docs/phase06-hosted-deployment.md and docs/phase06-human-acceptance.md. This is scoped milestone acceptance, not production readiness. Explicitly deferred and NOT VERIFIED: real hosted 24-hour authentication rejection; real elapsed-time delayed activation; real elapsed-time export expiry and exact deadline/duration assertions; interactive Phase 6 consumer UI testing; production retention and final-erasure lifecycle. Do not promote these deferrals to PASS. Phases 7–12 remain proposals, not implemented or authorized. Phase 7 requires separate explicit approval; this closure authorizes no implementation, deployment or merge. Implement only the approved phase, then stop for user acceptance before the next. Prewritten future specs are planning artifacts, not authorization. Inspect specs and git log when resuming.

If a genuine ambiguity blocks implementation, ask one specific question with a recommended answer and reason, then stop. Never invent secrets, accounts, webhook payloads, payment results, metrics or deployment URLs. Documentation work does not authorize external payments, account configuration or deployments.

Controlled Phase 6 hosted acceptance testing was separately authorized on 2026-10-27. Earlier attempts stopped at email confirmation/local credentials. On 2026-10-30, tests resumed with the two existing confirmed accounts only: 106 main hosted assertions plus 8 follow-up checks passed, including real 15-minute recent-auth/invitation expiry, ownership, state persistence, consent, lifecycle and logout. Authorized synthetic acceptance records are retained, including User B's closure_pending protection state; no users were created or deleted. See docs/phase06-hosted-acceptance.md. Scoped human acceptance comes from the reviewer's explicit decision above, not inference from test counts; the deferred criteria and all historical pending checks remain intact.

After implementation run typecheck, lint, build and relevant automated tests. Documentation-only changes run consistency checks and git diff --check; state application checks were not run when appropriate. Report behavior, commands/results, blockers and exact manual checks. Browser, PayPal dashboard, external-account and human acceptance remain user checks unless actual evidence exists. Preserve dates and attribution.

## Stack

TypeScript strict, Node.js, React + Vite, Express, npm workspaces, Zod, Vitest, Supabase PostgreSQL, PayPal sandbox Orders API, OpenAI API, Render backend, Vercel frontend. Keep repository/package identifiers unless explicitly approved. API contracts and a typed SDK are future deliverables, not prerequisites to every phase. Ask before major unplanned dependencies or provider changes.

## Architecture invariants

- Opt-in enforcement covers only authenticated enrolled users in participating flows. Never imply universal history access, bank/account blocking or authority over unrelated payments. Fictional identities and sandbox accounts only; no live wagering, casino operation, player exploitation or assumed production gambling approval.
- Version consent and policies. Tightening applies immediately; relaxation waits the specified delay. Revocation stops optional processing and new protected checkout, never silently converts to unprotected payment. Merchants and AI cannot modify consumer policy.
- Preserve rules-v1 as a pure research baseline. protection-policy-v1 is a separate pure deterministic engine. AI only provides evidence-linked behavioral warnings: no freezing funds, payment initiation/capture/refund, policy changes or eligibility decisions.
- Keep immutable synthetic and verified sandbox provenance separate. Synthetic gambling scenarios are not PayPal activity; generic sandbox purchases are not verified gambling. Never pool their budget ledgers. Real-world history is outside MVP scope.
- Simulator core uses seed and virtual time with no network, database or model calls. Hide ground truth/scenario metadata at inference; hold out templates, seeds and actor streams. Report leakage and synthetic limitations; never claim clinically validated harm prevention.
- Enforce server-side with atomic database reservations and concurrency protection across all applicable budgets. Persist intent, idempotency and provider correlation before external calls. Process-local locks do not suffice. Keep uncertain payments reserved until verified reconciliation.
- Explicit user approval and verified order state precede capture. Serialize policy changes and capture authorization at the documented database linearization point. Verify every webhook and deduplicate captures durably. Fail closed for new capture when authority/storage is unavailable. AI failure never changes policy eligibility.
- Use integer minor units or precise decimal strings, never floating-point settlement/FX. Reservations allocate budget, not consumer funds.
- Keep PayPal secrets, privileged database credentials and integrator keys server-side. Never log tokens, secrets, full payment payloads or personal payment data. Bound and authorize all reads/writes. Version migrations, enforce owner/integrator isolation and least privilege. Labels stay inaccessible to scoring.
- Store minimal data with explicit retention/export/deletion controls. No behavioral marketing or merchant profiling. Separate optional AI consent from protection enrollment.

## Conventions and communication

Strict types; no any without documented justification. Prefer small deterministic tests and one obvious implementation. Comments explain decisions. Never weaken tests or add hidden fallbacks. Do not edit historical migrations. Document new environment variables in .env.example only when implementation requires them; never commit .env files.

Be concise. Human configuration instructions identify the exact variable, dashboard and next verification step, then stop at that blocker. Never request secrets in chat. Missing external access is a blocker, not a simulated success.
