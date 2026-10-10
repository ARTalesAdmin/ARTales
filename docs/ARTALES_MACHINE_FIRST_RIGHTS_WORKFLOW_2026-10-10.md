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

## 2026-10-10 continuation — fixture dossier lab
- Added a preview-only `/lab/rights-scan` with four synthetic scenarios, component detail, challenge action and JSON manifest download. This is browser-local, not a persisted claim, real AI scan or legally sufficient archival copy. It never writes to Supabase, never authorizes publication, and returns 404 in production.
- Tightened the pure validator: captured-source inventory must be complete, original text and edition material are assessed separately, evidence must belong to the exact source/edition/component, and missing/invalid records fail closed without returning a partial approved include list.
- Added tests for incomplete inventory, unassessed edition, foreign evidence and all-or-nothing include IDs. These need Node execution; Vercel READY is not a substitute.
- The current demo uses synthetic hashes and `example.invalid` primary-evidence URLs. A model passing this lab cannot establish legal authorization. A future trusted capture adapter must independently verify actual bytes/hash, archive evidence, check rights by jurisdiction and source version, and create an immutable signed dossier before any publication decision.

## 2026-10-10 — publication-target policy rather than candidate reservoir

Product owner target: “Deliver 5 publishable and commercially usable titles.” Candidate generation, cheap prescreen, portfolio balancing and detailed legal screen are a **single replenishing production funnel**, not separate, independent queues.

- Candidate sourcing selects a bounded cohort using genre/author diversity, catalog gaps, reader requests and editorial capacity; when exhausted with target unmet, request AI replenishment and continue only within approved budgets and rate limits.
- Cheap prescreen filters high-risk/costly/duplicate works before full legal/source scan. Prioritize **commercially usable** rights: include original text only if current evidence supports permitted monetized usage; rights of editions, translations and artwork remain independent.
- Rights verdict stays compact: work/author/text/edition/illustrations/translation, valid jurisdictions and evidence, selected edition, one recommended option (“omit illustrations”, “commission illustrations”, “own translation”, “defer until date”), a signed versioned audit trail and exact captured-source manifest. Archive original evidence independently for later questions; no false assertion that an archive guarantees legal clearance.
- Select a feasible edition and editorial cost case; reserve operational cost and dispatch only qualified draft candidates into a common editor inbox or approved assignee. **Qualified for editorial work ≠ published.** Publication requires a separate verified gate and existing publisher controls.
- Risks, disputes and counterevidence immediately freeze progression. If a published title is credibly challenged, an independently authorized takedown/revert-to-draft action must gate its availability while preserving previous published revision and full history; never silently delete provenance.
- Record outcomes and chronology per candidate plus run: prescreened/skipped/escalated/qualified, elapsed time, actual spend, forecast to reach target, genre balance, numbers editorial-ready/published, and reason/next option for each refusal.

### Implemented in PR #197 — bounded planner, not background automation
- `lib/catalogProductionPlanner.ts` pure plan function with explicit target count, genre preferences, per-author cap, prescreen/full-scan/editorial cost limits, simulated candidate decisions, escalation/refill suggestions and optional editor assignment planning.
- `tests/catalogProductionPlanner.test.ts` covers genre priority, commercial gate, no automatic unlicensed translation, spending bounds, refill and round-robin dispatch.
- It consumes **supplied** candidate screens; does not discover titles, call an AI model, spend money, create tasks, assign real editors, create drafts, or publish. It never reports a title as published (`actualPublished:0`). Tests are authored but not yet executed.
- Follow-up: verified scan dossier/policy linkage, costs and persistent run state, actual candidate generation/refill with external sources, task-inbox domain/RLS, evidence package retrieval/export, publication/takedown governance.
