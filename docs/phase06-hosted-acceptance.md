# Phase 6 hosted acceptance evidence

**Scoped human closure, 2026-10-30: ACCEPTED — BACKEND/STORAGE SCOPE ONLY.** The user reported explicit human reviewer approval based on 114 hosted checks with zero failures, 36 focused local tests, 86 storage assertions and preservation of historical research data/security permissions. See [decision and deferred criteria](phase06-human-acceptance.md). This is milestone acceptance, not production readiness. Real hosted 24-hour authentication rejection, real elapsed-time delayed activation, real elapsed-time export expiry and exact deadline/duration assertions, interactive Phase 6 consumer UI testing, and production retention/final erasure are explicitly **DEFERRED — NOT VERIFIED**. No deferred test row is promoted to PASS. Phase 7 and merging remain unauthorized by this closure.

Human acceptance preparation, 2026-10-30: see [concise sign-off report](phase06-human-acceptance.md) for the hosted/local evidence split, absence of Phase 6 consumer UI, precise time-fixture coverage and remaining limitations. Focused local tests were rerun (36 policy/API tests and 86 storage assertions PASS); direct read-only inspection reconfirmed synthetic isolation and User B's retained closure_pending state. No browser verification or human acceptance is inferred.

**Latest completed hosted run — 2026-10-30 (America/Toronto)**

The user supplied the local email/password inputs and resumed the already authorized tests using **only the two existing confirmed accounts**. Normal password sign-in succeeded for both and returned the expected distinct identities. No new Supabase user was created. The earlier blocked attempts below are preserved as dated history, not the current credential status.

Target: `ymsbiagwhgxultjoryzf`. User A: `692af282-e793-400d-9fec-4a6c104d9c04`. User B: `5c33ac3f-d89a-4a4f-80ad-342a952e810e`. Both accounts were independently confirmed through real Auth responses and read-only metadata. The main run lasted `2026-10-31T01:22:36.907Z`–`01:37:52.526Z`, corresponding to **2026-10-30 21:22–21:37 America/Toronto**. The follow-up finished at `01:38:07.131Z` / 21:38 local. The generated run tag uses UTC: `phase6-2026-10-31-4aa09fd1-b231-43d2-9b9a-a04b436005e5`.

**Observed result: 106 main hosted assertions plus 8 follow-up checks passed; zero failures.** These exercised the built local Express /v1 API against real hosted Supabase Auth/PostgREST/database storage, with no mocked Auth or database transport. This is a defined API-level acceptance run, not interactive browser UI verification. The subsequent scoped human approval is recorded above; unverified items below remain explicit and production readiness is not established.

