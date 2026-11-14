# ARTales – author identity / release contract, source-only plan (2026-11-14)

## Observed producer-consumer mismatch

- Production linking and evidence trigger accept exact author names and a guarded, uniquely matching longer author name; canonical publication accepts exact only. For Carmilla, candidate byline is `Sheridan Le Fanu`, linked author `Joseph Sheridan Le Fanu`, and the exact release comparator rejects it.
- On initial revision insertion, `artales_auto_enqueue_semantic_tasks` omits both author tasks for an existing *exact* author; publication previously required a completed row for both tasks unconditionally.

## Proposed changes limited to the existing publication function

The source-only SQL draft replaces only `public.artales_publish_semantic_candidate` and preserves all pre-existing legal lock, immutable snapshot readback, QA, cover and portrait Storage, author bilingual text, collection, authorization, transaction and audit checks.

1. Match the linked author's candidate byline by exact name or bounded surname suffix. Count **all** matching author rows and require exactly one match, and require the linked author ID be that unique row. Ambiguous candidates fail closed.
2. Always require completed `cover_art`, `work_description`, `collection_curation` tasks.
3. For each author task, if **any** task row exists for the candidate/kind, require a completed row; a missing task is not treated as completed. Only when no task was created do we allow a narrow exception: linked author exists since **at or before the first semantic revision**, its name is an exact case-insensitive match to the candidate byline, and all independent biography/portrait evidence is still verified by the existing publication function. This mirrors the original trigger's intentional skip. Later-created authors fail closed.
4. Do not modify current editorial assignments, task records, escalation statuses, source bytes or anything else; existing production code continues to work until a separately authorized database apply.

## Negative regression cases before any apply

- Carmilla: uniquely matched `Sheridan Le Fanu` → `Joseph Sheridan Le Fanu`, with real completed bio+portrait tasks, may pass author identity only; other independent release gates remain.
- Two different authors with matching last-name suffix → fail.
- `Le Fanu` / `von Goethe` short ambiguous byline → fail unless exact match.
- New author after first revision, no author tasks → fail.
- One author task present but incomplete → fail, even if bio/portrait fields are populated.
- Exact pre-existing author, no author tasks, present since initial revision and full bio/portrait with Storage assets → may pass author task-existence check.
- Missing bilingual bio, cover, portrait, legal approval, text QA or snapshot proof → fail as before.

## Execution gate and rollback

**No SQL executed.** Before migration: inspect live `pg_get_functiondef`, compare with the source captured for this PR, verify migration/DB drift; obtain an actual restore-ready backup and test the draft function and negative cases in an authorized isolated DB or transactionally safe controlled environment. Obtain separate explicit approval for production SQL. Preserve the current production function definition as the rollback artifact; run readback after change, monitor errors and real editor-to-publication handoff. No backfill.

## Scope / risk

High; DB yes **if applied**; Env no; only a pre-review SQL proposal now. Deployment order: review and preflight → authorized DB migration → readback → role-scoped publication acceptance, separately authorized. Application code is not modified here.
