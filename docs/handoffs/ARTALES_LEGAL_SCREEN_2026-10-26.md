# ARTales — Právní check v1: produkční closure a předání (26. 10. 2026)

> **Status:** source and release evidence captured for next thread. Runtime rollout of latest UI cleanup confirmed Vercel production READY at commit `d221aef0ab38bf8bcd018ff9b376246e4c788019`. **This checkpoint is a historical handoff, not action authorization.** User acceptance of all broader automated copyright edge cases is NOT asserted. Next thread must reverify live state and user authority.

## 1. Context and decision

ARTales project: `ARTalesAdmin/ARTales`; live `https://artales.net`; legal overview `/member/legal`.
Architect explicitly instructed an **isolated main-only hotfix path**, because `develop` contains dormant, unfinished and superseded work not approved for production. Do not pull these changes into production, and do not treat this exception as universal supersession of ARTales `AGENTS.md`, `docs/WORKFLOW.md` and `docs/RELEASE_POLICY.md`. Separate review/authorization applies to each future release, migration and runtime action.

**Editorial goal as clarified by Architect:** a quick *factual public-domain/date check*, not a certified legal memorandum or genealogical research. Obtain Gutenberg work/edition identifiers and original first publication where available, creator/editor, any identified translator and illustrator with death years, apply standard CZ/EU death+70 term, examine explicit Gutenberg rights notices, present three practical options **NE / ANO bez ilustrací / ANO s ilustracemi**; let editor confirm with optional note; preserve source citations, audit, person and timestamp; hand off confirmed edition for later Snapshot. Protected text/known protected translation is a hard stop. Unknown or protected illustration => use text without images. Gutenberg US public-domain metadata is not by itself proof of CZ/EU status. The public Gutenberg eBook release date is not the original book publication date.

Important policy nuance: a historical collection edited by Andrew Lang is screened at the historical edition level rather than requiring per-folktale genealogy absent a concrete indicator, but any actually credited modern protected translation is excluded. Illustration authorship should not automatically be inferred from a book author without source evidence; this is a future enhancement.

## 2. Chronological source change and release record

All below GitHub links are durable source evidence. No `develop` merge in this sequence.

