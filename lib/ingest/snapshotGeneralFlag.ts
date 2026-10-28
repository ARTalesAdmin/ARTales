/** Explicit independent activation gate. Off unless reviewed DB/RLS/backfill,
 * production deployment, and an Architect-approved env change are complete. */
export const SNAPSHOT_GENERAL_V1_ENABLED = process.env.ARTALES_SNAPSHOT_GENERAL_V1 === "enabled";
