# ARTales — Mandatory legacy re-ingest, recomposition and Reader cutover
**Architect clarification, 2026-10-11.** Integral part of PR #204. Documentation only; no permission to modify the production database, release logic, reader or `main`. Read with `ARTALES_UNIFIED_PUBLICATION_LEGACY_CUTOVER_2026-10-11.md` and `ARTALES_UNIFIED_WORK_GOVERNANCE_V1_1_2026-10-11.md`.

## Non-negotiable architectural decision
**An existing published/draft `work` is not migrated merely by filling in metadata/rights and clicking Accept.** Every retained legacy work must be evaluated for an actual source/edition and **re-ingested, recomposed with the new ARTales semantic block model, rendered and editorially re-approved** before it can be marked *migrated to the new publication model*. A mere read-only audit is insufficient.

- Stable `works.id`, slug, public URL, author/contributor identity, reader entitlements, library associations, cover history, bookmarks, progress and notes must survive.
- Keep existing published content and legacy Reader operational as a temporary compatibility path until an individual new revision passes all checks. Do not mass-republish or perform direct manual `status=published` bypass.
- A genuine legal risk may trigger a separately authorized hold before recomposition; ordinary typography issues should not automatically unpublish an otherwise lawful existing version.
- Distinguish **work identity**, **source edition**, **original raw source snapshot**, **legacy database content snapshot**, **composed semantic revision**, and **publication release pointer**. None substitutes for the others.

## Verified current reader implementation
At the checked `develop` HEAD `e514cc685ad807707df127fce0f654918b360f99`:
- `app/reader/[slug]/page.tsx` gets a published work from `getWorkBySlug`, uses `work.content_blocks` or fallback `work.content`, plus `getPreviewBlocks` for excerpt mode; full read remains gated by `canOpenFullReader`.
- `components/reader/ReaderClient.tsx` calls `paginateReaderBlocks` and `components/work/WorkContentRenderer.tsx`.
- `lib/blocks.ts` defines old rigid `WorkBlock` union; current formatter and `lib/reader/paginateBlocks.ts` sometimes fragment blocks for pages, including poem/newspaper lines. The old model is **not** the authoritative shape for the new semantic edition.
- Reader notes and progress: `lib/reader/readerStorage.ts` uses slug, percent, page index/count and layout; `app/api/reader/notes/route.ts` stores `work_slug`, percentages and pagination metadata. Page numbers will drift after recomposition. Preserve and remap these records; do not silently drop them or claim stable anchoring.

## Per-work migration contract (legacy batch N=1 then 5 then rest)
1. **Inventory / freeze observable legacy bytes (no writes initially):** capture current content text + resolved legacy block batches + author metadata + source refs + edition fields + public description/cover references and the live Reader projection. Hash and archive immutable *legacy observed* snapshots only after separately authorized safe storage. Record `work_id`, old slug, revision/URL lineage, capture time and provenance=legacy_unverified. No claim that existing content was an original source or legally approved.
2. **Identify actual source/edition:** re-discover Gutenberg eBook/reference or lawful original source; determine exact edition, translator, preface, notes, image/cover rights and jurisdiction. Retrieve via permitted acquisition channel, archive independently immutable **raw source bytes** with SHA-256, retrieval metadata and component ledger. Source archive and old website content archive are two distinct records.
3. **Compare for source drift:** align legacy text/blocks against the verified source. Flag missing chapters, duplicated headers, differing translations, corrupt line breaks, unexplained edits, invented passages and copyright/metadata mismatches. No silent 'copy prior blocks as new'. If exact source unknown or differences unexplained, fail closed to human issue and postpone migration approval; retain safe prior public edition under an explicit temporary compatibility policy.
4. **Deterministic clean + adaptive composition:** strip only boilerplate/component exclusions, preserve offsets into raw captured source and attribution evidence. Build **new** semantic ARTales blocks: chapter/section and paragraphs, quotes, nested verse/poem (stanzas and lines within a coherent block), footnotes, epigraphs, tables etc. Structure is governed by a versioned schema, compositor recipe/model, typed typography tokens (emphasis, italic, indent, stanza spacing, line breaks, page-break intent), block IDs + source-span anchors + hashes. The old `WorkBlock` format is a reference and migration input, not a requirement that locks in past bad presentation.
5. **New Reader projection, not old renderer with new JSON:** define validated semantic revision -> renderer/pagination projection. Test `WorkContentRenderer` replacement/adapter, `paginateReaderBlocks` replacement/adapter, preview/full/inline embeds, headings, footnotes, verse preservation, responsive multi-page/spread/scroll modes, font preferences, tables and large works. Do not reproduce former fragile block splitting merely to be wire-compatible. Explicitly exclude reusing withdrawn pagination patch v0.10.15k unless newly authorized.
6. **Compare and iterate:** side-by-side verified raw source, current public legacy rendering and candidate new Reader output; machine check loss/duplication and human review diffs/layout. Two or more return rounds, stable revision-bound issue anchors, regeneration of only changed blocks; preserve approved unchanged spans.
7. **Preserve reader state:** `reader_notes`, locally saved bookmarks/reading progress, full-reading entitlements and library membership cannot be lost. Migrate anchor to `work_id + stable block/span + revision` where remap confidence is defensible; keep original slug/percent/page snapshot as compatibility fallback and show a user-visible approximate location if exact anchor cannot be reconstructed. Paged screen number is never canonical. Do not leak notes between users.
8. **Legal + content + metadata + visual approvals:** independently approve the candidate source/edition, translated material and images; specific text revision, generated public blurb/credits and visual assets. No metadata-only checkbox substitutes for editorial render review or original source correspondence.
9. **Atomic release and rollback:** switch `works.published_revision_id` (or approved equivalent) and new Reader projection only when rights, content QA, approval, mapping and runtime smoke tests pass. Release pointer + available assets must change coherently. Keep previous revision/renderer fallback with explicit time-bounded retirement policy. On failure, revert to prior *approved & lawful* revision, or hold if legal risk precludes rollback to the previous version.
10. **Retire compatibility:** only once the remaining legacy subset is zero or explicitly held/unavailable, all public routes use new release pointer, reader notes/entitlements reconciliation passes and no direct legacy write bypass exists. Historical snapshots remain archived for audit; old renderer need not persist as active normal path.