| Requested criterion | Result | Actual hosted evidence / limitation |
| --- | --- | --- |
| Normal email/password sign-in for both existing users | PASS | HTTP 200 for both; A matched the supplied UUID and B matched the second confirmed account; no token-only substitute |
| Token refresh | PASS | Both sessions refreshed successfully and retained their verified owner/session binding |
| Logout and revoked access | PASS | Session-local logout returned 204 for both; subsequent protected API calls with those access tokens returned 401. Follow-up refresh after logout returned 400 refresh_token_not_found |
| Original authentication timestamp comes from server storage | PASS | Read-only auth.sessions inspection matched the verified owners/session IDs and unchanged original created_at before/after refresh |
| 24-hour maximum API authentication-age boundary | NOT VERIFIED | No valid real session older than 24 hours was available. Legacy access tokens were invalid/expired; their rejection is not evidence of this boundary |
| 15-minute recent-auth requirement | PASS for real expired-window behavior | Waited over 15 real minutes; refreshed tokens could read, but cap increase, AI opt-in and re-enrollment returned 401 recent_authentication_required. The exact millisecond edge was not separately probed |
| Protective actions remain available after 15 minutes | PASS | Tightening, cooling-off and protection withdrawal returned 200 under normally authorized aged sessions |
| Refresh cannot restart the original age clock | PASS for retained timestamp and 15-minute enforcement | Refreshed JWTs kept the same database session created_at and remained non-recent. The separate 24-hour rejection remains NOT VERIFIED |
| Cross-user access isolation | PASS | B could not read A's export or revoke A's link; A could not read B's deletion request (404). B's links/policy remained independent; supplied ownerId was rejected with 400 |
| Consumer enrollment, revocation and re-enrollment | PASS | Explicit consent/caps persisted; withdrawal disabled protection and AI and revoked links; re-enrollment preserved policy and did not silently restore AI or links |
| Spending limits and cooling-off persistence | PASS | Immediate tightening/mixed caps, seven-day cooling-off, no shortening, and exact persistence across new sign-in and a fresh local API instance |
| Pending increases and version history | PASS for creation, resubmission, cancellation and persistence | Exact 24-hour pending delay recorded; resubmission restarted it, cancellation retained effective caps, stale/superseded requests conflicted, history retained versions |
| Due pending increase actually activates after 24 hours | NOT VERIFIED | No backdating or shortened delay; real activation time has not elapsed during this run |
| Idempotency and stale versions | PASS | Identical commands replayed the original envelope; changed payload/key and stale policy versions returned 409; replay did not add a policy version |
| Integration invitation redemption and single use | PASS | A approved the scoped invitation; B's second redemption returned 404; second integration could not see the first integration's link |
| Real invitation expiry | PASS | After the actual 15-minute expiry, A signed in freshly before retrying; redemption returned 404 invitation_unavailable, independently of recent-auth rejection |
| Integration credential rotation/revocation and link revocation | PASS | Old I1 credential returned 401 after rotation; new credential worked; owner revoked a link; protection withdrawal revoked all active links; disabled I2 returned 401 |
| Export ownership, paging and immutable cutoff | PASS | Owned policies/consents/links/audit sections returned bounded pages; B received 404. After later consent edits, export snapshot remained version 5 while live consent reached 8; final consent page was empty |
| Export retrieval expires after real 24 hours | NOT VERIFIED | Export expiry metadata is present, but real 24-hour expiry was not accelerated or observed |
| Deletion lifecycle and anti-reset behavior | PASS within Phase 6 scope | B received retained/closure_pending, both consents stopped, policy/cooling-off remained intact, and re-enrollment returned 409 account_closure_pending. Auth account still exists; no erasure was claimed |
| Unresolved-operation retention exclusion on actual hosted operation | NOT VERIFIED | No unresolved payment operation or artificial hold was created; prior local fixture evidence remains separate |
| Re-enrollment cannot replace active restrictions | PASS | Replacement caps on retained enrollment returned 409; normal re-enrollment and fresh sign-in preserved exact effective/pending caps and cooling-off |
| Authenticated Data API/private-schema isolation | PASS at HTTP/API level | Real authenticated user request to private profile returned 406 PGRST106; direct privileged RPC returned 42501 permission denied. Earlier anonymous/service profile evidence remains below |
| Historical Phase 1–5 storage and permissions preserved | PASS | New pre/post snapshots matched the saved pre-deployment fingerprints, historical ACLs/RLS/functions/constraints and Auth-session grants; no extra migration or role change |
| Interactive browser UI acceptance | NOT VERIFIED | HTTP harness used real Auth and API; no browser UI flow was exercised |
| Human Phase 6 milestone acceptance | ACCEPTED — BACKEND/STORAGE SCOPE ONLY | Explicit reviewer approval reported by the user on 2026-10-30; deferred criteria remain NOT VERIFIED and Phase 7 remains unauthorized |

