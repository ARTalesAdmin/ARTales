import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {composeSemanticRevision,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
import {selectEditorialEdition} from "../lib/semantic/editionProjection";
import {getSemanticPageUnits,projectSemanticReader,verifyReaderProjection} from "../lib/semantic/readerProjection";
import {getOmittedQaAtoms} from "../lib/semantic/qaFindingProjection";
import {planQaProposalReview} from "../lib/semantic/qaProposalReview";
import {prepareQaPresentationBatch} from "../lib/semantic/qaBatchPreparation";
import type {AiQaSuggestion} from "../lib/semantic/aiQaProposalEngine";
import type {SemanticNode} from "../lib/semantic/model";

const sha=(text:string)=>createHash("sha256").update(text).digest("hex");
const id=(index:number)=>"10000000-1111-4111-8111-"+String(index).padStart(12,"0");
const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("source → 20 flags → AI choices → shared batch preview → Reader/QA projection",async()=>{
 const candidateId=id(900);
 const raw=Array.from({length:26},(_,i)=>
  "Paragraph "+(i+1)+": Raymond met Goethe in Werther's garden. "+
  "This original text must survive immutable redaction from the public edition."
 ).join("\n\n");
 const original=composeSemanticRevision({work_id:candidateId,work_slug:"synthetic-qa-flow",
  snapshot_ref:"sha256:"+sha("immutable-archive"),source_bytes_sha256:sha(raw),
  component_id:"synthetic",original_byte_start:0,original_raw:raw});
 const atoms=walkSemanticAtoms(original.blocks);
 assert.equal(atoms.length,26);
 const flags=Array.from({length:20},(_,i)=>({
  id:id(i+1),status:"open",kind:i<5?"text":i<15?"typography":"other",
  comment:i<5?"Smazat, smazat, smazat.":i<15?"Změnit sazbu.":"Ověřit výraz.",
  target_atom_id:atoms[i].id,revision_sha256:original.revision_sha256
 }));
 const ai:AiQaSuggestion[]=flags.map((f,i)=>({
  flagId:f.id,action:i<5?"manual_review":i<15?"center":i<18?"protect_term":"manual_review",
  editorialIntent:i<5?"exclude_from_edition":"none",
  term:i>=15&&i<18?["Raymond","Goethe","Werther"][i-15]:"",
  targetAtomIds:[],rationale:"Synthetic editor-reviewed AI suggestion"
 }));
 const choices=flags.map((f,i)=>({flagId:f.id,choice:i<18?"approve" as const:"reject" as const}));
 const plan=planQaProposalReview(ai,flags,choices);
 assert.deepEqual([plan.exclusions.length,plan.layout.length,plan.protectedTerms.length,plan.rejected.length],
  [5,10,3,2]);
 const repairs=[
  ...plan.exclusions.map(f=>({flagId:f.flagId,action:"exclude_note" as const})),
  ...plan.layout
 ];
 // Mock only the two Supabase SELECTs, not the preparation/composition logic.
 // The production code prepares the exact same immutable JSON revision.
 const query={
  select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},
  maybeSingle(){return Promise.resolve({data:{revision:original,source_text:raw,
   revision_sha256:original.revision_sha256},error:null});},
  in(){return Promise.resolve({data:flags.filter(f=>repairs.some(r=>r.flagId===f.id)),error:null});}
 };
 const mockDb={from:()=>query} as unknown as Parameters<typeof prepareQaPresentationBatch>[1];
 const prepared=await prepareQaPresentationBatch({candidateId,
  revisionSha:original.revision_sha256,repairs},mockDb);
 assert.equal(prepared.ok,true,prepared.ok?"prepared":prepared.message);
 if(!prepared.ok)return;
 const updated=prepared.revision;
 verifySemanticRevision(updated,raw);
 assert.equal(updated.round,1);
 assert.equal(updated.review_issues.length-original.review_issues.length,15);
 assert.equal(updated.editorial_exclusions?.length,5);
 assert.equal(updated.source.normalized_text,raw);
 assert.equal(updated.source.normalized_text_sha256,original.source.normalized_text_sha256);
 assert.deepEqual(walkSemanticAtoms(updated.blocks).map(a=>a.raw),atoms.map(a=>a.raw));
 assert.deepEqual(walkSemanticAtoms(updated.blocks).map(a=>a.anchor),atoms.map(a=>a.anchor));

 const range=selectEditorialEdition(raw).range;
 const before=getSemanticPageUnits(original,range);
 const after=getSemanticPageUnits(updated,range);
 const visible=new Set(after.flatMap(u=>u.source_atom_ids));
 assert.equal(before.length,26);
 assert.equal(after.length,21);
 const omitted=getOmittedQaAtoms(updated);
 for(let i=0;i<26;i++){
  if(i<5){
   assert.equal(visible.has(atoms[i].id),false,"Excluded atom appeared in Reader");
   assert.equal(omitted[atoms[i].id]?.reason,"editorial_exclusion");
  }else assert.equal(visible.has(atoms[i].id),true,"Nonexcluded source atom lost");
 }
 const align=new Map<string,string>();
 function visit(nodes:readonly SemanticNode[]){
  for(const n of nodes){
   if(n.kind==="chapter"||n.kind==="section")visit(n.children);
   else if("atom" in n)align.set(n.atom.id,n.presentation?.align??"");
  }
 }
 visit(updated.blocks);
 for(let i=5;i<15;i++)assert.equal(align.get(atoms[i].id),"center");
 const pages=projectSemanticReader(updated,{mode:"paged",viewport_width:700,
  viewport_height:900,font_scale:1,editionRange:range});
 const verified=verifyReaderProjection(updated,pages,range);
 assert.equal(verified.ok,true);
 assert(pages.length>0);
});

