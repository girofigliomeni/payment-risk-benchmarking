# Phase 6 scoped human acceptance

**ACCEPTED — BACKEND/STORAGE SCOPE ONLY**

On 2026-10-30 (America/Toronto), the user reported that the human reviewer approved the implemented Phase 6 backend and persistent-storage scope on project `ymsbiagwhgxultjoryzf`. This acceptance is recorded from that explicit decision, not inferred by Codex. Evidence: **114 hosted checks passed, zero failures; 36 focused local tests passed; 86 storage assertions passed; historical research data and security permissions preserved.** The review and coverage detail below remain the evidence for that decision; no tests were rerun as part of this documentation-only closure.

| Explicitly deferred criterion | Closure status |
| --- | --- |
| Real hosted 24-hour authentication rejection | DEFERRED — NOT VERIFIED |
| Real elapsed-time delayed activation | DEFERRED — NOT VERIFIED |
| Real elapsed-time export expiry and exact deadline/duration assertions | DEFERRED — NOT VERIFIED |
| Interactive Phase 6 consumer UI testing | DEFERRED — NOT VERIFIED; no Phase 6 consumer UI implemented |
| Production retention and final-erasure lifecycle | DEFERRED — NOT VERIFIED; pending closure is not completed erasure |

**Milestone closure is not production readiness.** Local test coverage is not newly promoted to hosted proof, known advisor findings are not waived, and the deferred criteria remain open. Synthetic acceptance records, including User B's closure_pending state, are retained without cleanup. Phase 7 still requires separate explicit authorization. No database, migration, permission, Auth-setting or credential change is authorized by this record, and no merge is authorized.

**Verified hosted behavior.** Reviewed the retained run journals: **106 main assertions + 8 follow-up checks = 114 PASS, zero FAIL**, using the two existing confirmed fictional accounts. These exercised a local built Express API against real hosted Supabase Auth/PostgREST/database storage, not a deployed consumer UI. Verified password sign-in, refresh, logout/revoked refresh tokens, real elapsed 15-minute enforcement without resetting the original session clock, protective actions after 15 minutes, ownership isolation, policy/consent persistence and anti-reset behavior, invitation single use/real expiry/credential rotation, export cutoff/paging, and retained deletion/closure behavior. Historical counts/fingerprints and grants matched the saved baseline in that run. See [full criterion matrix](phase06-hosted-acceptance.md) and [deployment evidence](phase06-hosted-deployment.md).

**Browser/UI assessment: NOT IMPLEMENTED, so Phase 6 browser smoke testing is not applicable.** Inspection of `apps/dashboard/src/main.tsx` and `Checkout.tsx` found health polling, the synthetic sample and the legacy PayPal sandbox checkout only. There are no Supabase consumer sign-in/logout/session controls, consent/enrollment controls, protection/pending-increase/cooling-off editor, integration-link approval or export/deletion screens. The checkout's access-code form and cookie session are Phase 3 operator checkout controls; they are not consumer authentication or Phase 6 protection. No interactive browser smoke test was performed, no credentials were entered into that form, and no PayPal action was taken. This UI absence is outside the Phase 6 API/storage deliverables; it must not be represented as browser-verified functionality or implemented now through a future-phase shortcut.

**Verified local automated behavior and timing coverage (prior preparation evidence).** The acceptance preparation reran the core build, the focused policy/API suite (**36 tests PASS**) and isolated PostgreSQL-compatible storage suite (**86 assertions PASS**). Existing fixtures were used without editing tests or connecting the verifier to the hosted project. This documentation-only closure retains those results without rerunning application checks.

| Time-dependent criterion | Existing local coverage | Remaining distinction |
| --- | --- | --- |
| 24-hour original authentication age | `scripts/test-protection-storage.mjs:315`: session created_at set to DB now minus 24 hours, refreshed_at set to now, then API authority returns 401. At line 323, age 23h59m remains authorized. Missing/future/revoked/expired session cases are also covered | Controlled isolated timestamp fixtures, not a pure frozen-clock test. Clock execution makes the denial sample at least 24 hours old; it is not an exact millisecond equality proof. Real hosted 24-hour boundary remains NOT VERIFIED |
| Delayed policy activation | `packages/core/src/protection.test.ts:79`: pure engine remains pending at t+24h−1ms and activates at exactly t+24h. The storage fixture at `scripts/test-protection-storage.mjs:408` materializes a due request before expectedVersion comparison and matches the pure oracle | Exact deterministic engine boundary PASS; isolated database transition PASS. Real hosted 24-hour activation remains NOT VERIFIED |
| Export expiry | `scripts/test-protection-storage.mjs:587` exercises an available export; line 651 sets an isolated export deadline into the past, then verifies expired status, absent content and removed snapshot | Controlled before/after-expiry behavior PASS. Exact deadline equality and the precise 24-hour creation-to-expiry interval are not separately asserted by the current test, despite its broad test label. SQL uses expiry <= database time and creates the deadline at DB time +24h; source inspection alone is not an executed boundary test. Real hosted expiry remains NOT VERIFIED |