**Real-clock authentication evidence.** User A's original session created_at was `2026-10-31T01:22:37.766216Z`; User B's was `01:22:38.123092Z`. Initial and refreshed session references mapped to those same stored timestamps. After the aged-token checks, read-only inspection showed original ages of 932/931 seconds with the same created_at, while the newly signed-in sessions used for local logout were absent as expected. Thus the cap/AI/re-enrollment rejections followed a real elapsed recent-auth window with freshly refreshed tokens, not fake time, JWT issuance-time substitution, session backdating or an altered Auth lifetime.

The follow-up proved that a normal new sign-in restores owned access after logout while retaining protections. Logout used scope local; unrelated existing sessions were not globally revoked. Normal sign-in/refresh/logout may create/update/remove the associated Auth session and authentication audit records, as expected for this authorized test. No Auth account, Auth setting or database grant was modified manually.

**Acceptance records retained for review.** All consumer state is in the isolated synthetic namespace and belongs only to A/B. No PayPal transaction, sandbox payment fact, research ingestion, model call, new identity or destructive cleanup occurred. Exact post-run counts:

| Protection table | Rows |
| --- | ---: |
| subjects | 2 |
| policy_versions | 12 |
| policy_change_requests | 5 |
| consent_records | 11 |
| integration_clients | 2 |
| link_invitations | 3 |
| integration_links | 2 |
| audit_records | 22 |
| lifecycle_requests | 2: A export, B deletion request |
| retention_holds | 0 |
| idempotency_records | 25 |
| quotas | 4 |

User A subject `9b8038d9-5b99-423c-8bd5-c0496684bd59` remains active/enrolled with AI off, policy version 7, consent version 8, effective caps 25/200 USD minor units, pending caps 25/400, and the retained seven-day cooling-off. Pending activation is `2026-11-01T01:22:44.260Z`; cooling-off ends `2026-11-07T01:22:43.558Z`. User B subject `2c6b19ed-ebc4-4194-889e-cca865b40cec` is closure_pending with both consents off, policy version 5, consent version 3, caps 5/10 and retained cooling-off ending `2026-11-01T01:37:49.347Z`. These are fictional test restrictions, not application defaults or actual spending.

Integration I1 `b2eb02ce-9c6b-4763-898b-d1a22c44dd7d` has a rotated credential and remains enabled; I2 `30542754-8e1e-4353-9ff8-91e32bb2999d` is disabled. Both have sandbox environment and links-only scopes; zero test links remain active. Credentials were generated/used only in process memory and were not saved or printed. The retained invitation/link IDs and server expiry times are in the local redacted run journal. A's export is `603da2aa-d5d8-40ad-aa31-f79194cec4e8`; B's retained deletion request is `7516187b-d75a-48f6-84a8-ca25ae0555a3`. Both existing Auth users remain present and confirmed. No reset or cleanup was performed; do not blindly rerun the initial-enrollment harness against these retained states.

**Historical preservation and security.** The original six historical fingerprints and row counts remain exactly as in the baseline table in the original attempt below: 7 experiments, 39 events, 3 provider references, 4 detector runs, 35 scores, 0 labels. Their table permissions/RLS, old function definitions/configuration/ACLs, validated provenance constraints and Auth-session privileges match the saved pre-deployment baseline. Migration history, role metadata and memberships match the fresh pre-run snapshot. There are no unexpected owner/source rows or invalid source links. Expected changes are only the authorized synthetic acceptance data and normal Auth activity.

Security advisors remain at 18 INFO RLS-without-policy notices and the pre-existing WARN for leaked-password protection disabled. No setting, grant, policy, migration or index remediation was performed. [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy); [password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). These findings are not waived by passing acceptance assertions.

