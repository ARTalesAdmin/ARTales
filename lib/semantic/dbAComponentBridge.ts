import {createHash} from "node:crypto";
import {composeSemanticRevision,verifySemanticRevision} from "./compose";
import type {SemanticRevision} from "./model";
const sha=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type CapturedDbASource={
 work_id:string;work_slug:string;snapshot_id:string;
 snapshot_sha256:string;source_bytes:Uint8Array;
 component_id:string;component_kind:"WORK_CONTENT";
 disposition:"qa_text_only";byte_start:number;byte_end:number;
};
/** Trusted, server-side read of exact immutable DB-A bytes; NEVER accept client-supplied bytes as capture evidence. */
export function composeFromCapturedDbA(input:CapturedDbASource):{revision:SemanticRevision;original_raw:string}{
 if(!uuid.test(input.work_id)||!uuid.test(input.snapshot_id)||!uuid.test(input.component_id)||
  !input.work_slug||input.component_kind!=="WORK_CONTENT"||input.disposition!=="qa_text_only"||
  !/^[a-f0-9]{64}$/.test(input.snapshot_sha256)||sha(input.source_bytes)!==input.snapshot_sha256)
  throw Error("Untrusted DB-A source identity or digest");
 if(!Number.isSafeInteger(input.byte_start)||!Number.isSafeInteger(input.byte_end)||
  input.byte_start<0||input.byte_end<=input.byte_start||input.byte_end>input.source_bytes.length)
  throw Error("Untrusted DB-A component boundary");
 const bytes=Buffer.from(input.source_bytes).subarray(input.byte_start,input.byte_end);
 const original_raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
 if(Buffer.byteLength(original_raw,"utf8")!==bytes.length)throw Error("Lossy source encoding");
 const revision=composeSemanticRevision({
  work_id:input.work_id,work_slug:input.work_slug,
  snapshot_ref:"sha256:"+input.snapshot_sha256,source_bytes_sha256:input.snapshot_sha256,
  component_id:input.component_id,original_byte_start:input.byte_start,original_raw,
 });
 verifySemanticRevision(revision,original_raw);
 if(revision.source.original_byte_end!==input.byte_end)throw Error("Mismatched byte end");
 return {revision,original_raw};
}
