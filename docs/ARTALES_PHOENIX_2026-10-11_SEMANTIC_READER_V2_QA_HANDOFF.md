# ARTales Phoenix — Semantic Reader / Composer v2 QA handoff (2026-10-11)

> Non-authoritative status checkpoint for the main ARTales thread. Live repository state, AGENTS.md, WORKFLOW.md, RELEASE_POLICY.md, production safeguards and the architect's explicit permissions take precedence. No permission to merge, publish, apply migrations, or change production.

## Identity / exact observed state

- Repo: ARTalesAdmin/ARTales
- Feature branch: `feat/artales-semantic-reader-composer-v2-20261011`
- Draft PR: **#209**, https://github.com/ARTalesAdmin/ARTales/pull/209 ; base **develop**; **NOT merged**
- Checked branch HEAD: `78a96c218ae0e14635cab5f01fd32f058b086c84`
- Checked develop HEAD: `7faf5283a9a199207453e02673c0e664686747e3`
- GitHub compare develop...feature: **82 ahead, 22 behind** (diverged); PR mergeability output varies UNKNOWN/FALSE while GitHub recalculates. Before any integration, reconcile onto the CURRENT develop and rerun tests. Do not assume auto-merge.
- GitHub Actions run **38148229812** completed SUCCESS at that feature HEAD: **31/31 tests PASS**, TypeScript PASS, ESLint PASS.
- Vercel preview READY at https://ar-tales-kne5ncaeu-artalesadmins-projects.vercel.app/preview/semantic-reader (HTTP 200, source/composition visible, no synthetic legacy column).
- No main/prod changes, no Supabase apply, no account/notes writes, no Nexus worker queue, no paid persistent DB. No merge authorization.

## Delivered in isolated PR #209

- Exact Gutenberg PG#11 fixture pipeline from previously merged PR #205, immutable source snapshot and SHA-256, exact source byte / normalized text spans. Rights and CZ/EU assessment are NOT cleared for publishing.
- Semantic chapters/sections, paragraphs, quotes, epigraphs, footnotes, poems/stanzas/verses and bounded editorial layout flags (alignment, indent and spacing); iterative parent-linked revision-bound changes, exact text integrity checks.
- Semantic rendering and new pure projection (without reintroducing withdrawn legacy paginator v0.10.15k). Browser-measured block heights, responsive layout, page-fragment continuation and sentence/semicolon-preferred breaks; no duplicates or dropped source atoms under tested projections.
- Two surfaces over common semantic renderer: editorial QA **original ↔ composed** with two visually scrollbar-free source-anchored synchronized panes; customer QA **continuous pagedFlow / spread on sufficiently wide viewports**, not a third public single-page mode.
- **Legacy diagnostic column removed entirely** from the visual QA. Existing real legacy observations still lack approved read-only evidence; tripleQA capability intentionally reports can_cutover=false.
- Draft title page (ARTales, work title, author, optional reviewed edition note, no ISBN), version-bound and separate from original source; not approved as default.
- New compatible read-only ReaderNotes/settings bridge: canonical ReaderNote colors/title/body, existing bookmarks/progress and ReaderSettings/profile defaults preserved; old page-% mappings are approximate unless proven, no destructive migration. New notes QA are ephemeral React-state-only, never persisted.
- Notes UX mirrored from current `ReaderToolbar`: compact three-dot menu, create from reading position, five colors, previous/next, selected note, collapsed/expanded list, goto/delete, colored in-text margin markers. Source anchors survive reflow and font changes.

## Architect's direct manual QA verdicts

**PASS by architect in preview:** text reflow and display quality; mobile default single page and continuous reading; progressively improved semantically natural page fill; temporary notes creation and navigation (including after typography changes); **bidirectional synchronized scroll** source ↔ composition. Final notes UX parity adjustment was implemented after initial PASS; code and CI green, but the exact newest menu deserves final quick browser look.

**NOT an unconditional release PASS:** cross-device authenticated notes, production Alice/legacy content snapshot, footer/footnotes/poems/tables heterogeneity, real user account persistence, entitlement/RLS, DB-backed revision storage and atomic release/rollback, legal review, first 1→5 migration and full browser E2E remain open.

