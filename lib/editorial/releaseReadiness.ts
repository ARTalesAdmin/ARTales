export type EditorialTaskState={
 kind:string; status:string; revision_sha256:string
};
export type ReleaseReadinessInput={
 latestSha:string|null;
 revisionStatus:string|null;
 imageSelection:string|null;
 legalApproved:boolean;
 snapshotConfirmed:boolean;sourceAuthorized:boolean;
 published:boolean;
 tasks:EditorialTaskState[];
 openFindings:number|null;
 unacceptedChanges:number|null;
 pendingAi:boolean;
 metadata:{
  authorId:string|null;collectionId:string|null;
  descriptionCs:string|null;descriptionEn:string|null;
  coverPath:string|null;coverAlt:string|null
 }|null;
 author:{bioCs:string|null;bioEn:string|null;portraitPath:string|null;portraitAlt:string|null}|null;
 collection:{descriptionCs:string|null;descriptionEn:string|null}|null;
};
const completeBilingual=(cs:string|null|undefined,en:string|null|undefined)=>
 [cs,en].every(value=>{const length=(value??"").trim().length;return length>=200&&length<=800;});
/** Presentation-only readiness. Publication RPC independently checks all evidence
 * and storage objects inside its authorized transaction. */
export function assessEditorialRelease(input:ReleaseReadinessInput){
 const blockers:string[]=[];
 const task=(kind:string)=>input.tasks.find(t=>t.kind===kind);
 const metadata=input.metadata;
 if(input.published)blockers.push("Dílo už bylo publikováno.");
 if(!input.latestSha||input.revisionStatus!=="draft"||input.imageSelection!=="none")
  blockers.push("Není dostupná platná aktuální sémantická revize.");
 if(!input.legalApproved)blockers.push("Chybí právní souhlas se zvoleným zdrojem.");
 if(!input.snapshotConfirmed)blockers.push("Chybí ověřená shoda archivovaného textu.");
 if(!input.sourceAuthorized)blockers.push("Archivní zdroj neodpovídá právnímu schválení nebo ověřenému snapshotu.");
 if(!input.latestSha||!input.tasks.some(t=>t.kind==="text_review"&&
    t.revision_sha256===input.latestSha&&t.status==="completed"))
  blockers.push("Aktuální textová revize nemá dokončené QA.");
 if(input.openFindings===null||input.openFindings>0)
  blockers.push("Zbývají otevřené nálezy nebo nelze ověřit jejich stav.");
 if(input.unacceptedChanges===null||input.unacceptedChanges>0)
  blockers.push("Opravy aktuální revize nejsou všechny přijaty.");
 if(input.pendingAi)blockers.push("AI stále zpracovává opravy.");
 for(const [kind,label] of [
  ["cover_art","Obálka"],["work_description","Anotace"],["collection_curation","Kolekce"]
 ] as const)
  if(task(kind)?.status!=="completed")blockers.push(label+": dokončit redakční úkol"+(kind==="cover_art"?" a nahrát soubor":"")+".");
 for(const [kind,label] of [["author_bio","Text autora"],["author_visual","Vizuál autora"]] as const)
  if(task(kind)&&task(kind)?.status!=="completed")blockers.push(label+": dokončit redakční úkol"+(kind==="author_visual"?" a nahrát portrét":"")+".");
 if(!metadata||!completeBilingual(metadata.descriptionCs,metadata.descriptionEn))
  blockers.push("Chybí platná česká a anglická anotace.");
 if(task("cover_art")?.status==="completed"&&(!metadata?.coverPath||(metadata.coverAlt??"").trim().length<8))
  blockers.push("Dokončená obálka nemá platný soubor nebo popis.");
 if(!metadata?.authorId||!input.author||!completeBilingual(input.author.bioCs,input.author.bioEn))
  blockers.push("Profil autora není kompletní v obou jazycích.");
 if(task("author_visual")?.status==="completed"&&(!input.author?.portraitPath||(input.author.portraitAlt??"").trim().length<8))
  blockers.push("Dokončený vizuál autora nemá platný portrét nebo popis.");
 if(!metadata?.collectionId||!input.collection||
    !completeBilingual(input.collection.descriptionCs,input.collection.descriptionEn))
  blockers.push("Kolekce nemá kompletní dvojjazyčný popis.");
 // Individual incomplete tasks already explain the relevant redaction blockers.
 if(input.tasks.some(t=>t.status==="open"||t.status==="claimed"||t.status==="returned")&&
    !input.tasks.some(t=>["cover_art","work_description","collection_curation","author_bio","author_visual"].includes(t.kind)&&
      ["open","claimed","returned"].includes(t.status)))
  blockers.push("Zbývá další nedokončená kontrola.");
 return {ready:blockers.length===0,blockers};
}
