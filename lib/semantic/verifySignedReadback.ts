import {createHash} from "node:crypto";
import {verifySemanticRevision} from "./compose";
import type {SemanticRevision,SemanticReviewIssue} from "./model";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
const own=(value:unknown):value is Record<string,unknown> =>
  value!==null && typeof value==="object" && !Array.isArray(value);
const hash=(value:string)=>createHash("sha256").update(value,"utf8").digest("hex");
export type VerifiedEditorDraft=Readonly<{
  work_id:string;work_slug:string;draft_id:string;source_snapshot_id:string;
  source_sha256:string;revision:SemanticRevision;
  pending_issue:SemanticReviewIssue|null;
  previous_return:SemanticReviewIssue|null;
  publication_allowed:false;
}>;
function validateIssue(value:unknown, revision:SemanticRevision):SemanticReviewIssue|null{
  if(value===null)return null;
  if(!own(value)||typeof value.id!=="string"||typeof value.target_atom_id!=="string"||
    typeof value.parent_revision_ref!=="string"||typeof value.round!=="number"||
    value.disposition!=="returned_for_changes"||!own(value.source_anchor)||
    typeof value.reason!=="string"||typeof value.requested_layout!=="string")
    throw Error("Unverified editor return");
  // Additional recipe validation is done in the Composer when applied.
  if(value.parent_revision_ref!==revision.revision_ref&&
     !revision.review_issues.some(issue=>issue.id===value.id))
    throw Error("Unrelated editor return");
  return value as SemanticReviewIssue;
}
/**
 * Verify the signed RPC readback envelope in a server-only editor pathway.
 * The RPC must already have checked auth.uid and editor assignment.
 * This validator cannot replace identity/RLS checks or prove archived source bytes.
 */
export function verifySignedReadback(value:unknown,expected:{work_id:string;slug:string}):VerifiedEditorDraft{
  if(!own(value)||value.result!=="ready"||value.publication_allowed!==false||
     typeof value.work_id!=="string"||value.work_id!==expected.work_id||
     typeof value.work_slug!=="string"||value.work_slug!==expected.slug||
     typeof value.draft_id!=="string"||!uuid.test(value.draft_id)||
     typeof value.source_snapshot_id!=="string"||!uuid.test(value.source_snapshot_id)||
     typeof value.source_sha256!=="string"||!hex.test(value.source_sha256)||
     typeof value.revision_sha256!=="string"||!hex.test(value.revision_sha256)||
     typeof value.serialized_payload!=="string"||
     Buffer.byteLength(value.serialized_payload,"utf8")>1_500_000)
    throw Error("Untrusted signed editor readback");
  if(hash(value.serialized_payload)!==value.revision_sha256)
    throw Error("Editor readback digest mismatch");
  let json:unknown;
  try{json=JSON.parse(value.serialized_payload);}catch{throw Error("Invalid serialized editor revision");}
  if(!own(json)||"revision_sha256" in json||"revision_ref" in json)
    throw Error("Untrusted embedded revision metadata");
  const revision={
    ...json,revision_sha256:value.revision_sha256,
    revision_ref:"sha256:"+value.revision_sha256,
  } as SemanticRevision;
  verifySemanticRevision(revision);
  if(revision.work_id!==expected.work_id||revision.work_slug!==expected.slug||
     revision.source.source_bytes_sha256!==value.source_sha256||
     revision.source.source_snapshot_ref!=="sha256:"+value.source_sha256||
     revision.release_allowed!==false||
     value.round!==revision.round||
     (revision.round===0 && value.parent_draft_id!==null)||
     (revision.round>0 &&
       (typeof value.parent_draft_id!=="string"||!uuid.test(value.parent_draft_id))))
    throw Error("Editor work, source or parent mismatch");
  const previous=value.previous_return??null,pending=value.pending_issue??null;
  if(revision.round===0&&previous!==null)throw Error("Initial revision has unexpected return");
  if(revision.round>0&&(!own(previous)||!revision.review_issues.some(issue=>
     issue.id===previous.id&&issue.parent_revision_ref===previous.parent_revision_ref)))
    throw Error("Missing or unrelated ancestor review");
  if(pending!==null&&(!own(pending)||pending.parent_revision_ref!==revision.revision_ref))
    throw Error("Pending review does not target head");
  return Object.freeze({
    work_id:value.work_id,work_slug:value.work_slug,draft_id:value.draft_id,
    source_snapshot_id:value.source_snapshot_id,source_sha256:value.source_sha256,
    revision,pending_issue:validateIssue(pending,revision),
    previous_return:previous as SemanticReviewIssue|null,publication_allowed:false,
  });
}