**Saved evidence/checks.** Under ignored `artifacts/phase06-hosted-acceptance/`: `resume-auth-preflight-results.json`, `resume-full-results.json` (106 PASS), `resume-export-cutoff-results.json` (8 PASS), `resume-session-clocks-before.json`, `resume-session-clocks-after.json`, `resume-20261030-pre.json`, `resume-20261030-post.json`, `resume-20261030-records.json` and `resume-20261030-security.json`. Test harnesses are `resume-auth-preflight.mjs`, `resume-full.mjs` and `resume-export-cutoff.mjs`; the latter two exited 0. Only redacted results, UUIDs, timestamps and synthetic policy/control state were recorded; no passwords, access/refresh tokens, email addresses or service-role keys were printed or committed. Core and API workspace builds passed; `git diff --check` and documentation consistency checks passed. Full application lint/build/unit suites were not rerun because application/migration implementation was unchanged.

**Remaining verification (explicitly deferred by scoped closure):** a valid normally maintained session must actually age past 24 hours, then be refreshed without a new password sign-in before checking the API's maximum-age rejection. An invalid/expired legacy token or a new sign-in does not establish this. Pending-policy activation and export expiry likewise need real 24-hour passage; do not edit stored timestamps or shorten settings. Exact export deadline/duration assertions, interactive consumer UI testing and production retention/final erasure remain deferred. Scoped human approval above does not turn any of these into PASS. No further hosted mutation, merge or Phase 7 work is implied by this evidence. Earlier pending-human-acceptance statements below remain dated historical records.

**Earlier credential-preflight attempt — 2026-10-30 (America/Toronto)**

The user reports both existing test accounts have confirmed emails and authorizes only those accounts on `ymsbiagwhgxultjoryzf`. Test User 1 is `692af282-e793-400d-9fec-4a6c104d9c04`; Test User 2 is the second existing confirmed test account. No additional user creation is authorized. Email confirmation is no longer asserted to be the current blocker; the user's confirmation report has not been independently checked in this resume attempt.

**Stopped at the first required authentication prerequisite.** A names/presence-only inventory of root `.env` and the process environment found `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EXPERIMENT_ACCESS_TOKEN`, and `EXPERIMENT_ACCESS_TOKEN_B`, but no email/password credential pairs. Passwords, key values and token contents were not printed or recorded. Existing access tokens are not substitutes for a successful normal email/password sign-in and were not used to bypass that first required check. Neither sign-in was attempted with missing or guessed credentials. This is unavailable test input, not an observed invalid-password response or authentication defect.

No hosted request or mutation was made during this resume attempt. No accounts, sessions, integration credentials, invitations, links, policies, consents, lifecycle requests or other hosted acceptance records were created. Nothing was deleted or cleaned up. Test User 2's identifier was not inferred from an unverified token or selected from unrelated accounts. No research records, settings, grants, RLS policies or migrations were changed. Phase 7 was not started and human acceptance remains pending.

| Requested resume criterion | Result on 2026-10-30 | Reason |
| --- | --- | --- |
| Normal email/password sign-in for both existing accounts | NOT VERIFIED | Required email/password pairs are unavailable locally; access-token presence is insufficient |
| Sign-in, refresh and logout | NOT VERIFIED | Stopped before establishing real test sessions |
| 24-hour maximum authentication age | NOT VERIFIED | No authenticated test session; no backdating or shortened-clock substitution |
| 15-minute recent-auth requirement | NOT VERIFIED | No authenticated test session |
| Refresh cannot reset authentication age | NOT VERIFIED | No real refresh attempted |
| Cross-user access isolation | NOT VERIFIED | Both password sign-ins must first succeed |
| Consent enrollment, revocation and re-enrollment | NOT VERIFIED | No authorized consumer session established |
| Persistent limits and cooling-off | NOT VERIFIED | No new hosted policy state created or exercised |
| Pending increases and policy history | NOT VERIFIED | Authentication prerequisite blocked |
| Invitation expiry/redemption/rotation/revocation | NOT VERIFIED | No integrations or invitations created while authentication is blocked |
| Export/deletion lifecycle | NOT VERIFIED | No lifecycle requests created |
| Re-enrollment cannot bypass restrictions | NOT VERIFIED | No authenticated transitions performed |
| Current historical data/permission preservation | NOT VERIFIED in this resume | User required stopping if normal authentication could not be verified; no fresh hosted comparison was run. Prior dated preservation evidence below is retained unchanged |

