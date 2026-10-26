import type {GutenbergBook,CatalogPerson} from "./gutenbergCatalog";
import type {VerifiedRights} from "./gutenbergRights";
import type {TextRightsCheck} from "./textRightsCheck";
import type {EpubInspection} from "./epubInspection";

/** Editorial public-domain fact check, not a legal opinion or a Gutenberg licence grant. */
export type LegalOutcome="no"|"yes_without_illustrations"|"yes_with_illustrations";
export type TermStatus="public_domain"|"protected"|"unknown"|"not_applicable";
export type PersonEvidence={name:string;died:number|null;role:string;source:string};
export type ComponentEvidence={status:TermStatus;people:PersonEvidence[];basis:string};
export type PublicDomainCheck={
 schema:"artales.public-domain-check.v1";outcome:LegalOutcome;reason:string;
 text:ComponentEvidence;translation:ComponentEvidence;illustrations:ComponentEvidence;
 originalPublicationYear:number|null;gutenbergId:number;gutenbergCatalogUrl:string;
 gutenbergRdfUrl:string;gutenbergUsStatus:string;sourceTextStatus:string;
 sourceTextNotice:string|null;sourceEpubImageCount:number|null;
 publicationNote:string;editionLanguage:string|null;inferences:string[];
};
const currentYear=new Date().getFullYear();
export const deathTerm=(death:number|null,year=currentYear):TermStatus=>{
 if(death===null||!Number.isInteger(death)||death<1000||death>year)return "unknown";
 return death+70<year?"public_domain":"protected";
};
function component(people:PersonEvidence[],basis:string,year=currentYear):ComponentEvidence{
 const terms=people.map(p=>deathTerm(p.died,year));
 return {status:terms.includes("protected")?"protected":terms.length>0&&terms.every(s=>s==="public_domain")?"public_domain":"unknown",people,basis};
}
const personKey=(v:string)=>v.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g,"").trim();
const unique=(items:PersonEvidence[])=>items.filter((p,i)=>items.findIndex(x=>personKey(x.name)===personKey(p.name))===i);
export function assessPublicDomain(input:{
 book:GutenbergBook;rights:VerifiedRights;prescreenDeath:number|null;candidateAuthor:string;
 originalPublicationYear:number|null;textCheck:TextRightsCheck;epub:EpubInspection;
 year?:number;
}):PublicDomainCheck{
 const {book,rights,prescreenDeath,candidateAuthor,originalPublicationYear,textCheck,epub}=input;
 const year=input.year??currentYear;
 const asPerson=(p:CatalogPerson,role:string,source:string):PersonEvidence=>({name:p.name,died:p.died,role,source});
 const direct=rights.people.map(p=>asPerson(p,"autor",rights.url));
 // Some historical anthologies have a Gutenberg editor role, not an author role.
 const editors=rights.contributors.filter(p=>/marcrel:edt$/.test(p.role)).map(p=>({name:p.name,died:p.died,role:"editor",source:rights.url}));
 const fallback=book.authors.map(p=>asPerson(p,"autor",book.catalogUrl));
 const primary=unique(direct.length?direct:editors.length?editors:fallback.length?fallback:[{name:candidateAuthor,died:prescreenDeath,role:"autor/editor uvedený v Prescreenu",source:book.catalogUrl}]);
 const primaries=primary.map(p=>({...p,died:p.died??(primary.length===1?prescreenDeath:null)}));
 const text=component(primaries,"Úmrtí tvůrce nebo editora historického vydání + 70 let v ČR/EU",year);
 const translators=rights.contributors.filter(p=>/marcrel:trl$/.test(p.role)).map(p=>({name:p.name,died:p.died,role:"překladatel",source:rights.url}));
 if(!translators.length)for(const p of book.translators)translators.push(asPerson(p,"překladatel",book.catalogUrl));
 const images=rights.contributors.filter(p=>/marcrel:(?:ill|art)$/.test(p.role)).map(p=>({name:p.name,died:p.died,role:"ilustrátor",source:rights.url}));
 const allTranslators=unique(translators),allIllustrators=unique(images);
 const inferences:string[]=[];
 const historicFirstEdition=originalPublicationYear!==null&&originalPublicationYear<=year-120;
 let translation:ComponentEvidence;
 if(allTranslators.length)translation=component(allTranslators,"Úmrtí překladatele + 70 let v ČR/EU",year);
 else if(textCheck.translationCredit&&!historicFirstEdition)translation={status:"unknown",people:[],basis:"V textu je zmíněn překlad bez identifikovaného překladatele"};
 else {
  translation={status:"not_applicable",people:[],basis:historicFirstEdition?
   "Kontroluje se původní historické vydání (nikoli novější překlad nebo adaptace).":"V katalogu ani prověřené části textu nebyl uveden samostatný překladatel"};
  inferences.push(historicFirstEdition?"Historická edice: zahrnuté starší překlady a převyprávění jsou předběžně posouzeny na úrovni vydání; novější přídavky je nutné vyřadit.":"Nezjištěný překladatel sám o sobě neprokazuje původnost; editor potvrzuje shodu původní edice.");
 }
 const illustrationEvidence=allIllustrators.length?component(allIllustrators,"Úmrtí ilustrátora + 70 let v ČR/EU",year):{status:"unknown" as TermStatus,people:[],basis:"Nedoložený ilustrátor; obrazové soubory nepřebírat"};
 const illustrations:ComponentEvidence=epub.checked&&epub.imageCount===0?{...illustrationEvidence,status:"not_applicable",basis:"V prověřeném EPUB nebyly nalezeny další obrázky"}:illustrationEvidence;
 const explicitRestriction=textCheck.status==="possible_restriction"||!!epub.notice||rights.usStatus==="restricted";
 const laterEdition=originalPublicationYear!==null&&primaries.some(p=>p.died!==null&&originalPublicationYear>p.died+70);
 if(laterEdition)inferences.push("Vydání může spadat pod zvláštní režim prvního zveřejnění po uplynutí práv – nutno prověřit.");
 const textBlocked=text.status==="protected"||translation.status==="protected"||explicitRestriction||laterEdition;
 const textUnknown=text.status==="unknown"||translation.status==="unknown";
 const withImages=illustrations.status==="public_domain"&&epub.checked&&epub.imageCount!==null&&epub.imageCount>0;
 const outcome:LegalOutcome=textBlocked||textUnknown?"no":withImages?"yes_with_illustrations":"yes_without_illustrations";
 const reason=textBlocked?"Text, překlad nebo podmínky zdroje vykazují konkrétní překážku; zatím nepřevzít."
  :textUnknown?"Chybí rozhodující datum či identita autora nebo překladatele; text zatím nepotvrzovat."
  :withImages?"Text i identifikovaní ilustrátoři splňují obvyklou ochrannou lhůtu."
  :"Text splňuje předběžnou kontrolu datací; ilustrace nepřebírat bez samostatného doložení.";
 return {schema:"artales.public-domain-check.v1",outcome,reason,text,translation,illustrations,
  originalPublicationYear,gutenbergId:book.id,gutenbergCatalogUrl:book.catalogUrl,gutenbergRdfUrl:rights.url,
  gutenbergUsStatus:rights.usStatus,sourceTextStatus:textCheck.status,sourceTextNotice:textCheck.notice??epub.notice,
  sourceEpubImageCount:epub.imageCount,editionLanguage:book.languages[0]??null,
  publicationNote:"Rok prvního vydání (pokud doložen), nikoli datum zveřejnění elektronické knihy Project Gutenberg.",
  inferences};
}
export function compactCheckEvidence(check:PublicDomainCheck):string{
 const compact=(c:ComponentEvidence)=>({status:c.status,people:c.people.slice(0,8).map(p=>({name:p.name.slice(0,120),died:p.died,role:p.role,source:p.source})) ,basis:c.basis});
 const c={schema:check.schema,outcome:check.outcome,reason:check.reason,
  text:compact(check.text),translation:compact(check.translation),illustrations:compact(check.illustrations),
  originalPublicationYear:check.originalPublicationYear,gutenbergId:check.gutenbergId,
  gutenbergCatalogUrl:check.gutenbergCatalogUrl,gutenbergRdfUrl:check.gutenbergRdfUrl,
  gutenbergUsStatus:check.gutenbergUsStatus,sourceTextStatus:check.sourceTextStatus,
  sourceTextNotice:check.sourceTextNotice,sourceEpubImageCount:check.sourceEpubImageCount,
  inferences:check.inferences};
 const data=JSON.stringify(c);
 if(data.length<=4800)return data;
 // Preserve valid JSON and all decisions; reduce explanatory data only.
 return JSON.stringify({schema:check.schema,outcome:check.outcome,reason:check.reason,
  originalPublicationYear:check.originalPublicationYear,gutenbergId:check.gutenbergId,
  text:{status:check.text.status,people:check.text.people.slice(0,4).map(p=>({name:p.name.slice(0,70),died:p.died}))},
  translation:{status:check.translation.status,people:check.translation.people.slice(0,4).map(p=>({name:p.name.slice(0,70),died:p.died}))},
  illustrations:{status:check.illustrations.status,people:check.illustrations.people.slice(0,4).map(p=>({name:p.name.slice(0,70),died:p.died}))},
  gutenbergCatalogUrl:check.gutenbergCatalogUrl,sourceTextNotice:check.sourceTextNotice?.slice(0,100)??null});
}
