# Reader migration — first whole-work shadow cutover

The existing public `/reader/[slug]` uses `getWorkBySlug()`, `content_blocks`, fallback text, `ReaderClient`, and existing entitlement rules. **Do not replace this live route yet.** New SemanticRevision v2 is distinct and requires a versioned release pointer with a dedicated signed DB authorization, not an overwrite of works.content_blocks.

## Incremental migration
1. Pin canonical source and archive old observed publication and every existing note/progress/bookmark state for one work. Preserve work UUID/slug.
2. Perform signed editorial QA, rights component selection, old/new comparison and release review.
3. Shadow project the final revision in full / preview and desktop/mobile spread/scroll, compare text byte coverage, test remapped reader positions. Any approximate map retains original stored position.
4. Explicitly authorize atomic per-work revision-pointer change with server-side exact-head and rights recheck. Other works remain on the old Reader. Keep a rollback pointer and validate entitlements before/after.
5. Only after multiple works pass can the same per-work transaction be orchestrated in batches. No mass overwrite, no user data deletion.

`inspectReaderCutoverDryRun` is a pure shadow planner tested on the **full pinned twelve-chapter Alice**, with synthetic observed-legacy digest and sample reader positions. It tests positive projection, exact and approximate note mapping and fail-closed cases. **The positive fixture's `manual_reader_qa` boolean is synthetic and does not represent browser-tested real Alice.** The function never writes SQL or authorizes publication.

Risk HIGH (future Reader path); current PR read-only pure functions/tests. Target develop first. DB no. Env no. Rollback revert PR. Test: exact-head CI, TypeScript, lint, no public reader change. Remaining: actual legacy snapshot, signed approved revision, inventory of real reader notes, browser QA and approved atomic SQL release pointer. No prod DB apply, main, or paid branch.
