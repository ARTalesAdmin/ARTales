# ARTales — Unified Work, Metadata, Editorial and Visual Governance v1.1
**Decision addendum, 2026-10-11.** Product direction approved for architecture; implementation and production release are not authorized by this document. Read with ARTALES_UNIFIED_PUBLICATION_LEGACY_CUTOVER_2026-10-11.md and ARTALES_PARALLEL_COMPOSER_HANDOFF_2026-10-11.md. Live policy, current schema, and explicit authorizations take precedence.

## 0. Product decisions (supersede any ambiguous v1 interpretation)

- **One canonical content/work system.** The legacy direct manual publishing workflow is transitional only. Do not perpetuate parallel manual and automatic publication authorities. Migrate behind compatibility controls; do not break existing editors or public works prematurely.
- **No old-work -> new-work identity rewrite.** Existing works retain IDs, slugs, URLs, authors, reader notes/progress, library entitlements, collections and related records. Upgrade them by binding historical/provisional revisions and provenance, NOT by re-inserting a duplicate work or fabricating a preexisting approved candidate.
- **Candidate is only pre-work intake.** After promotion it links to one enduring work. A legacy work may have no genuine candidate. Provenance kind 'legacy' records that fact honestly.
- **System produces; humans oversee.** ARTales/AI proposes blocks, factual metadata, reading descriptions, visual variants and targeted fixes. Humans review public text + cover/design before release, flag doubtful details, adjudicate exceptional legal risk and approve specific immutable revisions. Routine field-by-field manual authoring is not the target.
- **AI-generated confidence is never legal proof.** Factual identity, language, edition, translator, copyright, licence and source assertions require actual archived evidence and deterministic checks. Unknown stays unknown, and disputed rights block gated publication until resolved.
- **A release is a pinned bundle**, not a mutable row status: text revision, public metadata revision, selected visual/asset revision(s), edition/source manifest, rights dossier and decision/audit. Changing only cover or description creates a new release reference without rewriting a previously approved text revision.
- **Reporting and correction are first-class.** Editors and readers can flag exact content/metadata/visual issues, plus legal threats; each triaged issue has immutable referent and reasons. Authorized hold/withdrawal is separate from creating a new draft revision. The previous live version stays visible during non-critical editing.
- **No Nexus bypass.** Natural language in an ARTales/Nexus console is an input to the same authenticated action contracts and review queues as the website, not a privileged direct database update.

## 1. Entity and state model, additive migration first

Proposed physical shapes are provisional, to be designed/tested in a separate explicitly authorized migration PR:

1. **Work identity:** works.id is stable; candidate links optional but unique where present; provenance distinguishes 'new_candidate', 'legacy_backfill', 'manual_original' and genuine source-linked derivations.
2. **Edition identity:** immutable source or source-edition snapshot, translator/illustrator/preparer credits, geographical exploitation and component rights. A work may have distinct editorial ARTales editions over time. A Project Gutenberg ebook ID alone is not the edition, translator, or legal dossier.
3. **Text revisions:** parent revision, source manifest SHA-256, selected included/excluded components, semantic block tree, source anchored spans, compositor/parser/prompt versions and exact content hash. Approved/published text is immutable.
4. **Metadata revisions:** independently versioned verifiable facts (title, authors, original language, edition/translation, dates, source/provenance), editorial/public presentation (blurbs, summaries, tags, SEO), source citation ledger, prompt template ID/version, model/config, generation time, validation failures, reviewer flags and acceptance. Separate claims backed by evidence from generated prose. Never overwrite verified sources to fit generated copy.
5. **Visual revisions/assets:** source or generated asset ref, content hash, licensing/usage restrictions, generation prompt + collection-style version, alternatives, review decision, creator/assignee and selected edition relation. Covers and illustrations differ; both have component rights. Treat replacement as a versioned choice, not overwrite/delete the live media object.
6. **Editorial/review issues:** immutable target work/edition/revision and optional block/span/metadata field/visual asset; kind, severity, reporter role, grounded reason, suggested remedy, status, assigned reviewer, response and iteration sequence. Text and visual work queue IDs remain separate; both converge in release.
7. **Release decisions:** current published release pointer + lifecycle availability, signed/reviewed actor, approvals for text/public descriptions/visual, rights status, QA and source-drift checks. Release is blocked when a required component differs from reviewed revision/hash.
8. **Availability:** 'unreleased', 'live', 'held', 'withdrawn' independent of editorial 'draft', 'in_review', 'changes_requested', 'approved'. A live text revision can coexist with an unapproved replacement draft. Hold must block public APIs/storage/search/cache routes, not just hide a UI card.

**No new canonical work ID for a previously published work.** Backfill a baseline *legacy observed* revision without pretending it was approved under the new process. Mark evidence as pending/unverified until validated. Keep legacy published content live by policy decision while triaging risk; support immediate authorized hold where warranted.

## 2. Triage of 64 existing works (read-only baseline)

