# ARTales: machine-first provenance and rights screening (2026-10-10)

## Product decision
The editor's normal job is work quality: text, literary fidelity, layout, artwork, and approval. ARTales automates candidate selection, provenance gathering and component-wise rights evidence screening. Human review is exception-based, on request, or at a separately configured legal risk threshold. No rule may silently turn AI confidence into a legally certain assertion.

## Target flow
1. Candidate selector balances genres, authors, languages, works already in pipeline, editorial capacity and user requests. Explainable score and overrides; editorial suggestions can enter the same backlog. Avoid unreviewed content automatically becoming public.
2. Capture each edition component separately: original text, metadata, translation, images, source wrapper, and editorial additions. Persist immutable bytes with SHA-256, retrieval time, canonical ID, source URL and archival reference. Source lineage and derived ARTales edition branches remain linked but versioned separately.
3. Machine extractor collects primary records, copyright/life/publication facts, licensing statements and jurisdiction; archives each cited record with fingerprint and timestamp. AI drafts component decisions + uncertainties. A **deterministic rules engine** independently verifies mandatory evidence, consistency, cross-component rights and exclusions.
4. Outcomes: eligible for **draft staging only**, hold for exception review, or source blocked. Unsupported translation or artwork may be excluded without blocking usable original text **only if ingest can prove physical omission**. If translated text is the only available text, that edition is held/blocked.
5. Generate a stable downloadable evidence package (future PDF/ZIP): manifest, hashes, exact source snapshots or lawful archival references, rights statements, evidence copies/links and timestamps, component decisions, exclusions, scanner/policy versions, jurisdiction, challenges, human overrides and audit chain. Document that such a package is evidence, not a guarantee against copyright claims.
6. Editor can open a concise rights status, full dossier, challenge individual findings, request rescan, submit contrary evidence or escalate to project owner/legal review. Normal editor work remains side-by-side manuscript/ARTales quality review and local artwork variants, each new artwork branch having its own rights lineage.

## Current implemented groundwork
- `lib/rightsScanDossier.ts`: pure fail-closed, machine-first evidence/decision validator; distinguishes work text, edition, translation, illustrations, wrapper and metadata. Importantly **never** authorizes publication.
- `tests/rightsScanDossier.test.ts`: synthetic positive and negative tests (not yet executed in Node).
- Existing `lib/candidateProvenance.ts` read-only provenance preflight and ephemeral SQL trial are unchanged.
- This is *not* a legal research engine, downloader, server-side snapshot service, persistent schema, PDF generator or actual scan. No human review burden added by this PR.

## Policy boundary
- A model-generated conclusion is never enough by itself: included original content requires traceable primary evidence and explicit component decision.
- Every unknown, stale, conflicting or contested entry is fail-closed. Rights to a literary work do not authorize a particular translation/illustration, and a Gutenberg tag does not establish rights in EU/CZ.
- Even a machine-cleared **candidate draft** remains unpublished; a separate publication gate checks current dossier, complete source mappings, and editor approval.
- The present prototype escalates every included translation or illustration to specialist review rather than pretending high confidence is enough. Future enhanced policy can accept specific verified licenses.
- Automated selection balances editorial portfolio goals; no blind bulk publishing.

## Next modules
- Immutable storage manifest + snapshot capture adapter (coordinate with parallel ingest PR #196).
- Evidence fetcher/legal metadata screening, expiry and rescan, challenge/audit records; capture each evidence source's terms.
- Machine proposal output schema + deterministic validator, signed policy version and protected overrides.
- Editor rights summary/download, audit archive and owner legal escalation.
- Canonical migration, role tests and safe candidate -> draft RPC after ephemeral verification.

## Parallel integration
Changes touch only new library, tests and this document; ingest composer/Reader PR #196 keeps its own area. Commit to a feature branch and bring via PR to `develop`, never change `main` or production DB without a separate authorization.
