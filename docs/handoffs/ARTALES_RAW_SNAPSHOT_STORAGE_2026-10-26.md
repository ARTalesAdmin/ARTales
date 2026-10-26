# ARTales — Private raw Snapshot Storage readback, 2026-10-26

## Exact architect authorization and scope
- Architect: "Autorizuji bucket. Myslíš, že bude problém s místem..? Pokračuj prosím."
- Interpreted narrowly: create a **private bucket** for original, immutable Gutenberg source files; continue source-only pilot. No generalized approval for source ingestion, production API enablement, Storage RLS policies, database migrations, GitHub merge, Vercel deployment, or reader/publication cutover.
- Existing ARTales image buckets and real book/reader records must be preserved. Do not treat the old `develop` branch as deployable baseline.

## Applied production infrastructure (confirmed by independent SQL readback)
- Project: `nmhdwmszbwgrgfbmlguu` (ARTales, Nexus Supabase Pro organization).
- New bucket **`artales-raw-snapshots`**, `public=false`, max **26,214,400 bytes = 25 MiB per object**.
- MIME allowlist: `application/epub+zip`, `text/plain`, `text/html`; not generic ZIP or raw image uploads.
- Created at: `2026-10-26 18:35:31.595955+00`.
- One directly authorized bucket creation through `storage.buckets` (Supabase official Creating Buckets guide explicitly documents SQL for this purpose). Not a schema migration; no Supabase migration history was appended.
- Readback: bucket present exactly once with expected limits; `storage.objects` contains **0** objects in this bucket.
- `storage.objects` and `storage.buckets` have RLS enabled. **No new policies** for the bucket. Existing policies remain exclusively for `artales-images` (public images), so client reads/writes have no newly granted access. Privileged service-side actions require separately designed authentication/authorization, never a browser service key.
- Existing `artales-images` public 5 MiB and `artales-source-archive` private illustrations 10 MiB unchanged.

## Capacity / billing read-only audit
- Subscription Nexus organization confirmed **Pro**: **100 GB** file Storage included **across all its projects**, overage currently **$0.0213 per GB-month**. Actual plan and cost should be rechecked periodically.
- Storage object metadata at verification: ARTales 175 objects / 425,704,513 B (~406 MiB); Flowre 144 / 463,221,827 B (~442 MiB); Nexus 0. Total 888,926,340 B (~848 MiB), below 1% of 100 GB.
- Each book sized 5 MiB: ~320 MiB for 64 titles; large illustrated editions may be bigger. Bucket file cap is distinct from org capacity. Source-only pilot currently enforces an even stricter **8 MiB** capture limit, so raise it only after explicit end-to-end testing, without lowering storage controls.
- No cost of new compute/project/branch created. Empty bucket alone has no file-byte usage charge, but real Storage usage and egress can be metered later. Billing organization-wide can differ from this metadata snapshot.

## Implementation, interfaces and follow-up
- Source-only work remains in Draft PR #276 (main-based), `lib/ingest/lockedSnapshotSelection.ts`, `rawSourceSnapshot.ts` and `rawSourceArchive.ts`. Archive adapter already references exact bucket name and verifies SHA-256 by downloading bytes after upload (mock-tested; no production readback).
- First real pilot target: Gutenberg #389 *The Great God Pan*, legal lock decision no. 9, catalog `https://www.gutenberg.org/ebooks/389` and frozen `389.epub.noimages`. Same-record alternative format may be selected without a second Legal Check, but only after source/edition and content correspondence. Do not automatically crawl public Gutenberg pages contrary to its robot-access rules; use a permitted acquisition channel or authorized human-provided original and preserve provenance.
- **Images**: prefer archiving the whole lawful original EPUB (including embedded assets) privately, preserving exact source bytes; public image usage is a separate approval. The current source-only adapter is deliberately fail-closed for embedded images without an internal retention-rights decision; do not silently conflate private retention permission with public publication rights.
- Next technical work: approved authenticated server-only entry, real source fetch with bounded streaming, exact signed source/provenance capture, upload to new private bucket, SHA readback, immutable per-source receipt, semantically verified component selection, then optional Composer v2. Every component separately tested and released.
- Required checkpoint before first real write: Architect review of precise source/acquisition and Storage grant. No reader, WorkBlock migration, legacy published content, new user role grants or production env changes are part of this bucket authorization.

## Verification and rollback
- Creation plus immediate independent readback **PASS**. Real storage upload/download **NOT PERFORMED**. Authenticated browser E2E **NOT PERFORMED**.
- If future rollback considered, confirm no objects/references and seek fresh authorization. Never remove an in-use bucket as a reaction to a failed code test.

## Canonical reading order
1. `docs/handoffs/ARTALES_LEGAL_SCREEN_2026-10-26.md`
2. `docs/handoffs/ARTALES_SNAPSHOT_SEMANTIC_2026-10-26.md`
3. This bucket readback.
4. Fresh Nexus STARTUP-01/Continuity/Phoenix, `AGENTS.md`, `docs/WORKFLOW.md`, and live repo/db/PR readback.