No FAIL is recorded because no attempted hosted criterion produced an observed failure. The earlier PASS results below retain their original date and scope; they are not fresh 2026-10-30 verification.

To unblock the required password-flow check, place the two existing accounts' credentials only in the local ignored `.env` or process environment, using `PHASE6_TEST_A_EMAIL`, `PHASE6_TEST_A_PASSWORD`, `PHASE6_TEST_B_EMAIL`, and `PHASE6_TEST_B_PASSWORD`. These names identify local acceptance-test inputs, not new application configuration or a change to Auth settings. In **Supabase Authentication > Users** for the target project, verify which existing account is User 2 and that User A corresponds to the supplied User 1 UUID. Do not create users, reset passwords, or send secrets in chat. The next check is normal `/auth/v1/token?grant_type=password` sign-in and verification that each returned identity matches the intended existing account; the already authorized acceptance scope can resume once those local prerequisites exist.

Documentation-only resume evidence: `git diff --check` passed. Application typecheck/lint/build/tests were not rerun because no implementation changed. No hosted acceptance criterion or human approval is marked complete.

**Original attempt — 2026-10-27**

Run by Codex on 2026-10-27 (America/Toronto) against `ymsbiagwhgxultjoryzf`, under the user's explicit authorization for minimum fictional identities and isolated Phase 6 acceptance records. **Overall: NOT VERIFIED; Auth-dependent acceptance stopped at the required email-verification blocker.** Human acceptance remains pending. No Phase 7 work was performed.

**Auth blocker and identities**

The actual hosted `/auth/v1/settings` response was HTTP 200 with:

```json
{"disable_signup":false,"mailer_autoconfirm":false,"email_enabled":true}
```

New email/password accounts therefore require email confirmation. No dedicated fictional-user email/password variables were found in the authorized local environment (names/presence only were inspected; values were not printed). An existing research access-token variable was not used: it is not an established pair of controlled fictional acceptance identities. Existing server credentials were available for read-only verification, and an active existing publishable client key was obtained for anonymous-role probes; no key was created or rotated.

The user's instruction was to stop the affected portion if email verification or unavailable credentials were required, without bypassing controls. Accordingly, no signup, email delivery, admin auto-confirmation, generated confirmation link, Auth user-row insertion, forged JWT, session backdating or security-setting change was attempted. No CAPTCHA challenge was exercised; CAPTCHA configuration is not established by this run.

- Test identities created: **0**; non-sensitive identity identifiers: **none**.
- Integrations/invitations/links/consumer policies/consents/exports/deletions created: **0**.
- All 12 protection tables have exact count **0**, including audit, quota and idempotency tables.
- No existing identity was deleted, reused for acceptance, or modified. No test cleanup was performed or required.

This is a test prerequisite blocker, not an observed failure of email/password authentication or policy enforcement. It does not authorize changing email confirmation or leaked-password protection settings.

**Live HTTP checks actually performed**

Anonymous probes used an existing publishable key, with no user bearer token. Service control probes used the existing server key locally without recording it. Direct HTTP requests exercised the real hosted Auth/PostgREST endpoints; no interactive browser UI was used.

| Probe | Actual result | Interpretation |
| --- | --- | --- |
| Auth public settings | 200; email enabled, signup enabled, mailer_autoconfirm false | Email-confirmation prerequisite confirmed |
| Anonymous GET subjects with Accept-Profile: protection | 406 / PGRST106 / Invalid schema: protection | Private table schema rejected by the live API |
| Anonymous GET policy_versions with Accept-Profile: protection | 406 / PGRST106 | Private policy schema rejected |
| Anonymous GET private authentication_time with protection profile | 406 / PGRST106 | Private helper schema rejected |
| Anonymous GET private snapshot with protection profile | 406 / PGRST106 | Private helper schema rejected |
| Anonymous POST public protection_command | 401 / 42501 / permission denied for function protection_command | Privileged RPC execution denied |
| Anonymous POST public protection_operator | 401 / 42501 / permission denied for function protection_operator | Operator execution denied |
| Existing service credential GET subjects with protection profile | 406 / PGRST106 | Exclusion is API schema configuration, not merely the anonymous role's schema-USAGE denial |
| Existing service credential public experiments zero-row control | 200, empty array | Public schema works; no historical record bodies returned |

