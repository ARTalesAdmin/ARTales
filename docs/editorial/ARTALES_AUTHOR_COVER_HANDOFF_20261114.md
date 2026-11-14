# ARTales – author create/link and cover readback (2026-11-14)

## Scope
Application-only, no schema or migration; initial main SHA e3927c1be69b83c42cf9b608c7331ad2db35f4c9.

**Author task input/output:** claimed author task → canonical candidate ID and byline → internally saved draft author (or matching existing record) → identity-bound `artales_save_candidate_editorial_field` → independent readback of `artales_candidate_editorial_metadata.author_id` → separate existing bio and portrait task evidence gates. The author form is only allowed to omit bilingual biography requirements in a candidate context, after server-side actor/claimed-task verification. New author remains private. General author creation still requires bilingual text. Failure after insert leaves ID for explicit recoverable link; never auto-delete or create duplicate.

**Cover input/output:** file in `artales-images` → guarded cover metadata RPC → independent readback of path and alt → existing task completion RPC and audited DB trigger. Automatic discovery on work-card opening when no linked cover is present; editor must choose among multiple uploads. In particular Pan and Werther contain two files each but no candidate cover link (as observed at 2026-11-14).

**Limit:** no historic data backfill. No evidence that pre-existing failed upload transactions were caused by the same specific bug; resolve them with authenticated editor retry and observe the exact error. Preview actor-bound test remains required. Rollback: revert this app-only PR; authors or tasks created by users after deployment are durable data and must not be deleted by code rollback.
