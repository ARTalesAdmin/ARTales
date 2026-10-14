/** Exact signed GoTrue/PostgREST cycle on disposable localhost only. Not live ARTales data. */
import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {execFileSync,spawnSync} from "node:child_process";
import {composeFromCapturedDbA} from "../../lib/semantic/dbAComponentBridge";
import {decodeSignedPilotSource,serializeSignedDraft} from "../../lib/semantic/selfPilotDraft";
import {recomposeSemanticLayout,walkSemanticAtoms,verifySemanticRevision} from "../../lib/semantic/compose";
import type {SemanticRevision,SemanticReviewIssue} from "../../lib/semantic/model";

const sha=(data:string|Uint8Array)=>createHash("sha256").update(data).digest("hex");
const settings=JSON.parse(execFileSync("supabase",["status","-o","json"],{encoding:"utf8"}));
const api=String(settings.API_URL??"");
const anon=String(settings.ANON_KEY??""),service=String(settings.SERVICE_ROLE_KEY??"");
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(api)||!anon||!service||
   process.env.PGHOST!=="127.0.0.1"||process.env.PGPORT!=="54322"||
   process.env.SUPABASE_ACCESS_TOKEN||process.env.SUPABASE_DB_PASSWORD)
  throw Error("E2 signed QA refuses cloud or non-loopback services");
