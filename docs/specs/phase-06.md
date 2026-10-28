# Phase 6: Consent, policy persistence and authorization

Status: proposed, unimplemented. Requires user acceptance of Phase 5 before implementation. Build only this phase, then stop.

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
