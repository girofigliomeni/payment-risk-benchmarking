# Phase 6: Consent, policy persistence and authorization

Status, 2026-10-30: **ACCEPTED — BACKEND/STORAGE SCOPE ONLY**. The user reported explicit human reviewer approval based on 114 hosted checks with zero failures, 36 focused local tests, 86 storage assertions and preserved historical research data/security permissions. Phase 6 was authorized on 2026-10-27; migration 20261028022432 remains deployed to ymsbiagwhgxultjoryzf. See [deployment evidence](../phase06-hosted-deployment.md) and [scoped human acceptance](../phase06-human-acceptance.md). This closes the implemented milestone only, not production readiness. Phase 7 is not authorized; stop before implementing it or merging.

Explicitly deferred, **NOT VERIFIED**: real hosted 24-hour authentication rejection; real elapsed-time delayed activation; real elapsed-time export expiry and exact deadline/duration assertions; interactive Phase 6 consumer UI testing; production retention and final-erasure lifecycle. These are not PASS and are not erased by scoped acceptance. Existing local coverage and all earlier dated acceptance evidence below remain separately attributed.

Implementation record: see [consent/storage setup, contracts, retention and verification](../phase06-storage.md). The approved scope below is retained.

Hosted acceptance attempt, 2026-10-27: the user authorized controlled fictional acceptance testing. Live private-schema/API permission and historical-preservation checks passed; Auth-dependent testing stopped because email confirmation is required and dedicated verified fictional credentials are unavailable. No identities or protection acceptance records were created. See [criterion matrix and blocker](../phase06-hosted-acceptance.md). Human acceptance remains pending.

Hosted resume, 2026-10-30: credentials for the two existing confirmed users became available. The real hosted API/Auth acceptance run passed 106 main assertions and 8 follow-up checks, including actual 15-minute expiry, with zero failures and preserved historical data/grants. Synthetic test state is retained; no additional users were created. The actual 24-hour authentication-age boundary, delayed activation/export expiry, interactive browser and human acceptance remain unverified. See the latest matrix in the linked acceptance evidence; do not start Phase 7.

Human sign-off preparation: [review report](../phase06-human-acceptance.md) confirms that no Phase 6 consumer UI exists to browser-smoke-test and distinguishes exact pure-engine timing coverage from controlled local timestamp fixtures and unobserved hosted timers. The subsequent explicit reviewer decision accepted only the backend/storage scope; the earlier statements of pending acceptance describe their dated test runs.

Approved authentication contract: existing Supabase email/password sign-in; backend-verified original authentication age strictly below 24 hours for protected API access and below 15 minutes for sensitive grants/increases. Refresh never resets either clock. The backend verifies the token with Supabase Auth, then uses its session_id and authenticated owner to look up auth.sessions.created_at; missing/unverifiable timestamps require fresh authentication. Protective tightening, cooling-off activation/extension, cancellation and revocation need normal authorized access only. Session changes never reset protection state. This explicit user decision refines the linked proposals' blanket recent-auth wording.

## Goal

Persist consumer-controlled policy and consent safely; no payment dispatch.

Read [project](../project-doc.md), [architecture](../protection-architecture.md), [consumer policy](../consumer-dashboard.md), [SDK/API](../developer-sdk.md), [evaluation](../evaluation-methodology.md) and [PayPal constraints](../paypal-constraints.md) as relevant. These linked documents define the shared contracts.

## Scope

- Add versioned additive migrations for subjects, consent, policy versions/change requests, integration clients/links and minimal audit; never rewrite Phase 4 migrations/data.
- Implement consumer authentication/recent-auth checks, owner/integration scopes, policy edits with expectedVersion and idempotency, immediate tightening/revocation and due relaxation evaluation under a subject lock.
- Provide operator-only sandbox integration provisioning and consumer-approved expiring link invitations; implement bounded policy/consent reads without browser table grants.
- Specify and test minimal export/deletion lifecycle records and retention exclusions for unresolved operations; optional AI consent remains independent.

## Acceptance and automated tests

- Two users and two integrations cannot read/mutate each other's policies or links; altered owner IDs never establish authority. Browser direct table/RPC access denied.
- Concurrent mixed policy edits, revocation, resubmission and pending cancellation serialize correctly; duplicate payloads replay, changed-key payloads conflict.
- Isolated migration/upgrade checks preserve existing experiment data, grants, labels and rules runs. Missing service configuration yields explicit unavailable.
- Run npm run typecheck, npm run lint, npm run build, then npm test and any phase-specific storage/concurrency/contract checks above. Report commands/results and blockers truthfully. Do not weaken existing tests.

## Deliverables

Additive migrations, authorized consent/policy/link routes, access tests and human setup/retention guide.

## User acceptance

Configure test Auth users through Supabase Authentication > Users using existing documented server variables locally; verify two-user isolation and policy history. Review a migration dry run before any authorized hosted application. Do not request secrets in chat.

## Out of scope

Budget reservation, PayPal calls, AI warnings and polished dashboard.

Preserve Phases 1–4 acceptance records and implementations. No following-phase work until explicit acceptance. Local mocks do not establish external-account or browser acceptance.
