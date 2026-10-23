import Link from "next/link";
import { requireEditorOrAdmin } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import "./candidates.css";
export default async function CandidatesPage({searchParams}:{searchParams:Promise<{status?:string;q?:string}>}) {
 await requireEditorOrAdmin();
 const db=await createClient();
 const {status="",q=""}=await searchParams;
 const {data,error}=await db.from("work_candidates").select("id,proposed_title,proposed_author_name,status,priority,origin,rights_status,updated_at").order("priority",{ascending:false}).order("created_at",{ascending:true}).limit(250);
 const statuses:Record<string,string>={new:"Nový",checking:"V posouzení",ready:"Připraveno pro právní screen",deferred:"Odloženo",rejected:"Zamítnuto"};
 const rows=(data??[]).filter(c=>(!status||c.status===status)&&(!q||[c.proposed_title,c.proposed_author_name].join(" ").toLocaleLowerCase("cs").includes(q.toLocaleLowerCase("cs"))));
 return <main className="ca-root"><header className="ca-head"><div><p className="ca-eyebrow">ARTales / Redakce</p><h1>Kandidáti</h1><p>Trvalý seznam námětů. Právní posouzení a výběr konkrétní edice následují až později.</p></div><Link className="ca-btn ca-primary" href="/member/candidates/new">+ Přidat kandidáta</Link></header>
 <nav className="ca-links"><Link href="/member">← Pracovní nástroje</Link> · <Link href="/member/admin/prescreen/shadow">Stínová knihovna (administrátor)</Link></nav>
 <form className="ca-filters"><label>Vyhledat<input name="q" defaultValue={q} placeholder="Název nebo autor"/></label><label>Stav<select name="status" defaultValue={status}><option value="">Všechny stavy</option>{Object.entries(statuses).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><button className="ca-btn ca-secondary" type="submit">Filtrovat</button></form>
 {error?<p className="ca-error" role="alert">Kandidáty se nepodařilo načíst. Databázová migrace možná zatím není aktivní.</p>:rows.length===0?<section className="ca-card">Zatím tu nejsou kandidáti odpovídající filtru.</section>:<div className="ca-list">{rows.map(c=><article className="ca-card" key={c.id}><div><h2>{c.proposed_title}</h2><p>{c.proposed_author_name}</p><small>{statuses[c.status]??c.status} · Priorita {c.priority} · {c.origin==="prescreen"?"Z Prescreenu":"Ručně"} · Práva: {c.rights_status==="unknown"?"neprověřena":c.rights_status}</small></div><Link className="ca-btn ca-secondary" href={`/member/candidates/${c.id}`}>Detail →</Link></article>)}</div>}</main>;
}