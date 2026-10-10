# ARTales — Editorial Task Contract v1 (cross-thread agreement)

Status: **integration contract / proposed follow-up**, not an applied database schema and not an authorization to publish. Prepared after comparing fixture ingest PR #196, catalog rights PR #197, and inbox PR #198 with `develop` head `4f630c4a581ef85c70b25ea6c9f3ecb6050a7c88`. Each source PR is still a draft at the time of this review. This contract limits parallel work to avoid racing migrations, UI and reader code.

## Ownership: one stable chain

`catalog_run -> candidate -> preferred source/edition -> rights dossier + immutable source snapshot -> works draft -> work revision -> editorial_task -> issue/review -> release decision`

1. **Candidate**: `public.work_candidates.id` (UUID) owns discovery and candidate-level triage. `work_candidate_sources.id` (UUID) identifies a **concrete source/edition choice**, scoped to that candidate. Component-rights rows refer to candidate + source. No candidate id is a work id.
2. **Work**: `public.works.id` (UUID) is the stable, already-existing ARTales work identity. On promotion, `work_candidates.matched_work_id` links back to exactly one work. Author identity uses `works.primary_author_id`, with FK to `authors.id`. Existing works store edition metadata in `edition_title`, `edition_version`, `edition_language`, `edition_source_url`, and related fields. **There is not yet a canonical editions table or work-revisions table** in the inspected production baseline; do not invent a physical `edition_id` or `revision_id` FK.
3. **Edition/source snapshot**: use an immutable logical `snapshot_set_ref` + `source_sha256` captured by the source-ingest layer, with a mapped `candidate_source_id` for actual candidates. This reference is distinct from `works.id` and from the Gutenberg eBook number/provider URI. The eventual storage/DB migration is separate from inbox v1.
4. **Work revision**: a logical immutable `work_revision_ref` (not a published database column yet), bound to the work, snapshot set, language, selected composer recipe, blocks/content hash and ancestry. Review approvals refer to a specific revision, never to "whatever the current page renders."
5. **Task**: `public.editorial_tasks.id` (UUID) from #198. Exactly one of `candidate_id` and `work_id` is populated on each task (database XOR check). Candidate-related tasks may represent legal/source exceptions; real text and visual editing tasks refer to `work_id`. `source_system` can be `artales|nexus|manual`, but only ARTales-admin creation is currently wired and no Nexus task insertion is authorized. For dedupe, use unique `(source_system,source_external_id)` when provided.
6. **Anchor**: PR #196 `AnchoredBlock` uses `sourceId`, `componentId`, `start`, `end` and `block.id`. Source offsets are half-open **[start,end)** within the captured component text; block IDs are **strings, not UUIDs**. An issue may anchor to a block or to `boundary_after` with an adjacent next block. The anchor must be stored together with `snapshot_set_ref` and `work_revision_ref` to prevent silent drift. Physical original/ARTales page numbers, font scale and viewport dimensions are diagnostic context only; never treat page number as a durable identity.
7. **Issue/review**: PR #196 `FixtureIssueReport` and `FixtureReviewRecord` are useful **fixture schemas**, but they live in browser localStorage and are not already persisted under `editorial_tasks`. A future `editorial_issues` / `editorial_review_events` store will be separately migrated; annotations must preserve source anchors, request type and exact proposed revision, including accepted vs returned outcome. Never automatically write a fixture review to a real work.

## V1 cross-boundary payload (conceptual, not a database row)

```ts
type EditorialTaskReferenceV1 = {
  taskId: string;              // editorial_tasks.id (UUID)
  target:
    | { kind: "candidate"; candidateId: string }
    | { kind: "work"; workId: string };
  candidateSourceId?: string;   // work_candidate_sources.id if selected
  snapshotSetRef?: string;      // immutable source capture
  workRevisionRef?: string;     // immutable composed revision
  anchor?: {
    componentId: string;
    blockId?: string;
    start: number;
    end: number;                // half-open offsets [start,end)
    boundaryAfter?: { nextBlockId: string };
  };
  issueKind?: "typography"|"structure"|"readability"|
              "pagination"|"line_break"|"unsure"|"other";
};
```

The task row alone is not an approval artifact. Any future backend must verify that the anchor and revision match the current locked work/version and source rights set before writing a new revision or closing a task.