2026-10-11 read-only production SQL: 64 works, 49 published and 15 drafts; 49 published recorded as Gutenberg/public_domain; 49 published have blank edition licence/source URL/version/title fields; 22 lack original language; at least one original language is incorrect; visual rights are not verified by their cover presence. These are **audit signals**, not legal verdicts.

**Legacy published:** preserve work ID/slug/public links; attach pending evidence and historical baseline, risk score and editor/legal issue(s), then rescreen actual text, covers, translator, edition and licence. Do not synthesize a successful modern candidate or automatically depublish every incomplete record. Prioritize potentially protected authors/editions and meaningful complaints for urgent authorized review/hold.

**Legacy drafts with material content:** retain work ID, put into the new revision/editorial process, revalidate provenance and text. Their status remains draft until approvals.

**Legacy draft placeholders, incomplete or unusable sources:** propose recovery to candidate backlog, but preserve old record and foreign keys by auditable archival/superseded relation; do not delete or silently create duplicate published works. A migration dry run lists proposed dispositions, delta checks and rollback before write.

**Editorial original works:** legitimate work identity without Gutenberg source is supported; require origin-specific rights/author attestations, not fake Gutenberg provenance.

## 3. Machine-produced metadata and existing description prompts

- Existing ARTales/GPT blurb prompts become **versioned content recipes** rather than undocumented manual calls. Store input facts/provenance, source work+edition+revision, locale, recipe ID, model/version, settings, generated candidate, copy-edit feedback, approved version and reason.
- Validated facts and presentation copy are separate. The model may draft title formatting, author bio/description, summary, collection-related tags or keyword suggestions, but cannot authoritatively assign copyright, translator, language or licence without evidence. Cross-check metadata against edition/source and use an explicit 'unknown/disputed' state.
- Human review need not mean hand-filling all metadata. Reviewer receives a compact package of **public-facing title, subtitle, summary, description, visual and credits** with source comparison, machine checks and red flags. Approve as a package or flag one field with a reason. An approved metadata revision is pinned to the release.
- A later fix to a description alone generates a new metadata revision and release binding; unchanged text is not regenerated. All public metadata changes have audit and a visible diff.

## 4. Adaptive block composition and learning from feedback

