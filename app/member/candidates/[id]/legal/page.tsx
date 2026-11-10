import Link from "next/link";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {notFound} from "next/navigation";
import {AutomaticLegalScreen} from "@/components/legal/AutomaticLegalScreen";
import {LegalReviewActions} from "@/components/legal/LegalReviewActions";
import {LegalPipelineNav} from "@/components/legal/LegalPipelineNav";
import {SnapshotActionPanel} from "@/components/snapshot/SnapshotActionPanel";
import {getCandidateSnapshotState} from "@/lib/ingest/server/getCandidateSnapshotState";
import {makeReviewHistory} from "@/lib/legal/reviewHistory";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {canProgressCandidate} from "@/lib/editorial/candidateAuthority";
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
 const canProgress=await canProgressCandidate(id,profile);
 const {checks,history}=makeReviewHistory(decisions??[],sources??[]);
 const latest=decisions?.[0];
 // Do not query unapplied registry tables before explicit activation.
 const snapshotState=lock&&SNAPSHOT_GENERAL_V1_ENABLED?await getCandidateSnapshotState(id):null;
 const q=await searchParams;
 return <main className="ca-root">
  <header className="ca-head"><div><p className="ca-eyebrow">Právní prověření díla</p><h1>{c.proposed_title}</h1><p>{c.proposed_author_name}</p></div></header>
  <LegalPipelineNav step="legal" candidateId={id} admin={profile.role==="admin"}/>
  <p className="ca-links"><Link href="/member/legal">← Přehled právních screenů</Link> · <Link href={`/member/candidates/${id}`}>Kandidát</Link></p>
  {q.ok?<p role="status" className="ca-success">Rozhodnutí bylo úspěšně uloženo do historie. {latest?.verdict==="approved"?"Další krok: uzamkni schválený zdroj pro Snapshot.":"Další postup závisí na výsledku právního posouzení."}</p>:null}
  {q.error?<p role="alert" className="ca-error">Akci nelze dokončit; zkontroluj podklady nebo právní stav.</p>:null}
  {!lock&&canProgress?<AutomaticLegalScreen candidateId={id}/>:lock?<section className="ca-card">
   <p className="ca-eyebrow">Právní check dokončen</p><h2>Další krok: příprava textu</h2>
   <p>Zdroj je připraven pro redakční zpracování.</p>
   <Link href={"/member/snapshot/"+id} className="ca-btn ca-primary">Pokračovat →</Link>
  </section>:null}
  {!lock&&canProgress&&profile.role==="admin"?<details className="ca-card"><summary>Záložní ruční právní posouzení (administrátor)</summary><LegalReviewActions candidateId={id} checks={checks} locked={false}/></details>:null}
  {canProgress&&!lock&&latest?.verdict==="approved"&&latest.source_id?<section className="ca-card" id="legal-next-step" aria-label="Další krok po schválení"><h2>Právní kontrola dokončena · pokračuj ke Snapshotu</h2>
   <p>Rozhodnutí je uložené v historii. Nyní uzamkni schválený zdroj, aby Snapshot převzal přesně tuto edici. K samotné archivaci dojde až v dalším kroku.</p>
   <form action={lockScreening.bind(null,id)} className="ca-form">
    <input type="hidden" name="source_id" value={latest.source_id}/><input type="hidden" name="decision_no" value={latest.decision_no}/>
    <button className="ca-btn ca-primary" type="submit">Uzamknout a připravit pro Snapshot</button>
   </form>
  </section>:null}
  {lock&&profile.role==="admin"?<details className="ca-card">
   <summary>Evidence a technické podklady (administrátor)</summary>
   {snapshotState?<SnapshotActionPanel candidateId={id} state={snapshotState} canArchive={false}/>:null}
   <a className="ca-btn ca-secondary" href={`/member/candidates/${id}/legal/report`}>Stáhnout audit (JSON)</a>
  </details>:null}
  {history.length?<details className="ca-card"><summary>Historie posouzení a rozhodnutí ({history.length})</summary>
   {history.map(h=><div key={h.decisionNo} style={{paddingBlock:8,borderBottom:"1px solid var(--artales-border)"}}>
    <strong>#{h.decisionNo} · {h.label}</strong> · {new Date(h.recordedAt).toLocaleString("cs-CZ")} · <a href={`/member/legal/${id}/audit/${h.decisionNo}`}>Stáhnout JSON</a>
   </div>)}
  </details>:null}
 </main>;
}