The two negative POST RPC probes were permission tests, not accepted mutations. Their inputs could not reach a write path even if an execution grant regressed: command had no principal and rejects before quota/subject writes; operator used an unsupported action. Both were denied before function execution. The subsequent zero protection-row counts corroborate that no acceptance data was created.

These results confirm that `protection` is excluded from the actual exposed-schema routing for the tested anonymous and service profiles. The complete dashboard allowlist was not exported; no API configuration was modified. Read-only catalog inspection separately confirmed no schema usage for anon/authenticated, no direct privileges on any of the 12 private tables, no execute permission on the four protection functions, and no Auth-session table/created_at write privileges. All protection tables retain RLS. Catalog checks for authenticated permissions are not a substitute for a real signed-in browser/user request.

**Acceptance matrix**

PASS applies only to the evidence stated. FAIL would mean an observed criterion violation; no FAIL was observed in the completed checks. NOT VERIFIED means the hosted functional test was not run or its prerequisite was unavailable. Prior local test passes remain in their own records and are not relabeled as hosted acceptance.

| Requested criterion | Result | Evidence or blocker |
| --- | --- | --- |
| Private protection schema/helper exclusion from API | PASS | Actual anonymous and service protection profiles rejected; public zero-row control succeeds |
| Minimum fictional identities and isolated records | NOT VERIFIED | Creation intentionally stopped before signup because email confirmation is required and controlled verified fictional credentials are unavailable |
| Real email/password sign-in | NOT VERIFIED | No verified fictional test account credentials available |
| Real token refresh and logout | NOT VERIFIED | Depends on successful fictional sign-in; no session created |
| Original session-age enforcement via backend | NOT VERIFIED | No real fictional session available; no client-time or JWT-iat substitution was used |
| 24-hour maximum protected API age | NOT VERIFIED | No actual aged session; not simulated with backdating, an altered clock or a shorter timeout |
| 15-minute recent-auth gate/protective-action availability | NOT VERIFIED | No actual test session/time-bound authenticated flow |
| Refresh cannot renew either age clock | NOT VERIFIED | No real refresh performed; local fixture evidence remains separate |
| Cross-user policy/link/export/deletion ownership | NOT VERIFIED | Requires two controlled fictional authenticated users |
| Integration invitation expiry and single redemption | NOT VERIFIED | Requires consumer approval flow; no unnecessary integrations/invitations created |
| Integration credential rotation and revocation | NOT VERIFIED | No hosted integration provisioned while consumer acceptance is blocked |
| Persistent caps, cooling-off, pending increases, policy versions | NOT VERIFIED | No hosted consumer policy writes or restart-with-owned-policy test |
| Consent withdrawal/re-enrollment preserves restrictions | NOT VERIFIED | No hosted enrollment/revocation/re-enrollment performed |
| Export/deletion lifecycle | NOT VERIFIED | No hosted lifecycle requests; no completed-erasure claim |
| Anonymous direct private table/helper/RPC access denied | PASS | Actual HTTP 406/401 denials plus catalog checks |
| Authenticated role lacks direct private grants | PASS, structural only | Live hosted catalog reports no schema/table/function authority |
| Actual authenticated browser/Data API denial | NOT VERIFIED | No verified fictional user bearer token; no interactive browser session |
| Historical data and permissions preserved | PASS | Saved pre-deployment baseline comparison described below |
| No unexpected checked database changes | PASS for observed scope | Original ACLs/functions/constraints and role metadata/memberships unchanged; migration history has only the approved fourth entry; all new tables remain empty |
| Security advisor review | PASS as observation | Existing warning/notices recorded; not an assertion of zero findings |
| Human Phase 6 acceptance | NOT VERIFIED | Not marked complete; separate user approval required |

