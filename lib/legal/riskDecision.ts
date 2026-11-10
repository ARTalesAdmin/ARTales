/** Narrow, auditable acceptance of missing Gutenberg bibliographic evidence.
 * It is not a finding of public domain. Positive evidence of protection always
 * wins; source identity and text-only scope are mandatory.
 */
export type RiskFinding={schema?:string;outcome?:string;gutenbergId?:number;
 text?:{status?:string;people?:Array<{name?:string;died?:number|null}>};
 translation?:{status?:string;people?:Array<{name?:string;died?:number|null}>};
 gutenbergUsStatus?:string;sourceTextStatus?:string;sourceTextNotice?:string|null;
 originalPublicationYear?:number|null};
export type RiskSource={source_kind:string;source_url:string;download_url:string|null;
 identity_match:string;language_match:string;illustration_use:string;original_rights:string;
 translation_rights:string;source_terms:string;notes:string};
export type RiskAssessment={eligible:boolean;uncertainties:string[];blocking:string[];gutenbergId:number|null};
export function assessGutenbergRisk(source:RiskSource,year=new Date().getUTCFullYear()):RiskAssessment{
 const blocking:string[]=[],uncertainties:string[]=[];
 const idMatch=/^https:\/\/www\.gutenberg\.org\/ebooks\/([1-9][0-9]{0,7})$/.exec(source.source_url);
 const gutenbergId=idMatch?Number(idMatch[1]):null;
 if(source.source_kind!=="gutenberg"||gutenbergId===null||
    !source.download_url?.startsWith(source.source_url+".")||
    !source.download_url.includes(".epub")||
    source.identity_match!=="confirmed"||source.language_match!=="matches")
  blocking.push("Není ověřená totožnost a konkrétní EPUB edice");
 if(source.illustration_use!=="excluded")blocking.push("Ilustrace nejsou vyloučeny");
 if(["restricted"].includes(source.original_rights)||source.translation_rights==="restricted"||
    source.source_terms==="restricted")blocking.push("Výslovné omezení práv u zdroje");
 let audit:RiskFinding={};
 try{audit=JSON.parse(source.notes) as RiskFinding;}catch{blocking.push("Neplatný právní audit");}
 if(audit.schema!=="artales.public-domain-check.v1"||audit.gutenbergId!==gutenbergId)
  blocking.push("Právní audit neodpovídá edici");
 if(audit.gutenbergUsStatus==="restricted"||audit.sourceTextStatus==="possible_restriction"||
    Boolean(audit.sourceTextNotice))
  blocking.push("Výslovné upozornění na omezení v předaných podkladech");
 for(const [label,component] of [["autor nebo editor",audit.text],["překladatel",audit.translation]] as const){
  if(component?.status==="protected")blocking.push("Neuplynulá ochranná lhůta: "+label);
  if(component?.status==="unknown")uncertainties.push("Neúplné údaje: "+label);
  for(const person of component?.people??[]){
   if(typeof person.died==="number"&&Number.isInteger(person.died)&&person.died+70>=year)
    blocking.push("Neuplynulá lhůta jmenované osoby: "+person.name);
   if(person.died===null||person.died===undefined)uncertainties.push("Neznámé úmrtí: "+(person.name??label));
  }
 }
 if(!audit.text?.people?.length)uncertainties.push("Nedoložený autor nebo editor");
 if(!audit.originalPublicationYear)uncertainties.push("Nezjištěný rok prvního vydání");
 if(audit.sourceTextStatus!=="no_explicit_notice")uncertainties.push("Neúplná kontrola případných upozornění v textu");
 if(source.source_terms!=="cleared")uncertainties.push("Podmínky zdroje nebyly úplně prověřeny");
 if(source.original_rights!=="public_domain")uncertainties.push("Ochranná doba autora není doložena");
 if(!["not_applicable","public_domain"].includes(source.translation_rights))
  uncertainties.push("Ochranná doba případného překladatele není doložena");
 return {eligible:blocking.length===0&&uncertainties.length>0,
  uncertainties:[...new Set(uncertainties)],blocking:[...new Set(blocking)],gutenbergId};
}
