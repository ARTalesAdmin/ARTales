# ARTales Block & Typography + Internal Works Audit v0.1

- **Status:** audit only; no runtime, CSS, parser, Reader, editor, environment or schema change
- **Target:** `develop first`
- **Risk of this PR:** low (documentation only)
- **DB / Env:** no / no

**Specification basis:** `ARTales_Block_Typography_Contract_v1_CZ (1).docx`, as identified by the product owner, including the contractual rules and acceptance expectations supplied with this audit brief; and Ivanina requirements for the internal works list. The binary attachment is not committed in this repository, so findings do not claim byte-level verification of content beyond the supplied contract text. Before implementation, keep the controlled DOCX beside the implementation ticket and resolve any discrepancy in favour of that controlled source.

## Inspected repository surface

The audit read, without changing, these current `develop` paths:

- routes: `app/member/works/page.tsx`, `app/member/works/new/page.tsx`, `app/member/works/[slug]/edit/page.tsx`, `app/member/works/search/route.ts`;
- internal UI/copy: `components/member/WorksQuickNavigation.tsx`, `lib/i18n/dictionaries/cs/member.ts`, `lib/i18n/dictionaries/en/member.ts`, `lib/dictionaries/language.ts`, `lib/dictionaries/status.ts`, `lib/guards.ts`;
- data/save/schema evidence: `lib/dbWorks.ts`, `lib/actions/works.ts`, `lib/forms/workForm.ts`, `lib/workContentChanges.ts`, `lib/supabase/migrations/2026-05-13_editor_quality_v05.sql`, `lib/supabase/migrations/2026-05-14_edition_imprint_contributor_v06.sql`, `lib/supabase/migrations/2026-07-03_work_content_block_batches_v01012j.sql`, `lib/supabase/migrations/2026-07-05_work_content_block_batches_public_read_v01013b2.sql`, and all repository migrations searched for the fields listed in §16;
- canonical content/parser/editor: `lib/blocks.ts`, `lib/textParser.ts`, `components/editor/WorkEditorForm.tsx`, `components/editor/WorkBlocksEditor.tsx`;
- rendering/Reader: `components/work/WorkContentRenderer.tsx`, `components/work/work-content-renderer.css`, `components/reader/ReaderClient.tsx`, `components/reader/ReaderToolbar.tsx`, `components/reader/reader.css`, `lib/reader/paginateBlocks.ts`, `lib/reader/readerSettings.ts`, `lib/reader/readerStorage.ts`, `lib/rendering/blockFormats.ts`;
- operational context: `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, `docs/ARTALES_WORKS_NAVIGATION_SEARCH_AUDIT_V0_1.md`, and relevant Reader audit/release documents.

All database conclusions below distinguish **repository evidence** from **deployed-database fact**. The repository does not contain the base `works` DDL or its policies, so it cannot prove the live schema or RLS state.

# 1. Executive summary

The baseline is the current post-Reader-Phase-4 `develop` snapshot: synced notes and marker/navigation work, internal works quick navigation, and PWA update hygiene are present. PR #160 account-synced Reader progress is **open, unmerged and future**; it is not treated as current capability and no #160 path is changed or depended upon here. “Production” descriptions are contextual rather than a claim that this branch equals `main`.

The contract **can and should be implemented incrementally**, but only if parser, editor, Reader and storage converge on one versioned canonical model. The current system already has a useful `WorkBlock` registry, JSON block storage, sanitisation, composite table/image/letter handling, a shared renderer, and batch overlays. These are foundations, not contract compliance.

Main blockers:

1. the canonical registry lacks epigraph/list/telegram/drama/section-role and relational footnote/review-signal structures;
2. legacy `preface`, `afterword`, `acknowledgement` are writable top-level types;
3. pagination estimates text weight and splits blocks, but does not model table rows, anchors, heading-follow relationships or composite relations;
4. no repository-proven work typography profile or editorial-only timestamp exists;
5. ownership/review semantics and deployed `works` RLS are not provable from migrations;
6. the parser remains primarily marked-block/line heuristic logic and emits prose `editor_note`, not typed review signals;
7. title-page metadata is incomplete/indirect and no generated Work Title Page exists.

**Recommended first implementation phase:** IW-1, an internal-list shell using only verified, RLS-visible data, with explicit conservative limitations. In the block programme, begin separately with a registry/schema design decision and read-compatible simple types—never a parser rewrite and migration in the same PR.

Explicitly defer: Nexus/Syrael assignment and hierarchy, destructive legacy conversion, anchored footnotes, semantic pagination/table splitting, generated-title-page cleanup, full drama, and automated review routing. The cancelled v0.10.15k table pagination/header patch must not be revived.

# 2. Current internal works list audit

## Routes, rendering and data

| Question | Current finding | Evidence/consequence |
|---|---|---|
| Data source | `getWorksForMember()` uses cookie/session `createClient()` and selects `works` plus primary author/collection. | It is not the public gallery query and does not use service role. |
| Default order | Main list: database `.order("title", ascending)` on legacy `title`. | Not “Poslední změna”; localized display title can appear out of order. |
| Status filtering | No application status filter. | It can return draft, review, published and archived if RLS permits; published/archived are not excluded. |
| Rendering | `/member/works` is an async Server Component; cards are server-rendered. `WorksQuickNavigation` is a client island calling a dynamic server route. | Mixed page overall, with the main list server-rendered. |
| Pagination | None: no `limit`, `range`, cursor, page param or load-more. | Every RLS-visible work is rendered into the response. |
| Search/filter | Main grid has none. Quick navigation is a separate debounced typeahead (minimum two characters). | Search does not filter the visible card grid. |
| Required modes | Absent. | No “Všechna díla / Moje díla / Ke kontrole”. |
| Current identity | The guard resolves an editor/admin, but the list helper receives no profile ID and projects no owner fields. | UI cannot perform reliable ownership filtering. |
| Ownership fields | Main projection has none. Actions write `created_by`/`updated_by` through form payload mapping, but base schema is missing from repository. No `submitted_by`, `editor_id` or `main_editor_id` is proven. | “Moje” cannot safely be inferred from author or last editor. |
| Needs review / lower level | Status includes generic `review`, but no review request, reviewer, editor level or hierarchy is projected/proven. | Generic status is insufficient for “Ke kontrole”. |
| RLS | Session queries allow RLS to restrict rows. Batch-table migrations have editor/admin policies, but `works` policy DDL is absent. | RLS protection is intended but not verifiable from repository alone. |
| Guard sufficiency | `requireEditorOrAdmin()` protects pages/endpoints but is not row authorization. | A role/ownership-scoped query plus verified RLS is required; UI filtering is never authorization. |

`/member/works/new` and `/member/works/[slug]/edit` are server route shells guarded by `requireEditorOrAdmin`; each loads authors/options and mounts client `WorkEditorForm`. Editing loads `getWorkForEditBySlug`. Neither route supplies ownership, level or review-request context. Czech quick-nav dictionary text is present (with an English counterpart), but no mode/sort vocabulary exists.

## Typeahead and sorting

`searchWorksForMember()` searches title/title_cs/title_en/slug and author-name matches, then UUID. Database requests order `updated_at DESC`; merged results are finally ranked exact → prefix → other, then `updated_at DESC`. Therefore typeahead relevance takes precedence over recency. It returns at most ten deduplicated results and displays only the calendar date, not time.

Available fields:

- A–Z/Z–A: `title`, `title_cs`, `title_en`; a locale/display-title policy is needed before sorting. Prefer a server-side normalized `display_title`/locale expression or deterministic client sort only for an already bounded page.
- last update: `updated_at` appears in search projection and common application conventions; `published_at` is explicit publication time.
- repository searches found no `content_changed_at`, `content_changed_by`, or `editorial_changed_at`.

**Required conclusion:** `updated_at` is a **technical row timestamp**, not a proven editorial timestamp. Metadata edits, status/publishing operations, migrations, backfills or triggers may change it. It must not silently power “Naposledy změněno”. Until a dedicated field exists, label it accurately (for example “Technická aktualizace”), omit the promise, or explicitly mark the temporary approximation.

Recommended exact fields: `content_changed_at timestamptz`, `content_changed_by uuid references profiles(id) on delete set null`; optionally `content_change_source text` (prefer a constrained vocabulary such as `editor_save`, `parser_import_confirmed`, `batch_edit`) and `content_change_reason text` only if editorial reporting needs it. Add nullable fields first, backfill only from evidence (not blindly from `updated_at`), update them atomically only in successful editorial content saves—including successful batch/change-set writes—and add `(content_changed_at desc, id)` index. Do not make the timestamp trigger on every `works` update.

# 3. Internal works recommendation

### IW-1 — conservative UI/query MVP

- Equal mode controls: **Všechna díla**, **Moje díla**, **Ke kontrole**; separate sort: **Poslední změna** (default/newest), **A–Z**, **Z–A**.
- Use existing session/RLS-visible projection only. “Všechna” means all returned rows, including all statuses unless product explicitly narrows “in progress”.
- Do not call `updated_at` editorial change; either display a clearly temporary technical label or wait for IW-2.
- “Moje” may only become active if deployed `created_by` is verified and product confirms “inserted/created by me”; otherwise show an honest planned state.
- “Ke kontrole” should be an empty/planned state while no review model exists; do not equate every `status=review` row with permission to review.
- Pass mode and sort to the server query/search endpoint. Search must apply the selected mode in the authorized query, not fetch everything and hide client-side.
- Add pagination/cursor when cardinality warrants; stable tiebreak by `id`.

### IW-2 — editorial change audit

Isolated migration/API PR: add `content_changed_at`, `content_changed_by`, optionally constrained `content_change_source`; define which metadata edits count; update after a complete successful content transaction/change set; make list and typeahead use it. Reconcile partial batches before advancing the timestamp.

### IW-3 — ownership groundwork

Verify/backfill `created_by`; add `submitted_by` and `main_editor_id` only where their semantics are approved. “Moje díla” means `created_by = auth.uid()` per Ivanina’s wording, not `updated_by`, author, or assignee. Keep creator identity separate from responsibility and authorization.

### IW-4 — Nexus/Syrael-aligned review

Only after integration alignment: review request/status and editor-level representation. Still no automatic assignment.

Remain deferred to Nexus/Syrael: work assignment; editor-hierarchy enforcement; multi-level approvals; review escalation; automatic candidate selection. ARTales may own local mode UI, editorial timestamps and explicit request records, but must not invent broader identity/permission architecture.

# 4. Current canonical block model audit

Legend: P/E/R = parser/editor/Reader support. “Migration” means future impact, not a migration in this PR.

| Contract block | Current support / representation | P / E / R | Gap | Typing/schema & migration impact | Risk | Suggested phase |
|---|---|---|---|---|---|---|
| paragraph | Present, simple text | yes/yes/yes | No explicit inline token model beyond `<em>/<i>` rendering | registry-compatible; audit existing rich text | low | registry QA |
| book_part | Present, simple heading | yes/yes/yes | label/title are newline convention, not fields | optional structured heading fields, compatible conversion | medium | canonical registry |
| chapter | Present, simple heading | yes/yes/yes | same; paginator forces break | optional label/title fields | medium | canonical registry |
| headline | Present, simple heading | yes/yes/yes | no section relation/level | add role/level deliberately | medium | registry |
| quote | Present, simple text | yes/yes/yes | no attribution/source fields; epigraph conflated in help/prompt | add optional fields; classify conservatively | medium | PR 5–7 |
| poem | Present, line-preserving text | yes/yes/yes | no stanza/verse semantics | fields optional; avoid premature fragmentation | medium | later |
| letter | Present, composite `place_year/body/date_signature` | partial/yes/yes | parser does not structurally infer internals; salutation/addressee etc. absent | extend fields read-compatibly | medium | later document blocks |
| separator | Present | yes/yes/yes | uncertainty is not a signal | possible review signal/section relation | low/medium | parser v1 |
| note | Present, simple public note | yes/yes/yes | no relation model | likely compatible | low | registry QA |
| footnote | Present, standalone text | partial/yes/yes | no anchor/ID relation; duplicated inline and collection | relational fields and content migration | high | PR 9 |
| dedication | Present, simple multiline | yes/yes/yes | uncertain dedication cannot be typed signal | add review signal support | medium | parser v1 |
| place_line | Present, simple text | yes/yes/yes | no normalized place/date parts | optional fields only if needed | low/medium | later |
| newspaper_article | Present, multiline simple text | partial/yes/yes | lacks masthead/headline/byline/date/body fields and font exception | extend composite fields; legacy fallback | medium/high | document blocks |
| telegram | Missing | no/no/no | fully unsupported | add type + optional sender/recipient/date/body fields; no old migration | medium | PR 5–7 |
| image | Present, composite | marked/yes/yes | `source_note` substitutes for credit; alt can fall back; no zoom | add `credit`, dimensions/asset metadata; backfill review | medium | PR 7/image PR |
| table | Present, composite rows/headers | marked/yes/yes | no row-aware page split/repeated continuation header/expanded view | fields already JSON-compatible; pagination high risk | high | polish first; semantic pagination later |
| epigraph | Missing; quote conflates motto | no/no/no | distinct semantics/attribution absent | add type/fields; migration report for likely quotes | medium | PR 5–7 |
| list | Missing | no/no/no | ToC must not be misclassified as list | add ordered/items fields or child model | medium | PR 5–7 |
| act | Missing | no/no/no | drama hierarchy absent | new type + stable relation/section IDs | high | PR 10 |
| scene | Missing | no/no/no | drama hierarchy absent | same | high | PR 10 |
| cast | Missing | no/no/no | composite character entries absent | typed entries | high | PR 10 |
| speaker | Missing | no/no/no | relation to dialogue absent | speaker/entity or stable label relation | high | PR 10 |
| dialogue | Missing | no/no/no | prose/verse/song variants absent | variant + speaker relation | high | PR 10 |
| stage_direction | Missing | no/no/no | block and inline directions absent | block type plus safe inline marks | high | PR 10 |
| editor_note | Present only as nullable property on every block, not a block type | parser text/yes/not rendered | conflates human note and machine review signal | retain note; add structured signals separately | medium | PR 6 |
| section role | Missing | no/no/no | preface/afterword/acknowledgement remain types | optional `section_role` on structural block/section relation; non-destructive conversion | high | PR 5 + later migration |

`WORK_BLOCK_TYPES`, its metadata and `WorkBlock.type` are the de facto registry. `fields` is a permissive record rather than a discriminated union. `createEmptyBlock()` specializes letter/image/table. `sanitizeWorkBlocks()` drops unknown types and normalizes those composites; this means deploying new stored types before read support could silently hide content. `validateWorkBlocks()` validates visible text, letters and table shape, permits unresolved images in drafts, but is not relational validation. Any registry evolution must deploy tolerant readers before writers/migration.

# 5. Parser audit

## Current pipeline

`ARTALES_TEXT_PREPROCESSOR_PROMPT` instructs an external/preprocessing step to emit `::tag` blocks. Supported tags match the current registry: `book_part`, `chapter`, `paragraph`, `headline`, `quote`, `poem`, `letter`, `newspaper_article`, `place_line`, `separator`, `note`, `footnote`, `dedication`, `preface`, `afterword`, `acknowledgement`, `image`, `table`. Contract-missing tags are `epigraph`, `list`, `telegram`, all drama tags, and section roles. `preface`, `afterword`, `acknowledgement` should be deprecated as emitted tags after read compatibility exists.

Marked parsing groups lines under tags; heuristics classify normalized lines with regexes and contextual neighbouring-line checks. It is more than a single regex but remains predominantly a line classifier, not a document grammar with relations. Blank lines flush paragraph buffers/group blocks; normalisation trims empty content. This does not represent intentional vertical space, which is correct, but contract QA must verify that blank lines create paragraph boundaries without semantic blocks.

Uncertainty is human-readable `editor_note` (“Parser: …”), including invalid table/image placeholders. It is not a structured, filterable review signal. No ToC recognizer/skipper was found; therefore a source contents section may become headings/paragraphs and later duplicate navigation. Quote vs epigraph does not exist. Telegram/drama do not exist. Footnotes have no anchor pairing. Letter markup preserves a block but does not parse its internal parts. Table marked content requires JSON, passes through table normalization/validation, and falls back with an editor note when invalid; it does not infer relational rows from arbitrary prose safely. Image placeholders preserve request text and create an unresolved image block, but do not preserve asset identity/dimensions/credit.

Stats count block types, images, tables and whether markup was used; they do not count confidence, unresolved relations or signal types.

## Parser contract gap matrix

| Current behaviour | Contract requirement | Difficulty | False-positive risk | Phase |
|---|---|---:|---:|---|
| Emits legacy long-text section types | structural heading + paragraphs + section role | high (existing data) | medium | read-compatible registry, then parser PR |
| Quote includes motto | epigraph distinct from quote | medium | high | typed signal first, PR 5–6 |
| No ToC rule | recognize and skip ToC as reader content | high | high (ordinary lists/headings) | corpus-led parser PR |
| No telegram | telegram semantics and internals | medium | high | registry then conservative marked support |
| No drama grammar | related act/scene/cast/speech/directions | very high | very high | dedicated drama corpus/PR 10 |
| Standalone footnote | anchor-linked unique relation | very high | high | PR 9 |
| Letter body largely opaque | internal parts preserved structurally | medium/high | medium | later composite upgrade |
| Table accepts tagged JSON | semantic rows/columns, safe preservation | medium | medium | validation first; heuristics later |
| Image request placeholder | asset/alt/caption/credit | medium | medium | image model PR |
| `editor_note` warning prose | low-noise typed review signal | medium | low if additive | PR 6 |
| Heuristic specialized types | uncertainty should not fabricate type | medium | currently medium/high | confidence thresholds + generic fallback |
| Empty lines delimit buffers | paragraph boundaries, not layout semantics | low | low | regression tests |

### Small versus large works

`parseRawTextToWorkBlocks()` selects marked or heuristic parsing for the text; no block-semantic branch based on work size was found in `lib/textParser.ts`. Small/large differences instead occur later in editor persistence: local autosave thresholds, smart append and batch/change-set paths. This aligns directionally with the contract, but semantic equivalence must be regression-tested because batch reconstruction can alter insertion/deletion/reorder outcomes even if parsing does not.

# 6. Editor audit

The editor exposes semantic type labels from the registry, not CSS class names, but presents a flat type selector rather than contract groups. There is no typography-profile control or Work Title Page preview. Canonical/edition/original language metadata exists; Reader CSS uses language inheritance/hyphenation behaviour, but the parser call itself does not receive a robust work-language grammar contract.

- Image: upload/request, alt, caption, alignment, size and `source_note` UI exist. UI language calls `source_note` credit, but there is no explicit `credit` field. Publishing blocks unresolved image assets, not proven missing alt; renderer substitutes caption or “ARTales image”, so contract alt confirmation is unmet.
- Table: caption, header row, first-column header, responsive mode, per-column alignment, add/remove rows and columns, and preview are present. This is stronger than the pagination layer.
- Footnote: only generic content/editor note; no anchor picker, marker text or relation validation.
- Drama: no act/scene/cast/speaker/dialogue/stage-direction controls.
- Review signals: parser `editor_note` is shown in the same generic editor-note surface; no distinct confidence/status UI.
- Emphasis: renderer recognizes `<em>/<i>`, and plain text can retain those literal tags, but the editor is a textarea rather than a robust inline semantic editor; preservation is possible but not guaranteed through arbitrary preprocessing.
- Composite internals: letter and table/image have dedicated controls; newspaper/quote/footnote/drama do not.
- Live preview: block-level/table/image previews and a link to Reader preview exist; there is no generated title-page/profile preview.

## Save pipeline versus Contract §6.6 / acceptance

Local drafts use `localStorage` after load and warn on quota/unavailability. Autosave is intentionally disabled for large works based on block count/serialized size; the UI tells the editor to use the main save. A `beforeunload` warning exists when the current snapshot differs.

For ordinary full save, the form submits metadata and blocks, updates the `works` row, then clears batch overlays. Relation syncing happens afterward, so the operation is not one database transaction; a later failure can leave the core work updated while the UI reports failure. Publishing timestamps are also reset/set on saves, reinforcing that general timestamps are not editorial-only.

For large works:

- smart append persists new blocks in sequential API batches with insertion anchors;
- delete/update legacy batch metadata is supported;
- unified `content_change_set` supports inserted, updated, deleted and complete ordered IDs;
- reconstruction applies delete/update/insert/reorder semantics;
- one explicit unified save path can represent add + edit + delete + reorder and reports added/changed/deleted/reordered counts;
- fallback/specialized paths have eligibility rules (for example reordering can reject older append-only plans);
- sequential append is non-atomic. The UI correctly warns that partial batches may already be saved and does **not** claim success, but recovery remains manual;
- successful messages expose useful counts in unified/delete paths, while ordinary full save is a generic success.

Contract acceptance should require: identical resulting canonical sequence for full and batched save; one user Save covering all four mutations; atomic RPC/transaction or an idempotent commit envelope; only mark saved after server reconciliation; preserve stable IDs/relations; counts for all mutation classes; unresolved-signal/alt/relation validation; and leave warning until reconciled. Current implementation is partial, not §6.6-complete.

# 7. Reader/rendering audit

`WorkContentRenderer` maps all current types: headings (`book_part`, `chapter`, `headline`), prose, quote, poem, structured letter, newspaper article, place line, separator, accessible HTML table, image figure, note, footnote, dedication and the three legacy section types. Unknown future types render nothing after sanitization risk.

It uses a selected rendering preset (`defaultReader`, `editionClassic`, `readerComfort`, `readerCompact`), while Reader supplies user density-oriented formats. These are not the contract’s work-level Classic/Clear/Edge/Drama. Current font model is primarily Georgia/Times for reading/paper with Arial/Helvetica for chrome/some document treatments; paragraph rhythm is controlled by shared preset/layout CSS, font scale and density, not by work metadata.

Specific findings:

- chapter supports newline convention “kicker + title”; book part is one `h2`, not separate label/title fields;
- quote/poem/letter/newspaper/note have dedicated styling; no epigraph/telegram/drama mapping;
- footnote renders once as an inline `aside` and again in the collected `<ol>`: duplicate content, with no source anchor interaction;
- image preserves natural aspect ratio/max width, but has no zoom/modal or exact return-focus/scroll contract;
- table supports semantic `<thead>`, column/row scopes, alignment and horizontal-scroll/stack CSS, but no fullscreen/expanded mobile view;
- pagination treats images/headlines/place lines/separators as keep-together and chapters/book parts as page breaks. Tables receive only default text weight (their `content` may be stale/plain), are neither row-split nor header-repeated;
- page slicing clones and splits prose/poem/newspaper/letter by estimated character/line budgets. It knows no anchor relations, heading-follow rule, table rows, cast/dialogue groups or orphan/widow semantics;
- Reader does not generate a Work Title Page. Existing leading chapter/headline/separator/paragraph content could duplicate one later;
- `pagedFlow` and `spread` reuse the same estimated slices, which is a useful single delivery path, but visual height can diverge from estimates. Contract work should extend semantic pagination, not create profile-specific semantic content.

## Reader gap matrix

| Block/area | Current render | Contract render | Status | Risk | Phase |
|---|---|---|---|---|---|
| paragraph/headings | semantic HTML, shared presets | profile rhythm; structured labels/relations | partial | medium | profile + registry |
| quote/epigraph | quote only | distinct epigraph/attribution | partial | medium | PR 5–7 |
| poem | line-preserving | profile-aware verse rules | partial | medium | later QA |
| letter | 3-part render | richer internal parts | partial | medium | later |
| newspaper | simple article/prose | internal document fields, Inter + Lora | partial | medium | document PR |
| telegram | none | dedicated Inter document | missing | medium | PR 5–7 |
| table | accessible table + scroll/stack | expansion, row split, repeat header | partial | high | polish, then separate paginator |
| image | figure/alt fallback/caption | required alt/credit/no upscale/zoom | partial | medium | image PR |
| note | inline aside | canonical note | mostly present | low | QA |
| footnote | inline plus collected duplicate | anchored popover/sheet, one content instance | non-compliant | high | PR 9 |
| legacy sections | styled long-text blocks | structural blocks + role | legacy-only | high | compatibility/migration |
| drama family | none | related drama rendering/profile | missing | high | PR 10 |
| title page | none | generated metadata opening | missing | high | PR 8 |
| semantic pagination | character/line weights | relation/row/keep-aware | partial | high | later dedicated PR |

# 8. Typography profile audit

No `works.typography_profile` is present in TypeScript projections/forms or repository migrations. No Classic/Clear/Edge/Drama dictionary/options exist. `editionClassic` is a renderer preset name, not proof of Contract Classic, and must not be aliased without visual/spec mapping.

Reader settings persist locally (theme, font scale, width, density, layout, page fit and advanced-controls visibility). PR #160 is not considered. User font size and theme are compatible preference overlays; density/width need profile QA. There is no user font-family selector, so there is no direct family override conflict today.

CSS can vary rhythm via renderer classes and Reader settings but has no work profile class/data attribute. Language is carried as work metadata and automatic hyphenation exists in Reader CSS, with narrow-layout exceptions; verify the rendered `lang` chain per work. Fonts observed are platform/local CSS stacks; no repository-hosted licensed contract font package or clear deployment/license record was found. No verified Inter+Lora newspaper pairing, Telegram Inter exception, or Atkinson Hyperlegible Next Drama profile exists.

Minimal implementation: add constrained work-level `typography_profile` (`classic`, `clear`, `edge`, `drama`), default existing works only after product chooses the default, project it into Reader, apply one root data attribute/class, keep user size/theme, prohibit per-paragraph profile CSS, and visually QA 3–5 real works across language, mobile/desktop and pagedFlow/spread. Font files/licences and fallback metrics require an explicit asset decision.

# 9. Work Title Page audit

Metadata evidence:

- title: yes, including localized variants;
- author: yes through `primary_author_id` relation;
- translator: no dedicated work field; `work_contributors` supports role `translator`, but current projections/editor use only free-text `contributor_summary` and do not resolve it for title-page generation;
- edition: several fields (`edition_title`, version, publisher, publication year, notes) exist;
- series: no dedicated series field found; collections are not necessarily series.

Reader renders no generated opening page. Parser has no title-page recognizer and can classify source title/author material as headline/chapter/paragraph/separator. Therefore existing works may contain pseudo-title pages, but code alone cannot count them.

Safest rollout: (1) add a read-only editor preview and a non-writing detection report; (2) define translator/edition/series source priority; (3) add a per-work `generated_title_page_enabled` flag default false for existing works, opt-in/new works after QA; (4) run migration report for suspicious leading blocks; (5) offer human-reviewed conversion; (6) only then consider cleanup. Do not automatically delete leading headings. A “new works first” rollout is safer than global enablement, but the flag is preferable for rollback and exceptions.

# 10. Section roles / removed block types audit

`preface`, `afterword`, `acknowledgement` appear in the registry/meta, empty-block flow, sanitizer/validator/plain-text flattening, parser tags/prompt/heuristics, editor selector, renderer and CSS/pagination-derived handling. Repository-wide search should be repeated in implementation because tests/docs may add references. The deployed content count is unknown without DB access.

Non-destructive path:

1. continue reading/rendering old types, mark them legacy/read-only in editor;
2. introduce optional `section_role` metadata on a structural section heading (define allowed values and navigation semantics);
3. stop parser creation of old types, emitting heading + paragraph sequence with role;
4. offer explicit editor conversion with preview/stable order;
5. migrate only approved content after counts and backups;
6. remove old types from writable/allowed enum only after telemetry/count reaches zero, retaining tolerant legacy read as long as needed.

Required count query is supplied in §16. Never reinterpret a long legacy preface as one heading; it must split into heading plus paragraphs without losing emphasis/order.

# 11. Footnote audit

Current `footnote` is `{id,type,content,editor_note,fields?}` with no anchor ID, visible marker, target block, offset/token or note relation. Parser creates independent footnote blocks. Editor has no pairing controls. Renderer numbers footnote blocks by display order, shows each as an inline aside and duplicates it in an end list. IDs are block IDs, but pagination cloning can suffix them and no cross-block invariant guarantees anchored uniqueness.

Migration path: define stable `footnote_id`, `anchor_block_id`, anchor representation (prefer a stable inline token/range strategy rather than raw character offset alone), marker label and note content; support legacy standalone read; inventory candidate markers/notes; present suggested pairs for human confirmation; write new relations without deleting legacy; switch Reader per work/feature flag; verify desktop popover, mobile bottom sheet, focus/scroll restoration and exactly one rendered note body; clean legacy only after reports.

Non-goals for first implementation: automatic fuzzy pairing across all books, migrating ambiguous notes, renumbering source markers, review assignment, or combining this with pagination rewrite.

# 12. Table audit

Current fields: `headers?: string[]`, `rows: string[][]`, `caption`, `first_column_header`, per-column `alignment`, and `responsive_mode: scroll|stack`. Sanitizer normalizes rectangular structure and validation requires at least one row/two columns/equal widths. Editor provides the expected elementary row/column/header/alignment/caption controls and preview. Renderer uses correct basic HTML header scopes and responsive container.

Mobile offers scroll/stack CSS but no expanded/fullscreen interaction. Pagination sees the table as one opaque default-weight block; it cannot split by row, repeat `<thead>`, or preserve a continuation relation. Header repetition in browser print may be partly browser-dependent and is not implemented as Reader page slices.

Recommended order: first contained Reader CSS/mobile QA (without reviving v0.10.15k), then explicit expanded view with focus/return handling, then header semantics/continuation data tests, and only later a separate row-aware pagination design. Image fallback needs a high-resolution asset reference, alt/caption/credit and explicit editor choice; it must not masquerade as a structured table.

# 13. Image audit

Current image fields are `storage_path`, `image_request`, `alt`, `caption`, `alignment`, `size`, `source_note`; `content` mirrors storage path. There is no explicit `credit`, intrinsic width/height or asset ID. Editor upload and preview exist. Publishing checks unresolved asset paths, but no code proves that empty alt is blocked or editor-confirmed; Reader falls back to caption then generic “ARTales image”, which is not adequate authored alt.

Reader centers/sizes through figure classes and preserves image aspect ratio, but cannot assert “no upscaling” without intrinsic dimensions and appropriate CSS/asset metadata. No zoom overlay exists, so close focus and exact reading position restoration are absent.

Add explicit `credit` and optional asset dimensions/version without deleting `source_note`; distinguish provenance/internal source note from public credit. Backfill via review, enforce alt-or-decorative-confirmation at publication, and implement zoom as an isolated accessible UI with focus return and unchanged page position. Migration is additive; do not synthesize meaningful alt from filename.

# 14. Drama audit

Act, scene, cast, speaker, dialogue and stage direction are absent across registry, parser, editor and Reader. Drama profile is absent. Inline stage directions and dialogue variants prose/verse/song have no token model. Implementing isolated text blocks would lose the necessary speaker-dialogue and act-scene relationships and would invite parser false positives.

Minimum safe future model: stable IDs; act/scene structural parent or section IDs; cast as typed entries; dialogue with `speaker_id`/stable speaker label and `variant`; block stage direction plus an approved inline semantic mark; ordered children; review signals for unresolved speaker/direction; tolerant serialization and relational validation. Build a representative Czech/multilingual drama corpus first. This is later/high-risk because it touches every contract layer and pagination/typography simultaneously.

# 15. Review signals audit

Today `editor_note` is a nullable free-text property. Parser uses it for provenance, invalid table/image warnings and uncertainty; editors can also enter it. UI does not distinguish machine review from a human note, signals cannot be counted/filtered/resolved, and Reader correctly does not render editor notes.

Recommended additive shape (exact storage placement to be decided):

```ts
review_signals: Array<{
  id: string;
  type: "possible_section_break" | "possible_telegram" | "unpaired_footnote" |
        "unpaired_anchor" | "possible_dedication" | "possible_epigraph" |
        "possible_drama_ambiguity";
  confidence: number;
  evidence: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
}>;
```

Evidence must be short/non-sensitive and confidence calibrated. Parser should fall back to a generic truthful block plus a low-noise signal rather than fabricate specialization. Local editor resolution can be safe if it is just block correction + resolved state in one save. Queue ownership, reviewer assignment and escalations remain Nexus/Syrael work.

# 16. Data/schema audit requirements

## Repository-evidenced field map

| Concern | Finding |
|---|---|
| `typography_profile` | Not found. |
| `content_changed_at/by`, `editorial_changed_at` | Not found. |
| `created_by` / `updated_by` | Action payloads use them and prior audit records them, but base `works` DDL/type is absent; verify deployed DB. |
| `submitted_by` | Not found for works (`member_submissions` identity is unrelated). |
| assigned/main editor | Not found. |
| review status/request fields | Work status has generic `review`; no request/reviewer fields found. |
| section role | Not found in work/block type. |
| translator | `work_contributors.role` permits translator; no direct field/current resolved projection. |
| edition | Multiple work columns proven by migration and current TS types. |
| series | Not found; collections must not be assumed equivalent. |
| `updated_at` / `published_at` | Used by search/actions/public ordering; exact base definitions/triggers not present. |
| block fields | Embedded `fields` in `content_blocks` JSON; permissive TS record. |
| relation IDs / section roles / anchors / review signals | Not modeled. |
| order | JSON array order; batch reconstruction plus `orderedBlockIds` in content change set. |
| batches | `work_content_block_batches`: JSON `blocks`, count, `created_by/at`, JSON `metadata`; ordered by created time/id. |
| content change set | Stored inside batch `metadata.content_change_set`; supports inserted/updated/deleted/ordered IDs, not an independent audited commit table. |

## Read-only SQL required before implementation

Run only against an approved sandbox/preview project (not production writes):

```sql
-- Exact columns, defaults and generated/identity properties.
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('works','work_content_block_batches','work_contributors')
order by table_name, ordinal_position;

