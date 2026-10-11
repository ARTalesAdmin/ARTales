# ARTales publication / hold preflight v0 — contract handoff (2026-10-11)

## Purpose and strict boundaries
Propose a **pure TypeScript, synthetic-input** fail-closed contract before committing risky canonical schema/privileged RPC changes. It does NOT publish, hold, grant territorial copyright clearance, create release pointers, expose new APIs, change existing user sessions, or migrate live works.

Read first:
- `docs/ARTALES_UNIFIED_PUBLICATION_LEGACY_CUTOVER_2026-10-11.md`
- `docs/ARTALES_UNIFIED_WORK_GOVERNANCE_V1_1_2026-10-11.md`
- `docs/ARTALES_LEGACY_REINGEST_RECOMPOSE_READER_CUTOVER_2026-10-11.md`

## Contract surfaces
- `inspectReleasePreflight()`: exact version-pinned source/text/metadata/visual/reader QA and jurisdiction-specific component rights; no unresolved blocking issue; valid signed human approval **claims supplied by a future trusted server**; separate restore/update/first-release availability.
- `inspectLegacyCutover()`: old/new IDs and slugs identical; separate legacy observed and raw source snapshots; reviewed source differences; actual newly composed semantic text; Reader full QA and preservation/remap of reader state. Refuses metadata-only conversion.
- `inspectHoldPreflight()`: a confirmed privileged editor/admin proposal for urgent hold with a human-readable reason and exact concurrency version; a server-side transaction must enforce it.
- `inspectUntrustedFlag()`: reader reports and inbound email are untrusted triage recommendations, never direct publish/withdraw triggers.

**Important non-goal:** caller-provided review objects, hashes, role strings, timestamps and rights labels are test fixtures, **not trustworthy proof**. Production cannot reuse this preflight alone as an authorizer. Actual implementation requires independently verifiable records, `auth.uid()`, GRANT/RLS scrutiny, write-once content byte verification, locking, role matrix, and database audit triggers. A web/AI console must not supply any of these trusted fields.

## Next explicit high-risk implementation PRs (not performed here)
1. Additive, locally tested persistence for snapshots, source/legal evidence, immutable text and metadata revisions, selected visual assets, release decisions and issue/hold audit. Use properly generated Supabase migration names and no production DB apply.
2. Signed local GoTrue/PostgREST test roles for ordinary reader/editor, independent reviewer, authorized publisher and a negative direct `UPDATE works SET status='published'` after protected cutover.
3. Route legacy `lib/actions/works.ts` and all public `app/reader/[slug]/page.tsx`, preview/read policies and content batches through version- and availability-safe projections. Do not make the old renderer accept new JSON without semantic re-render validation.
4. Dry-run legacy Alice PG #11 in an isolated test environment using only sanctioned source bytes and a deliberately sanitized or synthetic legacy comparison fixture. Existing public Alice: work ID `3abbac79-8877-4bb6-ae56-8481d8a336da`, slug `alices-adventures-in-wonderland`; legacy content must remain untouched until separate approval.
5. Pilot 1 then 5 then remaining catalog, reconciling IDs, notes, entitlements and public rendering, and allowing urgent authorized holds. Reader/Composer PR #205 owns raw Gutenberg ingestion; don't cross-write its files.
6. Only after explicit architect review and authorization: merge into develop, separate preview/environment checks, distinct production DB migration apply authorization and separate main release authorization.

## Review checklist
- No Supabase migrations/production writes, no environment changes, no main changes.
- Exact-head GitHub CI for 16 synthetic fail-closed scenarios + TypeScript and ESLint.
- Confirm a successful preflight is never a privilege grant or legally sufficient dossier.
- Rollback: revert this isolated PR; no data migration or runtime change to undo.
