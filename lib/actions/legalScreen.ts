"use server";
import {redirect} from "next/navigation";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
const values=(form:FormData,k:string)=>String(form.get(k)??"").trim();
const safeUrl=(v:string)=>!v||(/^https:\/\/[^\s]+$/.test(v)&&v.length<=1000);
const validId=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const back=(id:string,error:boolean)=>redirect(`/member/candidates/${id}/legal?${error?"error=1":"ok=1"}`);
export async function addLegalSource(id:string,form:FormData){
 if(!LEGAL_SCREEN_V1_ENABLED)throw Error("legal_screen_not_enabled");
 const profile=await requireEditorOrAdmin();
 if(!validId(id))throw Error("invalid_id");
 const keys=["source_kind","edition_title","source_url","download_url","translation_status","read_url","edition_year","language_code","translator","illustrator","author_died","translator_died","illustrator_died","identity_match","language_match","text_format","completeness","text_quality","original_rights","translation_rights","illustration_use","source_terms","evidence_url","notes"] as const;
 const p=Object.fromEntries(keys.map(k=>[k,values(form,k)]));
 if(!p.download_url||!p.edition_title||p.edition_title.length>300||!p.source_url||![p.source_url,p.download_url,p.read_url,p.evidence_url].every(safeUrl)||p.notes.length>5000)back(id,true);
 const year=p.edition_year?Number(p.edition_year):null;
 if(year!==null&&(!Number.isInteger(year)||year<1400||year>2100))back(id,true);
 for(const k of ["author_died","translator_died","illustrator_died"]){
  if(p[k] && (!/^\d{4}$/.test(p[k]) || Number(p[k])<1000 || Number(p[k])>2100))back(id,true);
 }
 const db=await createClient();
 const {error}=await db.from("candidate_legal_sources").insert({...p,author_died:p.author_died?Number(p.author_died):null,translator_died:p.translator_died?Number(p.translator_died):null,illustrator_died:p.illustrator_died?Number(p.illustrator_died):null,candidate_id:id,edition_year:year,read_url:p.read_url||null,evidence_url:p.evidence_url||null,created_by:profile.id,updated_by:profile.id});
 if(error)back(id,true);
 back(id,false);
}
export async function recordLegalVerdict(id:string,form:FormData){
 if(!LEGAL_SCREEN_V1_ENABLED)throw Error("legal_screen_not_enabled");
 const profile=await requireEditorOrAdmin();
 if(!validId(id))throw Error("invalid_id");
 const source=values(form,"source_id"),verdict=values(form,"verdict"),rationale=values(form,"rationale");
 if(!["needs_evidence","deferred","approved","rejected"].includes(verdict)||rationale.length<15||rationale.length>5000||(source&&!validId(source)))back(id,true);
 const db=await createClient();
 const {error}=await db.from("candidate_legal_decisions").insert({candidate_id:id,source_id:source||null,verdict,territory:"CZ/EU",rationale,reviewed_by:profile.id});
 if(error)back(id,true);
 back(id,false);
}

export async function requestSnapshot(id:string,form:FormData){
 if(!LEGAL_SCREEN_V1_ENABLED)throw Error("legal_screen_not_enabled");
 const profile=await requireEditorOrAdmin();
 if(!validId(id))throw Error("invalid_id");
 const source=values(form,"source_id");
 if(!validId(source))back(id,true);
 const db=await createClient();
 const {error}=await db.from("candidate_snapshot_requests").insert({candidate_id:id,source_id:source,proposed_by:profile.id});
 if(error)back(id,true);
 redirect(`/member/candidates/${id}/legal?requested=1`);
}
export async function reviewSnapshot(id:string,form:FormData){
 if(!LEGAL_SCREEN_V1_ENABLED)throw Error("legal_screen_not_enabled");
 const profile=await requireEditorOrAdmin();
 if(profile.role!=="admin"||!validId(id))throw Error("admin_only");
 const requestId=values(form,"request_id"),decision=values(form,"decision");
 if(!validId(requestId)||!["approved","rejected"].includes(decision))back(id,true);
 const db=await createClient();
 const {error}=await db.from("candidate_snapshot_requests")
 .update({status:decision,reviewed_by:profile.id,reviewed_at:new Date().toISOString()})
 .eq("id",requestId).eq("candidate_id",id).eq("status","pending");
 if(error)back(id,true);
 redirect(`/member/candidates/${id}/legal?reviewed=1`);
}

export async function lockScreening(id:string,form:FormData){
 if(!LEGAL_SCREEN_V1_ENABLED)throw Error("legal_screen_not_enabled");
 const profile=await requireEditorOrAdmin();
 const source=values(form,"source_id"),decision=Number(values(form,"decision_no"));
 if(!validId(id)||!validId(source)||!Number.isSafeInteger(decision)||decision<=0)throw Error("invalid_legal_lock");
 const db=await createClient();
 const {error}=await db.from("candidate_legal_locks").insert({
  candidate_id:id,source_id:source,decision_no:decision,locked_by:profile.id,
  source_url:"https://placeholder.invalid",download_url:"https://placeholder.invalid",
  source_facts:{},illustrations:[]
 });
 if(error)back(id,true);
 redirect(`/member/candidates/${id}/legal?locked=1`);
}
