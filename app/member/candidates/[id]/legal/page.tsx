import Link from "next/link";
import {notFound} from "next/navigation";
import {AutomaticLegalScreen} from "@/components/legal/AutomaticLegalScreen";
import {LegalReviewActions} from "@/components/legal/LegalReviewActions";
import {LegalPipelineNav} from "@/components/legal/LegalPipelineNav";
import {makeReviewHistory} from "@/lib/legal/reviewHistory";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {lockScreening} from "@/lib/actions/legalScreen";
import "../../candidates.css";
export default async function LegalScreen({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;ok?:string;locked?:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const {id}=await params;
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))notFound();
 const db=await createClient();
 const [{data:c},{data:sources},{data:decisions},{data:lock}]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name").eq("id",id).maybeSingle(),
  db.from("candidate_legal_sources").select("*").eq("candidate_id",id).order("created_at",{ascending:false}),
  db.from("candidate_legal_decisions").select("decision_no,source_id,verdict,rationale,recorded_at,source_facts").eq("candidate_id",id).order("decision_no",{ascending:false}),
  db.from("candidate_legal_locks").select("*").eq("candidate_id",id).maybeSingle()
 ]);
 if(!c)notFound();
 const {checks,history}=makeReviewHistory(decisions??[],sources??[]);
 const latest=decisions?.[0];
 const q=await searchParams;
 return <main className="ca-root">
  <header className="ca-head"><div><p className="ca-eyebrow">Právní screen · CZ/EU</p><h1>{c.proposed_title}</h1><p>{c.proposed_author_name}</p></div></header>
  <LegalPipelineNav step="legal" candidateId={id} admin={profile.role==="admin"}/>
  <p className="ca-links"><Link href="/member/legal">← Přehled právních screenů</Link> · <Link href={`/member/candidates/${id}`}>Kandidát</Link></p>
  {q.ok?<p role="status" className="ca-success">Rozhodnutí bylo uloženo.</p>:null}
  {q.error?<p role="alert" className="ca-error">Akci nelze dokončit; zkontroluj podklady nebo právní stav.</p>:null}
  {!lock?<AutomaticLegalScreen candidateId={id}/>:<p role="status" className="ca-success">Právní posouzení je uzamčeno. Zdroj i rozhodnutí jsou připraveny k předání.</p>}
  {!lock?<LegalReviewActions candidateId={id} checks={checks} locked={false}/>:null}
  {!lock&&latest?.verdict==="approved"&&latest.source_id?<section className="ca-card"><h2>Předání ke Snapshotu</h2>
   <p>Schválení zdroje je zapsané. Uzamčení vytvoří neměnný předávací podklad, nikoli samotný Snapshot.</p>
   <form action={lockScreening.bind(null,id)} className="ca-form">
    <input type="hidden" name="source_id" value={latest.source_id}/><input type="hidden" name="decision_no" value={latest.decision_no}/>
    <button className="ca-btn ca-primary" type="submit">Uzamknout a připravit pro Snapshot</button>
   </form>
  </section>:null}
  {lock?<section className="ca-card"><h2>Připraveno ke Snapshotu</h2><p>Zdroj je uzamčený. Snapshot se zatím nevytváří automaticky.</p><a className="ca-btn ca-primary" href={`/member/candidates/${id}/legal/report`}>Stáhnout předávací protokol (JSON)</a></section>:null}
  {history.length?<details className="ca-card"><summary>Historie posouzení a rozhodnutí ({history.length})</summary>
   {history.map(h=><div key={h.decisionNo} style={{paddingBlock:8,borderBottom:"1px solid var(--artales-border)"}}>
    <strong>#{h.decisionNo} · {h.label}</strong> · {new Date(h.recordedAt).toLocaleString("cs-CZ")} · <a href={`/member/legal/${id}/audit/${h.decisionNo}`}>Stáhnout JSON</a>
   </div>)}
  </details>:null}
 </main>;
