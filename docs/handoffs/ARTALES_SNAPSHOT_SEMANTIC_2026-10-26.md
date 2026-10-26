# ARTales Snapshot → Semantic v2 | durable handoff | 2026-10-26

## Architect decisions (binding intent, NOT action grant)
1. Deploy **separate, connected** components: Legal Check → private immutable raw Snapshot → verified semantic source components → Semantic Composer v2 → protected Block Editor + new Reader QA → per-work governed release. Never couple Snapshot to legacy production Reader or perform a single full cutover.
2. Legal Check v1 is provisionally finished. Legal lock authorizes the chosen Gutenberg **edition/catalog entry**, not an irrevocable binary format. On the same verified Gutenberg record we may choose EPUB/HTML/TXT as technically suitable **without repeating Legal Check**, recording both original locked URL and newly selected file, and proving text/edition correspondence before composing. Any changed translation, creative insertions or contradictory source data must stop for review.
3. Store exact raw downloaded file separately in a **PRIVATE immutable archive**, byte-for-byte SHA-256, acquisition URL, format, timestamp, catalog evidence, and component manifest. Prefer retaining original EPUB with embedded images if lawful for internal archive; **rights-unknown images are never publicly served** and may require metadata-only instead. Visual editor decision original/custom/omit is downstream and independent.
4. Existing corpus 64 works (49 published, 15 draft at 26 October) must be assessed one at a time. Save an independent `legacy_observed` snapshot, compare against verified Gutenberg source, extract true ARTales editor contributions (prefaces, notes, original added passages, public metadata, credits); distinguish mechanical parser `editor_note` fields. Preserve work ID, slug, public URL, reader notes/progress, entitlements and editorial attribution. Recompose, compare and cut over 1 → 5 → remainder, never blind overwrite or mass republish.
5. Temporary Git policy: create independent topic branches from freshly checked **main**, PR against main for review; treat `develop` as historic reference only, cherry-pick selectively after review, no wholesale merges or copy of superseded code. Standalone routing policy Draft PR #275; not merged or production approval.
6. Approval/acceptance != merge != deployment != DB/Storage apply != publication. Do not assume authority carry-forward, create Nexus work arcs without authorization, or bypass Nexus/Phoenix gates.

## Verified reference state / handoffs
- Production Legal closure: `docs/handoffs/ARTALES_LEGAL_SCREEN_2026-10-26.md` (main).
- Production legal source: *The Great God Pan*, Arthur Machen, Project Gutenberg #389, candidate `98508359-bce1-4e73-b842-b69a9d1112d0`, source `2fbd2f26-89e6-464e-b048-001a8e533cc0`, locked decision no. 9, catalog `https://www.gutenberg.org/ebooks/389`, frozen download `https://www.gutenberg.org/ebooks/389.epub.noimages`. Verdict: text without illustrations; image rights not yet established. Separate source inspection/completeness necessary.
- Existing production private Storage `artales-source-archive` allows only GIF/PNG/JPEG, 10 MiB; **NOT EPUB**. Raw source archive requires separately authorized private bucket/MIME/ACL and real readback. No raw Snapshot DB tables or SemanticRevision publishing pointer yet. No real EPUB bytes have been fetched or archived under this pilot.
- `develop` at `671cc8453e87dee53fb0d86954cce9b1572c65cd`: isolated experiments `lib/ingest/gutenbergSnapshot.ts` (PG11 pinned), `gutenbergImageManifest.ts`, `illustrationStorageAdapter.ts`, `lib/semantic/model.ts`, `compose.ts`, `readerProjection.ts`, and test fixtures. New Semantic Reader draft PR #209 and separate admin image endpoint draft PR #237 are **not production**; documentation contains dated superseded states. Never import all develop.
- Main originally `ba9f442ac5476a24affe814a7cbda5e8594044ef`; always re-check.
- Old Reader remains running while the new semantic pipeline is independently proven. Old WorkBlock/DB records are temporary compatibility only.

