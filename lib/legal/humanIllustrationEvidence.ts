/** Evidence for a human-reviewed illustration decision on one exact Gutenberg edition.
 * Machine checks stay immutable; a documented, attributable human determination may
 * supplement them. This does NOT grant automatic public use of archived images.
 */
export type HumanIllustrationBasis="public_domain"|"licensed";
export type HumanIllustrationReview={
 contributors:string; basis:HumanIllustrationBasis|"";
 evidenceUrl:string; completeEdition:boolean;
};
const trimLines=(s:string)=>s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
export function humanIllustrationEvidenceIssues(v:HumanIllustrationReview,year:number):string[]{
 const issues:string[]=[];
 const lines=trimLines(v.contributors);
 if(!Number.isSafeInteger(year)||year<2025||year>2100)issues.push("Neplatný rok posouzení.");
 if(!["public_domain","licensed"].includes(v.basis))
  issues.push("Vyber důvod oprávnění: volné dílo nebo licence.");
 if(!lines.length||lines.length>35||v.contributors.length>1600||lines.some(line=>line.length<5))
  issues.push("Uveď jména autorů ilustrací, nejlépe jednoho na řádek.");
 if(v.basis==="public_domain"){
  const limit=year-71; // CZ/EU: protection expires on January 1 following 70 years after death.
  for(const line of lines){
   const years=[...line.matchAll(/(?:^|[^0-9])([12][0-9]{3})(?![0-9])/g)].map(m=>Number(m[1]));
   if(years.length!==1||years[0]>limit||years[0]<1000)
    issues.push("Každý řádek musí uvádět jméno a jeden rok úmrtí nejpozději "+limit+".");
  }
 }
 let u:URL|null=null;
 try{u=new URL(v.evidenceUrl)}catch{}
 if(!u||u.protocol!=="https:"||!u.hostname||u.username||u.password||u.hash||
    v.evidenceUrl.length>1000)
  issues.push("Přidej přímý HTTPS odkaz na bibliografické nebo licenční podklady.");
 if(!v.completeEdition)issues.push("Potvrď, že důkazy pokrývají ilustrace této konkrétní edice.");
 return [...new Set(issues)];
}
