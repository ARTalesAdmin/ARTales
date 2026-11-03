/** Shared RFC 4122 UUID validation for production candidate-bound ingestion.
 * Matches the shape accepted by the existing Snapshot technical-evidence route.
 */
export function isCandidateUuid(value:unknown):value is string{
 return typeof value==="string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
