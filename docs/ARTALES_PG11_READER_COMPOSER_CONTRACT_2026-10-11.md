# Reader/Composer PG #11 bounded Gutenberg pilot — 2026-10-11

## Boundary and provenance

Independent workstream from `develop` at `e514cc685ad807707df127fce0f654918b360f99`; handoff in PR #204 consulted. No `main`, production Supabase, environment change, main-thread editorial backend, catalog or publication gate. This is a **fixture and pure adapter**, not a legally authorized release.

One exact archival source: Project Gutenberg eBook **#11**, Lewis Carroll (1832–1898), *Alice's Adventures in Wonderland*, original English text, **The Millennium Fulcrum Edition 3.0** (the source archive reports update October 6, 2016). Third-party GITenberg mirror pinned to commit `7f18748e114b994d5d9454d5793581bc0b9cf9d7`, Git blob SHA-1 `0f25e9af379233267a09623e0c650472f9e463ea`; path `11-0.txt`, 173595 original UTF-8 bytes, including BOM/CRLF, SHA-256 `49a0b2726606e1290ac03a63978fa1dd1bd38a8d805704d98265f393533ea094`. Archived as `tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt`, exact-byte snapshot, not live fetched by a web page. PG wrapper and licence evidence preserved within those immutable bytes; body excludes PG terms and downstream cover/illustrations, no images included.

**Rights assessment only preliminary:** Carroll's death year suggests literary text merits territorial review; actual editional/translator/illustrator status and commercial CZ/EU reuse still require independent human dossier sign-off. GITenberg/PG US public-domain labels do **not** constitute CZ/EU clearance. The Fulcrum edition credit is preserved in the source evidence and excluded from literary blocks pending component-level review. Source uses original English, not a translated version; translations and covers explicitly excluded. Do not publish this text from this PR.

**Acquisition**: never crawl `gutenberg.org/ebooks` pages. Adapter accepts only the exact fixed GITenberg raw Git URL/commit and expected SHA-256, no redirects, 5MiB byte cap and 10s timeout, no automatic retry. Production ingestion requires a separately authorized sanctioned bulk/mirror route and refreshed rights review. Official policy: https://www.gutenberg.org/policy/robot_access.html and https://www.gutenberg.org/policy/terms_of_use.html. Source here is a one-time archived mirror Git snapshot; exact bytes and checksum checked at intake.

## Deterministic data contract for the main thread

`createPg11IntegrationPayload(snapshot, extractPg11Components(snapshot))` yields:
```ts
{
 schema: "artales.ingest.snapshot-handoff.v1",
 candidate_id: string, candidate_source_id: string,
 source_uri: string, retrieval_method: string,
 bytes_sha256: string, snapshot_ref: `sha256:${string}`,
 content_components: Array<{
   id: string, kind: "WORK_CONTENT"|"SOURCE_WRAPPER"|"EDITION_CONTENT"|"ASSET"|"TRANSLATION",
   label: string, disposition: "qa_text_only"|"exclude"|"manual_review",
   original: { byte_start:number, byte_end:number, first_line:number, last_line:number }|null,
   reason: string
 }>,
 jurisdiction: "CZ/EU", rights_dossier_ref: string,
 capture_time: string, provenance_and_license_manifest: object,
 release_allowed: false
}
```
The snapshot's `raw_utf8` is server-side source archive material and **must be stored separately** under a write-once object reference. Main thread implements real candidate/source ID resolution, immutable snapshot persistence and privileges, independent `rights_dossiers`, `work_revisions`, task + issue event stores and publisher checks. Fixture IDs are **not** legitimate UUIDs/DB foreign keys. Block `start/end` are `[start,end)` offsets in LF-normalized `FixtureCapture`, **plus** `original.byte_start/byte_end` in exact archived UTF-8. Source hash/ref binds every original anchor. Page numbers never become identity.

The source is split into wrapper head, edition frontmatter, work text, edition tail and PG licence wrapper with exact line/byte windows, and linked source cover excluded. Missing/multiple/out-of-order markers, embedded new asset/footnote/translation markers, tampered bytes or blank text fail closed to `needs_boundary_review`. No automatic hidden stripping of prefaces, notes, or legal evidence. The pilot composes chapter I to existing `AnchoredBlock` fixture for side-by-side tooling; whole-text composition also testable without persistence. Composition is bounded and no downstream direct `works.content_blocks` writes occur.

`revisionReview.ts` binds `RevisionBoundIssue` to `snapshot_ref`, exact source anchors, `parent_revision_ref`, `parent_revision_sha256` and review round; `applyReturnedIssue` revises only the selected block layout using existing recipe. Immutable revision hash includes parent, changed blocks, issue and state; unchanged block arrays remain byte/content/anchor-identical. The next review pass requires an explicit accepted checkpoint, not simply deleting issue metadata. All decisions are fixture-only; integrate with real editorial task and permission model only via main thread.

## Files

- `tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt`: pinned complete raw source evidence.
- `lib/ingest/gutenbergSnapshot.ts`: bounded acquisition, raw SHA-256, structural components, byte-anchored text composition, payload contract.
- `lib/ingest/revisionReview.ts`: version-bound selective return, recompose, review and resubmission.
- `tests/gutenbergIngest.test.ts`: hash, source fidelity, legal exclusion, wrapper/translation/image negatives, network caps, two reviewer rounds, stale/tampered ancestry.
- `docs/ARTALES_PG11_READER_COMPOSER_CONTRACT_2026-10-11.md`: this integration contract.

## Limitations and rollback

No production persistence, no human reviewed CZ/EU rights dossier, no full actual `ReaderClient` paginated E2E, no protected browser click QA, no Vercel or real DB writes. Existing visual fixture remains the synthetic Czech book; this PR prepares a genuine original-text pilot *adapter* for future context-switched UI review, not an assertion that the UI already displays Alice. No automatic task notifications or publication.

Rollback: revert this PR (new files only). No DB rollback or environment cleanup needed. Manual preview checks, if later wired: compare chapters/verse/notes and original source anchors, two sequential targeted issue cycles, mobile/A4 layout, ensure no network call to Gutenberg or DB mutation.
