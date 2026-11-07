export type EditorialTaskState={
 kind:string; status:string; revision_sha256:string
};
export type ReleaseReadinessInput={
 latestSha:string|null;
 revisionStatus:string|null;
 imageSelection:string|null;
 legalApproved:boolean;
 snapshotConfirmed:boolean;
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
  if(task(kind)?.status!=="completed")blockers.push(label+" — úkol není dokončen.");
 for(const [kind,label] of [["author_bio","Text autora"],["author_visual","Vizuál autora"]] as const)
  if(task(kind)&&task(kind)?.status!=="completed")blockers.push(label+" — úkol není dokončen.");
 if(!metadata||!completeBilingual(metadata.descriptionCs,metadata.descriptionEn))
  blockers.push("Chybí platná česká a anglická anotace.");
 if(!metadata?.coverPath||(metadata.coverAlt??"").trim().length<8)
  blockers.push("Chybí obálka nebo její alternativní popis.");
 if(!metadata?.authorId||!input.author||!completeBilingual(input.author.bioCs,input.author.bioEn))
  blockers.push("Profil autora není kompletní v obou jazycích.");
 if(!input.author?.portraitPath||(input.author.portraitAlt??"").trim().length<8)
  blockers.push("Chybí portrét autora nebo alternativní popis.");
 if(!metadata?.collectionId||!input.collection||
    !completeBilingual(input.collection.descriptionCs,input.collection.descriptionEn))
  blockers.push("Kolekce nemá kompletní dvojjazyčný popis.");
 if(input.tasks.some(t=>t.status==="open"||t.status==="claimed"||t.status==="returned"))
  blockers.push("V redakci zbývají nedokončené úkoly.");
 return {ready:blockers.length===0,blockers};
}
