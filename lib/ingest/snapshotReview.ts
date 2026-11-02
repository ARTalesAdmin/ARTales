export type SnapshotReview = {candidate_id:string;snapshot_sha256:string;text_correspondence:"confirmed"|"needs_review"|"rejected";image_disposition:"exclude_all"|"requires_separate_review";evidence_note:string};
export function parseSnapshotReview(form:URLSearchParams,candidateId:string,sha:string):SnapshotReview {
 const keys=["candidate_id","snapshot_sha256","text_correspondence","image_disposition","evidence_note"];
 if([...form.keys()].length!==keys.length||keys.some(k=>form.getAll(k).length!==1)||
  form.get("candidate_id")!==candidateId||form.get("snapshot_sha256")!==sha||
  !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(candidateId)||!/^[a-f0-9]{64}$/.test(sha)||
  !["confirmed","needs_review","rejected"].includes(form.get("text_correspondence")??"")||
  !["exclude_all","requires_separate_review"].includes(form.get("image_disposition")??"")||
  (form.get("evidence_note")??"").trim().length<80||(form.get("evidence_note")??"").length>4000)
   throw Error("snapshot_review_invalid");
 return {candidate_id:candidateId,snapshot_sha256:sha,
  text_correspondence:form.get("text_correspondence") as SnapshotReview["text_correspondence"],
  image_disposition:form.get("image_disposition") as SnapshotReview["image_disposition"],
  evidence_note:(form.get("evidence_note")??"").trim()};
}
