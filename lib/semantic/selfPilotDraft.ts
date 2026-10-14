import {createHash} from "node:crypto";
import {composeFromCapturedDbA,type CapturedDbASource} from "./dbAComponentBridge";
import {verifySemanticRevision} from "./compose";
import type {SemanticRevision} from "./model";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex=/^[a-f0-9]{64}$/;

/** This is a PRIVATE server-side pilot, never a general editor or a production feature. */
export function selfPilotAllowed(input:{
 actorId:string;configuredActorId:string|undefined;deployment:string|undefined;
 connectionEnabled:boolean;connectionReason:string;
}):boolean {
 return uuid.test(input.actorId) && uuid.test(input.configuredActorId??"") &&
  input.actorId.toLowerCase()===input.configuredActorId?.toLowerCase() &&
  input.deployment!=="production" &&
  input.connectionEnabled &&
  (input.connectionReason==="local" || input.connectionReason==="ephemeral");
}
export function decodeSignedPilotSource(value:unknown,expected:{work_id:string;slug:string}):CapturedDbASource {
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw Error("Pilot source envelope missing");
 const v=value as Record<string,unknown>;
 if(v.result!=="ready"||v.publication_allowed!==false||v.work_id!==expected.work_id||
   v.work_slug!==expected.slug || typeof v.snapshot_id!=="string"||!uuid.test(v.snapshot_id)||
   typeof v.component_id!=="string"||!uuid.test(v.component_id)||
   typeof v.source_sha256!=="string"||!hex.test(v.source_sha256)||
   v.component_kind!=="WORK_CONTENT"||v.disposition!=="qa_text_only"||
   typeof v.byte_start!=="number"||typeof v.byte_end!=="number"||
   !Number.isSafeInteger(v.byte_start)||!Number.isSafeInteger(v.byte_end)||
   typeof v.source_base64!=="string"||v.source_base64.length>1_500_000||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.source_base64))
  throw Error("Untrusted signed source metadata");
 const bytes=Buffer.from(v.source_base64,"base64");
 if(bytes.length<1||bytes.length>1_048_576||bytes.toString("base64")!==v.source_base64)
  throw Error("Untrusted base64 source bytes");
 const input:CapturedDbASource={
  work_id:expected.work_id,work_slug:expected.slug,
  snapshot_id:v.snapshot_id,snapshot_sha256:v.source_sha256,source_bytes:bytes,
  component_id:v.component_id,component_kind:"WORK_CONTENT",disposition:"qa_text_only",
  byte_start:v.byte_start as number,byte_end:v.byte_end as number,
 };
 // Independent byte digest, Unicode integrity, source spans and Composer structure.
 composeFromCapturedDbA(input);
 return input;
}
export function serializeSignedDraft(revision:SemanticRevision):{
 serialized:string;sha256:string;
}{
 verifySemanticRevision(revision);
 const {revision_ref:_ref,revision_sha256:_sha,...body}=revision;
 void _ref;void _sha;
 const serialized=JSON.stringify(body);
 const sha256=createHash("sha256").update(serialized,"utf8").digest("hex");
 if(sha256!==revision.revision_sha256||Buffer.byteLength(serialized,"utf8")>1_500_000)
  throw Error("Noncanonical or oversized semantic revision");
 return {serialized,sha256};
}
