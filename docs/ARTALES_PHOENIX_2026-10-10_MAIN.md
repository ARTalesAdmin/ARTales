# ARTales Phoenix — 2026-10-10: main-thread integration handoff

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
