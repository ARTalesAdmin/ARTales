"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";

/** Runs an existing authenticated server operation and keeps failures in the
 * Snapshot workspace, rather than navigating users to a raw JSON response. */
export function AutomaticSnapshotCompose({candidateId,autoStart=false}:{candidateId:string;autoStart?:boolean}){
 const router=useRouter();
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const started=useRef(false);
 const labels:Record<string,string>={
  legal_components_not_cleared_for_text_only:
   "Schválený právní záznam neobsahuje všechny povinné složky textového vydání. Ověř práva původního textu i překladatelů, shodu jazyka a podmínky zdroje; ilustrace se pouze vylučují.",
  translation_approval_evidence_incomplete:
   "Překlad nebyl ověřen: schází úplná totožnost, práva nebo datace některého překladatele v uzamčeném právním auditu.",
  live_rdf_translation_identity_conflict:
   "Údaje o překladatelích v aktuálním katalogu neodpovídají schválenému právnímu auditu.",
  author_identity_or_death_term_unverified:
   "Rozpor v identitě nebo ochranné lhůtě doloženého tvůrce. Podklady z právní kontroly je nutné zkontrolovat.",
  text_creator_identity_role_or_death_unverified:
   "U některého textového tvůrce chybí ověřená role nebo rok úmrtí.",
  candidate_contributor_identity_unverified:
   "Údaj o tvůrci v kandidátovi neodpovídá schválenému právnímu dokladu.",
  prescreen_death_conflicts_with_legal_evidence:
   "Rok úmrtí v bibliografické evidenci odporuje schválenému právnímu dokladu.",
  live_rdf_contradicts_locked_legal_evidence:
   "Aktuální katalogové údaje se liší od uzamčené právní kontroly.",
  live_rdf_translation_requires_separate_clearance:
   "V aktuálním katalogu je uveden překladatel; jeho práva vyžadují vlastní posouzení.",
  text_contains_unresolved_credits_or_rights:
   "Text archivované edice obsahuje možné právní upozornění nebo údaj o překladu.",
  independent_edition_bytes_mismatch:
   "Nezávisle získaný originál se neshoduje s archivem. Archiv zůstal beze změny.",
  independent_mirror_unavailable__retry_later:
   "Ověřovací Gutenberg zrcadlo je nyní nedostupné. Žádná revize nevznikla; zkus akci znovu později.",
  approved_legal_audit_incomplete:
   "Schválené právní podklady jsou neúplné. Není možné vytvořit revizi bez ověření.",
  linked_evidence_unavailable:
   "Některý z archivních nebo právních dokladů není dostupný.",
  legal_or_archive_unavailable:
   "Nepodařilo se načíst uzamčený zdroj nebo archivní soubor.",
  candidate_progress_forbidden:"Tento titul může dále zpracovat jen jeho původní editor nebo administrátor.",
  semantic_revision_insert_failed:
   "Ověření doběhlo, ale nepodařilo se uložit sémantickou revizi. Zkontroluj stav díla před opakováním."
 };
 const run=useCallback(async()=>{
  if(pending)return;
  setPending(true);setError("");
  try{
   const response=await fetch("/api/member/snapshot/"+candidateId+"/auto-compose",{
    method:"POST",credentials:"same-origin",headers:{"Accept":"application/json"}
   });
   if(response.redirected){
    const destination=new URL(response.url);
    if(destination.origin===window.location.origin&&
      destination.pathname==="/member/editorial-detail/"+candidateId){
     router.push(destination.pathname+destination.search+destination.hash);router.refresh();return;
    }
    throw Error("unexpected_redirect");
   }
   let code="compose_failed";
   try{const payload=await response.json();if(typeof payload?.error==="string")code=payload.error;}
   catch{}
   setError(labels[code]??"Automatické zpracování nebylo dokončeno ("+code+"). Archiv i právní rozhodnutí zůstaly zachované.");
  }catch{
   setError("Spojení se nepodařilo dokončit. Zkontroluj stav Snapshotu před opakováním.");
  }finally{setPending(false);}
 },[candidateId,pending,router]);
 useEffect(()=>{
  if(autoStart&&!started.current){started.current=true;void run();}
 },[autoStart,run]);
 return <div className="ca-form">
  <button type="button" className="ca-btn ca-primary" onClick={run} disabled={pending}>
   {pending?"Připravuji textové bloky…":"Pokračovat do redakce"}
  </button>
  {error?<p role="alert" className="ca-error">{error}</p>:null}
  <p className="ca-hint">Úspěšné zpracování otevře redakční kartu s úkoly a odkazem na textové QA. Při chybě zůstaneš tady a uvidíš její příčinu.</p>
 </div>;
};
