/** Pure, side-effect-free pre-acquisition guard for one-shot Snapshot writes. */
export type SnapshotPreflight = "start" | "already_archived" | "claim_without_receipt";
export function deriveSnapshotPreflight(hasReceipt: boolean, hasClaim: boolean): SnapshotPreflight {
  // Receipt takes precedence for a safely archived historical import such as #389.
  if (hasReceipt) return "already_archived";
  // A claim can represent ongoing work or a failed partial attempt.
  // Neither case permits another acquisition, claim or upload.
  if (hasClaim) return "claim_without_receipt";
  return "start";
}