These fixtures alter only disposable local test timestamps. No hosted timestamp, Auth setting, migration, grant or historical record was changed. Local coverage does not turn an unobserved hosted timer into a PASS.

**Outstanding NOT VERIFIED criteria.**

- A valid, normally maintained hosted session exceeding 24 hours, refreshed without a fresh password sign-in, receiving the maximum-age rejection. Expired legacy access tokens do not prove this.
- Real hosted activation of the pending increase and expiry of the existing export after 24 hours. Do not backdate or shorten lifetimes. Exact export-deadline/duration regression coverage is a local test gap, not an observed production defect.
- Retention exclusion for an actual unresolved hosted payment operation. None exists in Phase 6; local hold fixtures cover the storage rule. No artificial payment was created to manufacture evidence.
- Interactive consumer UI verification, once such UI is implemented in its separately approved phase. There is no Phase 6 screen to sign off today.
- Production retention and final-erasure lifecycle. Minimal retention/lifecycle records do not certify production purge, backup or provider erasure.

**Retained test state confirmed read-only.** At `2026-10-31T01:47:13.033607Z` / 2026-10-30 21:47 America/Toronto, direct SELECT inspection confirmed exactly two protection subjects, both in `synthetic`, with no other source rows for these users and zero mismatched-source links:

| User | Retained state |
| --- | --- |
| A — `692af282-e793-400d-9fec-4a6c104d9c04` | Active, enrolled, AI off; policy 7 / consent 8; caps 25/200 USD minor units, pending 25/400, retained seven-day cooling-off |
| B — `5c33ac3f-d89a-4a4f-80ad-342a952e810e` | `closure_pending`, both consents off; policy 5 / consent 3; caps 5/10 and cooling-off retained. Auth account was not deleted; this is not completed erasure |

Both test links remain inactive. I1 is still enabled with a rotated credential, I2 is disabled; both are sandbox, synthetic and links-only. The owned export and retained deletion request are documented in the full acceptance record. No reset, reenrollment or cleanup was performed in this preparation. Evidence: ignored `artifacts/phase06-hosted-acceptance/human-signoff-retained-state.json`.

**Known security/operational limits.** The latest security-advisor run retains the existing leaked-password-protection WARN and 18 RLS-without-policy INFO notices; no security setting was changed or finding waived. See [password remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Deployment performance findings remain 12 unindexed-FK INFO notices and one unused-index INFO, not measured workload failures. Private tables deny browser grants; service_role intentionally bypasses RLS and relies on verified backend ownership checks. Retention cleanup is lazy/operator-triggered, final deletion/backups/provider erasure are not certified, and the legacy checkout remains outside protection enforcement. No reservations or protected payment dispatch are implemented in Phase 6.

**Human decision.** The reviewer has now explicitly signed off the demonstrated backend/storage behavior with the listed deferrals. The milestone is ACCEPTED — BACKEND/STORAGE SCOPE ONLY; complete production readiness and the deferred criteria are not accepted or verified by that decision. The prior conditional recommendation is superseded by this scoped approval, while all supporting evidence and limitations remain. UI absence does not authorize unplanned dashboard work, and this decision does not approve Phase 7.

The prior preparation changed documentation only. No hosted session, policy or quota-mutating API call was made; its hosted checks were direct read-only metadata/state SELECTs. No passwords, tokens or service keys were read or printed for a browser flow. Its core build, focused tests, local storage assertions, documentation consistency and `git diff --check` passed; the full application suite was not rerun. The subsequent scoped closure changes documentation only, preserves unrelated working-tree changes and historical evidence, and authorizes no merge.

**Scoped closure validation, 2026-10-30.** Documentation consistency passed across eight updated documents and 59 local links. All 33 pre-existing non-human NOT VERIFIED matrix rows and the historical README section were preserved; the five explicit deferrals remain NOT VERIFIED. Hash comparison confirmed 73 snapshotted non-document files unchanged. `git diff --check` passed. Application checks were not rerun for this documentation-only closure; no hosted operation or merge was performed.
