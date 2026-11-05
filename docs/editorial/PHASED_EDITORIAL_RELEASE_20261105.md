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


## Actual production checkpoint — 2026-11-05

**Applied:** Supabase ARTales production migration `20261105105037_artales_editorial_pool_ownership_v3`
from `ops/sql/20261104_artales_editorial_pool_ownership_v3.sql`.
Provider returned `success:true`. Readback verified:
- `artales_editorial_capabilities`: Pavla 5 competencies; Ivana 9 competencies.
- `artales_editorial_default_owners`: cover, author visual and collection to Ivana.
- `task_staff_read` RLS is active and scoped to admin, existing owner or eligible unassigned work.
- Pan candidate `98508359-bce1-4e73-b842-b69a9d1112d0`: six existing tasks unchanged except explicit QA takeover.
- Pan QA `fe8257aa-d624-41f3-9e7c-24b49ad02455` reassigned **from Pavla to Luboš** and `claimed` with durable event. The other five retain their owners and statuses.
- Open QA finding around the typography of `Raymond` persists.
- No schema apply for AI jobs, change decision v4, safe layout commit v4, closeout v4 or monthly review.
- Production UI remains main `72ae85687b9aefbad8fd5d72f3f6706b974e1c37`; large PR #297 is still draft.
- Public semantic reader stays disabled, no semantic publication created, no AI keys activated.

**Next release gate:** do not merge the composite PR #297 just because its CI succeeds.
Validate v4 service-only commit, per-change acceptance, AI crash/retry and SQL RLS
under realistic role and concurrency tests first; then separately approve deployment
of the editor UI, with independent public reader gate off. The user will perform
Pan's QA together with the assistant before five preassigned tasks are handed
to their respective editors for feedback. Preserve legacy content and readers.

## Editorial task navigation / evidence gate — 2026-11-05 (PR only)

- New candidate-specific internal detail: `/member/editorial-detail/[candidateId]`.
  Candidates are not yet `works`; **never** send their author, collection,
  cover and blurb tasks into a legacy published-work editor or text QA.
- Every inbox task links to its actual work surface. QA/proofreading opens
  semantic editor; collection, cover, description and author go to dedicated
  candidate sections; existing author and collection records link to their
  actual editing pages. New author creation returns to the candidate detail.
- Metadata is stored per candidate; the legacy public `works` and WorkBlocks
  are untouched. Separate bounded field writes allow editors to work in parallel.
- Save collection, blurb or cover **once**. If the task is currently claimed
  by that editor, the server tries to close it automatically. A database BEFORE
  trigger independently verifies the collection relationship, 200–800 char
  blurb, or an existing actual cover storage object with alternative text.
  Author text and portrait completion require a linked existing author and
  real bio/portrait evidence. Claims and completion remain separate audit events.
- Migration DRAFT: `ops/sql/20261105_artales_candidate_editorial_metadata_gate.sql`.
  UI and source-contract CI green on PR. **Do not activate this UI before the
  DB migration is authorized and the trigger/RLS are proven on realistic users.**
- Critical existing publication gap observed read-only: current
  `artales_publish_semantic_candidate` expects exactly three completed task
  kinds, yet Pan has six tasks; it also creates or finds an author by name and
  inserts work without using the candidate metadata's author/collection,
  cover and caption. Therefore **publication remains blocked** until a
  separately reviewed replacement supports all active task kinds, validated
  metadata and safe author/collection/cover transfers.
- No auto-publish or public reader switching in this change. The Pan QA task
  remains claimed by the administrator and the five downstream assignments are
  unchanged. This task flow is intended for their first live editorial pilot
  after activation and QA.