test("real UI and server actions share the exact mixed QA source-to-revision path",()=>{
 const page=source("app/member/semantic/[candidateId]/page.tsx");
 const panel=source("components/editor/SemanticQaPanel.tsx");
 const review=source("components/editor/SemanticAiProposalReview.tsx");
 const server=source("app/member/semantic/[candidateId]/qa-proposal-actions.ts");
 const worker=source("app/api/internal/editorial/ai-qa-jobs/route.ts");
 const jobs=source("app/member/semantic/[candidateId]/ai-job-actions.ts");
 const lab=source("components/editor/SemanticReaderLab.tsx");
 const publicReader=source("components/reader/SemanticPublicReader.tsx");
 const finish=source("app/member/semantic/[candidateId]/qa-actions.ts");
 const sql=source("supabase/migrations/20261115154959_artales_mixed_ai_qa_commit.sql");
 assert.match(panel,/enqueueSemanticAiQaJob\(/);
 assert.match(panel,/job\.appliedRevisionSha===p\.revisionSha/);
 assert.match(panel,/job\.appliedRevisionSha\?\<p\>Nová opravná revize/);
 assert.match(jobs,/artales_enqueue_ai_qa_job/);
 assert.match(worker,/artales_claim_ai_qa_job/);
 assert.match(worker,/generateSemanticAiQaSuggestions\(input,db\)/);
 assert.match(worker,/artales_finish_ai_qa_job/);
 assert.match(worker,/requiresEditorialExclusion/);
 assert.match(review,/lastSemanticAiQaJob/);
 assert.match(review,/previewSemanticQaBatch\(/);
 assert.match(review,/applyReviewedQaProposals\(/);
 assert.match(server,/planQaProposalReview\(/);
 assert.match(server,/prepareQaPresentationBatch\(/);
 assert.match(server,/artales_commit_editorial_review_batch/);
 assert.match(sql,/status='claimed'/);
 assert.match(sql,/applied_revision_sha256=coalesce\(v_new_sha,p_parent_sha\)/);
 assert.match(sql,/j\.applied_revision_sha256 IS NULL/);
 assert.match(page,/SemanticReaderLab revision=\{revision\}/);
 assert.match(page,/flags=\{qaFlags\?\?\[\]\}/);
 assert.match(lab,/getSemanticPageUnits\(activeRevision,edition\.range\)/);
 assert.match(lab,/getOmittedQaAtoms\(revision\)/);
 assert.match(publicReader,/getSemanticPageUnits\(revision,edition\.range\)/);
 assert.match(finish,/artales_finish_semantic_text_qa/);
});

test("unsuitable requests cannot silently pass as a completed edit",()=>{
 const flags=[{id:id(1),status:"open",kind:"text",comment:"Smazat."}];
 const bad:AiQaSuggestion[]=[{flagId:id(1),action:"manual_review",
  editorialIntent:"none",term:"",targetAtomIds:[],rationale:"No change."}];
 assert.throws(()=>planQaProposalReview(bad,flags,[{flagId:id(1),choice:"approve"}]),
  /vyřazení|beze změny/);
 const partial=[{id:id(2),status:"open",kind:"text",comment:"Smazat jen první slovo."}];
 const partialSuggestion:AiQaSuggestion[]=[{flagId:id(2),action:"manual_review",
  editorialIntent:"none",term:"",targetAtomIds:[],rationale:"Unimplemented"}];
 assert.throws(()=>planQaProposalReview(partialSuggestion,partial,[{flagId:id(2),choice:"approve"}]),
  /části textu/);
 assert.deepEqual(planQaProposalReview(partialSuggestion,partial,[{flagId:id(2),choice:"reject"}]).rejected,[id(2)]);
 const pending=planQaProposalReview(bad,flags,[{flagId:id(1),choice:"reject"}]);
 assert.deepEqual(pending.rejected,[id(1)]);
});
