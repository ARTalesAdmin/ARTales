/** Pure generalized Legal -> Snapshot action state; not a persistence or rights grant. */
export type SnapshotActionStatus="legal_not_approved"|"not_locked"|"ready"|"acquisition_required"|"acquiring"|"archiving"|"archived_verification_pending"|"verified_for_composition"|"failed"|"rejected";
export type SnapshotActionEvidence=Readonly<{approved:boolean;locked:boolean;sourceAvailable:boolean;receipt?:{sha256:string;readbackVerified:boolean}|null;editionVerified?:boolean;rejected?:boolean;operation?:"acquiring"|"archiving"|null;failed?:boolean}>;
export type SnapshotActionState=Readonly<{schema:"artales.snapshot-action-state.v1";status:SnapshotActionStatus;canStart:boolean;actionLabel:string;semanticReady:boolean;publicationAuthorized:false}>;
export function deriveSnapshotActionState(e:SnapshotActionEvidence):SnapshotActionState{
 const result=(status:SnapshotActionStatus,canStart=false,actionLabel="Zobrazit stav",semanticReady=false):SnapshotActionState=>({schema:"artales.snapshot-action-state.v1",status,canStart,actionLabel,semanticReady,publicationAuthorized:false});
 if(e.rejected)return result("rejected",false,"Vyřazeno");
 if(!e.approved)return result("legal_not_approved",false,"Čeká na schválení");
 if(!e.locked)return result("not_locked",false,"Uzamknout zdroj");
 if(e.receipt){
  if(!e.receipt.readbackVerified||!/^[a-f0-9]{64}$/.test(e.receipt.sha256))return result("failed",false,"Prověřit archiv");
  return e.editionVerified?result("verified_for_composition",false,"Předat do kompozice",true):result("archived_verification_pending",false,"Ověřit obsah");
 }
 if(e.operation)return result(e.operation);
 if(e.failed)return result("failed",false,"Prověřit pokus");
 if(!e.sourceAvailable)return result("acquisition_required",false,"Vybrat zdroj");
 return result("ready",true,"Vytvořit Snapshot");
}