- Current ARTales block formats are a starting template, not a requirement to fragment prose/poems mechanically. Choose **semantic units**: chapter/section heading, prose paragraph, quote, footnote, verse/poem with nested stanza/line information, epigraph and other justified types. A poem must not become 60 disconnected top-level blocks simply because it contains 60 lines.
- Keep source fidelity with approved included spans, exact original offsets, excluded component mapping, stable block IDs and revision hashes. Aesthetic layout/style may be a separate ARTales edition layer, not silent rewriting of the source.
- The compositor can select/create/restructure allowed blocks while preserving the approved original literary meaning and textual fidelity. Substantive edits, paraphrases, omitted sentences, altered translation or remixed semantics must be highlighted as proposed editorial/derived changes with a distinct human/rights gate. A new ARTales typographic edition does not automatically grant new copyright to underlying content.
- Typography is tokenized: bold, italic, indentation, quotation, stanza spacing, footnotes, line breaks, emphasis, and reader-responsive presentation. Only established type tokens unless a documented, reviewed extension is needed. Preserve meaningful textual form, especially verse.
- Preview shows source vs composed text with per-span diffs and confidence/blockers. Editors can flag an exact block/span (or generalized rule) and write a reason/suggestion, not necessarily edit full prose manually.
- Iteration: machine proposes *targeted* corrected blocks and a new immutable revision, unchanged blocks retain IDs/hashes, editor reviews again; support many return loops, avoiding loss of prior decisions.
- Feedback learning is **gated and measured**: persist normalized issue reason, block type, rule/prompt version and accepted correction; detect repeating issues (e.g. every poem's indentation), propose a style/compositor rule update; add regression fixtures and re-evaluate before activating. No autonomous self-training against unreviewed complaints; human approved change to published content is still required.

## 5. Visual work, Ivanka and collections

- **Visual task inbox is separate from text inbox**, keyed to a work/edition and optional collection theme. A style brief references collection theme/style manifest, not a fabricated decision about copyright or exact person.
- Verify Ivanka's real ARTales profile ID before any assignment. When assigned, let her review/select cover/illustration candidates or request regeneration. Audit selection, source/licence and prompt/recipe version.
- A new visual version may be proposed for a live release without replacing the current cover; render previous approved media until new revision is approved and atomically released. Preserve old versions for rollback where rights permit.
- **Collections are editorially curated thematic objects**, not merely mechanically inherited visual presets. Leave collection structure, thematic prompts, and degree of automation pending an explicit discussion with Ivanka. No automated reassignment or rewriting of live collection definitions.
- Plan future direct Ivanka initiation from a work/edition detail: create new thematic variant or edition-specific asset, choose or return; the approved visual revision becomes effective only through the publication/asset-release gate.

## 6. Human flags, mail, reader reports and incident safety

- Put **'Nahlásit problém'** on reader work details and **'Pozastavit publikaci / otevřít revizi'** (distinct privileged action) for editor/admin. In editor details enable flags for text, source anchor, factual metadata, generated blurb, visuals/credits, rights and edition.
- A flag is a *claim requiring triage*, not a public edit or proof. Store reporter context, work ID, current release/revision, optional source anchor/field/asset, classification, free-text reason, evidence, severity, timestamps and moderation state. Rate limit untrusted inputs; anti-abuse; keep user identities private.
- Machine threat detection may surface anomalies and summarize inbound ARTales mail, but email is untrusted external input and may contain prompt injection. It can open a *triage recommendation*, never directly call publication/hold APIs as an LLM instruction. Separate explicit trusted policy may implement narrowly defined urgent safety holds with accountable authorization/audit.
- A normal typo produces a revision request while the safe previously approved release stays public. A credible rights/security claim should be escalated immediately and may require swift authorized hold, irrespective of whether the editor has drafted a fix.
- Hold/withdraw: server-side authenticated and audited transaction; all public data routes, cached reader content, search, media access/derivative previews and direct REST calls must respect availability or be invalidated. Preserve published prior release and reader entitlements. A restore/new edition must pass current clearance again.
- Show visible audit/decision states to the right role: submitted, triage, acknowledged, hold requested, held, editing, review, resolved or published. No silent merges.

## 7. Human-readable ARTales and Nexus interaction surface

- Present one work detail with source, legal status, metadata, current public revision, draft revision(s), reviewer flags, editorial text tasks, visual tasks and publication history. A status label such as 'Ke kontrole' should not conflate technical task state with public visibility.
- Actions from a website form, ARTales console or conversational Nexus command resolve the same permitted use cases: request N titles, prescreen, challenge evidence, regenerate block, flag a field, review visual, approve revision, hold, release, reopen. Server resolves identity, current locked revision, affected components, permissions and resulting audit.
- Commands that change publication/rights or allocate budget require role-based capability + explicit confirmation; natural language cannot provide forged role, reviewer, legal outcome or updated hash. No direct mutable row shortcuts via public/privileged client.
- Admin requests **N actually published titles**, gets indicative stage-by-stage costs, candidates consumed, pending review, rejections and ETA. Budget-based automation is deferred until an explicit cap/reservation model is reviewed. Even without charging, persist run identity, idempotency, dedupe and a bounded retry/refill policy.

## 8. Governance and staged acceptance

**Phase 0 (now):** accept the architecture (this document), no runtime change; independently finish PR #203 signed local Auth checks and Reader/Composer source-parsing work.

**Phase 1:** read-only legacy work audit plan, risk matrix and safe report/hold contract in separate Draft PR; design tests of direct writes, RLS, public API, CDN, storage and queue. Do not add SQL migration without explicit approval; no mass withdrawal based on missing fields.

**Phase 2:** additive editions/provenance + immutable text/metadata/visual revisions and issue/audit contracts on disposable DB, signed Auth E2E and exhaustive grants; no production data rewrite.

**Phase 3:** guarded action/service cutover with two parallel operational modes only temporarily, controlled dual-read/single-write consistency, migration of existing UI action paths and explicit no-bypass enforcement. Validate a legacy example and one approved new candidate, then small batch, with rollback.

**Phase 4:** integrate actual Gutenberg snapshot ingest, Composer, metadata prompt recipes, human textual and cover review; target N title console with synthetic or safely sourced runs. Publication gated and separately authorized.

**Phase 5:** production approval for any SQL apply, existing work backfill and release transition; reconcile all existing IDs, URLs and entitlements; verify no open legacy write bypass before retirement of manual mode.

### Required negative tests
- Editor cannot promote a forged 'published' status by direct table update after cutover; unauthenticated users cannot mutate works; service role not leaked.
- Legacy work retains work ID, slug, reader notes, ownership and visible prior revision after new draft; no duplicate work identity from pseudo-candidate.
- Wrong/missing edition, translation or visual rights, stale source hash, altered metadata evidence or unresolved issue block release.
- Rejected returned blocks do not change live approved blocks; unchanged spans retain stable anchors; poem stanza layout fidelity.
- Unapproved blurb/visual can never be public; visual-only approved update preserves exact text hash and old media audit.
- Credible hold disables all public routes; a normal non-urgent issue cannot unpublish without privileged decision.
- Repeated flags, duplicate mailbox events and ambiguous natural-language requests cannot double-open paid work or bypass approvals.

## Workstream ownership
Main thread: canonical model, legacy audit and safe hold/publication gate, metadata/rights evidence and admin orchestration. Reader/Composer thread: source adapter, source anchors, faithful block composition and two-round editor QA; **no canonical DB migration**. Visual design thread: style/collection consultation, asset variants and review UX/manifest; no unapproved visual assignment or prod writes. All merge/deploy/apply gates remain separate.
