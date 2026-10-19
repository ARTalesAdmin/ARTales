"use client";
import {useState} from "react";
type Live={ok:boolean;title?:string;author?:string;sourceUrl?:string;firstPublished?:number|null;authorBorn?:number|null;authorDied?:number|null;outcome?:string;reason?:string;detail?:string;searched?:number};
export default function OneLiveTitle(){
 const [busy,setBusy]=useState(false),[data,setData]=useState<Live|null>(null);
 async function run(){setBusy(true);setData(null);try{const r=await fetch("/api/fixture/prescreen/live",{method:"POST"});setData(await r.json());}catch{setData({ok:false,detail:"network_unavailable"});}finally{setBusy(false);}}
 return <section style={{border:"1px solid #7b8c94",padding:18,marginTop:22}}>
 <h2>Jedno živé dohledání — Open Library</h2>
 <p>Ověření spojení na skutečném bibliografickém zdroji. Zkusíme jednu esej, bez zápisu a bez právního verdiktu. Kontrola duplicity platí pouze vůči fiktivní fixture.</p>
 <button type="button" onClick={run} disabled={busy}>{busy?"Ověřuji katalog…":"Dohledat 1 skutečný titul"}</button>
 {data&&<div aria-live="polite" style={{marginTop:12}}>
 {data.ok?<><p><strong>{data.title}</strong> — {data.author}</p><p>První vydání: {data.firstPublished??"nezjištěno"} · autor {data.authorBorn??"?"}–{data.authorDied??"?"}</p><p>Výsledek: {data.outcome} ({data.reason})</p><a href={data.sourceUrl} target="_blank" rel="noreferrer">Otevřít původní katalogový záznam</a></>:<p role="alert">Rešerše neprošla: {data.detail??"nenalezen použitelný výsledek"}</p>}
 </div>}</section>;
}
