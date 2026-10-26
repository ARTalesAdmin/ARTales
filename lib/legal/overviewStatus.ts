/** Reader-friendly editorial stages for the Legal Screen overview.
 * "Processed" is a completed editorial decision (locked for Snapshot or rejected),
 * not proof that a Snapshot itself has been created.
 */
export const legalOverviewFilters={
 all:"Všechny",
 pending:"K prověření",
 verified:"Ověřené",
 processed:"Zpracované"
} as const;
export type LegalOverviewFilter=keyof typeof legalOverviewFilters;
export type LegalOverviewStage="not_checked"|"in_review"|"verified"|"locked"|"rejected";

export function legalOverviewStage(locked:boolean,lastDecision?:{verdict:string}|null):LegalOverviewStage{
 if(locked)return "locked";
 if(!lastDecision)return "not_checked";
 if(lastDecision.verdict==="approved")return "verified";
 if(lastDecision.verdict==="rejected")return "rejected";
 return "in_review";
}
export function legalOverviewMatches(stage:LegalOverviewStage,filter:LegalOverviewFilter):boolean{
 if(filter==="all")return true;
 if(filter==="pending")return stage==="not_checked"||stage==="in_review";
 if(filter==="verified")return stage==="verified";
 return stage==="locked"||stage==="rejected";
}
export const legalOverviewPresentation:Record<LegalOverviewStage,{label:string;hint:string;action:string}>={
 not_checked:{label:"Čeká na check",hint:"Ještě nebyl spuštěn právní check.",action:"Provést check"},
 in_review:{label:"Čeká na rozhodnutí",hint:"Otevřít poslední posouzení a rozhodnout.",action:"Pokračovat"},
 verified:{label:"Ověřeno",hint:"Připraveno k uzamčení a předání pro Snapshot.",action:"Připravit pro Snapshot"},
 locked:{label:"Zpracováno",hint:"Zdroj je uzamčený a připravený pro Snapshot.",action:"Zobrazit předání"},
 rejected:{label:"Vyřazeno (NE)",hint:"Negativní rozhodnutí je uložené v historii.",action:"Zobrazit rozhodnutí"}
};
