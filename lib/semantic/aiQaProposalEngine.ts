import {requestArtalesAiResponse} from "@/lib/semantic/artalesAiGateway";
import type {ArtalesAiUsage} from "@/lib/semantic/aiGatewayUsage";
import type {SupabaseClient} from "@supabase/supabase-js";
import {verifySemanticRevision,walkSemanticAtoms} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";

/** Suggestions ONLY. No semantic revision, source text or QA status is changed here. */
export type AiQaSuggestion={
 flagId:string;
 action:"compact"|"airy"|"center"|"protect_term"|"manual_review";
 term:string;
 rationale:string;
};
export type AiQaSuggestResult={ok:boolean;message:string;suggestions:AiQaSuggestion[];usage?:ArtalesAiUsage|null};
const sha=/^[a-f0-9]{64}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions=new Set(["compact","airy","center","protect_term","manual_review"]);
const text=(s:string,limit:number)=>s.length>limit?s.slice(0,limit)+" [zkráceno]":s;

export async function generateSemanticAiQaSuggestions(input:{
 candidateId:string;revisionSha:string;editorId:string;expectedFlagIds?:string[]
},db:SupabaseClient):Promise<AiQaSuggestResult>{
 const fail=(message:string,usage:ArtalesAiUsage|null=null):AiQaSuggestResult=>({ok:false,message,suggestions:[],usage});
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha))
  return fail("Neplatná identita díla nebo revize.");
 const [{data:record,error:revisionError},{data:flags,error:flagError}]=await Promise.all([
  db.from("candidate_semantic_revisions").select("revision,source_text,revision_sha256")
   .eq("candidate_id",input.candidateId).order("created_at",{ascending:false})
   .order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("artales_semantic_qa_flags")
   .select("id,target_atom_id,kind,comment,status,revision_sha256")
   .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
   .eq("status","open").order("created_at",{ascending:true}).limit(26)
 ]);
 if(revisionError||!record||record.revision_sha256!==input.revisionSha||
    flagError||!flags||!flags.length)return fail("Pro aktuální revizi nejsou dostupné otevřené nálezy.");
 if(flags.length>25)return fail("Dávka přesahuje 25 nálezů. Rozděl ji na menší části.");
 if(input.expectedFlagIds&&(
   input.expectedFlagIds.length!==flags.length||
   flags.some(f=>!input.expectedFlagIds!.includes(f.id))
 ))return fail("Po vytvoření úlohy se změnily QA nálezy; vytvoř novou dávku.");
 let atoms:ReturnType<typeof walkSemanticAtoms>;
 try{
  const revision=record.revision as SemanticRevision;
  verifySemanticRevision(revision,record.source_text);
  atoms=walkSemanticAtoms(revision.blocks);
 }catch{return fail("Integrita výchozí revize nebyla potvrzena.");}
 const byAtom=new Map(atoms.map((a,i)=>[a.id,{atom:a,index:i}]));
 const requests=flags.map(f=>{
  const selected=byAtom.get(f.target_atom_id);
  if(!selected)return null;
  const prev=atoms[selected.index-1],next=atoms[selected.index+1];
  return {flagId:f.id,kind:f.kind,comment:text(f.comment,700),
   atomId:f.target_atom_id,excerpt:text(selected.atom.raw,1600),
   before:prev?text(prev.raw,300):"",after:next?text(next.raw,300):""};
 });
 if(requests.some(x=>x===null))return fail("Některé nálezy nemají platnou kotvu.");
 const schema={
  type:"object",additionalProperties:false,required:["suggestions"],properties:{
   suggestions:{type:"array",items:{type:"object",additionalProperties:false,
    required:["flagId","action","term","rationale"],properties:{
     flagId:{type:"string"},action:{type:"string",enum:[...actions]},
     term:{type:"string"},rationale:{type:"string"}
    }}}
  }
 };
 try{
  const {body,usage}=await requestArtalesAiResponse({
   candidateId:input.candidateId,editorId:input.editorId,
   instructions:"Jsi konzervativní redakční navrhovatel ARTales. Nevytvářej ani neměň literární text. Pracuj pouze s dodanými nálezy přesné revize. Pro každý flagId vrať právě jeden návrh. compact/airy/center jen pro typografické nebo strukturální nálezy; nikdy nezahazuj text. protect_term pro jména, názvy a jiné výrazy, které nemají být rozděleny. manual_review pro nejisté či obsahové nálezy. Zdůvodnění stručně česky. Neznámé flagId a změny originálního textu jsou zakázány.",
   payload:{schema:"artales/editorial-ai-suggestions/v1",
     revisionSha:input.revisionSha,requests},
   schemaName:"artales_qa_suggestions",schema
  });
  const output=body.output as Array<{content?:Array<{type:string;text?:string}>}>|undefined;
  const raw=(output??[]).flatMap(o=>o.content??[])
   .filter(x=>x.type==="output_text").map(x=>x.text??"").join("");
  if(!raw)return fail("AI nevrátila použitelný výsledek; nic se nezměnilo.");
  const parsed=JSON.parse(raw) as {suggestions:AiQaSuggestion[]};
  if(!Array.isArray(parsed.suggestions)||parsed.suggestions.length!==flags.length)
   return fail("AI vrátila neúplný seznam. Návrhy nebyly přijaty.",usage);
  const expected=new Map(flags.map(f=>[f.id,f]));
  const seen=new Set<string>();
  for(const suggestion of parsed.suggestions){
   const flag=expected.get(suggestion.flagId);
   if(!flag||seen.has(suggestion.flagId)||!actions.has(suggestion.action)||
      typeof suggestion.term!=="string"||typeof suggestion.rationale!=="string"||
      suggestion.rationale.length>500||suggestion.term.length>80)
    return fail("AI vrátila neplatný návrh. Žádná oprava se neprovedla.",usage);
   seen.add(suggestion.flagId);
   if(["compact","airy","center"].includes(suggestion.action)&&
      !["typography","structure"].includes(flag.kind))
    return fail("AI navrhla nepovolenou změnu druhu bloku.",usage);
   if(suggestion.action==="protect_term"&&(!suggestion.term.trim()||
     !byAtom.get(flag.target_atom_id)?.atom.raw.includes(suggestion.term.trim())))
    return fail("AI navrhla ochranu výrazu, který se nenachází v bloku.",usage);
  }
  return {ok:true,message:"Návrhy AI jsou připraveny ke kontrole; zatím nic nemění.",suggestions:parsed.suggestions,usage};
 }catch{
  return fail("AI návrh se nepodařilo bezpečně získat nebo ověřit; žádná data nebyla změněna.");
 }
}
