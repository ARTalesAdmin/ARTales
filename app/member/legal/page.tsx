import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {LegalPipelineNav} from "@/components/legal/LegalPipelineNav";
import "../candidates/candidates.css";
import {legalOverviewFilters,legalOverviewMatches,legalOverviewPresentation,legalOverviewStage,type LegalOverviewFilter} from "@/lib/legal/overviewStatus";


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
 const aliases:Record<string,LegalOverviewFilter>={todo:"pending",checking:"pending",ready:"verified",locked:"processed"};
 const requested=params.status??"all";
 const active:LegalOverviewFilter=Object.hasOwn(legalOverviewFilters,requested)?requested as LegalOverviewFilter:aliases[requested]??"all";
 const query=(params.q??"").trim().toLocaleLowerCase("cs");
 const lastByCandidate=new Map<string,(typeof decisions extends (infer T)[] | null ? T : never)>(); 
 // Decisions are newest-first: keep the first occurrence.
 for(const d of decisions??[])if(!lastByCandidate.has(d.candidate_id))lastByCandidate.set(d.candidate_id,d);
 const lockedIds=new Set((locks??[]).map(x=>x.candidate_id));
 const stage=(id:string)=>legalOverviewStage(lockedIds.has(id),lastByCandidate.get(id));
 const rows=(candidates??[]).filter(c=>legalOverviewMatches(stage(c.id),active)&&(!query||[c.proposed_title,c.proposed_author_name].join(" ").toLocaleLowerCase("cs").includes(query)));
 return <main className="ca-root">
  <header className="ca-head"><div><p className="ca-eyebrow">ARTales / Výběr titulů</p><h1>Právní screen</h1><p>Rychlý právní check, rozhodnutí editora a předání ověřeného zdroje pro Snapshot.</p></div><Link className="ca-btn ca-secondary" href="/member/candidates">Zpět ke kandidátům</Link></header>
  <LegalPipelineNav step="legal" admin={profile.role==="admin"}/>
  <form className="ca-filters"><label>Hledat dílo nebo autora<input name="q" defaultValue={params.q??""} placeholder="Název, autor"/></label><label>Stav<select name="status" defaultValue={active}>{Object.entries(legalOverviewFilters).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="submit" className="ca-btn ca-secondary">Filtrovat</button></form>
  {error?<p className="ca-error">Kandidáty se nepodařilo načíst.</p>:rows.length===0?<section className="ca-card">V tomto filtru nejsou žádné tituly.</section>:<div className="ca-list">{rows.map(c=><article key={c.id} className="ca-card"><div><h2>{c.proposed_title}</h2><p>{c.proposed_author_name}</p><small><strong>{legalOverviewPresentation[stage(c.id)].label}</strong> · {legalOverviewPresentation[stage(c.id)].hint}</small></div><div className="ca-actions"><Link className="ca-btn ca-primary" href={`/member/legal/${c.id}`}>{legalOverviewPresentation[stage(c.id)].action}</Link></div></article>)}</div>}
 </main>;
}
