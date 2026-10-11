# ARTales — Semantic Composer v2 as mandatory editor for legacy migration (2026-10-11)

**Decision:** no legacy work is marked migrated by metadata-only acceptance, copying old `WorkBlock` data or a format flag. All 49 published and 15 draft works require a new `artales.semantic-text.v2` revision in the governed editor, with original raw source, archived legacy observed bytes, deterministic text reconciliation, reviewed block structure and independent legal/release gate. Existing `works.id`, slug, public URLs, entitlements, local/account reader preferences and notes never change just to migrate the text.

## Integration baseline

This branch reconciles only the 19 isolated semantic QA/preview files from PR #209 onto post-#211/#212 `develop`. No existing public Reader, old WorkBlock editor, permissions or production DB changed. Actual protected work editing/save is **not implemented by PR #209**: `SemanticReaderLab` currently shows and navigates a synthetic PG11 revision, with QA notes in React memory. Production `/member/works/[slug]/edit` still renders `WorkEditorForm` and `WorkBlocksEditor` and may directly edit `works.status`. Do not call a test fixture a live editor.

## New protected work-editor contract

1. A protected `/member/works/[slug]/semantic` (or editorial-task-bound equivalent) is for editor/admin roles, scoped to **real work UUID and source snapshot**, not a synthetic fixture or arbitrary client work ID. A session is bound to `work_id`, immutable `source_snapshot_id`, source component spans, editor task and latest draft revision.
2. Panel A: exact archived raw source with preserved source bytes/offsets and component legal markings. Panel B: editable semantic structure/typography over the same immutable source atoms. Flag/select a chapter, paragraph, verse, footnote or metadata field, add a grounded reason, then create an append-only **new draft** with a new revision hash and parent. No direct mutation of published text.
3. The machine proposes structural blocks, human flags problems and may accept/reject specific patches; manual semantic edits that alter source text are explicitly marked as derivative editorial changes and demand their own legal/source gate. Source text cannot be silently replaced.
4. After every revision, verify source coverage without missing/duplicated bytes, chapter/poem layout and footnotes; reader QA preview uses the same semantic renderer. `qaNoteSession` notes are not canonical editor issues; persistent issues must be anchored to actual immutable revision and editorial task and keep return rounds.
5. Attach complete `SemanticRevision` integrity separately from the DB-A `semantic_sha256` of `semantic_blocks::text`. Explicitly store/check dual digests, canonical serializer/JSONB roundtrip, recipe, parent, original byte hash and verified work UUID. Draft save must return actual persisted revision ID/hash and be idempotent. A stale parent/digest or foreign work/source aborts transaction.
6. Do not create a new work for a legacy title or forge a prior candidate; legacy provenance is `legacy_backfill`. Only `capture_work_source_pending` and approved future storage entrypoints can add new raw snapshots, and input bytes remain unapproved until independently checked.
7. Account/user notes are **not** editor comments. Preserve legacy `reader_notes` and browser progress; add only an opt-in per-user revision-bound anchor sidecar, signed GoTrue ownership and fail-closed cross-user tests. Reflow doesn't change note ownership, original data or user preferences.
8. Legal/metadata/visual review must approve pinned evidence and exact asset/text hashes. Pending/disputed edition source cannot be released. Separate protected Hold for credible rights issue; never automatically depublish works merely because metadata is missing. Work remains publicly on lawful current release while safe revisions are being prepared.
9. Pilot: synthetic work, then sanitized legacy Alice + independently verified raw PG #11 source, then five heterogeneous titles covering prose/translation/poem/footnote. No full text or personal user records in repository test fixtures.
10. Only after controlled per-work cutover may the legacy manual editor be retired. New editor must not inherit its direct publish bypass. All new content approvals / release operations use common signed governance.

## Blocking implementation steps

**E0:** reconcile the isolated PR #209 files on newest develop and run exact-HEAD CI, TypeScript/ESLint and DB regressions (this branch); no merge without another explicit authorization.

**E1:** real-work read-only semantic workbench with allowed server-side source lookup, fail-closed on missing source/archive/rights, side-by-side source and new semantic projection, and current work metadata, status and review issues. Do not copy live raw content into repository or expose unpublished material in public preview routes.

**E2:** immutable revision persistence and editor issue/return RPC with signed editor/admin role and per-work/task auth; full source span and digest validation. Local CI Auth E2E, concurrency and replay/self-approval negative tests. Does NOT publish.

**E3:** reader notes/progress anchor migration and account preference compatibility; signed per-user isolation and two-device tests.

**E4:** DB-B governed publication/hold; retain old approved lawful release while editing replacement. Legal audit and per-work cutover independent authorizations.

**Immediate acceptance rule:** a future claim `legacy_migrated=true` is invalid unless a real `SemanticRevision` exists, is stored, renderer QA + legal/source checks completed, editorial approval targets exact digest and the release pointer has been atomically changed.
