import Link from "next/link";
import {notFound} from "next/navigation";
import {CANDIDATES_AB_ENABLED} from "@/lib/candidates/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getEditorialPeople} from "@/lib/editorial/staffDirectory";
import {candidateWorkflowStage,candidateWorkflowLabels,candidateWorkflowAction,
 candidateWorkflowDestination,type CandidateWorkflowEvidence} from "@/lib/editorial/candidateWorkflowStage";
import "./candidates.css";

export default async function CandidatesPage({searchParams}:{searchParams:Promise<{status?:string;q?:string}>}){
 if(!CANDIDATES_AB_ENABLED)notFound();
 await requireEditorOrAdmin();
 const db=await createClient();
 const {status="",q=""}=await searchParams;
 const [{data,error},{data:locks},{data:decisions},{data:snapshots},
  {data:revisions},{data:publications}]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name,status,priority,origin,rights_status,created_by,updated_at")
   .order("priority",{ascending:false}).order("created_at",{ascending:true}).limit(250),
  db.from("candidate_legal_locks").select("candidate_id").limit(500),
  db.from("candidate_legal_decisions").select("candidate_id,verdict,decision_no").order("decision_no",{ascending:false}).limit(1000),
  db.from("candidate_snapshots").select("candidate_id,readback_status").limit(500),
  db.from("candidate_semantic_revisions").select("candidate_id").limit(1000),
  db.from("artales_semantic_publications").select("candidate_id").limit(500)
 ]);
 const people=await getEditorialPeople([...new Set((data??[]).map(c=>c.created_by))]);
 const creatorNames=new Map(people.map(p=>[p.id,p.display_name??"Editor"]));
 const locked=new Set((locks??[]).map(l=>l.candidate_id));
 const latestDecision=new Map<string,string>();
 for(const d of decisions??[])if(!latestDecision.has(d.candidate_id))latestDecision.set(d.candidate_id,d.verdict);
 const archiveByCandidate=new Map<string,"verified"|"attention">((snapshots??[]).map(s=>[s.candidate_id,s.readback_status==="sha256_verified"?"verified":"attention"]));
 const revisionIds=new Set((revisions??[]).map(r=>r.candidate_id));
 const publicationIds=new Set((publications??[]).map(p=>p.candidate_id));
 const rows=(data??[]).map(c=>{
  const evidence:CandidateWorkflowEvidence={intakeStatus:c.status,
   latestVerdict:latestDecision.get(c.id),legalLocked:locked.has(c.id),
   snapshotStatus:archiveByCandidate.get(c.id),hasRevision:revisionIds.has(c.id),
   published:publicationIds.has(c.id)};
  return {...c,stage:candidateWorkflowStage(evidence)};
 }).filter(c=>(!status||c.stage===status)&&(!q||
  [c.proposed_title,c.proposed_author_name].join(" ").toLocaleLowerCase("cs").includes(q.toLocaleLowerCase("cs"))));
 return <main className="ca-root">
  <header className="ca-head"><div><p className="ca-eyebrow">ARTales / Redakce</p><h1>Kandidáti</h1>
   <p>Přehled skutečného stavu přípravy každého díla. Pokračuj vždy posledním dokončeným krokem.</p></div>
   <Link className="ca-btn ca-primary" href="/member/candidates/new">+ Přidat kandidáta</Link>
  </header>
  <form className="ca-filters"><label>Vyhledat<input name="q" defaultValue={q} placeholder="Název nebo autor"/></label>
   <label>Stav<select name="status" defaultValue={status}><option value="">Všechny stavy</option>
    {Object.entries(candidateWorkflowLabels).map(([key,value])=><option value={key} key={key}>{value}</option>)}
   </select></label><button className="ca-btn ca-secondary" type="submit">Filtrovat</button></form>
  {error?<p className="ca-error" role="alert">Kandidáty se nepodařilo načíst.</p>:
  rows.length===0?<section className="ca-card">Žádní kandidáti neodpovídají filtru.</section>:
  <div className="ca-list">{rows.map(c=><article className="ca-card" key={c.id}>
   <div><h2>{c.proposed_title}</h2><p>{c.proposed_author_name}</p>
    <p className="ca-hint"><strong>{candidateWorkflowLabels[c.stage]}</strong> · {c.origin==="prescreen"?"Z Prescreenu":"Ručně"} · Vložil(a): {creatorNames.get(c.created_by)??"ARTales"}</p>
   </div><Link className="ca-btn ca-secondary" href={candidateWorkflowDestination(c.id,c.stage)}>
    {candidateWorkflowAction(c.stage)} →
   </Link></article>)}</div>}
 </main>;
}
