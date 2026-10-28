# Phase 12: Deployment, verification and hackathon submission

Status: proposed, unimplemented. Requires user acceptance of Phase 11 before implementation. Build only this phase, then stop.

## Goal

Deploy the accepted sandbox product and prepare a truthful reproducible submission.

Read [project](../project-doc.md), [architecture](../protection-architecture.md), [consumer policy](../consumer-dashboard.md), [SDK/API](../developer-sdk.md), [evaluation](../evaluation-methodology.md) and [PayPal constraints](../paypal-constraints.md) as relevant. These linked documents define the shared contracts.

## Scope

- Deploy approved API/worker to Render and frontend to Vercel; configure Supabase, HTTPS/exact origins, same-origin proxy/cookies as applicable, durable worker recovery, safe quotas and protected legacy-route configuration.
- Review migration dry run/history and required environment variable names without exposing credentials. Verify logs/client bundles/history for secrets and minimize public demo cost/access.
- Publish current README, architecture/setup/privacy/methodology guides, SDK quickstart, limitations and demo script using actual evidence.
- Draft hackathon submission and checklist. Verify the selected event's current official deadline, eligibility, judging and partner/payment rules before claiming compliance; event is not yet identified.

## Acceptance and automated tests

- Run typecheck, lint, build, tests, API/SDK integration and isolated migration/concurrency suite; report each actual result and all blockers.
- Verify real deployment URLs only when created, cross-instance reservations, restart recovery, authorized access, webhook verification and no legacy bypass.
- Public demo is sandbox-only, source labeled, budget/cost limited and lacks production/clinical claims. Missing provider/model access is clearly unavailable, never fake success.
- Run npm run typecheck, npm run lint, npm run build, then npm test and any phase-specific storage/concurrency/contract checks above. Report commands/results and blockers truthfully. Do not weaken existing tests.

## Deliverables

Deployed sandbox configuration when authorized, pass/fail/blocker report, reproducibility guide, demo script/video checklist and draft submission.

## User acceptance

User verifies deployed browser flow, explicitly approved PayPal capture and dashboard reconciliation, privacy/accessibility, evaluation results and SDK quickstart; records demo and personally approves/submits. Deployment/account actions require phase authorization. No deployment URL, compliance check or submission is invented.

## Out of scope

New product features, live gambling/production processing, automatic public publication/submission without authorization.

Preserve Phases 1–4 acceptance records and implementations. No following-phase work until explicit acceptance. Local mocks do not establish external-account or browser acceptance.
