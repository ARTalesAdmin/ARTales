# ARTales — Snapshot #389 secure pilot handoff (2026-10-27)

## Exact scope
- Source-only continuation after PR #276 was merged to main (`c9336824c4c735bccd31ebe060519281b0f060c6`), production READY and smoke tested.
- Isolated topic branch `feat/artales-snapshot-389-admin-import-20261027` from that main SHA. Do not merge develop or couple to legacy Reader.
- `lib/ingest/snapshot389Pilot.ts` orchestrates the **one-title** bounded archive flow; refuses other candidate, legal decision, unlocked substitutions, non-EPUB, images without retention clearance and any prior publication authorization.
- It uses previously reviewed legal handoff, raw capture, and write-once Storage adapter. A genuine byte-for-byte Storage SHA-256 readback is required for a receipt. The receipt NEVER means semantic/publication approval or authentic Gutenberg provenance.
- Offline/operator-supplied files remain `provenance=pending_independent_verification`, and `content_correspondence=pending` even if the archive succeeds. Never claim authenticity solely from filename or SHA.
- This PR deliberately creates **no live POST route, new public or authenticated Storage grants, DB tables, migrations, environment secrets, CDN exposure, or actual Stored Object**. All of those require a separate decision and a specific audit gate.
- Database state read-only as of 2026-10-27: private bucket `artales-raw-snapshots`, 25 MiB per file, EPUB/TXT/HTML, zero objects; legal decision #9 for Gutenberg #389 approved CZ/EU. Current source capture has stricter 8 MiB per input.
- Exact source: `https://www.gutenberg.org/ebooks/389.epub.noimages` from locked legal decision. Alternative edition-format selection may occur in later integration, but must carry edition/text comparison.
- Gutenberg robot access: do not deploy a direct crawler. Official OPDS is catalog discovery; acquisition must use authorized robot/mirror pathway or provenance-tracked operator supplied original. The first pilot is purposely operator-supplied, and this is not yet an end-to-end ingest.
- No actual EPUB has been fetched, acquired or stored in this scope.

## Pending integration decisions
1. Precise admin-only server upload workflow with CSRF/origin verification, 8 MiB request cap, one candidate, single-use semantics, and immediate SHA readback; feature disabled by default. Select user-facing UI versus endpoint as a separate small component.
2. Narrow authenticated Storage INSERT and SELECT RLS for active admin only, restricted exact bucket/path, not general service-role bypass; approve/review SQL separately before applying.
3. Decide how to prove original Project Gutenberg provenance from a supported acquisition channel. Legal check was edition approval, not proof of the uploaded bytes.
4. Explicitly authorize first and only production write of #389 after reviewing prepared rights and test plan. Verify archive receipt and preserve immutable history.
5. Only then independently integrate semantic-text v2 Composer and editorial QA.

## Governance
Approval of source-only work is not permission to merge, deploy, create Storage RLS, fetch unapproved sources, ingest data, or publish. Read ARTales Legal closure, Snapshot Semantic handoff and Nexus STARTUP/Continuity/Phoenix before continuing.
