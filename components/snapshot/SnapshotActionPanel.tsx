"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import type {SnapshotActionState} from "@/lib/ingest/generalSnapshotAction";

/** Shared, server-rendered action surface: Legal detail and Snapshot detail.
 * The POST route is independently gated by active admin authentication and
 * a fresh legally approved lock. Rendering the control grants no capability.
 */
export function SnapshotActionPanel({candidateId,state,canArchive}:{
 candidateId:string;
 state:SnapshotActionState;
 canArchive:boolean;
}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const archive=async()=>{
  if(busy)return;
  setBusy(true);setError("");
  try{
   const form=new URLSearchParams({candidate_id:candidateId,private_original_retention:"archive_only"});
   const response=await fetch("/api/member/snapshot/"+candidateId,{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:form.toString(),credentials:"same-origin",cache:"no-store"
   });
   if(response.ok&&response.redirected){
    const dest=new URL(response.url);
    if(dest.origin===window.location.origin&&dest.pathname.startsWith("/member/snapshot/")){
     router.push(dest.pathname+dest.search);router.refresh();return;
    }
   }
   const data=await response.json().catch(()=>null) as {error?:string}|null;
   const code=data?.error??"request_failed";
   const help:Record<string,string>={
    source_identity_mismatch:"Název kandidáta neodpovídá uzamčené edici. Právní záznam neměň; je potřeba zkontrolovat shodu.",
    catalog_author_or_title_mismatch:"Katalog nedokázal potvrdit stejnou edici a autora.",
    snapshot_catalog_unavailable:"Katalog Gutenbergu je dočasně nedostupný.",
    snapshot_mirror_unavailable:"Zdrojový EPUB není momentálně dostupný.",
    snapshot_claim_requires_owner_inspection:"Předchozí archivaci musí bezpečně dokončit původní editor.",
    candidate_progress_forbidden:"Nemáš oprávnění pokračovat v archivaci."
   };
   setError(help[code]??"Archivace se nepodařila ("+code+"). Dosavadní záznamy zůstaly zachované.");
  }catch{
   setError("Spojení selhalo. Archivace nebyla potvrzena; před dalším pokusem obnov stav stránky.");
  }finally{setBusy(false);}
 };
 return <>
  <p><strong>{state.status==="ready"?"Připraveno k pokračování":state.status==="archived_verification_pending"?"Zdroj připraven":state.actionLabel}</strong></p>
  {state.status==="archived_verification_pending"?<p>Originál je bezpečně uložen. Další krok automaticky připraví text pro redakci; nic není zveřejněno.</p>:null}
  {state.status==="verified_for_composition"?<p>Kontrola shody byla potvrzena. Pokračuj automatickým zpracováním do redakční karty.</p>:null}
  {state.status==="archiving"||state.status==="acquiring"?<p>Archivace probíhá. Nezahajujte druhý pokus.</p>:null}
  {state.status==="recovery_ready"?<p role="status">Předchozí pokus založil archivní claim, ale upload selhal. Bez změny právního rozhodnutí systém znovu ověří stejný zdroj a SHA-256 a dokončí archivaci pouze při přesné shodě. Nic nepřepisuje.</p>:null}
  {state.status==="reconciliation_required"?<p role="alert">Existuje archivní claim bez potvrzeného receipt. Nové stažení ani upload nejsou povoleny. Administrátor musí prověřit originál ve Storage, SHA-256 a zápisy registru.</p>:null}
  {state.status==="failed"||state.status==="acquisition_required"?<p>Akci nelze automaticky dokončit. Je nutná kontrola zdroje nebo předchozího pokusu.</p>:null}
  {state.status==="ready"&&!canArchive?<p>Zdroj je připraven. Soukromý Snapshot může dokončit pouze oprávněný vlastník zpracování nebo administrátor.</p>:null}
  {(state.status==="ready"||state.status==="recovery_ready")&&canArchive?<>
    <p>Původní vydání bude bezpečně uloženo do soukromého archivu; ilustrace nebudou součástí veřejného vydání. Následně systém automaticky připraví text.</p>
    <div className="ca-form">
      <button type="button" className="ca-btn ca-primary" disabled={busy}
       onClick={()=>void archive()}>{busy?"Připravuji archiv…":
        state.status==="recovery_ready"?"Dokončit přípravu":"Pokračovat v přípravě"}</button>
      {error?<p className="ca-error" role="alert">{error}</p>:null}
    </div>
  </>:null}
 </>;
}
