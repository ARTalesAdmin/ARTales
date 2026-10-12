import {inspectLegacyCutover,type LegacyCutoverProof} from "./releasePreflight";

/**
 * Immutable routing decision; it does not query the database or switch a release.
 * All values must later be reconstructed server-side from trusted stored records.
 */
export type ReaderRoutingProof=Readonly<{
 workId:string;slug:string;
 currentPublishedReleaseId:string;
 activeRevision:"legacy"|"semantic_v2";
 proposedRevision:"legacy"|"semantic_v2";
 targetReleaseId:string;
 editorialState:"draft"|"returned"|"approved";
 rightsState:"pending"|"approved";
 readerQaState:"pending"|"passed";
 expectedWorkVersion:number;
 observedWorkVersion:number;
 cutover:LegacyCutoverProof|null;
 explicitAdminAuthorization:boolean;
}>;
export type ReaderRouteDecision=Readonly<{
 eligibleForAtomicSwitch:boolean;
 mode:"legacy"|"semantic_v2";
 blockers:readonly string[];
 retainLegacyRollback:true;
}>;
export function inspectReaderRevisionRouting(input:ReaderRoutingProof):ReaderRouteDecision{
 const blockers:string[]=[];
 if(!input.workId||!input.slug||!input.currentPublishedReleaseId||
  !input.targetReleaseId)blockers.push("identity_or_release_missing");
 if(!Number.isSafeInteger(input.expectedWorkVersion)||input.expectedWorkVersion<0||
  input.expectedWorkVersion!==input.observedWorkVersion)blockers.push("work_version_changed");
 if(input.editorialState!=="approved")blockers.push("editorial_not_approved");
 if(input.rightsState!=="approved")blockers.push("rights_not_approved");
 if(input.readerQaState!=="passed")blockers.push("reader_qa_not_passed");
 if(!input.explicitAdminAuthorization)blockers.push("authorization_missing");
 if(input.proposedRevision!=="semantic_v2")blockers.push("target_not_semantic");
 if(input.activeRevision!=="legacy")blockers.push("not_legacy_cutover");
 if(input.targetReleaseId===input.currentPublishedReleaseId)blockers.push("same_release");
 if(!input.cutover)blockers.push("cutover_proof_missing");
 else{
  if(input.cutover.workId!==input.workId||input.cutover.slug!==input.slug)
   blockers.push("cutover_identity_mismatch");
  blockers.push(...inspectLegacyCutover(input.cutover).blockers);
 }
 return {
  eligibleForAtomicSwitch:blockers.length===0,
  // Only the future committed pointer may determine a public route.
  // This pure preflight always leaves the existing Reader untouched.
  mode:input.activeRevision,
  blockers:[...new Set(blockers)],
  retainLegacyRollback:true,
 };
}
