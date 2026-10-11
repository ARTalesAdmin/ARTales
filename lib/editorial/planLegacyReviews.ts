/** Pure, read-only planning. Not an authorization or an editorial task write. */
export type ReviewWork = {
  workId: string; title: string; sourcePinned: boolean;
  semanticRevisionReady: boolean; rights: "cleared"|"needs_review"|"blocked";
  risk: "ordinary"|"heightened"; status: "published"|"draft";
};
export type EditorCapacity = { userId: string; role: "editor"|"admin"; active: boolean; capacity: number };
export type PlannedReview = {
  workId: string; title: string; assigneeUserId: string|null;
  stage: "legal_review"|"source_recovery"|"semantic_composition"|"editorial_review"|"legal_block";
  reason: string;
};
export function planLegacyReviews(
  works: readonly ReviewWork[], staff: readonly EditorCapacity[],
  adminId: string, pilotIds: readonly string[],
): PlannedReview[] {
  const active = staff.filter(s=>s.active && Number.isSafeInteger(s.capacity) && s.capacity>=0);
  if (!active.some(s=>s.userId===adminId && s.role==="admin")) throw Error("active administrator required");
  if(new Set(works.map(w=>w.workId)).size!==works.length || new Set(active.map(s=>s.userId)).size!==active.length) throw Error("duplicate identity");
  const remaining=new Map(active.map(s=>[s.userId,s.capacity]));
  const pilots=new Set(pilotIds);
  const order=[...works].sort((a,b)=>Number(pilots.has(b.workId))-Number(pilots.has(a.workId)) || a.title.localeCompare(b.title));
  return order.map(w=>{
    const stage:PlannedReview["stage"]=w.rights==="blocked"?"legal_block":
      w.rights==="needs_review"||w.risk==="heightened"?"legal_review":
      !w.sourcePinned?"source_recovery":!w.semanticRevisionReady?"semantic_composition":"editorial_review";
    // No editor work item is created for unverified/blocked legal content.
    if(stage!=="editorial_review")return {workId:w.workId,title:w.title,assigneeUserId:null,stage,reason:"prerequisite not verified"};
    const available=active.filter(s=>(remaining.get(s.userId)??0)>0);
    const assignee=pilots.has(w.workId)
      ?available.find(s=>s.userId===adminId)
      :available.sort((a,b)=>(remaining.get(b.userId)??0)-(remaining.get(a.userId)??0)||a.userId.localeCompare(b.userId))[0];
    if(assignee)remaining.set(assignee.userId,remaining.get(assignee.userId)!-1);
    return {workId:w.workId,title:w.title,assigneeUserId:assignee?.userId??null,stage,
      reason:assignee?"proposed only; server must verify work/revision, rights and actor":"capacity exhausted"};
  });
}
