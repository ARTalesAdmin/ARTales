import Link from "next/link";
import {AutomaticLegalScreen} from "@/components/legal/AutomaticLegalScreen";
import {LegalPipelineNav} from "@/components/legal/LegalPipelineNav";
import {notFound} from "next/navigation";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {recordLegalVerdict,lockScreening} from "@/lib/actions/legalScreen";
import "../../candidates.css";

export default async function LegalScreen({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;ok?:string;requested?:string;reviewed?:string;locked?:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const db=await createClient();
 const [{data:c},{data:sources},{data:decisions},{data:locks},{data:illustrations}]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name,status").eq("id",id).maybeSingle(),
  db.from("candidate_legal_sources").select("*").eq("candidate_id",id).order("created_at",{ascending:false}),
  db.from("candidate_legal_decisions").select("decision_no,verdict,rationale,source_id,source_facts,recorded_at").eq("candidate_id",id).order("decision_no",{ascending:false}),
  db.from("candidate_legal_locks").select("*").eq("candidate_id",id).limit(1),
  db.from("candidate_legal_illustrations").select("id,source_id,asset_url,creator,archive_rights,publication_rights,planned_use,evidence_url").in("source_id",(await db.from("candidate_legal_sources").select("id").eq("candidate_id",id)).data?.map(s=>s.id)??[])
 ]);
 if(!c)notFound();

 const latest=decisions?.[0];
 const latestAutoSource=sources?.find(source=>source.id===latest?.source_id);
 let previousFacts:Record<string,unknown>|null=null;
 try{if(latestAutoSource?.notes?.startsWith('{'))previousFacts=JSON.parse(latestAutoSource.notes) as Record<string,unknown>;}catch{}

 const locked=locks?.[0];
 const q=await searchParams;
 return <main className="ca-root">

  <header className="ca-head"><div><p className="ca-eyebrow">Právní screen · CZ/EU</p><h1>{c.proposed_title}</h1><p>{c.proposed_author_name} · Prověření zdroje, nikoli snapshot</p></div></header>
  {locked?<p role="status" className="ca-success">Právní screen uzamčen. Snapshot je samostatná další etapa.</p>:null}
  {q.reviewed?<p role="status" className="ca-success">Rozhodnutí o požadavku bylo zapsáno. Samotný snapshot se v této etapě nevytváří.</p>:null}
  {q.ok?<p className="ca-success" role="status">Zapsáno.</p>:null}
  {q.error?<p className="ca-error" role="alert">Zápis se nezdařil. Zkontroluj podklady nebo oprávnění.</p>:null}
  <LegalPipelineNav step="legal" candidateId={id} admin={profile.role==="admin"}/>
  <p className="ca-links"><Link href="/member/legal">← Přehled právních screenů</Link> · <Link href={`/member/candidates/${id}`}>Bibliografický kandidát</Link></p>
  {!locked?<AutomaticLegalScreen candidateId={id}/>:null}
  {previousFacts?<section className="ca-card"><h2>Poslední uložené automatické posouzení</h2><p><strong>{latestAutoSource?.edition_title}</strong> · rozhodnutí #{latest?.decision_no} · {latest?.recorded_at?new Date(latest.recorded_at).toLocaleString("cs-CZ"):""}</p><p>Autor: {String((previousFacts.author as {status?:string}|undefined)?.status??"neověřeno")} · Překlad: {String((previousFacts.translation as {status?:string}|undefined)?.status??"neověřeno")} · Ilustrace: {String((previousFacts.illustrations as {status?:string}|undefined)?.status??"neověřeno")}</p><p><a href={latestAutoSource?.download_url??latestAutoSource?.source_url} target="_blank" rel="noopener noreferrer">Přesný vybraný zdroj a podklady</a></p><details><summary>Podrobnosti a auditní důvody</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(previousFacts,null,2)}</pre></details></section>:null}

  {!locked&&sources?.length?<section className="ca-card"><h2>Rozhodnutí editora</h2>
   <p>Automatický check navrhne postup. Schválení konkrétního zdroje je samostatné rozhodnutí.</p>
   <details><summary>Zapsat rozhodnutí k vybrané edici</summary>
    <form className="ca-form" action={recordLegalVerdict.bind(null,id)}>
     <label>Edice<select name="source_id" required>{sources.map(s=><option key={s.id} value={s.id}>{s.edition_title}</option>)}</select></label>
     <label>Rozhodnutí<select name="verdict"><option value="needs_evidence">Dořešit konkrétní složku</option><option value="deferred">Odložit</option><option value="approved">Právně ověřeno</option><option value="rejected">Vyřadit</option></select></label>
     <label>Stručný důvod / důkaz<textarea name="rationale" rows={2} minLength={15} maxLength={5000} required/></label>
     <button type="submit" className="ca-btn ca-primary">Uložit rozhodnutí</button>
    </form>
   </details>
  </section>:null}
  {locked?<p className="ca-success">Prověřená edice je uzamčena. <a href={`/member/candidates/${id}/legal/report`}>Předávací JSON</a></p>:null}
  {!locked&&latest?.verdict==="approved"&&latest.source_id?<section className="ca-card"><h2>Potvrdit prověřený zdroj</h2>
   <form action={lockScreening.bind(null,id)} className="ca-form"><input type="hidden" name="source_id" value={latest.source_id}/><input type="hidden" name="decision_no" value={latest.decision_no}/>
    <p>{sources?.find(s=>s.id===latest.source_id)?.edition_title} · uzamčení není snapshot ani publikace.</p>
    <button className="ca-btn ca-primary" type="submit">Uzamknout prověřený zdroj</button>
   </form>
  </section>:null}
  <details className="ca-card"><summary>Historie právních rozhodnutí</summary><h2>Historie rozhodnutí</h2>{decisions?.length?decisions.map(d=><article key={d.decision_no}><p><strong>#{d.decision_no} · {d.verdict}</strong> · {new Date(d.recorded_at).toLocaleDateString("cs-CZ")}</p><p>{d.rationale}</p></article>):<p>Zatím bez rozhodnutí.</p>}</details>
 </main>;
}
