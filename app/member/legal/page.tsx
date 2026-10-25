import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {LegalPipelineNav} from "@/components/legal/LegalPipelineNav";
import "../candidates/candidates.css";

const statuses={all:"Všechny",todo:"K prověření",checking:"Rozpracované",ready:"Ověřené – k uzamčení",locked:"Uzamčené"} as const;
type Status=keyof typeof statuses;
export default async function LegalOverview({searchParams}:{searchParams:Promise<{q?:string;status?:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const db=await createClient();
 const [{data:candidates,error},{data:decisions},{data:locks}]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name,status,priority").order("priority",{ascending:false}).limit(250),
  db.from("candidate_legal_decisions").select("candidate_id,verdict,decision_no").order("decision_no",{ascending:false}).limit(500),
  db.from("candidate_legal_locks").select("candidate_id,locked_at").order("locked_at",{ascending:false}).limit(250)
 ]);
 const params=await searchParams;
 const requested=(params.status??"all") as Status;
 const active=Object.hasOwn(statuses,requested)?requested:"all";
 const query=(params.q??"").trim().toLocaleLowerCase("cs");
 const lastByCandidate=new Map((decisions??[]).map(d=>[d.candidate_id,d])); 
 // Decisions are newest-first: keep the first occurrence.
 for(const d of decisions??[])if(!lastByCandidate.has(d.candidate_id))lastByCandidate.set(d.candidate_id,d);
 const lockedIds=new Set((locks??[]).map(x=>x.candidate_id));
 const stage=(id:string):Status=>{
  if(lockedIds.has(id))return "locked";
  const d=lastByCandidate.get(id);
  if(d?.verdict==="approved")return "ready";
  if(d)return "checking";
  return "todo";
 };
 const rows=(candidates??[]).filter(c=>(active==="all"||stage(c.id)===active)&&(!query||[c.proposed_title,c.proposed_author_name].join(" ").toLocaleLowerCase("cs").includes(query)));
 return <main className="ca-root">
  <header className="ca-head"><div><p className="ca-eyebrow">ARTales / Výběr titulů</p><h1>Právní screen</h1><p>Konkrétní edice, kontrola práv jednotlivých složek, uzamčení zdrojového souboru a předání k pozdějšímu snapshotu.</p></div><Link className="ca-btn ca-secondary" href="/member/candidates">Zpět ke kandidátům</Link></header>
  <LegalPipelineNav step="legal" admin={profile.role==="admin"}/>
  <section className="ca-card"><h2>Redakční agenda</h2><p>Každé dílo začíná jako Kandidát. Tady se posoudí konkrétní dostupné vydání; zdroj se při uzamčení nemění ani nestahuje. Ilustrace mají oddělený právní záznam.</p></section>
  <form className="ca-filters"><label>Hledat dílo nebo autora<input name="q" defaultValue={params.q??""} placeholder="Název, autor"/></label><label>Stav<select name="status" defaultValue={active}>{Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="submit" className="ca-btn ca-secondary">Filtrovat</button></form>
  {error?<p className="ca-error">Kandidáty se nepodařilo načíst.</p>:rows.length===0?<section className="ca-card">V tomto filtru nejsou žádné tituly.</section>:<div className="ca-list">{rows.map(c=><article key={c.id} className="ca-card"><div><h2>{c.proposed_title}</h2><p>{c.proposed_author_name}</p><small>{statuses[stage(c.id)]} · Priorita {c.priority}</small></div><div className="ca-actions"><Link className="ca-btn ca-secondary" href={`/member/candidates/${c.id}`}>Kandidát</Link><Link className="ca-btn ca-primary" href={`/member/candidates/${c.id}/legal`}>Právní screen</Link></div></article>)}</div>}
 </main>;
}
