import type {SupabaseClient} from "@supabase/supabase-js";
import {verifySemanticRevision,walkSemanticAtoms,recomposeSemanticBatch} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const sha=/^[a-f0-9]{64}$/;

export type EditorialBatchAction="exclude_note"|"compact"|"airy"|"center";
export type QaBatchInput={
 candidateId:string;revisionSha:string;repairs:{flagId:string;action:EditorialBatchAction}[]
};
export type QaBatchPreviewResult=QaMutationResult&{
 revision?:SemanticRevision;affectedAtomIds?:string[];
};

/** The same verified plan powers preview and commit. No text mutation is supported. */
export async function prepareQaPresentationBatch(input:QaBatchInput,db:SupabaseClient):Promise<
 {ok:true;revision:SemanticRevision;atomIds:string[]}|{ok:false;message:string}
>{
 const fail=(message:string)=>({ok:false as const,message});
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha)||
   !Array.isArray(input.repairs)||input.repairs.length<1||input.repairs.length>50||
   new Set(input.repairs.map(x=>x.flagId)).size!==input.repairs.length||
   input.repairs.some(x=>!uuid.test(x.flagId)||
    !["exclude_note","compact","airy","center"].includes(x.action)))
  return fail("Neplatná nebo prázdná opravná dávka.");
 const [{data:previous,error:readError},{data:flags,error:flagsError}]=await Promise.all([
  db.from("candidate_semantic_revisions").select("revision,source_text,revision_sha256")
   .eq("candidate_id",input.candidateId)
   .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("artales_semantic_qa_flags")
   .select("id,kind,comment,target_atom_id,status,revision_sha256")
   .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
   .eq("status","open").in("id",input.repairs.map(x=>x.flagId))
 ]);
 if(readError||!previous||previous.revision_sha256!==input.revisionSha||
    flagsError||!flags||flags.length!==input.repairs.length)
  return fail("Revize nebo její nálezy již nejsou aktuální.");
 try{
  const original=previous.revision as SemanticRevision;
  verifySemanticRevision(original,previous.source_text);
  const flagged=new Map(flags.map(f=>[f.id,f]));
  const sourceAtoms=walkSemanticAtoms(original.blocks);
  const atomIndex=new Map(sourceAtoms.map(a=>[a.id,a]));
  const changes=input.repairs.map(repair=>{
   const flag=flagged.get(repair.flagId);
   if(!flag||flag.status!=="open")throw Error("Missing flag");
   const atom=atomIndex.get(flag.target_atom_id);
   if(!atom)throw Error("Missing exact atom");
   if(repair.action==="exclude_note"){
    // Only an editor-selected, explicitly recorded apparatus exclusion.
    // AI is NOT allowed to recommend this action.
    if(!["structure","other"].includes(flag.kind)||
       !/^\\s*(?:NOTE[.\\u2014: -]|TRANSCRIBER)/im.test(atom.raw))
     throw Error("A literary paragraph must not be excluded.");
    return {flagId:flag.id,atomId:atom.id,reason:flag.comment,
     kind:"exclude_from_edition" as const};
   }
   if(!["typography","structure"].includes(flag.kind))
    throw Error("This finding is not a presentation fix.");
   const presentation=repair.action==="compact"
    ?{align:"left" as const,indent:"none" as const,
      space_before:"none" as const,space_after:"none" as const}
    :repair.action==="airy"
    ?{align:"left" as const,indent:"none" as const,
      space_before:"normal" as const,space_after:"generous" as const}
    :{align:"center" as const,indent:"none" as const,
      space_before:"normal" as const,space_after:"normal" as const};
   return {flagId:flag.id,atomId:atom.id,reason:flag.comment,
    kind:"block_presentation" as const,presentation};
  });
  const revision=recomposeSemanticBatch(original,changes,previous.source_text);
  const afterAtoms=walkSemanticAtoms(revision.blocks);
  if(sourceAtoms.length!==afterAtoms.length||
     sourceAtoms.some((a,i)=>a.id!==afterAtoms[i].id||
       a.raw!==afterAtoms[i].raw||
       a.source_sha256!==afterAtoms[i].source_sha256||
       JSON.stringify(a.anchor)!==JSON.stringify(afterAtoms[i].anchor)))
   throw Error("Editorial text or source anchor was changed.");
  if(revision.source.normalized_text_sha256!==original.source.normalized_text_sha256||
     JSON.stringify(revision.gaps)!==JSON.stringify(original.gaps))
   throw Error("Source or separators have been changed.");
  return {ok:true,revision,atomIds:changes.map(x=>x.atomId)};
 }catch{
  return fail("Oprava přesahuje bezpečné formátování. Nálezy zůstávají otevřené.");
 }
}

