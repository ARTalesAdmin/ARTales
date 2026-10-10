import {
  planCatalogProduction, type CatalogCandidate, type CatalogGenre,
  type CatalogPolicy, type CatalogRunPlan, type CandidateScreen,
} from "@/lib/catalogProductionPlanner"
import { evaluateRightsScan, type RightsScanDossier } from "@/lib/rightsScanDossier"

/**
 * Executable fixture workflow, never a rights oracle or a real candidate writer.
 * Runs entirely in the browser with synthetic books and archived-evidence labels.
 */
type FixtureRisk = "clear" | "translation" | "edition" | "rejected" | "incomplete" | "skip" | "research"

type FixtureTitle = {
  id: string
  title: string
  authorId: string
  author: string
  genre: CatalogGenre
  risk: FixtureRisk
  priority: number
  editorCostUsd: number
}

const titles: FixtureTitle[] = [
  {id:"fiction-01",title:"Cvičné dílo: Lesní příběhy",authorId:"writer-a",author:"Fiktivní autor A",genre:"prose",risk:"clear",priority:86,editorCostUsd:2.1},
  {id:"poetry-01",title:"Cvičné dílo: Svazek veršů",authorId:"writer-b",author:"Fiktivní autor B",genre:"poetry",risk:"translation",priority:93,editorCostUsd:1.6},
  {id:"drama-01",title:"Cvičné dílo: Dvě scény",authorId:"writer-c",author:"Fiktivní autor C",genre:"drama",risk:"clear",priority:83,editorCostUsd:2.3},
  {id:"tale-01",title:"Cvičné dílo: Cizí vydání pohádek",authorId:"writer-d",author:"Fiktivní autor D",genre:"fairy_tale",risk:"rejected",priority:88,editorCostUsd:2.0},
  {id:"poetry-02",title:"Cvičné dílo: Původní básně",authorId:"writer-e",author:"Fiktivní autor E",genre:"poetry",risk:"clear",priority:76,editorCostUsd:1.8},
  {id:"essay-01",title:"Cvičné dílo: Úvahy o knihách",authorId:"writer-f",author:"Fiktivní autor F",genre:"essay",risk:"clear",priority:81,editorCostUsd:2.6},
  {id:"fiction-02",title:"Cvičné dílo: Druhý svazek autora A",authorId:"writer-a",author:"Fiktivní autor A",genre:"prose",risk:"clear",priority:80,editorCostUsd:2.2},
  {id:"tale-02",title:"Cvičné dílo: Staré vyprávění",authorId:"writer-g",author:"Fiktivní autor G",genre:"fairy_tale",risk:"clear",priority:79,editorCostUsd:2.0},
  {id:"fiction-03",title:"Cvičné dílo: Krátké povídky",authorId:"writer-h",author:"Fiktivní autor H",genre:"prose",risk:"edition",priority:82,editorCostUsd:1.9},
  {id:"drama-02",title:"Cvičné dílo: Přeložená hra",authorId:"writer-i",author:"Fiktivní autor I",genre:"drama",risk:"translation",priority:77,editorCostUsd:2.1},
  {id:"essay-02",title:"Cvičné dílo: Zápisky",authorId:"writer-j",author:"Fiktivní autor J",genre:"essay",risk:"clear",priority:71,editorCostUsd:2.0},
  {id:"tale-03",title:"Cvičné dílo: Neúplná edice",authorId:"writer-k",author:"Fiktivní autor K",genre:"fairy_tale",risk:"incomplete",priority:74,editorCostUsd:1.8},
  {id:"poetry-03",title:"Cvičné dílo: Nové verše",authorId:"writer-l",author:"Fiktivní autor L",genre:"poetry",risk:"clear",priority:75,editorCostUsd:2.3},
  {id:"fiction-04",title:"Cvičné dílo: Nevhodný podklad",authorId:"writer-m",author:"Fiktivní autor M",genre:"prose",risk:"skip",priority:85,editorCostUsd:2.2},
  {id:"drama-03",title:"Cvičné dílo: Chybějící rešerše",authorId:"writer-n",author:"Fiktivní autor N",genre:"drama",risk:"research",priority:68,editorCostUsd:2.2},
  {id:"fiction-05",title:"Cvičné dílo: Třetí povídkový výbor",authorId:"writer-o",author:"Fiktivní autor O",genre:"prose",risk:"clear",priority:72,editorCostUsd:2.3},
]

