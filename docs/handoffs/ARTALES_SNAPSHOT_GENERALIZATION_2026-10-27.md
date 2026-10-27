# ARTales Snapshot v1 — closure and generalized action, 2026-10-27

## Production verified pilot #389 — PASS
- PR #276 squash c9336824; PR #277 squash 98022c11a440719527eb964c981fbe3fde86de02, Vercel production READY.
- Legal source candidate 98508359-bce1-4e73-b842-b69a9d1112d0, decision 9, approved CZ/EU, Gutenberg #389 The Great God Pan.
- Real production private EPUB uploaded and read back with SHA-256 verified in application and Vercel runtime log.
- Bucket artales-raw-snapshots: 1 object, immutable content-addressed path gutenberg/389/sha256/2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df/original.epub, 125934 bytes, created 2026-10-27T08:23:44.918623Z, EPUB MIME. Independent SQL readback verified size/path.
- Vercel runtime verification at 2026-10-27T08:23:45.858Z. Embedded generated cover: 1, only privately retained, public use excluded. No works added, still 64 total / 49 published.
- Production closure evidence: https://github.com/ARTalesAdmin/ARTales/pull/277#issuecomment-6437257985
- Scope PASS: preservation of exact original bytes, not attestation of edition content, public rights, semantic readiness or publication. provenance and content_correspondence remain pending.

## Current answer: is it generalized and callable?
- The legal handoff, same-book file-choice, ZIP/EPUB validation, original SHA256 and private archive adapter are reusable.
- The live trigger IS NOT generalized: /member/admin/snapshot-389 and /api/member/snapshot/389, fixed source ID #389, single mirror URL and only #389-specific Storage RLS. Other legally locked books cannot currently trigger a Snapshot.
- This branch starts a generalized safe action-state contract only. It does NOT create a general production action, DB receipt table, rights grant or multi-title endpoint.

## User's desired final workflow
1. Every candidate in ARTales with an approved, immutable Legal lock shows a contextual action Vytvorit Snapshot. Editors may see/request, but admin executes until a separately reviewed role design.
2. The server loads legal candidate+source+decision+lock afresh; browser provides candidate ID only, never rights flags or source URL. Reject mismatched/stale/rejected/unknown decisions.
3. Resolve Gutenberg catalog identity and edition, choose preferred available EPUB/HTML/TXT from the same verified book. A different technical format alone does NOT repeat Legal Check; content and translation correspondence must be checked before semantic release.
4. Acquisition provider is allowlisted and scoped by catalog number, no arbitrary remote URL/redirects/crawler. Keep operator-supplied fallback with provenance pending. Bound download, ZIP decompression, format, time and memory.
5. Preserve original bytes privately with content-address SHA256 and full inventory, including images if internal archive rights are explicitly cleared; NEVER infer permission for public illustration use.
6. Persist immutable receipt and audit in a new RLS-protected table: candidate ID, legal decision, source/URL/format, acquired timestamp, actor, Storage object path, SHA256, size, provenance/correspondence states, attempts and errors. Single-flight/idempotency: already archived exact lock gives status, not another upload. Inspect partial failure instead of overwrite.
7. UI statuses: not approved/not locked -> ready -> acquiring/archiving -> archived awaiting edition verification -> verified for semantic composition. Review hold and failed states are explicit. Legal processed != Snapshot complete.
8. Semantic output goes only to new Composer v2 / new Block Editor / new Reader QA, not old production Reader. Legacy books need separate old-version archive, editorial contribution extraction, comparison and approved per-book cutover.

## Release separation and gates
- Continue independent branches from main while develop remains superseded. No blanket develop import.
- Generalized action-state pure code + tests can be reviewed now. Next step is server read-only status backed by real persisted receipts and UX on legal detail; then staged RLS and real generalized server action under separately approved production authorization.
- Test existing #389 as ALREADY ARCHIVED (no second write) and test second distinct locked title only after its own Legal approval. Current production has only one legal lock.
- No new Supabase migration, Storage access, merge, production action or publication authorized by this handoff. Accept != Merge != Apply != Publish.
- Nexus ARTales bootstrap is project-only selectedWork:null; no cross-arc or retained action authority.
