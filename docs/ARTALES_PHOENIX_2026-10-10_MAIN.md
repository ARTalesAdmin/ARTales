# ARTales Phoenix — 2026-10-10: main-thread integration handoff

## Live reconciliation after integration — 2026-10-10 (supersedes older status fields below)

**Verified `develop` HEAD:** `41a55757cb87b6a5b717f6b6921f35b141af96bc`. **Production `main` (last verified):** `171df191eb54dbcef7bb015f748138c630428b2f`; verify again before any release. Both are distinct; no merge to main was authorized. **Production Supabase:** `nmhdwmszbwgrgfbmlguu`; candidate/editorial migrations have NOT been production-applied.

| PR | Outcome in `develop` | Merge commit |
| --- | --- | --- |
| [#196](https://github.com/ARTalesAdmin/ARTales/pull/196) | Merged: ingest/Composer fixture and source-anchored comparative Reader | `a6a1652c2a611dc372331acf2e71ab4ddc3f9520` |
| [#197](https://github.com/ARTalesAdmin/ARTales/pull/197) | Merged: catalog/rights **synthetic** planner and admin fixture, including sub-cent budget fix (29/29 tests + TypeScript passed) | `60cac24a8f89f3b9e6f6fd8bfbfb199a6c21eaa1` |
| [#198](https://github.com/ARTalesAdmin/ARTales/pull/198) | Merged: ARTales-native candidate legal-review inbox schema, RLS, claim/return audit; DB migration file merged but **NOT applied to production** | `41a55757cb87b6a5b717f6b6921f35b141af96bc` |
| [#199](https://github.com/ARTalesAdmin/ARTales/pull/199) | This documentation-only updated Phoenix; **merge not authorized yet** | open/draft until separately approved |

**Evidence / limitations:** On ephemeral Supabase branch `syxtzwkekuxqtbtfwzgk`, candidate+editorial migrations applied, synthetic admin enqueue and deduplication, member/anon denial, direct immutable field and audit tamper denial, editor claim / admin return, and two competing attempts giving one winner were verified. Baseline Supabase security-advisor warnings remain unrelated to #198. A later Vercel Sandbox successfully installed Chromium/Playwright while another ephemeral DB `oywotbmnsroaeblqttpf` accepted migrations; automatic test-user authentication was blocked by execution security tooling, so **authenticated browser E2E was not completed**. Both ephemeral DB branches have been deleted; sandbox stopped; final Supabase branch readback showed only `main`. **No production credential, DB apply, or release changes.**

**Revised acceptance boundary:** #198 *code/schema as files* is integrated into `develop`; authenticated full browser + isolated DB E2E and production schema/release approval remain separate, explicit gates before operating with real books. Its present queue only creates candidate `legal_review` tasks; it does **not** create `edit_text` tasks, content revisions, or final book clearance. The #196 dual-reader test is PC-first editorial UI; mobile editorial multi-pane test was waived by the architect (consumer Reader remains mobile).

**Immediate next implementation:** create a separate feature branch from current `develop` for canonical P1-2C1 transactional promotion **and** a safe bridge to real `edit_text` tasks. Review/reuse `docs/prototypes/ARTALES_P1_2C1_EPHEMERAL_PROOF_V2.sql` only as an untrusted starting artifact, and respect `docs/ARTALES_EDITORIAL_TASK_CONTRACT_V1_2026-10-10.md`. Do not promote simply because a model/fixture marked rights `clear`: require concrete edition/source-specific reviewed component decisions, auditable provenance, immutable snapshot/evidence binding before treating the output as publication-capable; fail closed when these are absent. Create at most one draft/task per source/candidate transaction, with rollback and genuine two-session negative tests; after that integrate a bounded admin catalog run, persisted per-run budget/cost ceilings and eventually paid source research. Never use Nexus workers or modify second-thread Reader fixture sources.

### Updated next-thread startup prompt

> Pokračujeme v hlavním vývoji ARTales. Načti aktuální `develop` (po merge #196/#197/#198 je checkpoint HEAD `41a55757cb87`), `main`, `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, `docs/ARTALES_DURABLE_CHECKPOINT.md`, `docs/ARTALES_PHOENIX_2026-10-10_MAIN.md` a `docs/ARTALES_EDITORIAL_TASK_CONTRACT_V1_2026-10-10.md`. Ověř živý stav #199 i nových integračních PR a Supabase branches. #196 Reader fixture, #197 katalog/rights syntetický plánovač a #198 candidate legal-review fronta jsou merged do develop; neznamená to produkční DB apply či funkční automatické publikování. Autentizované browser E2E proti dočasné databázi ještě chybí. Pokračuj na nové feature větvi nejmenším skutečným transakčním obloukem: kandidát + konkrétní zdroj + auditované důkazy → jediný koncept → redakční edit_text task. Když chybí důvěryhodné právní/snapshot podklady, fail closed; nedělej falešný clearance. Následně propojit s ruční admin dávkou, rozpočtovým limitem a editor UI. Druhé vlákno vlastní Reader/Composer a source-anchored QA. Žádné Nexus workers, zásahy do main ani produkční Supabase bez samostatné autorizace. Každý merge zvlášť; ephemeral branch jen na krátké testy a po testu smazat.

**Historical snapshot warning:** sections below this reconciliation describe the state *before* #196/#197/#198 merged. Retain as provenance only; do not follow their former PR order or old readiness/HEAD claims as current instructions.

---

> NON-AUTHORITATIVE checkpoint. Live code, database, `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, and fresh user authorization always override these notes. Written to close a very long main thread and restart safely. No merge or production DB apply is implied.

## Product mandate

ARTales is live, with users, roles, existing published content, and production data. Goal is an **admin-triggered, bounded pilot** producing publishable, commercially usable books rather than merely harvesting candidate records: admin specifies title count and budget; ARTales generates/extends a balanced candidate list (genre/author variety), cheap prescreens, performs machine-first evidence-backed component-wise rights/edition checks, skips or escalates bad candidates and continues until sufficient eligible titles or limits are reached, prepares one draft per title, then creates ARTales-native editor tasks. Editors claim tasks, compare original vs ARTales Reader, submit source-anchored issues, obtain targeted corrections, accept a reviewed revision; visual work (e.g. later assignment to Ivana/Ajwen via verified user profile) and publishing follow. Publication and legal takedown/reversion are separately controlled and audited. Full autonomy is **not required now**; a manually fired admin batch is preferred. No mandatory Nexus worker queue. Actual money spend is acceptable within a defined, explicitly approved per-run cap, but **no live paid executor exists yet**.

Rights snapshots should separate original work text, specific edition/transcription, translation, illustration/assets, wrapper and metadata. Keep immutable snapshot hashes and archived evidence per component. Machine/AI research prepares decisions; deterministic gate checks evidence, jurisdiction and commercial reuse rights; human/owner review is by exception or challenge, not a manual legal checklist for every editor. Compact verdict: text yes/no, edition yes/no, translation yes/no, illustrations yes/no, recommended feasible release version and cost. Dossier history and future downloadable evidence package; archived evidence is not legal immunity. If a commercial rights claim becomes credible, hold/unpublish through separately authorized control while retaining full history. “Structurally valid” synthetic evidence **is not legal clearance**.

## Verified live repository state at checkpoint

Repo: `ARTalesAdmin/ARTales`.
- `main` production head: `171df191eb54dbcef7bb015f748138c630428b2f`.
- `develop` integration/preview head: `4f630c4a581ef85c70b25ea6c9f3ecb6050a7c88`.
- PR #194 (candidate source/rights readback) and PR #195 (candidate promotion fixture/read-only scaffold) **already merged into develop**. None of the currently open three PRs are merged.
- `#196` [Ingest / Composer / source-anchored Reader QA](https://github.com/ARTalesAdmin/ARTales/pull/196), head `8e52b7f24948f3921614b01b953863dc191d7688`, draft, GitHub mergeable, Vercel success at this exact head. Its base started before #195; diff still appears additive. A second chat owns the Reader/fixture work, currently paused for coordination. No DB writes, no real Reader pagination; `localStorage` fixture reports/approval only. Its author reports targeted tests passed; confirm details/live state.
- `#197` [Catalog batch fixture + component rights policy](https://github.com/ARTalesAdmin/ARTales/pull/197), head `173b0b91cb62a75fe28c0ae2c06fa8afe8951cb2`, draft, GitHub mergeable, Vercel success at exact head. Provides pure `lib/rightsScanDossier.ts`, `lib/catalogProductionPlanner.ts`, synthetic admin UI `/member/admin/catalog-production`, preview legal dossier `/lab/rights-scan`, and test files. **Not** real AI sourcing, paid jobs, persisted catalog run, verified law, DB writes or actual editor task creation. New Node tests were authored but not independently run.
- `#198` [ARTales editor task inbox](https://github.com/ARTalesAdmin/ARTales/pull/198), head `296f35e540fe87fb3da04ddcc0e44d1ec4670ce1`, draft, GitHub mergeable and Vercel success at exact head. Contains migration `supabase/migrations/20261010111107_artales_editorial_tasks_pilot.sql`, task & history tables, RLS, `SECURITY INVOKER` public RPCs for admin candidate legal-review enqueue, editor/admin atomic claim/return, private audit triggers, and UI routes `/member/editorial-tasks`, `/member/admin/queue-candidates`. No production apply, no actual work editing/finishing yet. **New in #198**: `docs/ARTALES_EDITORIAL_TASK_CONTRACT_V1_2026-10-10.md` aligning cross-thread IDs and anchors, created on #198 branch at commit `296f35e540fe87fb3da04ddcc0e44d1ec4670ce1`. NOTE: PR #198 and #197 both edit `app/member/admin/dashboard/page.tsx`; merge sequentially and resolve.
- PR #160 existing account-synced Reader progress is open and unrelated; do not mix casually.

Checkpoint branch for this file: `docs/artales-phoenix-main-20261010`, from exact develop head. Keep as a documentation-only draft PR. No main or production DB changes.

## Database proof and limitations

Production Supabase project `nmhdwmszbwgrgfbmlguu`: **candidate schema foundation/persistence migrations from develop not yet applied to production**, and inbox migration not applied either. Do not use production to run candidate/task pilot or assume feature works there.

Ephemeral Supabase branch experiments (already deleted after tests; last list_branches confirmed only production main):
1. P1-2C1 prototype V2 was applied with candidate migrations on isolated temporary DB. Synthetic authenticated editor/author/source/rights produced **one `works` draft and one promotion audit** after two sequential RPC calls; `ROLLBACK` restored zero rows. Not proven: truly concurrent promotion, partial-failure rollback, role matrix or production integration. **Prototype lives in `docs/prototypes/ARTALES_P1_2C1_EPHEMERAL_PROOF_V2.sql`, not a production migration**, and real editor provenance persistence is missing.
2. PR #198 migration was applied successfully with candidate migrations on another ephemeral. Synthetic admin duplicate enqueue yielded exactly one legal-review task and one created event. Editor claimed, repeated claim was unavailable, returned; final 3 audit events, then `ROLLBACK` zero rows. `SECURITY INVOKER` public RPCs, no anon execute, unauthenticated call rejected. Not proven: two simultaneous real connections, full real JWT role matrix, client/browser E2E, direct-column bypass negative tests and trigger adversarial cases. Security advisors surfaced **pre-existing** project issues; no blanket “all green” claim.
3. Both ephemeral branches were deleted and branch list showed only main. Long-lived staging remains intentionally declined for cost. Prior rate $0.01344/hour (reconfirm before future session); use ephemeral only for active tests, remove before session end.

## Shared cross-thread contract and ownership

Full contract: [Editorial Task Contract v1](https://github.com/ARTalesAdmin/ARTales/blob/feat/artales-editorial-task-inbox-pilot-20261010/docs/ARTALES_EDITORIAL_TASK_CONTRACT_V1_2026-10-10.md).
- Candidate: `work_candidates.id` UUID; selected source: `work_candidate_sources.id` UUID, tied to candidate and component-rights rows.
- Persistent work: `works.id` UUID; existing work has edition metadata columns but **no physical editions or work-revisions table** verified.
- Propose immutable `snapshotSetRef`, `workRevisionRef` only as logical identifiers until independently migrated/approved.
- Durable editorial task: `editorial_tasks.id` UUID; exactly one of `candidate_id` and `work_id`. Candidate task is currently **legal_review**, never a guarantee of publication eligibility. Actual `edit_text` and `visuals` tasks target a `work_id` after source clearance + draft promotion.
- PR #196 fixture issues: `sourceId`, `componentId`, half-open text span `[start,end)`, `block.id` string, optionally boundary between blocks. Durable issues must also bind snapshot/revision refs. Physical page numbers and viewport are diagnostics, not stable IDs.
- PR #196 has editor-local issue and acceptance, not persisted/reviewed tasks. Future separate migration and PR must implement submit → review → returned/accepted → complete with versioned source-aware change history.
- Coordination comment written into PR #196 discussion (issue comment ID `6097230625`), confirming second thread exclusively owns composer / fixture Reader / source-anchored issues and measured pagination follow-ups. Main thread owns rights/catalog administration, queue storage/RLS and backend integration. No duplicate file editing across threads.

## Integration order

1. **PR #196**: independent visual/mobile QA, validate current head, build and test evidence, ensure production route disabled; if semantically correct, request/obtain explicit merge approval and merge into `develop`. Do not count fixture localStorage as real task persistence.
2. **PR #197**: run its actual Node tests and inspect catalog/rights semantic failure modes (especially proof-hash trust, commercial rights flags, budget refills). Resolve any issues and integrate next; ensure latest develop.
3. **PR #198**: update against new develop, reconcile overlapping admin dashboard link; complete independent concurrency, real role/RLS and browser E2E with temporary Supabase, check security advisors. Only then merge to develop after authorization. Code merge and production DB apply are separate.
4. Next small PR: trusted capture/dossier binding + approved P1-2C1 canonical migration + server-side candidate→draft; actual `edit_text` task creation; manual admin batch persistence, idempotent run/token and server budget bound; later AI source discovery/screen and paid bounded execution.
5. Parallel after contract: second thread adapter to persistent source spans/revision references, editor issue submission, change review and measured Reader pagination. Preserve text integrity and source components.

Avoid long scaffolding loops: prioritize **one complete synthetic/ephemeral vertical slice** demonstrating admin-triggered candidate → draft → editor task → claim and editorial QA. Real retrieval and legal publication clearance come only after trusted evidence path is proven.

## Additional risks and governance
- `main` production users/data. Only feature branches from current develop and PR to develop. No implicit production merge, Supabase DB apply or environment secrets change.
- On current develop and main, candidate rights schema and editor task queue cannot yet be used against production. Production preview routes that depend on missing tables may show unavailable states; never label them functional.
- New `SECURITY DEFINER` private triggers still require body/role review; public RPCs are SECURITY INVOKER. Row-level access, trigger history and direct table column mutation need adversarial tests.
- Non-prod fixture content and mocked rights claims may pass structural tests but **never prove a book is commercially usable**.
- Work ID stable, source edition snapshot immutable, work revision and editorial task separate.
- No automatic publication or take-down is active. Publication and legal challenge hold/revert need separately approved releases.
- User asked for an end-of-day Phoenix handoff and a ready-to-copy startup prompt for new main thread.

## Ready-to-copy opening prompt for the next MAIN thread

> Pokračujeme v hlavním vývoji ARTales po Phoenix 2026-10-10. Pracujeme současně ve druhém vlákně na ingestu/Readeru. Načti z `ARTalesAdmin/ARTales`: `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, `docs/ARTALES_DURABLE_CHECKPOINT.md`, `docs/ARTALES_PHOENIX_2026-10-10_MAIN.md` (zatím v dokumentačním PR #199, dokud nebude mergnuto) a `docs/ARTALES_EDITORIAL_TASK_CONTRACT_V1_2026-10-10.md` (zatím v PR #198). Ověř aktuální `develop`, `main`, Supabase branches a otevřené PR #196/#197/#198/#199. Neodvozuj aktuální stav pouze ze starých checkpointů.
>
> Cíl: admin ručně zadá požadovaný počet **komerčně vydatelných titulů** a rozpočet, ARTales vybírá/doplňuje kandidáty s rovnováhou žánrů/autorů, dělá levný prescreen, strojový/AI právní sken konkrétních edic a oddělených komponent (text/překlad/ilustrace/metadata/wrapper), archivuje důkazy/snapshoty, připraví jen bezpečně způsobilé koncepty a založí editorskou práci v interní frontě. Editor si úkol převezme, zkontroluje text a Reader, vrátí ukotvenou připomínku, schválí opravenou revizi; vizuály a publikace navazují se samostatnými branami. Právní kontrola je primárně strojová, člověk řeší výjimky. První pilot může být admin-only a nemusí být plně autonomní. Nexus worker queue nepoužívej.
>
> Rozdělení: PR #196/vlastní druhé vlákno vlastní ingest/composer/Reader; naše hlavní vlákno vlastní katalog/práva (#197), editor task backend/inbox (#198), serverové propojení, audit a rozpočtovou politiku. Contract v1 je v #198, koordinační zpráva je přímo v #196. Nekolidovat na stejných souborech.
>
> Priorita: nejdřív zreviduj #196 (zelený Vercel ≠ vizuální E2E), potom #197 (spustit reálné Node testy a QA), #198 (po aktualizaci vůči novému develop, vyřešit společný admin dashboard, dokončit concurrency/RLS/adversarial QA na krátké ephemeral Supabase a smazat). Merge pouze po kontrole a autorizaci. Produkční `main` a Supabase nech nedotčené; produkční DB apply vyžaduje samostatnou autorizaci. Pak implementuj nejmenší skutečný serverový vertical slice admin dávka → kandidát → ověřený source dossier → koncept → editor úkol, ne další pouhou simulaci. Výslovně odlišuj implementované, otestované a plánované. Po prvním kroku připrav další kontrolovatelné PR.