type ResponseData={
 id?:string;user?:{id?:string};access_token?:string;result?:string;reason?:string;
 draft_id?:string;issue_id?:string;issue?:SemanticReviewIssue;publication_allowed?:boolean;
 raw?:string;serialized_payload?:string;parent_draft_id?:string|null;previous_return?:{id?:string};[key:string]:unknown;
};
type RequestResult={status:number;data:ResponseData};
async function request(path:string,token:string,body?:unknown,method="POST"):Promise<RequestResult>{
 const response=await fetch(api+path,{method,headers:{
  apikey:anon,Authorization:"Bearer "+token,"Content-Type":"application/json",
  Prefer:"return=representation"
 },...(body===undefined?{}:{body:JSON.stringify(body)})});
 const txt=await response.text();
 let data:ResponseData;
 try{
  const parsed:unknown=JSON.parse(txt);
  data=parsed!==null&&typeof parsed==="object"
   ? parsed as ResponseData : {raw:"non-object RPC response"};
 }catch{data={raw:txt.slice(0,250)}}
 return {status:response.status,data};
}
type Actor={id:string;token:string;email:string;role:string};
const tag=randomUUID().slice(0,8);
const pass="Qa-"+randomUUID()+"!Ab";
async function actor(role:string):Promise<Actor>{
 const email="e2-"+role+"-"+tag+"@example.invalid";
 const created=await request("/auth/v1/admin/users",service,{email,password:pass,email_confirm:true});
 if(![200,201].includes(created.status)||!created.data.id)throw Error("Local GoTrue user creation failed: "+role);
 const signed=await request("/auth/v1/token?grant_type=password",anon,{email,password:pass});
 if(signed.status!==200||signed.data.user?.id!==created.data.id||!signed.data.access_token)
  throw Error("Signed GoTrue password login failed: "+role);
 return {id:created.data.id,token:signed.data.access_token,email,role};
}
async function main():Promise<void>{
const authors=await Promise.all(["admin","adminReviewer","editor","reader"].map(actor));
const [admin,reviewer,editor,reader]=authors;
const workId=randomUUID(),otherWork=randomUUID(),authorId=randomUUID(),sourceId=randomUUID(),componentId=randomUUID();
const sourceText="CHAPTER I. Test\n\nA short paragraph.\n\nCHAPTER II. More\n\nAnother short paragraph.";
const bytes=Buffer.from(sourceText,"utf8"),sourceDigest=sha(bytes);
const fixtureSql=[
 "begin;",
 "insert into public.profiles(id,email,display_name,role,is_active) values",
 "(:'admin_id',:'admin_email','E2 Author','admin',true),",
 "(:'review_id',:'review_email','E2 Independent Reviewer','admin',true),",
 "(:'editor_id',:'editor_email','E2 Editor','editor',true),",
 "(:'reader_id',:'reader_email','E2 Reader','reader',true)",
 "on conflict(id) do update set role=excluded.role,is_active=excluded.is_active;",
 "insert into public.authors(id,name,slug,created_by,updated_by)",
 "values(:'author_id','QA Synthetic Author',:'author_slug',:'admin_id',:'admin_id');",
 "insert into public.works(id,title,slug,summary,content,canonical_language,origin_type,source_label,status,primary_author_id,created_by,updated_by)",
 "values(:'work_id','Synthetic E2 Work',:'work_slug',repeat('Synthetic review reference. ',12),'Synthetic immutable text','en','original','original','draft',:'author_id',:'admin_id',:'admin_id'),",
 "(:'other_work','Unrelated E2 Work',:'other_slug',repeat('Synthetic review reference. ',12),'Other synthetic immutable text','en','original','original','draft',:'author_id',:'admin_id',:'admin_id');",
 "insert into artales_evidence.source_snapshots(id,work_id,kind,source_uri,source_bytes)",
 "values(:'source_id',:'work_id','external_raw','fixture://local-signed-e2',decode(:'bytes_hex','hex'));",
 "insert into artales_evidence.source_components(id,snapshot_id,kind,byte_start,byte_end,disposition,explanation)",
 "values(:'component_id',:'source_id','WORK_CONTENT',0,octet_length(decode(:'bytes_hex','hex')),'qa_text_only','Synthetic local source component');",
 "commit;"
].join("\n");
const vars:{[key:string]:string}={
 admin_id:admin.id,admin_email:admin.email,review_id:reviewer.id,review_email:reviewer.email,
 editor_id:editor.id,editor_email:editor.email,reader_id:reader.id,reader_email:reader.email,
 author_id:authorId,author_slug:"e2-author-"+tag,
 work_id:workId,work_slug:"e2-work-"+tag,other_work:otherWork,other_slug:"e2-other-"+tag,
 source_id:sourceId,component_id:componentId,bytes_hex:bytes.toString("hex")
};
const args=["-h","127.0.0.1","-p","54322","-U","postgres","-d","postgres","-X","-v","ON_ERROR_STOP=1",
 ...Object.entries(vars).flatMap(([k,v])=>["-v",k+"="+v])];
const seeded=spawnSync("psql",args,{input:fixtureSql,encoding:"utf8",
 env:{...process.env,PGPASSWORD:"postgres"}});
if(seeded.status!==0)throw Error("Local fixture seed failed: "+seeded.stderr.slice(0,1300));
const {revision,original_raw}=composeFromCapturedDbA({
 work_id:workId,work_slug:vars.work_slug,snapshot_id:sourceId,snapshot_sha256:sourceDigest,
 source_bytes:bytes,component_id:componentId,component_kind:"WORK_CONTENT",
 disposition:"qa_text_only",byte_start:0,byte_end:bytes.length
});
verifySemanticRevision(revision,original_raw);
function saveArgs(r:SemanticRevision,parent:string|null,req:string){
 const {revision_sha256,revision_ref,...body}=r;
 void revision_ref;
 const serialized=JSON.stringify(body);
 assert.equal(sha(serialized),revision_sha256);
 return {p_work_id:workId,p_source_snapshot_id:sourceId,p_component_id:componentId,
  p_serialized_payload:serialized,p_expected_sha256:revision_sha256,
  p_parent_draft_id:parent,p_request_id:req};
}
const rpc=(person:Actor,fn:string,args:unknown)=>request("/rest/v1/rpc/"+fn,person.token,args);
const stage="stage_semantic_v2_draft",returnFn="return_semantic_v2_revision";
// Architect-only pilot: one real admin JWT, same identity claiming an editor task.
const choices=await rpc(admin,"list_semantic_v2_self_sources",{p_work_id:workId});
if(choices.status!==200||choices.data.result!=="ready"||
  !Array.isArray(choices.data.sources)||choices.data.sources.length!==1||
  choices.data.sources[0].snapshot_id!==sourceId)
 throw Error("Signed archived source selector did not return exact fixture source");
const otherChoices=await rpc(editor,"list_semantic_v2_self_sources",{p_work_id:workId});
assert.equal(otherChoices.data.reason,"admin_required");
const selfQueued=await rpc(admin,"enqueue_semantic_v2_self_pilot",{
 p_work_id:workId,p_source_snapshot_id:sourceId,p_request_id:randomUUID()
});
if(selfQueued.status!==200||selfQueued.data.result!=="queued_for_review"||!selfQueued.data.task_id)
 throw Error("Self-pilot enqueue failed "+JSON.stringify(selfQueued));
const selfTaskId=String(selfQueued.data.task_id);
const taskHidden=await request("/rest/v1/editorial_tasks?select=id&id=eq."+selfTaskId,editor.token,undefined,"GET");
assert.equal(taskHidden.status,200);
assert.ok(Array.isArray(taskHidden.data)&&taskHidden.data.length===0,
 "Other editors must not see architect self-pilot");
const wrongClaim=await rpc(editor,"claim_editorial_task",{p_task_id:selfTaskId});
assert.ok(wrongClaim.status>=400||wrongClaim.data.result!=="claimed","Foreign editor claimed private pilot");
const ownClaim=await rpc(admin,"claim_editorial_task",{p_task_id:selfTaskId});
if(ownClaim.status!==200||ownClaim.data.result!=="claimed")throw Error("Own task claim failed "+JSON.stringify(ownClaim));
const ownReplay=await rpc(admin,"enqueue_semantic_v2_self_pilot",{
 p_work_id:workId,p_source_snapshot_id:sourceId,p_request_id:selfQueued.data.task_id
});
assert.equal(ownReplay.data?.reason,"work_already_queued");
const privateTask=await request("/rest/v1/editorial_tasks?select=id&id=eq."+selfTaskId,admin.token,undefined,"GET");
if(privateTask.status!==200||!Array.isArray(privateTask.data)||privateTask.data.length!==1)
 throw Error("Owner cannot read private self pilot");

const privateSource=await rpc(admin,"get_semantic_v2_self_source",{p_work_id:workId});
if(privateSource.status!==200||privateSource.data.result!=="ready")throw Error("Signed source unavailable");
const sourceInput=decodeSignedPilotSource(privateSource.data,{work_id:workId,slug:vars.work_slug});
assert.equal(sourceInput.snapshot_sha256,sourceDigest);
assert.equal(Buffer.from(sourceInput.source_bytes).toString("utf8"),sourceText);
assert.equal(serializeSignedDraft(revision).sha256,revision.revision_sha256);
const foreignSource=await rpc(editor,"get_semantic_v2_self_source",{p_work_id:workId});
assert.equal(foreignSource.data.reason,"admin_required");
const readerSource=await rpc(reader,"get_semantic_v2_self_source",{p_work_id:workId});
assert.equal(readerSource.data.reason,"admin_required");

const requestId=randomUUID(),initial=saveArgs(revision,null,requestId);
const deniedReader=await rpc(reader,stage,initial);
assert.equal(deniedReader.data?.reason,"editor_role_required");
const deniedEditor=await rpc(editor,stage,initial);
assert.equal(deniedEditor.data?.reason,"claimed_work_task_required");
const foreign=await rpc(admin,stage,{...initial,p_work_id:otherWork,p_request_id:randomUUID()});
assert.equal(foreign.data?.result,"blocked");
const badDigest=await rpc(admin,stage,{...initial,p_request_id:randomUUID(),p_expected_sha256:"f".repeat(64)});
assert.equal(badDigest.data?.reason,"revision_digest_mismatch");
const first=await rpc(admin,stage,initial);
if(first.status!==200||first.data.result!=="saved_draft"||!first.data.draft_id||
   first.data.publication_allowed!==false)throw Error("Initial signed draft failed "+JSON.stringify(first));
const initialRead=await rpc(admin,"get_semantic_v2_editor_state",{p_work_id:workId});
if(initialRead.status!==200||initialRead.data.result!=="ready"||
 initialRead.data.draft_id!==first.data.draft_id||
 initialRead.data.serialized_payload!==initial.p_serialized_payload)
 throw Error("Signed E2 first-read mismatch "+JSON.stringify(initialRead));
const readerRead=await rpc(reader,"get_semantic_v2_editor_state",{p_work_id:workId});
assert.equal(readerRead.data.reason,"editor_role_required");
const editorRead=await rpc(editor,"get_semantic_v2_editor_state",{p_work_id:workId});
assert.equal(editorRead.data.reason,"claimed_work_task_required");
const repeat=await rpc(admin,stage,initial);
assert.equal(repeat.data.result,"already_saved");
assert.equal(repeat.data.draft_id,first.data.draft_id);
const target=walkSemanticAtoms(revision.blocks).find(a=>a.raw.includes("A short paragraph"));
assert.ok(target);
const retArgs={p_work_id:workId,p_draft_id:first.data.draft_id,
 p_expected_sha256:revision.revision_sha256,p_target_atom_id:target.id,
 p_reason:"Change indentation of this specific source atom.",p_request_id:randomUUID()};
const self=await rpc(admin,returnFn,retArgs);
if(self.status!==200||self.data?.reason!=="self_review_forbidden")throw Error("Self-review denial mismatch "+JSON.stringify(self));
const retReader=await rpc(reader,returnFn,retArgs);
assert.equal(retReader.data?.reason,"editor_role_required");
const ret=await rpc(reviewer,returnFn,retArgs);
if(ret.status!==200||ret.data.result!=="returned_for_changes"||!ret.data.issue)
 throw Error("Independent signed return failed "+JSON.stringify(ret));
const replayReturn=await rpc(reviewer,returnFn,retArgs);
assert.equal(replayReturn.data.result,"already_returned");
const changedReason=await rpc(reviewer,returnFn,{...retArgs,p_reason:"Unrelated change",p_request_id:retArgs.p_request_id});
assert.equal(changedReason.data.reason,"idempotency_key_reuse");
const issue=ret.data.issue as SemanticReviewIssue;
const next=recomposeSemanticLayout(revision,issue,original_raw);
const child=saveArgs(next,first.data.draft_id,randomUUID());
const unsolved=await rpc(admin,stage,{...child,p_serialized_payload:initial.p_serialized_payload,
 p_expected_sha256:initial.p_expected_sha256,p_request_id:randomUUID()});
assert.equal(unsolved.data.result,"blocked");
const second=await rpc(admin,stage,child);
if(second.status!==200||second.data.result!=="saved_draft"||!second.data.draft_id)
 throw Error("Signed child revision failed "+JSON.stringify(second));
const latestRead=await rpc(admin,"get_semantic_v2_editor_state",{p_work_id:workId});
if(latestRead.status!==200||latestRead.data.result!=="ready"||
 latestRead.data.draft_id!==second.data.draft_id||
 latestRead.data.parent_draft_id!==first.data.draft_id||
 latestRead.data.previous_return?.id!==ret.data.issue_id||
 latestRead.data.serialized_payload!==child.p_serialized_payload||
 latestRead.data.publication_allowed!==false)
 throw Error("Signed E2 child-read mismatch "+JSON.stringify(latestRead));
const stale=await rpc(admin,stage,{...child,p_request_id:randomUUID()});
assert.equal(stale.data.reason,"stale_parent");
const staleReturn=await rpc(reviewer,returnFn,{...retArgs,p_request_id:randomUUID()});
assert.equal(staleReturn.data.reason,"stale_revision");
const direct=await request("/rest/v1/semantic_v2_drafts",admin.token,
 {work_id:workId,revision_sha256:sha("forged")});
assert.ok(direct.status>=400,"Direct private draft table write unexpectedly open");
const anonymous=await rpc({id:"",email:"",role:"anon",token:anon},stage,{...initial,p_request_id:randomUUID()});
assert.ok(anonymous.status>=400||anonymous.data.result==="blocked");
const query=spawnSync("psql",["-h","127.0.0.1","-p","54322","-U","postgres","-d","postgres","-X",
 "-At","-c","select status::text from public.works where id='"+workId+"'"],{encoding:"utf8",
 env:{...process.env,PGPASSWORD:"postgres"}});
assert.equal(query.status,0);
assert.equal(query.stdout.trim(),"draft");
console.log("PASS actual signed admin self-assigned editor task, private to same identity");
console.log("PASS signed local E2 admin/editor/reader GoTrue sessions, admin independent review");
console.log("PASS stored initial revision, anchored return, applied child revision and immutable source");
console.log("PASS replay, stale parent, self-review, reader/editor denial, cross-work, direct-table denial");
console.log("PASS public work remained draft; release not modified; NO legal/publishing authorization");

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