**Historical preservation and database changes**

At `2026-10-28T03:44:22.156620Z` (2026-10-27 23:44:22 America/Toronto), the counts/fingerprints below exactly matched the saved pre-deployment baseline. Historical table ACLs/owners/RLS, lab_command and rls_auto_enable definitions/ACLs/configuration, Auth session grants, and validated provenance constraints also matched. Role metadata and memberships matched the recorded post-deployment snapshot; no CLI command or role renewal was performed during acceptance testing.

| Historical table | Count | Fingerprint |
| --- | ---: | --- |
| experiments | 7 | `5747ae39e45040dcb409e1bc8ad5ea1a` |
| events | 39 | `ce183366343e516d11b4363d5b3fab55` |
| provider_references | 3 | `dee31d96c003946f304275af147b66d7` |
| detector_runs | 4 | `f2b5139cdda4994892c33393c29513f0` |
| scores | 35 | `173631325b5872c6bb77bccbea0fa77f` |
| labels | 0 | `d41d8cd98f00b204e9800998ecf8427e` |

Hosted migration history remains the three original Phase 4 entries plus approved Phase 6 version `20261028022432`. No migration, grant, RLS policy, Auth/security setting, existing experiment or payment record was changed. No PayPal transaction, real-money operation, privileged acceptance write or account configuration was performed. This run does not reconstruct missing older acceptance evidence or certify unrelated application writers were paused.

**Security findings**

Security advisors still report 18 INFO RLS-enabled/no-policy notices, consistent with the documented server-mediated/no-browser-grants design, and one existing WARN for leaked-password protection disabled. No new security-advisor category was observed. Nothing was enabled, repaired or waived. [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy); [password-protection remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The prior deployment's performance-index findings remain in [deployment evidence](phase06-hosted-deployment.md); no index changes were performed.

**Local evidence and checks**

Ignored local evidence directory: `artifacts/phase06-hosted-acceptance/`. It contains `http-results.json`, `privileged-profile-results.json`, `historical-postcheck.json`, `protection-counts.json`, `security-advisors.json`, and the read-only probe script. A client publishable key is held only in ignored local probe configuration; no service key, user token, refresh token, password or raw Auth user/session record is included in the evidence report. The database baseline and security results contain aggregate counts/fingerprints/catalog metadata only.

Hosted HTTP probe command: `node artifacts/phase06-hosted-acceptance/read-only-probes.mjs`, exit 0. Additional privileged GET controls and SELECT baseline/grant/count comparisons passed. `git diff --check` and documentation consistency checks passed. Application typecheck/lint/build/unit tests were not rerun because this run changed no application or migration implementation; previous results remain separately attributed. None of those local results fills the NOT VERIFIED hosted rows above.

**Next verification step**

Use controlled fictional test mailboxes to complete the existing Supabase email-confirmation flow, then confirm their verified status in project `ymsbiagwhgxultjoryzf` under **Authentication > Users**. Do not disable confirmation or use administrative auto-confirmation as a substitute for this blocked test. Make dedicated fictional-account credentials available through a local secure mechanism, never chat. Those prerequisites have not been completed or configured by Codex. Once available, the remaining already scoped hosted tests can be resumed, with explicit reporting of real 15-minute/24-hour timing and separate human/browser evidence. Do not backdate Auth sessions, shorten security lifetimes, fabricate expiry results, or mark human acceptance complete.

Stop here. Phase 6 human acceptance remains pending, and Phase 7 requires subsequent explicit acceptance/authorization.