## Transition contract

**Already implemented in #198 on ephemeral DB (narrow proof)**: `open -> claimed -> open` (return) with authenticated `editor/admin`, one sequential winner, and append-only `created/claimed/returned` events. Admin can enqueue one candidate `legal_review` task. This does **not** create a work or imply legal clearance. Sequential duplicate enqueue and claim/return were tested on a temporary synthetic database, cleaned up afterwards.

**Not implemented — separate follow-up**:
- `claimed -> submitted_for_review` by assignee after saving revision and editor notes; no final approval implied.
- `submitted_for_review -> returned_for_changes|accepted` by reviewer/authorized editor, with explicit reason/revision linkage; the new revision is staged without destructive overwrite.
- Mark task `completed` only when required review gates are satisfied; produce an event and update inbox atomically.
- A separate assignment for assets/illustrations (`kind=visuals`) to a real ARTales profile; do not guess the person ID from a name. Task actor and work owner remain distinct.
- Publication and withdrawal are separate, server-authorized transitions with rights re-evaluation, immutable prior revision and audit. A legal challenge may hold/unpublish under explicit policy; no local fixture button changes production availability.
- Rescan or regenerate only the complained-of section, retaining the rest of the accepted revision and verifying source integrity.

## Explicit thread/file ownership

| Workstream | Owner | Scope / do not edit |
| --- | --- | --- |
| **#196** | Second thread: Ingest/Composer/Reader | Owns `lib/fixtures/ingest*`, paired reader lab, anchored issue capture, typography and eventually measured pagination. **Do not modify `editorial_tasks` migration or admin catalog batch.** |
| **#197** | Main thread: Catalog/rights | Owns `lib/rightsScanDossier.ts`, `lib/catalogProductionPlanner.ts`, synthetic admin batch and policy. **Does not write or directly close editorial tasks** until signed dossier + snapshot contract. |
| **#198** | Main thread: Editorial inbox | Owns `editorial_tasks` SQL/RLS, server claim/return, and editor/admin inbox views. **Does not edit Composer or Reader fixtures**. |
| **Integration** | Sequential develop PRs | Main thread owns backend integration; second thread contributes mapping/adapters after the contract is accepted. A follow-up PR will connect persistent issues/revisions only after both base PRs land. |

## Merge/rebase order

1. PR #196 is fixture-only with no DB change. It is reported mergeable and Vercel success at checked head `8e52b7f24948f3921614b01b953863dc191d7688`. Perform latest visual/mobile QA, confirm preview route is protected in production, assess current test evidence, then seek merge authorization. Recheck head before merge.
2. PR #197 is fixture/catalog/rights policy, no DB changes; rebase from the resulting `develop` head and confirm current Vercel/tests. It adds an admin dashboard link.
3. PR #198 includes DB migration and changes the **same `app/member/admin/dashboard/page.tsx`** as #197. Rebase/update **after #197**, resolve dashboard navigation semantically, and perform independent concurrency/roles/browser E2E checks on ephemeral DB. A green Vercel build is not enough to merge a privileged schema change.
4. Only after validated merges start the follow-up persistent editorial issue/review workflow. Do not modify `develop` directly; all work goes via feature branch PRs.

## Operational note

The goal is a bounded admin-start workflow that selects **commercially usable** titles, persists candidates, prepares real drafts, then places genuine text-review tasks into the ARTales inbox. The editor does primarily textual/visual work; rights scanning is machine-first and only uncertain rights decisions go to exception review. A candidate legal-review task in #198 is a transitional pilot, **not** the desired final throughput. Nexus workers are optional and not in this path.

## Gate checklist for integration

- Exact candidate/source/dossier/snapshot/work/revision/task identifiers and immutable anchors.
- Role-based RLS, explicit audience, claim concurrency and return/submit/accept semantics.
- Idempotent task creation + event chronology + no duplicate work drafts.
- Rights/provenance fail-closed, no trusting model-only rights assertions or unlicensed translation/images.
- UI flow back to work list on completion/save, notification for revised sections, and review actions.
- Edition/source text not overwritten by editor layouts; page numbers not stable across settings.
- No production `main` / Supabase apply without a separate release authorization.
