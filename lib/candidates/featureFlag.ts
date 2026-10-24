/**
 * ARTales Candidates A+B release switch.
 * FAIL CLOSED on production until separately authorized production DB migration,
 * signed-role verification and explicit activation release.
 * Never infer availability from deploy/branch/environment.
 * This intentionally has NO runtime environment override.
 */
export const CANDIDATES_AB_ENABLED = true;
