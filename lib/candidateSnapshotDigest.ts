import { createHash, timingSafeEqual } from "node:crypto"

/** Server-only: validates real source bytes, never a model-provided digest alone. */
export function verifySourceBytes(bytes: Uint8Array, expectedSha256: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expectedSha256)) return false
  const actual = createHash("sha256").update(bytes).digest()
  const expected = Buffer.from(expectedSha256, "hex")
  return timingSafeEqual(actual, expected)
}

export type CapturedSourceBytes = {
  componentId: string
  expectedSha256: string
  bytes: Uint8Array | null
}

/** Every included component must have retrieved bytes and matching digest. */
export function validateIncludedSourceBytes(
  includedComponents: readonly CapturedSourceBytes[],
): {verified: boolean; missingOrMismatched: string[]} {
  const failures: string[] = []
  const seen = new Set<string>()
  if (includedComponents.length === 0) return {verified:false,missingOrMismatched:["no_included_components"]}
  for(const c of includedComponents){
    if(!c.componentId || seen.has(c.componentId) || !c.bytes ||
       !verifySourceBytes(c.bytes,c.expectedSha256)) failures.push(c.componentId || "invalid_component_id")
    seen.add(c.componentId)
  }
  return {verified:failures.length===0,missingOrMismatched:failures}
}
