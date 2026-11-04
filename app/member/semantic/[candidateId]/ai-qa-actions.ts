"use server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {verifySemanticRevision,walkSemanticAtoms} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";

/** Suggestions ONLY. No semantic revision, source text or QA status is changed here. */
export type AiQaSuggestion={
 flagId:string;
 action:"compact"|"airy"|"center"|"protect_term"|"manual_review";
 term:string;
 rationale:string;
};
export type AiQaSuggestResult={ok:boolean;message:string;suggestions:AiQaSuggestion[]};
const sha=/^[a-f0-9]{64}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions=new Set(["compact","airy","center","protect_term","manual_review"]);
const text=(s:string,limit:number)=>s.length>limit?s.slice(0,limit)+" [zkráceno]":s;

export async function suggestSemanticQaRepairs(input:{
 candidateId:string;revisionSha:string
}):Promise<AiQaSuggestResult>{
 const actor=await requireEditorOrAdmin();
 const fail=(message:string):AiQaSuggestResult=>({ok:false,message,suggestions:[]});
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha))
  return fail("Neplatná identita díla nebo revize.");
 const apiKey=process.env.ARTALES_EDITORIAL_AI_API_KEY;
 const model=process.env.ARTALES_EDITORIAL_AI_MODEL;
 if(!apiKey||!model)return fail("AI redakční návrhy nejsou aktivované. Chybí serverová konfigurace.");
 const db=await createClient();
 if(actor.role!=="admin"){
  const {data:task,error:taskError}=await db.from("artales_editorial_tasks")
   .select("id").eq("candidate_id",input.candidateId)
   .eq("revision_sha256",input.revisionSha).eq("kind","text_review")
   .eq("assigned_to",actor.id).eq("status","claimed").limit(1);
  if(taskError||!task?.length)return fail("Návrhy smí vyžádat pouze právě pracující editor QA.");
 }
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
  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{"Content-Type":"application/json",
    Authorization:"Bearer "+apiKey},
   body:JSON.stringify({model,store:false,max_output_tokens:2200,
    instructions:[
     "Jsi konzervativní redakční navrhovatel ARTales. Nevytvářej ani neměň literární text.",
     "Pracuj pouze s dodanými nálezy přesné revize. Pro každý flagId vrať právě jeden návrh.",
     "Povolené akce: compact/airy/center jen pro typografické/strukturální nálezy;",
     "Nikdy nenavrhuj vyřazení textu, věty, poznámky ani jiného úseku z vydání;",
     "protect_term pro explicitní jméno nebo výraz, který se nesmí dělit;",
     "manual_review pro vše ostatní či nejisté případy.",
     "Jakýkoliv problém s textem či s původem poznámky je manual_review.",
     "Zdůvodnění piš stručně česky. Nepřidávej neznámé flagId."
    ].join(" "),
    input:JSON.stringify({schema:"artales/editorial-ai-suggestions/v1",
     revisionSha:input.revisionSha,requests}),
    text:{format:{type:"json_schema",name:"artales_qa_suggestions",strict:true,schema}}
   }),
   signal:AbortSignal.timeout(30000)
  });
  if(!response.ok)return fail("AI poskytovatel požadavek nepřijal; nic se nezměnilo.");
  const body=await response.json() as {output?:Array<{content?:Array<{type:string;text?:string}>}>};
  const raw=(body.output??[]).flatMap(o=>o.content??[])
    .filter(c=>c.type==="output_text").map(c=>c.text??"").join("");
  if(!raw)return fail("AI nevrátila použitelný výsledek; nic se nezměnilo.");
  const parsed=JSON.parse(raw) as {suggestions:AiQaSuggestion[]};
  if(!Array.isArray(parsed.suggestions)||parsed.suggestions.length!==flags.length)
   return fail("AI vrátila neúplný seznam. Návrhy nebyly přijaty.");
  const expected=new Map(flags.map(f=>[f.id,f]));
  const seen=new Set<string>();
  for(const suggestion of parsed.suggestions){
   const flag=expected.get(suggestion.flagId);
   if(!flag||seen.has(suggestion.flagId)||!actions.has(suggestion.action)||
      typeof suggestion.term!=="string"||typeof suggestion.rationale!=="string"||
      suggestion.rationale.length>500||suggestion.term.length>80)
    return fail("AI vrátila neplatný návrh. Žádná oprava se neprovedla.");
   seen.add(suggestion.flagId);
   if(["compact","airy","center"].includes(suggestion.action)&&
      !["typography","structure"].includes(flag.kind))
    return fail("AI navrhla nepovolenou změnu druhu bloku.");
   if(suggestion.action==="protect_term"&&(!suggestion.term.trim()||
     !byAtom.get(flag.target_atom_id)?.atom.raw.includes(suggestion.term.trim())))
    return fail("AI navrhla ochranu výrazu, který se nenachází v bloku.");
  }
  return {ok:true,message:"Návrhy AI jsou připraveny ke kontrole; zatím nic nemění.",suggestions:parsed.suggestions};
 }catch{
  return fail("AI návrh se nepodařilo bezpečně získat nebo ověřit; žádná data nebyla změněna.");
 }
}
