import Link from "next/link";
import {requireAdmin} from "@/lib/guards";
import {createAdminClient} from "@/lib/supabase/admin";
import {getEditorialPeople} from "@/lib/editorial/staffDirectory";
import {
 aggregateArtalesAiUsage,type ArtalesAiUsage
} from "@/lib/semantic/aiGatewayUsage";
import "@/components/editor/editorial-workspace.css";
import "@/app/member/admin/editorial-performance/report.css";

export const dynamic="force-dynamic";
type RecordRow={
 generation_id:string;candidate_id:string;requested_by:string;
 model:string;input_tokens:number|null;output_tokens:number|null;
 total_tokens:number|null;cost_usd:number|null;cost_status:ArtalesAiUsage["status"];
 recorded_at:string;
};

async function readUsage(){
 const db=createAdminClient();
 const rows:RecordRow[]=[];
 const pageSize=500;
 for(let start=0;;start+=pageSize){
  const {data,error}=await db.from("artales_semantic_ai_usage")
   .select("generation_id,candidate_id,requested_by,model,input_tokens,output_tokens,total_tokens,cost_usd,cost_status,recorded_at")
   .order("recorded_at",{ascending:false}).order("generation_id",{ascending:false})
   .range(start,start+pageSize-1);
  if(error)return {rows:[],error:error.code==="42P01"?"missing_schema":"unavailable"};
  const batch=(data??[]) as RecordRow[];
  rows.push(...batch);
  if(batch.length<pageSize)return {rows,error:null};
 }
}
const fmt=(n:number)=>new Intl.NumberFormat("cs-CZ").format(n);
const usd=(n:number)=>new Intl.NumberFormat("cs-CZ",{
 style:"currency",currency:"USD",maximumFractionDigits:6
}).format(n);
export default async function ArtalesAiUsageReport(){
 await requireAdmin();
 const result=await readUsage();
 const rows=result.rows;
 const usage=rows.map(r=>({
  generationId:r.generation_id,candidateId:r.candidate_id,requestedBy:r.requested_by,
  model:r.model,inputTokens:r.input_tokens,outputTokens:r.output_tokens,
  totalTokens:r.total_tokens,costUsd:r.cost_usd,status:r.cost_status
 }));
 const summary=aggregateArtalesAiUsage(usage);
 const people=rows.length?await getEditorialPeople([...new Set(rows.map(x=>x.requested_by))]):[];
 const names=new Map(people.map(p=>[p.id,p.display_name??"Editor"]));
 const byMonth=new Map<string,{count:number,input:number,output:number}>();
 for(const row of rows){
  const month=row.recorded_at.slice(0,7);
  const old=byMonth.get(month)??{count:0,input:0,output:0};
  old.count++;old.input+=row.input_tokens??0;old.output+=row.output_tokens??0;
  byMonth.set(month,old);
 }
 const timeline=[...byMonth.entries()].sort(([a],[b])=>b.localeCompare(a));
 return <main className="ed-page ed-report">
  <nav className="ed-breadcrumb" aria-label="Drobečková navigace">
   <Link href="/member/admin/dashboard">Admin přehled</Link>
   <span className="ed-breadcrumb__sep">/</span><span>AI spotřeba</span>
  </nav>
  <header className="ed-hero"><p className="ed-eyebrow">ARTales · AI Gateway</p>
   <h1>Spotřeba AI redakce</h1>
   <p className="ed-hero__subtitle">
    Generování podle editorů, modelů a období. Údaje jsou odečtené z ARTales
    evidence; chybějící cenu nepočítáme jako nulu.
   </p>
  </header>
  {result.error?<section className="ed-card ed-report__section" role="status">
   <h2>AI účetnictví zatím není aktivní</h2>
   <p>{result.error==="missing_schema"?
    "Produkční tabulka spotřeby dosud není nasazená. Žádné hodnoty nelze vydávat za nulové.":
    "Přehled nebylo možné úplně načíst. Spotřebu ověř ve Vercel AI Gateway Logs."}</p>
  </section>:<>
  <div className="ed-stats ed-report__stats">
   <div className="ed-stat"><strong className="ed-stat__value">{fmt(summary.generations)}</strong>
    <span className="ed-stat__label">Požadavků</span></div>
   <div className="ed-stat"><strong className="ed-stat__value">{fmt(summary.inputTokens)}</strong>
    <span className="ed-stat__label">Vstupní tokeny</span></div>
   <div className="ed-stat"><strong className="ed-stat__value">{fmt(summary.outputTokens)}</strong>
    <span className="ed-stat__label">Výstupní tokeny</span></div>
   <div className="ed-stat"><strong className="ed-stat__value">{summary.unpricedGenerations?
    "Čeká na cenu":usd(summary.knownCostUsd)}</strong>
    <span className="ed-stat__label">Cena USD {summary.unpricedGenerations?
      "· "+fmt(summary.unpricedGenerations)+" neoceněných":""}</span></div>
  </div>
  <section className="ed-card ed-report__section">
   <h2>Měsíční vývoj</h2>
   <div className="ed-table-wrap"><table className="ed-table">
    <thead><tr><th>Měsíc</th><th>Generování</th><th>Vstupní tokeny</th>
     <th>Výstupní tokeny</th></tr></thead>
    <tbody>{timeline.map(([month,x])=><tr key={month}><td>{month}</td>
     <td>{fmt(x.count)}</td><td>{fmt(x.input)}</td><td>{fmt(x.output)}</td>
    </tr>)}</tbody>
   </table></div>
   {!timeline.length?<p className="ed-quiet">Zatím nebylo zaznamenané generování.</p>:null}
  </section>
  <section className="ed-card ed-report__section">
   <h2>Poslední generování</h2>
   <div className="ed-table-wrap"><table className="ed-table">
    <thead><tr><th>Čas</th><th>Editor</th><th>Model</th>
     <th>Vstup</th><th>Výstup</th><th>Cena</th></tr></thead>
    <tbody>{rows.slice(0,50).map(x=><tr key={x.generation_id}>
     <td>{new Date(x.recorded_at).toLocaleString("cs-CZ")}</td>
     <td>{names.get(x.requested_by)??"Neznámý editor"}</td>
     <td>{x.model}</td><td>{x.input_tokens??"?"}</td><td>{x.output_tokens??"?"}</td>
     <td>{x.cost_usd===null?"Čeká na vyúčtování":usd(x.cost_usd)}</td>
    </tr>)}</tbody>
   </table></div>
  </section></>}
 </main>;
}
