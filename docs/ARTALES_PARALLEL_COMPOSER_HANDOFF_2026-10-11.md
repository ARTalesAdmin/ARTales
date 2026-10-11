# ARTales — parallel Reader/Composer handoff, 2026-10-11

This is an isolated handoff for the already-running Reader/Composer thread. Authoritative architecture and ownership: [Unified publication and legacy cutover](./ARTALES_UNIFIED_PUBLICATION_LEGACY_CUTOVER_2026-10-11.md). **Do not implement migrations or production publish directly from this thread.**

## Integration goal
Make **one safely selected, rights-prequalified Gutenberg source** into a traceable ARTales-owned, editable block revision. Not yet auto-published.

## Work requested
1. Inspect live develop and the current Reader/Composer PR(s) and Phoenix. Preserve second thread's work. Do not silently assume fixture is durable.
2. Research Project Gutenberg allowed machine access; identify sanctioned bulk catalog/RDF/mirror/raw text endpoints, robots/rate terms. No aggressive scraping. Select one unequivocally synthetic/test-friendly Gutenberg work for noncommercial CI proof, with edition and translator status documented. **Do not label any real book legally approved solely from PG metadata.**
3. Define a source adapter boundary: `candidate_id, candidate_source_id, source_uri, retrieval_method, bytes_sha256, snapshot_ref, content_components, jurisdiction/rights_dossier_ref, capture_time, provenance_and_license_manifest`. Main thread implements DB persistence, you implement a pure adapter and fixture/tests only.
4. Build deterministic extraction of Gutenberg wrapper/boilerplate with line-range/source anchors and an explicit uncertain-boundary review output. Do not strip meaningful introduction/notes or evidence. Audit exact source bytes -> approved content spans -> ARTales component list.
5. Map clean source spans into `AnchoredBlock` / ARTales-owned block revision. Persist neither as direct live `works.content_blocks` nor as a published revision yet. Every block must preserve immutable original offsets; page number is not identity.
6. Extend side-by-side original versus composed text QA to produce revision-bound issue packets. Support returned issue and selective regeneration of affected block(s), without touching unchanged content or losing ancestry.
7. Make independent tests with wrapper leakage, translation/excluded illustrations, empty source, odd line breaks/footnotes, hash tampering and two-round reviewer issues. CI/local tests, no production DB, no main, no Nexus worker.
8. Produce a Draft PR into develop and report exact changed files/tests, interface payload, blocker list. Coordinate PR ordering with main thread and visual thread.

## Constraints
- **Own:** existing Reader/Composer fixture, parser, anchored blocks, comparison/review UI, pure source ingestion adapter.
- **Do not touch:** `supabase/migrations/**`, `lib/actions/works.ts`, `app/member/editorial-tasks/**`, catalog admin orchestration, rights/pub/hold RPC or production credentials.
- Use only current `develop` as the base, not `main`; avoid PR #203 files.
- An illustrator visual branch handles collection-specific style and candidate cover choices separately. Your text assets must exclude unlicensed source covers/images.
- If any source or licence is ambiguous, fail closed to an exception instead of fabricating approval.
- Scope is one real technical source integration; not 5 live copyrighted titles and not automatic publishing.