const fixtureHash = "c".repeat(64)
const money = (n:number) => Math.round(n*100)/100

export type DemoCatalogBatch = {
  mode: "synthetic_fixture"
  plan: CatalogRunPlan
  candidates: CatalogCandidate[]
  cohortSizes: number[]
  recommendationByCandidate: Record<string,string>
  runAt: string
  costLimitUsd: number
}

function syntheticDossier(row:FixtureTitle, now:string): RightsScanDossier {
  const sourceId="source-"+row.id, editionId="edition-"+row.id
  const stamp = now
  const baseRights = [
    {componentId:"work",action:"include" as const,finding:row.risk==="rejected"?"denied" as const:"supported" as const,
      confidence:"high" as const,evidenceIds:["evidence"],rationale:"Testovací archivní podklad uvádí modelové oprávnění k původnímu textu."},
    {componentId:"edition",action:row.risk==="edition"?"hold" as const:"exclude" as const,
      finding:"unknown" as const,confidence:"low" as const,evidenceIds:[],
      rationale:"Ediční dodatky modelově odděleny; nebudou součástí připravované verze.",
      exclusionMethod:"omit_from_ingest" as const},
    {componentId:"wrapper",action:"exclude" as const,finding:"unknown" as const,
      confidence:"low" as const,evidenceIds:[],
      rationale:"Doprovodná hlavička a další údaje nejsou součástí samotného textu.",
      exclusionMethod:"omit_from_ingest" as const},
    {componentId:"images",action:"exclude" as const,finding:"unknown" as const,
      confidence:"low" as const,evidenceIds:[],
      rationale:"Cizí ilustrace jsou z modelové edice pro jistotu fyzicky vyřazeny.",
      exclusionMethod:"omit_from_ingest" as const},
    {componentId:"translation",action:row.risk==="translation"?"include" as const:"exclude" as const,
      finding:"unknown" as const,confidence:"low" as const,evidenceIds:[],
      rationale:"Překlad vyžaduje samostatné oprávnění; nelze ho odvodit z práv k originálu.",
      exclusionMethod:row.risk==="translation"?undefined:"omit_from_ingest" as const},
  ]

  return {
    format:"artales-rights-dossier-v1",
    candidateId:row.id,sourceId,editionId,snapshotSetId:"snapshot-set-"+row.id,
    targetJurisdiction:"EU_CZ",policyVersion:"fixture-2026-10",
    scanner:{engine:"synthetic-fixture-no-ai",version:"1",ranAt:stamp},
    capture:{rawSourceSha256:fixtureHash,rawSourceByteLength:2048,
      rawSourceArchiveRef:"synthetic/raw/"+row.id,capturedAt:stamp,
      inventoryComplete:row.risk!=="incomplete",collectorVersion:"fixture-1"},
    snapshots:[
      {id:"work",kind:"WORK_CONTENT",sourceId,editionId,sha256:fixtureHash,byteLength:1024,capturedAt:stamp,archiveRef:"synthetic/work/"+row.id},
      {id:"edition",kind:"EDITION_CONTENT",sourceId,editionId,sha256:fixtureHash,byteLength:100,capturedAt:stamp,archiveRef:"synthetic/edition/"+row.id},
      {id:"wrapper",kind:"SOURCE_WRAPPER",sourceId,editionId,sha256:fixtureHash,byteLength:50,capturedAt:stamp,archiveRef:"synthetic/wrapper/"+row.id},
      {id:"images",kind:"ASSET",sourceId,editionId,sha256:fixtureHash,byteLength:256,capturedAt:stamp,archiveRef:"synthetic/images/"+row.id},
      {id:"translation",kind:"TRANSLATION",sourceId,editionId,sha256:fixtureHash,byteLength:512,capturedAt:stamp,archiveRef:"synthetic/translation/"+row.id}
    ],
    evidence:[{id:"evidence",type:"primary_record",sourceId,editionId,componentIds:["work"],
      sourceUri:"https://example.invalid/synthetic-rights/"+row.id,
      archiveRef:"synthetic/evidence/"+row.id,sha256:fixtureHash,
      capturedAt:stamp,jurisdiction:"EU_CZ",
      claim:"Jde pouze o testovací tvrzení vytvořené pro kontrolu aplikačního workflow."}],
    decisions:baseRights,
  }
}

