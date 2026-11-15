import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {composeSemanticRevision,recomposeSemanticBatch,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
import {planQaProposalReview} from "../lib/semantic/qaProposalReview";
import type {AiQaSuggestion} from "../lib/semantic/aiQaProposalEngine";
const text=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sha=(x:string)=>createHash("sha256").update(x).digest("hex");
const id=(i:number)=>"12345678-1234-4123-8123-"+String(i).padStart(12,"0");
function fixture(){
 const raw=Array.from({length:24},(_,i)=>"Sample paragraph "+i+
  " has real source text which must survive immutable revisions.").join("\n\n");
 const revision=composeSemanticRevision({work_id:"mixed-qa",work_slug:"mixed-qa",
  snapshot_ref:"sha256:"+sha("archived-snapshot"),source_bytes_sha256:sha(raw),
  component_id:"text",original_byte_start:0,original_raw:raw});
 return {raw,revision,atoms:walkSemanticAtoms(revision.blocks)};
}
test("mixed 20-finding plan covers five exclusions and fifteen other decisions",()=>{
 const flags=Array.from({length:20},(_,i)=>({
  id:id(i),status:"open",kind:i<5?"text":i<15?"typography":"other",
  comment:i<5?"Smazat, smazat, smazat.":i<15?"Zarovnat odstavce.":"Prověřit návrh."}));
 const proposals:AiQaSuggestion[]=flags.map((f,i)=>({
  flagId:f.id,term:"",rationale:"Editor requested change",targetAtomIds:[],
  action:i<5?"manual_review":i<15?"center":"manual_review",
  editorialIntent:i<5?"exclude_from_edition":"none"
 }));
 const decisions=flags.map(f=>({flagId:f.id,choice:"approve" as const}));
 const plan=planQaProposalReview(proposals,flags,decisions);
 assert.equal(plan.exclusions.length,5);
 assert.equal(plan.layout.length,10);
 assert.equal(plan.confirmedNoChange.length,5);
 assert.equal(plan.rejected.length,0);
 const {raw,revision,atoms}=fixture();
 assert(atoms.length>=20);
 const changes=[
  ...plan.exclusions.map((x,i)=>({flagId:x.flagId,atomId:atoms[i].id,
   reason:flags[i].comment,kind:"exclude_from_edition" as const})),
  ...plan.layout.map((x,i)=>({flagId:x.flagId,atomId:atoms[i+5].id,
   reason:flags[i+5].comment,kind:"block_presentation" as const,
   presentation:{align:"center" as const,indent:"none" as const,
    space_before:"normal" as const,space_after:"normal" as const}}))
 ];
 const revised=recomposeSemanticBatch(revision,changes,raw);
 verifySemanticRevision(revised,raw);
 assert.equal(revised.editorial_exclusions?.length,5);
 assert.equal(revised.review_issues.length-revision.review_issues.length,15);
 assert.equal(revised.round,revision.round+1);
 assert.equal(revised.source.normalized_text_sha256,revision.source.normalized_text_sha256);
 assert.deepEqual(walkSemanticAtoms(revised.blocks).map(a=>a.raw),atoms.map(a=>a.raw));
});
test("mixed approval can reject or defer findings without losing the editable QA task",()=>{
 const flags=Array.from({length:20},(_,i)=>({id:id(i),status:"open",kind:"typography",
  comment:i<5?"Smazat.":"Sazba."}));
 const suggestions:AiQaSuggestion[]=flags.map((f,i)=>({flagId:f.id,
  action:i<5?"manual_review":"center",
  editorialIntent:i<5?"exclude_from_edition":"none",
  rationale:"review",term:"",targetAtomIds:[]}));
 const choices=flags.map((f,i)=>({flagId:f.id,choice:i>=17?"reject" as const:"approve" as const}));
 const plan=planQaProposalReview(suggestions,flags,choices);
 assert.equal(plan.exclusions.length,5);
 assert.equal(plan.layout.length,12);
 assert.equal(plan.rejected.length,3);
 const sql=text("supabase/migrations/20261115154959_artales_mixed_ai_qa_commit.sql");
 assert.match(sql,/v_carried:=v_carried\+1/);
 assert.match(sql,/insert into public\.artales_semantic_qa_flags\(candidate_id,revision_sha256/);
 assert.match(sql,/status='claimed'/);
 assert.match(sql,/raise exception 'qa_flag_race'/);
 assert.match(sql,/raise exception 'followup_qa_missing'/);
});
test("database gate is one service-only atomic transaction with no partial mutation",()=>{
 const sql=text("supabase/migrations/20261115154959_artales_mixed_ai_qa_commit.sql");
 const action=text("app/member/semantic/[candidateId]/qa-proposal-actions.ts");
 const worker=text("app/api/internal/editorial/ai-qa-jobs/route.ts");
 assert.match(sql,/create or replace function public\.artales_commit_editorial_review_batch/);
 assert.match(sql,/language plpgsql security definer set search_path/);
 assert.match(sql,/current_setting\('request\.jwt\.claim\.role',true\)<>'service_role'/);
 assert.match(sql,/revoke all on function public\.artales_commit_editorial_review_batch/);
 assert.match(sql,/to service_role;/);
 assert.match(sql,/invalid_protected_term/);
 assert.match(sql,/changed_source_or_structure/);
 assert.match(sql,/unattributed_exclusion/);
 assert.match(sql,/unattributed_layout/);
 assert.match(sql,/older_unresolved_flags/);
 assert.match(sql,/rollback|raise exception|return pg_catalog\.jsonb_build_object/);
 assert.match(action,/artales_commit_editorial_review_batch/);
 assert.match(action,/plan\.exclusions/);
 assert.match(action,/plan\.layout/);
 assert.match(action,/plan\.protectedTerms/);
 assert.match(action,/plan\.rejected/);
 assert.doesNotMatch(action,/saveWorkTypographyRule\(|resolveSemanticQaFlag\(/);
 assert.match(worker,/requiresEditorialExclusion/);
});