## Practical rollout and measurable gates
- **Pilot 0**: one synthetic locally seeded work and one sanctioned raw source, with same shape of reader state; no production.
- **Pilot 1**: one read-only copied/sanitized legacy example on an isolated environment; do NOT copy personal reader notes or user data; verify semantic diff, verse/footnotes and mobile reader render.
- **Pilot 5**: heterogeneous works (prose, poem/verse, translation, footnotes/table if available, uncertain metadata). Do not select only trivially successful cases.
- **Batch remainder**: stage by source/edition risk and content complexity with per-work `legacy_observed -> source_verified -> recomposed -> reader_qa -> editorial_approved -> release_ready -> migrated` tracking, and explicit `held/unresolved` reasons. Reconcile unique work IDs, slugs, old/new hashes and access after each batch. Respect production authorizations, budgets and practical review capacity.

## Negative/regression tests (merge gates)
- No snapshots -> migration cannot be stamped `migrated`.
- Old content != verified source -> visible diff and blocked until reconciled.
- Original Gutenberg wrapper or unlicensed intro/translation/image does not leak into composed or public release.
- Poem with multiple stanzas remains semantically coherent; no naive line->block fragmentation, no line-loss/reorder; indents and italics preserved.
- New Reader read, preview and internal edit preview render faithfully with long paragraphs, mobile typography, pagination and footnotes.
- No duplicate or dropped text across reader page boundaries; no blank/overflow pages from automatic splitting.
- Reader note/progress/entitlement must survive; stable exact anchor preferred, bounded approximate fallback explicitly indicated.
- Revising an already published work must not overwrite its live revision; reviewer return cycles do not change live Reader.
- Legal hold prevents public reading even if cached old renderer, old REST endpoint, old cover asset or direct access URL is used. Ensure CDN and storage controls.
- Rejected migration leaves previous production content and public URL unchanged.
- A successful cutover retires direct status mutation only after tested compatible editor/reader client migration; no permanent dual publication system.

## Ownership and releases
- **Main ARTales thread** owns legacy inventory, source evidence authority, release/read pointer, rights/RLS/ACL and rollback contract; changes to DB and privileged routes require dedicated high-risk PR and explicit authorization.
- **Parallel Reader/Composer thread** owns new semantic block schema/recipe, Gutenberg cleanup and source anchors, comparative Reader QA and renderer/paginator migration feasibility. No canonical DB migration, `main` or production.
- Visual thread independently owns variant review/collection briefs. Do not conflate typography with visual rights.
- **PR #204 is docs-only**, not approval for schema/renderer changes or migration. Preserve work IDs and release controls throughout.