- [#263](https://github.com/ARTalesAdmin/ARTales/pull/263): move automated screen to prominent one-click entry; collapse manual tools.
- [#264](https://github.com/ARTalesAdmin/ARTales/pull/264): official Gutenberg OPDS catalog with fallback, no invented URLs.
- [#266](https://github.com/ARTalesAdmin/ARTales/pull/266): concrete book/file resolution, handles Gutenberg #389.
- [#267](https://github.com/ARTalesAdmin/ARTales/pull/267): component audit, standalone `/member/legal/[id]`, retained append-only history.
- [#268](https://github.com/ARTalesAdmin/ARTales/pull/268): author death-year Prescreen fallback and bounded Gutenberg text notices.
- [#269](https://github.com/ARTalesAdmin/ARTales/pull/269): RDF person/death metadata.
- [#270](https://github.com/ARTalesAdmin/ARTales/pull/270): computed separate author, translator, illustrator term evaluation; Open Library bibliographic fallback; bounded EPUB image/text scan; tests; merged into main as `1ba98ae08bbc...`. The initial tests revealed a legacy status assertion, later aligned; complete CI then PASS.
- [#271](https://github.com/ARTalesAdmin/ARTales/pull/271): decision-first, fewer manual forms, evidence collapsed, editor decision and lock action; merged as `fdbf0f018cdd9724c30e831564bd6f4901959b5a`, Vercel READY.
- [#272](https://github.com/ARTalesAdmin/ARTales/pull/272): production three-outcome public-domain *fact-check*, component/person data persistence, three editor choice buttons, historical JSON exports, latest-run selection, guarded source locking for Snapshot handoff; merged as `9820e046094a80c190124ec0cd0d85e5a16679fe`, Vercel READY. CI run [#40341080509](https://github.com/ARTalesAdmin/ARTales/actions/runs/40341080509) SUCCESS (source contracts, Gutenberg live, tests, TypeScript, ESLint, build).
- [#273](https://github.com/ARTalesAdmin/ARTales/pull/273): final legal overview UI status cleanup, **Všechny / K prověření / Ověřené / Zpracované**; stage-specific labels and single contextual action; drop redundant intro, no check/DB changes; merge SHA **`d221aef0ab38bf8bcd018ff9b376246e4c788019`**. CI run [#40345747615](https://github.com/ARTalesAdmin/ARTales/actions/runs/40345747615) SUCCESS. Vercel production deployment `dpl_haCdvuMnvsmXJN3gBGj5jacdWJDN` verified **READY** for exact SHA and `main` branch. No schema migration for #270–#273.

## 3. Product behavior at handoff

Overview `app/member/legal/page.tsx` plus `lib/legal/overviewStatus.ts`: Všechny = all; K prověření = not checked or incomplete/manual attention; Ověřené = latest approved and not yet locked; Zpracované = locked for later Snapshot **or rejected**, differentiated visually as 'Zpracováno' vs 'Vyřazeno (NE)'. Old filter query aliases preserved for compatibility. A completed legal handoff is **not** proof a Snapshot exists.

Individual legal page `app/member/candidates/[id]/legal/page.tsx` resolves to `/member/legal/[id]` in app routing: one-click automatic check, latest-run review, editable decision, downloadable per-decision audit JSON, source lock plus immutable handoff JSON, collapsed history. Supabase `candidate_legal_sources`, `candidate_legal_decisions`, `candidate_legal_locks`; app source files `lib/legal/publicDomainCheck.ts`, `app/member/candidates/[id]/legal/automatic/route.ts`, `components/legal/LegalReviewActions.tsx`, `lib/legal/reviewHistory.ts`, `app/member/legal/[id]/decision/route.ts`, `app/member/legal/[id]/audit/[decisionNo]/route.ts`.

The base legal screening schema and triggers predate this closure; late October work did not apply new migrations. Live DB was inspected read-only on 26 Oct 2026. It has approval and lock triggers that enforce reviewer identity, candidate/source consistency, source-approval evidence and latest approved decision; no bypass of these protections was deployed.

Snapshot is **next editorial stage**. Screen approval + lock yields an immutable source/decision packet for Snapshot; it does **not** create or import a Snapshot, nor grant general publication rights.

## 4. Observations and testing limits

- Architect supplied authenticated screenshots of both *The Great God Pan* Gutenberg #389 and *The Red Fairy Book* Gutenberg #540 earlier. These prompted successive correction of metadata fields, poor fallback, incomplete book/EPUB scanning, and inappropriate long manual UI.
- **User-reported acceptance:** On 26 Oct 2026 Architect stated *The Great God Pan* successfully reached locked state and handoff to Snapshot. This is a human-reported production flow result; no independent assistant-authenticated browser playback was performed. Red Fairy Book acceptance-to-lock was not likewise confirmed.
- Live Gutenberg data: Machen died 1947, work originally 1894; Lang died 1912, *The Red Fairy Book* originally 1890; later Project Gutenberg eBook dates should not substitute original publication. Tests cover both as fixtures/scenarios; tests ≠ guaranteed coverage of all real bibliographic variants.
- Known limitations deliberately deferred: automatic identification of illustrator/translation credits from arbitrary files; reliable matching to original edition of every Gutenberg work; EPUB fallback for all eBook hosts/redirects; complete licence analysis; downstream Snapshot creation. Unknown pictures currently yield a text-only path. Long genealogical/advanced rights review not part of requested MVP.

## 5. Governance, risks and operational handoff

1. **Start next thread:** load Nexus STARTUP-01, Phoenix/Continuity as relevant; ARTales `AGENTS.md`, `docs/WORKFLOW.md`, this handoff and freshest live GitHub/Vercel state. Nexus `bootstrap_work_context({project:"artales"})` is navigation only and returns `selectedWork:null` in this session. Do not invent or silently create an ARTales work arc. No prior authorization carries into next thread.
2. **No next code work requested for Legal Check v1 now.** Treat as functionally closed pilot. Future fixes require a new explicitly scoped work item and tests.
3. **Important repo routing exception:** late legal patches to `main` were expressly authorized by Architect because `develop` has unapproved/superseded code. Do not merge or backfill `develop` indiscriminately.
4. **Potential future work:** better attribution of truly original illustrations; more reliable editor/translator detection and original-publication evidence; maintain concise check and optional notes; add integrated Snapshot pipeline separately and independently.
5. **Rollback** for latest UI-only change: revert squash commit `d221aef0ab38bf8bcd018ff9b376246e4c788019` through a reviewed and separately authorized revert if needed. No destructive DB revert or data cleanup; append-only legal audit must be preserved.
6. Do not claim all legal work is blanket-cleared in CZ/EU or legally certified. The outcomes are editorial red/green fact checks and the editor remains accountable for approving the concrete edition.

## 6. Durable acceptance snapshot

- Final requested UX filter change (#273) **merged, production Vercel READY**, exact SHA verified.
- User reports successful full lock + Snapshot handoff for #389 before the final filter cleanup.
- No further changes to check algorithm after #272. No migrations as part of #273.
- Future agent should start with current production readback and this file; reopen only upon user request.