**Optional UX later:** precise note placement: after Add Note, select a specific paragraph under mouse/touch/keyboard, then open existing canonical form and store exact original atom + offset. Paragraph anchor first; word/selection offset only with verifiable raw-to-DOM mapping. Not a release blocker for isolated QA.

**Title-page deferred for Ivana:** do not auto-assign until she joins a permission-gated editorial interface. Compare currently published ARTales title pages read-only; later show a safe editable preview to her, discuss and approve default format. No ISBN, no invented credits, no automated publication.

## Main-thread integration plan — sequential gates, not permission to execute

1. Read AGENTS.md, WORKFLOW.md, RELEASE_POLICY.md, durable checkpoint, PR #209 and this Phoenix. Confirm latest develop, DB schema PR #207 and subsequent profile migrations; inspect current PR ownership to avoid second-thread conflicts.
2. Reconcile branch against CURRENT develop using safe merge/rebase, preserve all semantic PR-owned files and do not overwrite the newer main-thread DB/profile work. Verify exact HEAD, changed-file scope, no hidden new SQL, no conflicts, and CI + preview smoke. Merge only with separate architect authorization.
3. Integrate the semantic blocks/revision hashes/source evidence through reviewed DB-A persistence and separately authorized DB-B release gates; keep fixture work IDs distinct from real DB IDs.
4. Build account-bound real Reader notes/bookmarks/progress sidecar and reader UI wiring using canonical ReaderNote/ReaderSettings contracts; verify user isolation, RLS, two signed accounts/devices and no lost legacy notes. Keep old slug/page/progress as fallback; source exact vs approximate vs blocked confidence explicit.
5. Wire real editorial issue workflow and safe preview/return/accept controls; content acceptance never implies legal or publishing approval.
6. For pilot migrate 1 sanitized/authorized actual legacy work with source edition verification, raw immutable source and separate legacy snapshot; then five mixed works including verse/notes, mobile/desktop QA, missing/duplicate text audit, rights dossier and human visual approval.
7. Only after independent governance, legal, permissions and complete E2E may a separately authorized release pointer switch the production Reader. Keep safe rollback/hold.

## Isolation and open caveats

- Risk HIGH due to Reader/parser/composition domain, though current PR is only fixture/preview/pure adapters.
- No production release; full Reader still uses legacy WorkBlocks/paginator and is authoritative for live readers.
- Existing `docs/ARTALES_SEMANTIC_READER_COMPOSER_V2_CONTRACT_2026-10-11.md` contains historical open QA wording; this Phoenix and architect's later PR comments supersede outdated status statements.
- QA `Vzdušnější` is nonpersistent; production reader stays compact/comfortable preferences.
- The latest PR body was originally written before all follow-ups and contains historical triple-column summary; update PR body at handoff to avoid misleading reviewers while keeping traceability.
- User-specific data from production (including notes) must never be copied into public fixtures.

## Ready-to-paste prompt for the main ARTales thread

> Navazujeme na dokončené izolované QA Semantic Reader/Composer v2 v Draft PR #209. Načti `docs/ARTALES_PHOENIX_2026-10-11_SEMANTIC_READER_V2_QA_HANDOFF.md`, `docs/ARTALES_SEMANTIC_READER_COMPOSER_V2_CONTRACT_2026-10-11.md`, AGENTS.md, WORKFLOW.md a RELEASE_POLICY.md; ověř aktuální HEAD develop, PR #209, DB-A/release a souběžné PR. Architekt prakticky potvrdil funkční poznámky, navigaci a obousměrný source↔composition scroll. CI 31/31 GREEN, Vercel READY, ale PR #209 je stále Draft a develop o 22 commitů vpřed. Připrav integrační review, konfliktovou rekonciliaci a plán bezpečného napojení na revize, skutečné reader notes/settings, účty, právní/publikační gate a pilot 1→5. Neprováděj merge, DB apply, produkční změny ani publikaci bez nové explicitní autorizace. Návrh přesného umístění poznámek je neblokující; titulka patří později Ivaně po onboardingu.
