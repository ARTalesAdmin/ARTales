# ARTales Phoenix 2026-10-11 — Alice Vertical Proof and Main-thread Handoff

## Governance and scope
- Repo: ARTalesAdmin/ARTales; only PRs into `develop`; do not change `main`, production environment or database absent separate explicit authorization. No permanent paid Supabase branches or Nexus worker queue.
- Architect prioritizes proof of **semi-automated end-to-end flow** before batch automation. Pilot Alice is reviewed personally by architect; subsequent works distributed between active editors **including admin**, subject to source, legal, semantic-revision and capacity gates.
- Legacy strategy is **new pinned source snapshot + re-ingest + semantic rebuild + reconciliation to existing work identity**, not converting rigid `WorkBlock` JSON. Preserve existing work UUID/slug/public URL, reader notes/progress/entitlements, historic cover and old lawful release. Legacy text is evidence, not release authority.
- Rights preflight is NOT legal clearance. Gutenberg's US public-domain classification does not automatically apply in CZ/EU. Text, translations, covers, illustrations and public metadata each require independently evidenced review. No automated publication, Hold or take-down without separate authorization.

## Verified integration state
- Current checked `develop`: `3e63022a714dce170982e01bb9dad565eaf23e00` includes merged PR #211 (profile authority hardening) and #212 (DB-A immutable evidence). Production `main`: `171df191eb54dbcef7bb015f748138c630428b2f` remains unchanged.
- Production read-only inspection: 49 published works + 15 drafts; 1 active admin + 2 active editors. **Production does not yet contain** new `work_candidates`, `editorial_tasks` or `artales_evidence` tables; migrations merged in develop are NOT prod applied.
- PR #213 draft signed pending-only source capture on DB-A; signed local GoTrue and regression CI green, but still local SQL assembly, not canonical migration. Needs privilege review, CLI migration, exact-head CI, explicit approval.
- PR #215 draft 19 new semantic Reader/Composer v2 QA files + migration contract reconciled from PR #209 against current develop; 31/31 tests and CI green. QA preview is not a production editor; no authenticated revision persistence, no user-scoped note sync, no live Reader cutover.
- PR #216 draft pure review assignment planner, seeded without real account IDs and without DB writes; CI green. Admin gets first pilot; ready subsequent revisions can be balanced among editor/admin capacities. It must gain server-side signed work and revision checks before actual task enqueue.
- PR #214 draft documentation-only inventory/legal triage: 49 published Gutenberg refs, empty edition_license fields, gaps in language/provenance; high-priority review e.g. Helen Keller text/edition, translation credits, without assuming infringement.
- Existing #205 pinned PG11 source: exact UTF-8 archival fixture (173595 bytes), SHA-256 `49a0b2726606e1290ac03a63978fa1dd1bd38a8d805704d98265f393533ea094`, component boundary extraction, hash checks, semantic paragraphs. Currently a **single pinned source**, not generalized Gutenberg catalog ingest.
- DB-A `semantic_sha256` hashes JSONB semantic_blocks; Composer `revision_sha256` hashes entire structured payload including source/parent/title page. Distinguish and bridge deliberately; no false equality.
- No personal reader notes should be copied into CI; do not override `reader_notes`, account preferences, existing bookmarks/progress or work entitlements.

## New work in current main thread
- Opened `proof/artales-alice-vertical-flow-20261011` **from PR #215 head** to use semantic modules (which are not on develop yet).
- Added `lib/pilots/aliceVerticalProof.ts`, `tests/aliceVerticalProof.test.ts` and `.github/workflows/artales-alice-vertical-proof-qa.yml`.
- Proof intentionally uses ONLY repo PG11 fixture; pins source bytes/hashes and component boundaries; runs structural rights assessment with no evidence; composes SemanticRevision v2; compares a **synthetic** legacy fixture (not real production Alice); creates exact source-anchored editorial return and new child revision; forces `release_allowed=false`; records missing gates; **no DB writes and no real legal clearance**.
- IMPORTANT: check exact-head GitHub Actions and correct any failing tests. In current session the 3 new files were committed but PR creation, CI results and final Phoenix PR commit are still to be finished.
- After green proof, proceed to **real Alice sanitized legacy reconciliation** and persistent review/issue bridge with #213 before claiming complete end-to-end operational workflow. That will need separate explicit authorization for database migration or live changes.

## Immediate continuation
1. Confirm new proof branch head, open draft PR into develop (note branch includes #215 changes; it is STACKED and not independently mergeable before #215). Run CI exact HEAD, correct errors; consider basing proof on #215 as base for stacked PR or making parent-child dependency explicit. Do not merge without new authorization.
2. Add negative tests: rights fake evidence cannot approve publication; modified source hash blocked; stale revision/incorrect work fail; absence of real legacy evidence `legacy_evidence_required`; fixture comparison `can_cutover=false`.
3. Close this thread with Phoenix recorded in GitHub and handoff in next thread. Continue #213 canonical capture, #215 Semantic Composer integration, signed editorial tasks, read-only real-work reconciliation, then DB-B publication/hold separately.
4. Stage one work Alice then five heterogeneous works only after authenticated writer and reviews are safe. Source review and copyright concerns remain per-edition.