## S0 – source-only isolated PR
`lib/ingest/lockedSnapshotSelection.ts`: accept trusted server-read frozen lock and freshly fetched Gutenberg book/catalog; reject missing approval, mismatching ID/edition, unsigned or off-host URLs; preserve legal decision ID and select same-book format only from catalog inventory. Output **selection proposal**, not rights grant. `tests/lockedSnapshotSelection.test.ts` focuses on negative conditions. `artales.snapshot-selection.v1` is input to later source capture; it is not the raw archived source.

Review gates: focused local tests, TS and CI for exact branch HEAD. No runtime route/DB/schema/Storage or public Reader changes. No claim of successful real remote EPUB fetch or Storage readback from tests.

## S1 – requires separate authorization
Private raw EPUB archive infrastructure, role-scoped server-only entry, read actual Gutenberg #389 bytes, bounded ZIP parser / preservation of embedded assets, true SHA-256 upload/readback, immutable receipt and audit. Prefer original package with lawful embedded images. Stop if provenance or archive rights unclear.

## S2 – separate integration
Match actual text components (translation/editorial extras/graphics) to frozen legal edition; preserve offsets into raw archive; use `artales.semantic-text.v2` via verified, separately imported Composer, not legacy Reader/WorkBlock. Different file formats must pass content correspondence, no repeat of unchanged Legal Check. Protected semantic editing, return rounds and Reader QA independently gated.

## S3 – legacy migrations
Independently archive current published/draft original, diff and extract editor contributions with attribution, compose new immutable revision, preserve reader state and existing URLs. Atomic per-work authorized cutover with tested rollback and rights hold.

## Next thread start
Read Nexus STARTUP-01/Continuity/Phoenix, ARTales `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, legal closure and **this handoff**. Verify live repo/PR/DB and user scope first. Do not inherit a production authorization from this checkpoint.

## S1 source-only progress (2026-10-26, PR #276)
- Source modules `lib/ingest/rawSourceSnapshot.ts` and `lib/ingest/rawSourceArchive.ts` implemented separately from runtime, with negative tests `tests/rawSourceSnapshot.test.mjs`.
- `captureRawSource` copies exact original bytes, computes SHA-256 and content-addressed private target path; bounded ZIP central-directory metadata inventory (including illustration presence) or strict UTF-8 TXT/HTML screening; emits no semantic approval or publication permission. It does **not** fully parse/recompose EPUB or confirm actual internal image rights.
- Embedded images are catalogued but **archive_ready=false** pending separate internal-retention approval. Individual public image use remains excluded pending legal/editorial approval. This source-only gate is deliberately stricter than desired long-term archiving, and should be revisited with rights policy explicitly.
- `fetchRawSource` is a server-only bounded acquisition primitive with strict URL, exact HTTP 200, no redirect, byte count, and no automatic retry. Gutenberg robots/automated-use requirements and real endpoint availability need a separately conducted integration review; no genuine Gutenberg #389 bytes downloaded in this work.
- `archiveRawSource` is an inert adapter targeting a **proposed new** private bucket `artales-raw-snapshots`. It writes with upsert=false, readbacks and verifies SHA-256. Existing production `artales-source-archive` is illustrations-only and must NOT be reused for EPUB. No actual bucket, policy, route, schema, credentials, server service call, production data or publication changed.
- Local isolated run on Node 22: `node --experimental-strip-types --test tests/rawSourceSnapshot.test.mjs` => **10/10 PASS**; focused `tsc --noEmit` also passed using local Node type defs. Exact PR CI after source files and workflow update is the next verification checkpoint.
- Do NOT claim a true archivally persisted Snapshot; local tests use synthetic bytes and mocked Storage readback. Next gate is real authorized Storage + end-to-end capture, then independently reusable Semantic Composer v2 validation.
