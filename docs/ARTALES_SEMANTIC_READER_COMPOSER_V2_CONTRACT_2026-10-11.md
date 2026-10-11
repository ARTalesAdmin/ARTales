# Semantic Reader / Composer v2 — independent integration contract (2026-10-11)

Based on merged #204/#205/#206 and draft design #207. Pure isolated contract. No main, no DB, no release pointer, no production notes copied.

## Semantic revision
`SemanticRevision.schema=artales.semantic-text.v2`, `work_id` and slug are preserved, `source_snapshot_ref`, exact source bytes SHA, `revision_ref=sha256:<digest>`, parent revision and recipe version are pinned. New `SemanticNode` is **not** `WorkBlock`: chapter/section have heading and nested children; paragraph/quote/epigraph/footnote atoms carry typed marks; poem has nested stanza/verse atoms. Source separators are tracked as named gaps, not discarded. All [start,end) offsets are UTF-16 normalized character positions plus original UTF-8 byte offsets, and every source atom binds `source_sha256`. No source rewriting is silently permitted.

The new `projectSemanticReader` is independent of legacy `paginateReaderBlocks`. It arranges entire meaningful units and never reconstructs strings from trimmed fragments. Oversized units are marked `scroll_unit`, not truncated. Viewports validated for desktop/mobile; `verifyReaderProjection` requires exact unit order and cardinality. Actual browser measurements and deployment of new Reader to public routes remain **pending**; this code is a pure projection and is not yet the live reader.

## Legacy and Reader state
`remapLegacyPosition` uses `work_id + source snapshot + original byte span` when exact evidence is available. Page number and percentage have no authority; fallback is explicitly approximate and retains the complete original position. No notes, subscriptions, bookmarks, progress or entitlements are read/written. Full account-scoped remapping is owned by the future integration step.

`compareAliceThreeWays` shows verified Gutenberg #11 original, semantic text, and `legacy_observed` only when a separately verified safe snapshot exists. A generated synthetic legacy comparison cannot be called production evidence, and missing real legacy data results in `legacy_evidence_required`. Actual production Alice content (and personal notes) must not be copied to public test data. `can_cutover=false` unconditionally.

## Main thread handshake / PR207 DB-A
- Main thread supplies immutable external raw snapshot + component rights manifest and separately snapshotted `legacy_observed` content.
- Reader/Composer returns schema, recipe, exact source anchors, text/revision digests, parent ancestry, QA evidence and optional legacy source-drift result. No server trust or human approval inferred from these client-side values.
- DB-A later stores `work_text_revisions.semantic_blocks`, immutable source refs and verification; independently governed DB-B release decisions bind revision hashes and QA.
- No application route, `works.status`, catalogue orchestration, SQL migration, privileged RPC or production release is modified here.

## Blocking work for public cutover
Actual semantic React renderer and browser-measured multi-format pagination; full Editor facing-page and 3-column protected QA preview; safe read-only sanitized production Alice baseline; footnote layout/link handling and richer inlines; real reader notes/entitlements migration with signed account E2E; independent CZ/EU rights and editions evidence; privileged DB publication/hold gates; 1→5 work rollout. No substitute for existing production reader until explicitly gated. Revert this isolated PR to roll back.

**Risk high** by Reader policy although only isolated QA surfaces are added. **Target develop first; DB no; Env no.**
