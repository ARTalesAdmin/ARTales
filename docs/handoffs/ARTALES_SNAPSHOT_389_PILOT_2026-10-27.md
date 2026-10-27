# ARTales Snapshot #389 | implementation and production-test handoff | 2026-10-27

## Architect's objective and boundaries
- Legal v1 (production) approved *The Great God Pan*, Arthur Machen, Project Gutenberg #389, legal decision **9**, CZ/EU, text only. Original locked download URL `https://www.gutenberg.org/ebooks/389.epub.noimages`.
- Deploy independent yet connected components: Legal → immutable raw-source Snapshot → Semantic Composer v2 → new Block Editor/Reader QA → separately authorized publication. **NEVER** integrate with legacy production Reader.
- Raw Snapshot is a private byte-for-byte original, not editable work text. Original images should be retained privately if approved for internal archival, without granting public image use; every actual image use still requires rights/editorial gate.
- Until develop cleanup: isolated branches based on fresh **main**, targeted cherry-picks only; no wholesale merge of develop. PR #276 merged via squash `c9336824c4c735bccd31ebe060519281b0f060c6`, Vercel production READY with smoke test PASS. This PR #277 is an isolated follow-up.
- Accept != Merge != Apply/Production != published content. The current user's instruction authorized connecting the pilot; do not invent authorizations for unrelated database, production and publication steps.

## Implemented in Draft PR #277
- `lib/ingest/snapshot389Mirror.ts`: fixed single-file acquisition from Project Gutenberg's officially listed mirror `https://gutenberg.pglaf.org/cache/epub/389/pg389.epub`; 8 MiB limit; no redirects, retries, arbitrary URLs or crawler.
- `lib/ingest/rawSourceSnapshot.ts`: bounded ZIP/EPUB inspection, original file bytes, sha256, full component/image manifest; corrected ZIP local header offsets +6 flags / +8 method after real file exposed an earlier bug.
- `lib/ingest/snapshot389Pilot.ts`: exact legal #389 decision 9, original EPUB and private-retention gates. Separates mirror source URL from originally locked Gutenberg download URL; actual content correspondence remains **pending**.
- `lib/ingest/rawSourceArchive.ts`: write-once, sha256-addressed private object, upsert false and full re-download SHA256 comparison. When original contains embedded images, requires an **explicit admin confirmation of PRIVATE retention only**; image publication remains excluded.
- `lib/ingest/server/snapshot389RequestGate.ts`: bounded 2 KiB URL-encoded POST with exact fields, origin `artales.net` or `www.artales.net`, optional same-origin Sec-Fetch-Site, length validation and duplicate-field rejection.
- `app/api/member/snapshot/389/route.ts`: protected `requireAdmin` POST; fresh server-side `readLockedSnapshotPacket` and catalog `getGutenbergBook(389)`, no browser-supplied legal claim or any client-controlled acquisition URL. Upload uses **user-scoped Supabase auth** (not privileged service-role bypass). Real 200 response only after binary download, upload and SHA256 readback. Errors fail closed.
- `app/member/admin/snapshot-389/page.tsx`: admin-only one-click test form with required explicit confirmation of internal preservation of cover, not public reuse. On success, response includes full receipt.
- `supabase/migrations/20261027083000_snapshot389_storage_admin_rls.sql`: **staged, not applied** Storage INSERT and SELECT RLS policies for active admins only, exact bucket `artales-raw-snapshots` and exact `gutenberg/389/sha256/<64lowerhex>/original.epub` path. No UPDATE or DELETE, no general authenticated upload, no new service role.
- `.github/workflows/artales-snapshot-selection-check.yml` + focused tests include server request gate, RLS shape, mirror network acquisition, parser, mock Storage SHA256.
- Existing bucket in live ARTales Supabase is private, supports EPUB/TXT/HTML, per-file max 25 MiB and remains **empty**, without new RLS policies. No actual production archive object or full authenticated browser test yet.

## Real-source test evidence, NOT production Storage success
- GitHub Actions live mirror: `https://gutenberg.pglaf.org/cache/epub/389/pg389.epub` returned **125,934 bytes**.
- SHA-256 observed: `2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df` (a generated EPUB can later change, so this hash is only the observed version).
- ZIP manifest: **17 parts**, including **one internally generated cover PNG**, even for apparently no-images EPUB. No automatic external/public image clearance.
- First strict live test failed `unsafe_epub_entry` owing to local header parsing bug; fixed without relaxing security rules. A later live test **PASS**: real bytes + ZIP validation + hash + in-memory mock Storage upload/readback, including refusal without image retention approval. CI run #40470489974 PASS on code HEAD `bc807cd02cb36e4d4acf808e040f2cf92ab7c2d9`, including live Gutenberg catalog lookup.
- **These tests did not call production Storage.** Neither CI nor the repo has user Supabase credentials, and no service-role impersonation or SQL object-table workaround is allowed.

## Exact completion procedure
1. Confirm exact current PR #277 HEAD, CI GREEN, Vercel preview READY, code/security review and separate authorization to merge to `main` (automatically triggers production Vercel build).
2. Independently authorize/apply only the staged Storage RLS migration for #389; fresh readback 2 policies, bucket still private and no objects; security advisor scan.
3. Verify production Vercel READY on exact merge commit. Ensure no public endpoint or update/delete rights.
4. Logged-in ARTales admin visits `https://artales.net/member/admin/snapshot-389`, checks explicit **private archive only** confirmation, clicks **Otestovat Snapshot #389** once.
5. API must return `ok:true` with `storage_readback:sha256_verified`, `publication_authorized:false`, `semantic_ready:false`; independently query `storage.objects` for exactly one path/digest matching receipt. No published work/Reader changes.
6. If source, auth, rights, upload, readback or metadata check fails, record exact reason, fail-closed and do not report end-to-end PASS. Retrying a previously written object can return a write-once conflict; inspect the immutable SHA path rather than deleting/replacing objects.
7. The stored original still needs provenance and content/edition correspondence verification before Semantic Composer v2; an archival success proves bytes only.
8. Persist a final Phoenix checkpoint and PR/run/deployment/storage evidence once verified.

## Authorization note
As of this handoff the previous authorizations were specific to creating the private bucket, preparing code and merging **PR #276**; they do not themselves authorize broad Storage access or publication. PR #277 is Draft and RLS is staged. Ask for a precise merge/RLS approval at the apply boundary if not already explicitly covered by the Architect. The actual logged-in admin must submit the form; connectors available in this task cannot impersonate that browser session.
