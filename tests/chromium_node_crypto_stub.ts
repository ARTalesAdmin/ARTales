// The actual paginator imports revision verification from compose.ts, which imports
// Node crypto. Chromium fixture never seals/verifies revisions. Throw if reached.
export function createHash(): never {
 throw new Error("Unexpected revision hashing inside Chromium pagination fixture");
}