function recommendedAction(row:FixtureTitle):string {
  if(row.risk==="translation") return "Prověřit jinou edici, nebo vlastní překlad a ilustrace"
  if(row.risk==="rejected") return "Zamítnout zdroj, ověřit jinou verzi díla"
  if(row.risk==="edition") return "Doplnit právní podklad ke konkrétní edici"
  if(row.risk==="incomplete") return "Zopakovat capture úplného vydání"
  if(row.risk==="skip") return "Přejít na perspektivnější titul"
  if(row.risk==="research") return "Dohledat autora, metadata a práva před hlubokým skenem"
  return "Připravit čistý originál bez cizích ilustrací a bez překladu"
}

function toCandidate(row:FixtureTitle, now:string, asOf:string):CatalogCandidate {
  const risk=row.risk
  const prescreen=risk==="skip"?"skip":risk==="research"?"needs_research":"promising"
  let screen:CandidateScreen|null=null
  if(prescreen==="promising"){
    const evaluation=evaluateRightsScan(syntheticDossier(row,now))
    screen={
      outcome:evaluation.outcome==="source_blocked"?"reject":
        evaluation.outcome==="candidate_draft_eligible"?"provisionally_clear":"escalate",
      snapshotSetId:"snapshot-set-"+row.id,dossierRef:"synthetic-dossier-"+row.id,
      evidenceCurrentThrough:asOf,
      components:[
        {kind:"WORK_CONTENT",clearance:risk==="rejected"?"blocked":"usable",
          commercialUseVerified:evaluation.outcome==="candidate_draft_eligible"},
        {kind:"EDITION_CONTENT",clearance:risk==="edition"?"unresolved":"excluded",
          commercialUseVerified:false},
        {kind:"ASSET",clearance:"excluded",commercialUseVerified:false},
        {kind:"TRANSLATION",clearance:risk==="translation"?"unresolved":"excluded",
          commercialUseVerified:false},
        {kind:"SOURCE_WRAPPER",clearance:"excluded",commercialUseVerified:false},
      ],
      recommendedEdition:"Modelový originál bez cizích ilustrací a překladu",
      recommendationReason:recommendedAction(row)
    }
  }
  return {
    id:row.id,title:row.title,authorId:row.authorId,author:row.author,
    genre:row.genre,priority:row.priority,prescreen,
    prescreenCostUsd:.01,fullScanCostUsd:.18,
    estimatedEditorialCostUsd:row.editorCostUsd,screen
  }
}

export function runSyntheticCatalogBatch(
  targetTitles:number, costLimitUsd:number, asOf:string, now:string,
):DemoCatalogBatch{
  if(!Number.isInteger(targetTitles)||targetTitles<1||targetTitles>12||
     !Number.isFinite(costLimitUsd)||costLimitUsd<1||costLimitUsd>2000||
     !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(now))) {
    throw new Error("invalid_demo_batch_input")
  }
  const desiredGenres:CatalogGenre[]=["prose","poetry","drama","fairy_tale","essay"]
  const genreTargets:CatalogPolicy["genreTargets"]={}
  for(let i=0;i<targetTitles;i++){
    const genre=desiredGenres[i%desiredGenres.length]
    genreTargets[genre]=(genreTargets[genre]??0)+1
  }
  const policy:CatalogPolicy={
    targetTitles,
    prescreenBudgetUsd:money(costLimitUsd*.1),
    fullScanBudgetUsd:money(costLimitUsd*.25),
    editorialBudgetUsd:money(costLimitUsd*.65),
    maxFullScans:Math.min(25,targetTitles*4),
    maxPerAuthor:1,
    genreTargets,assignment:"shared_inbox",editorIds:[],asOf
  }
  const recommendationByCandidate:Record<string,string>={}
  const cohortSizes:number[]=[]
  let count=0,plan:CatalogRunPlan|null=null
  let candidates:CatalogCandidate[]=[]
  do{
    count=Math.min(titles.length,count+4)
    candidates=titles.slice(0,count).map(row=>{
      recommendationByCandidate[row.id]=recommendedAction(row)
      return toCandidate(row,now,asOf)
    })
    cohortSizes.push(count)
    plan=planCatalogProduction(candidates,policy)
  }while(plan.refillRequested&&count<titles.length)

  return {mode:"synthetic_fixture",plan:plan!,candidates,cohortSizes,
    recommendationByCandidate,runAt:now,costLimitUsd}
}
