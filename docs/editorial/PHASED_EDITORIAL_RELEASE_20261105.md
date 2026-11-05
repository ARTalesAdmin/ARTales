# ARTales — phased editorial rollout / acceptance plan

Status: verified read-only production inventory, 2026-11-05. This is **NOT a deployment authorization**.
Production: Vercel main `72ae85687b9aefbad8fd5d72f3f6706b974e1c37` (PR #296);
review PR #297 remains draft and not merged.
Production database ARTales project `nmhdwmszbwgrgfbmlguu`.
Read-only observed: 6 editorial tasks (6 active), 1 text QA task, 1 open QA flag,
0 published semantic editions. This is *not* yet a complete editorial AI round trip.
Production has neither `artales_commit_safe_layout_revision` nor
`artales_finish_semantic_text_qa` nor durable AI job RPCs; do not fake readiness.

## Phased release, in the shortest safe path

### Phase A — schema and authorizations (before new UI activation)
- Read-only fingerprint current tables, constraints, function signatures, RLS and approved owner profiles; compare each intended SQL migration against what really exists. Existing migration history is incomplete relative to live hand-applied SQL: never assume absence from `schema_migrations` means SQL is absent.
- Run migration and role matrix on an isolated / restorable database; test actor identities, atomic claim/return, service-role privilege boundaries, SQL function EXECUTE grants, concurrent repairs, exact source hashes, crash/retry consistency. Verify both live and isolated differences before any production APPLY.
- Prepare *non-destructive* sequential plan for exact required SQL files; production APPLY requires explicit separate approval. Capture before/after schema fingerprints and rollback.
- Do not grant QA write privilege to anonymous readers or to a cross-task editor.

### Phase B — editor UI in production, feature scoped to authorized staff
- Merge only after checks, database prerequisites and explicit owner merge approval.
- Set editor feature `NEXT_PUBLIC_ARTALES_SEMANTIC_PIPELINE_V1=enabled`
  only when application and deployed DB match. Existing server-side profile/RLS remain authoritative.
- Keep **`ARTALES_SEMANTIC_PUBLIC_READER_V1` absent/off** during this phase.
  The new server-only public reader gate is independent; all existing reader URLs
  and legacy works remain on untouched `ReaderClient`/original WorkBlock paging.
- Keep AI spending off; work through first QA, flags, and deterministic layout fixes with administrator in a single representative title (initial pilot The Great God Pan).
- Verify exact editor task owner, visibility, locks, persisted flags, batch revision, resolved flags, re-review, QA completion and next task creation. Do not invite Pavla or Ivana until this owner pilot succeeds.

### Phase C — constrained AI worker
- With separate approval, set server-only AI provider key and tested model, controlled worker flag and secrets, plus budget. No key in client code.
- Test 1 flag → 1 supported presentation correction → verified immutable revision → explicit accept/return; then several findings together and repeated returns.
- Confirm no source word/byte changes, dedupe/retry, fail-closed incomplete jobs and idempotent receipts. Record provider model, input/output tokens, measured/estimated cost where supported; do not claim full accounting if not implemented.
- Editor can remain in same QA session or leave and return; no silent user-side auto-approval.

### Phase D — private semantic reader, then per-work public cutover
- Preview new semantic renderer with authorized reviewers and source-safe test book, compare screenshots against production reader on mobile, tablet and desktop at multiple text sizes and layouts. Review pagination overflow, long paragraphs, poems, headings and protected terms. Confirm note/progress handling.
- **Only after parity acceptance** enable `ARTALES_SEMANTIC_PUBLIC_READER_V1=enabled`, maintaining per-`work_id` published-semantic routing; works without a published semantic revision remain on the unchanged legacy reader.
- Rollback: disable reader gate without deleting semantic data. Do not globally convert WorkBlocks.

### Phase E — real editors and catalogue migration
- Once owner pilot has completed, assign prepared editorial tasks to Pavla and Ivana, verify with their feedback and actual QA throughput.
- The existing catalog migrates per title; preserve author, cover, visuals, collections, legal proof, URLs and reader assets. Deprecate old content model *only after* every intended title and reader dependency passes acceptance and a human explicitly approves cutover.

## Release checklist
- [ ] Schema/RLS/role simulation proof on isolated database
- [ ] Production SQL plan reviewed and explicitly authorized
- [ ] UI + DB revision compatibility verified
- [ ] Legacy reader source and behavior unchanged during phase B
- [ ] Admin pilot QA complete, including AI-less fallback
- [ ] Controlled AI model/cost/worker authorization and observed success
- [ ] Browser screenshot and accessibility parity for semantic reader
- [ ] User approval for each merge, production APPLY and activation

Do not collapse phases, equate successful CI with database migration, or turn on
public semantic reader to test editorial QA.
