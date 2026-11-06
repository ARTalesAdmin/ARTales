import Link from "next/link";
import {requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {
 buildEditorialTaskReport,monthKey,type EditorialReportTask
} from "@/lib/editorial/taskReport";
import "@/components/editor/editorial-workspace.css";
import "./report.css";

export const dynamic="force-dynamic";
const PAGE_SIZE=500;
async function readAllTasks(db:Awaited<ReturnType<typeof createClient>>){
 const tasks:EditorialReportTask[]=[];
 for(let offset=0;;offset+=PAGE_SIZE){
  const {data,error}=await db.from("artales_editorial_tasks")
   .select("id,candidate_id,kind,status,assigned_to,created_at,completed_at,completed_by")
   .order("created_at",{ascending:true}).order("id",{ascending:true})
   .range(offset,offset+PAGE_SIZE-1);
  if(error)throw Error("Úkolové statistiky nelze bezpečně načíst.");
  const part=(data??[]) as EditorialReportTask[];
  tasks.push(...part);
  if(part.length<PAGE_SIZE)return tasks;
 }
}
function maxBar(value:number,max:number){
 return Math.round(100*value/Math.max(1,max));
}
export default async function EditorialReport({
 searchParams
}:{searchParams:Promise<{month?:string}>}){
 await requireAdmin();
 const db=await createClient();
 const tasks=await readAllTasks(db);
 const ids=[...new Set(tasks.map(t=>t.candidate_id))];
 const [membersRes,...workResults]=await Promise.all([
  db.from("profiles").select("id,display_name").in("role",["admin","editor"]).limit(500),
  ...Array.from({length:Math.ceil(ids.length/100)},(_,i)=>
   db.from("work_candidates").select("id,proposed_title")
    .in("id",ids.slice(i*100,(i+1)*100)))
 ]);
 if(membersRes.error||workResults.some(result=>result.error)){
  throw Error("Redakční statistiky nebylo možné kompletně načíst.");
 }
 const members=(membersRes.data??[]).map(p=>({id:p.id,name:p.display_name??"Člen redakce"}));
 const works=workResults.flatMap(r=>r.data??[])
  .map(w=>({id:w.id,title:w.proposed_title??"Dílo bez názvu"}));
 const requested=(await searchParams).month;
 const thisMonth=monthKey(new Date().toISOString());
 const selectedMonth=requested&&/^\d{4}-(0[1-9]|1[0-2])$/.test(requested)
  ?requested:thisMonth;
 const report=buildEditorialTaskReport(tasks,members,works,selectedMonth);
 const maxValue=Math.max(1,...report.months.map(m=>Math.max(m.assigned,m.completed)));
 return <main className="ed-page ed-report">
  <nav className="ed-breadcrumb" aria-label="Drobečková navigace">
   <Link href="/member/admin/dashboard">Admin přehled</Link>
   <span className="ed-breadcrumb__sep">/</span><span>Redakční výkon</span>
  </nav>
  <header className="ed-hero">
   <p className="ed-eyebrow">ARTales · pouze administrátor</p>
   <div className="ed-hero__row"><div>
    <h1>Redakční úkoly a výkon</h1>
    <p className="ed-hero__subtitle">Přehled práce všech editorů po titulech,
     celkové plnění a měsíční vývoj. Data vycházejí z aktuálních redakčních úkolů.</p>
   </div><Link className="ed-button ed-button--soft" href="/member/editorial-pipeline">
     Otevřít redakční úkoly</Link></div>
  </header>
  <div className="ed-stats ed-report__stats" aria-label="Celkové úkoly">
   <div className="ed-stat"><strong className="ed-stat__value">{report.total}</strong>
    <span className="ed-stat__label">Úkolů celkem</span></div>
   <div className="ed-stat"><strong className="ed-stat__value">{report.completed}</strong>
    <span className="ed-stat__label">Dokončeno</span></div>
   <div className="ed-stat"><strong className="ed-stat__value">{report.active}</strong>
    <span className="ed-stat__label">Aktivních</span></div>
   <div className="ed-stat"><strong className="ed-stat__value">{report.total?
     Math.round(100*report.completed/report.total):0}%</strong>
    <span className="ed-stat__label">Míra dokončení</span></div>
  </div>
  <section className="ed-card ed-report__section">
   <div className="ed-report__section-heading"><div><p className="ed-eyebrow">V čase</p>
    <h2>Měsíční vývoj</h2></div><span>Všechna dostupná období</span></div>
   <p className="ed-quiet">Zlatá: aktuálně přiřazené úkoly podle měsíce jejich založení.
    Zelená: skutečně dokončené úkoly podle data dokončení. Přeřazení v minulosti
    nelze z těchto součtů vyvozovat.</p>
   <div className="ed-report__legend"><span><i className="ed-report__swatch ed-report__swatch--assigned"/> Přiřazené</span>
    <span><i className="ed-report__swatch ed-report__swatch--done"/> Dokončené</span></div>
   {report.months.length?<div className="ed-report__chart" role="img"
    aria-label="Měsíční graf přiřazených a dokončených úkolů">
    {report.months.map(month=><div className="ed-report__chart-group" key={month.month}>
     <div className="ed-report__bar-pair">
      <div className="ed-report__bar ed-report__bar--assigned"
       style={{height:maxBar(month.assigned,maxValue)+"%"}}
       title={month.assigned+" přiřazených"}><span>{month.assigned}</span></div>
      <div className="ed-report__bar ed-report__bar--done"
       style={{height:maxBar(month.completed,maxValue)+"%"}}
       title={month.completed+" dokončených"}><span>{month.completed}</span></div>
     </div><strong>{month.month}</strong>
    </div>)}
   </div>:<p className="ed-quiet">Zatím žádná evidovaná práce.</p>}
  </section>
  <section className="ed-card ed-report__section">
   <div className="ed-report__section-heading"><div><p className="ed-eyebrow">Tým</p>
    <h2>Výkon jednotlivých členů</h2></div>
    <form className="ed-report__month-filter" method="get">
     <label htmlFor="report-month">Období</label>
     <select id="report-month" name="month" defaultValue={selectedMonth}>
      {[...new Set([thisMonth,selectedMonth,...report.months.map(m=>m.month)])]
       .sort((a,b)=>b.localeCompare(a)).map(month=><option key={month} value={month}>{month}</option>)}
     </select>
     <button className="ed-button ed-button--soft" type="submit">Zobrazit</button>
    </form>
   </div>
   <div className="ed-table-wrap"><table className="ed-table">
    <thead><tr><th>Člen</th><th>Přiřazeno celkem</th><th>Přiřazeno {selectedMonth}</th>
     <th>Aktivní</th><th>Dokončeno celkem</th><th>Dokončeno {selectedMonth}</th></tr></thead>
    <tbody>{report.members.map(member=><tr key={member.id}>
     <th scope="row">{member.name}</th><td>{member.assigned}</td>
     <td>{member.assignedThisMonth}</td><td>{member.active}</td>
     <td>{member.completed}</td><td>{member.completedThisMonth}</td>
    </tr>)}</tbody>
   </table></div>
   <p className="ed-quiet">Přiřazeno = současný vlastník úkolu; dokončeno = skutečný
    autor uzavření. Historické přesuny vlastnictví se nepřisuzují současnému členovi.</p>
  </section>
  <section className="ed-card ed-report__section">
   <div className="ed-report__section-heading"><div><p className="ed-eyebrow">Tituly</p>
    <h2>Plnění po dílech</h2></div><span>{report.titles.length} titulů</span></div>
   <div className="ed-report__titles">{report.titles.map(title=><article key={title.id}
    className="ed-report__title">
    <div className="ed-report__title-heading"><div><h3>{title.title}</h3>
     <Link href={"/member/editorial-detail/"+title.id}>Karta díla</Link></div>
     <strong>{title.completed}/{title.assigned+title.unassigned} hotovo</strong></div>
    <progress max={Math.max(1,title.assigned+title.unassigned)}
     value={title.completed} aria-label={"Plnění díla "+title.title}/>
    <p>{title.active} aktivních · {title.unassigned} bez vlastníka</p>
   </article>)}</div>
   {!report.titles.length?<p className="ed-quiet">Zatím žádné tituly.</p>:null}
  </section>
 </main>;
}