-- Constraints, indexes and triggers (especially updated_at behaviour).
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('public.works'::regclass,
                   'public.work_content_block_batches'::regclass);
select schemaname, tablename, indexname, indexdef
from pg_indexes where schemaname='public' and tablename in ('works','work_content_block_batches');
select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema='public' and event_object_table in ('works','work_content_block_batches');

-- RLS and grants.
select schemaname, tablename, rowsecurity
from pg_tables where schemaname='public' and tablename in ('works','work_content_block_batches');
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename in ('works','work_content_block_batches');
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('works','work_content_block_batches');

-- Legacy types and likely pseudo-title-page inventory; read-only counts/samples.
select block->>'type' as block_type, count(*)
from public.works w cross join lateral jsonb_array_elements(coalesce(w.content_blocks,'[]'::jsonb)) block
group by 1 order by 2 desc;
select status, count(*) from public.works group by status order by status;
select count(*) filter (where created_by is null) as creator_missing,
       count(*) filter (where updated_at is null) as updated_missing
from public.works;

-- Batch metadata vocabulary and coverage.
select metadata ? 'content_change_set' as unified_change_set, count(*)
from public.work_content_block_batches group by 1;
```

If `created_by` is not present, adjust only after the first column query; do not run the later count blindly. A title-page detector should be an application/report query over the first N combined base+batch blocks, not a destructive SQL regex.

# 17. Supabase / deployment caution

No Supabase preview branch is assumed running; none should be created merely for this audit. Do not depend on an ephemeral database. This documentation needs no DB branch and performs no production reads/writes. PR #160 remains open/unmerged/future and is ignored except for this status statement. Every future schema-requiring phase must be an isolated migration PR with deploy ordering, backward compatibility, backup/reporting and rollback; production changes require separate explicit approval.

# 18. Risk map

| Level | Areas | Controls / rollback |
|---|---|---|
| Low | docs; UI labels; simple list sorting when truthful data exists | Revert one commit; no data rollback. |
| Medium | authorized internal filters; typography profile CSS; editor block grouping; image/table UI polish | Feature flag/profile default, preview role tests, visual corpus; revert UI while leaving additive fields tolerated. |
| High | parser contract rewrite | Version prompt/parser, retain old parser, corpus snapshots; rollback writer while tolerant readers retain new data. |
| High | block type/legacy-section migration | Read-old/write-new, report/backups, per-work conversion; rollback renderer/writer, never delete source in same step. |
| High | anchored footnotes | Feature flag per work, dual-read without duplicate display, invariant tests; rollback to legacy renderer while retaining additive relations. |
| High | Work Title Page migration | Default-off flag and pseudo-page report; disable generated page instantly, do not auto-delete old blocks. |
| High | Reader semantic pagination | Keep existing paginator selectable, golden page/relationship tests; switch flag back—no data rewrite. Do not revive v0.10.15k. |
| High | drama model | Separate corpus/registry/parser/editor/Reader gates; stop writing new drama types and keep tolerant read/fallback. |
| High | DB ownership/review workflow | Nexus alignment, RLS matrix, additive nullable fields and audit logs; disable modes/requests, preserve identities, rollback policy carefully. |

# 19. Recommended implementation roadmap

1. **PR 1 — Audit only (this PR).** One documentation file; no runtime/schema.
2. **PR 2 — Internal works list MVP.** Equal modes and separate sorting UI; current data conservatively; planned state where ownership/review is unproven; search scoped to mode; no hierarchy/workflow.
3. **PR 3 — Editorial timestamps / ownership groundwork.** Isolated additive migration for `content_changed_at/by`; verify/add `created_by`/`submitted_by` only if missing/approved; update only on completed editor content saves; RLS tests.
4. **PR 4 — Typography profiles v1.** Work-level profile, default/backfill decision, editor select, Reader root class/data attribute and approved CSS/fonts; no parser rewrite; real-work visual QA.
5. **PR 5 — Canonical block registry alignment.** Add simple epigraph/list/telegram with tolerant sanitizer/types; add section-role shape; make old preface types read-only; no destructive migration.
6. **PR 6 — Parser contract v1.** Update controlled prompt/marked tags, conservative context heuristics, ToC handling and typed review signals; same semantics regardless of work size; no full drama.
7. **PR 7 — Reader simple/document blocks.** Epigraph/list/telegram render plus isolated image/table polish/expanded view; no semantic pagination rewrite.
8. **PR 8 — Work Title Page.** Generated page behind per-work flag; editor preview; translator/edition source definition; pseudo-title-page report before cleanup.
9. **PR 9 — Anchored footnotes.** Dedicated schema/relations/API/editor/Reader/migration-report PR with popover/bottom sheet and no duplicates.
10. **PR 10 — Drama phase.** After test corpus: act/scene/cast/speaker/dialogue/stage_direction and variants/profile; likely split further if review shows scope is too large.
11. **PR 11 — Nexus-linked review workflow.** Review requests, editor levels, assignment logic and permissions/integration only after Nexus/Syrael contract.

Each phase must state canonical-model version compatibility, old/new read behaviour, database and environment impact, rollout flag, test corpus and rollback. Parser, migration and semantic paginator should remain separate review boundaries.

# 20. Acceptance for this audit PR

- [x] Only `docs/ARTALES_BLOCK_TYPOGRAPHY_INTERNAL_WORKS_AUDIT_V0_1.md` is added.
- [x] Exact repository files inspected are named.
- [x] Current-state mapping covers internal works, block model, parser, editor, Reader, typography, title page, legacy roles, footnotes, tables, images, drama, signals and schema.
- [x] Contract/current matrices are included.
- [x] Immediate ARTales-local work and deferred Nexus/Syrael work are distinguished.
- [x] PR-sized roadmap and risk/rollback notes are included.
- [x] No runtime, CSS, package, environment, database, migration, parser, editor or Reader file is changed.
- [x] PR #160 is referenced only as open/unmerged/future.

## Delivery metadata

- **Summary:** repository-backed gap audit and staged recommendations only.
- **Changed files:** this document only.
- **Risk:** `low`; documentation cannot change runtime or data.
- **Target:** `develop first`.
- **DB:** `no`.
- **Env:** `no`.
- **Rollback:** revert this audit commit; no runtime/data rollback.
- **Test checklist:** `git diff --check`; verify changed-file allowlist; verify no package/env/DB/runtime changes; review factual statements against controlled DOCX before implementation.
