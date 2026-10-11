import {createHash} from "node:crypto";
import {PG11_BYTES_SHA256,PG11_GIT_BLOB_SHA1,PG11_URI,captureGutenbergBytes,
  extractPg11Components,getPg11FixtureRequest,type GutenbergComponent} from "../ingest/gutenbergSnapshot";
import {evaluateRightsScan,type RightsScanDossier} from "../rightsScanDossier";

/** An actual source-byte assessment, not an automated legal permission or cloud DB grant. */
export type AliceRealRightsDeskOutput=Readonly<{
  source:{uri:string;sha256:string;git_blob_sha1:string;bytes:number;source_archived:true};
  componentInventory:readonly Readonly<{
    id:string;kind:GutenbergComponent["kind"];byteStart:number|null;byteEnd:number|null;
    sha256:string|null;disposition:"qa_text_only"|"exclude";
  }>[];
  evidenceReferences:readonly Readonly<{url:string;role:string;archived:false}>[];
  legalFinding:{
    originalEnglishText:"term_expired_preliminary_EU_CZ";
    originalTextAuthorDeathYear:1898;
    termEndedAfterYear:1968;
    externalImages:"excluded_not_captured";
    translations:"none_in_pinned_text";
    digitalEdition:"separate_assessment_required";
    publicationAuthorized:false;
  };
  dossier:RightsScanDossier;
  scan:ReturnType<typeof evaluateRightsScan>;
}>;
const repoPath="tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt";
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
export function inspectRealAliceRights(bytes:Uint8Array,at="2026-10-11T18:00:00.000Z"):AliceRealRightsDeskOutput{
 const snapshot=captureGutenbergBytes(bytes,getPg11FixtureRequest(at));
 const boundaries=extractPg11Components(snapshot);
 if(boundaries.status!=="ready_for_fixture"||boundaries.review_reasons.length)
  throw Error("Alice source boundaries are ambiguous; independent rights check blocked");
 const inventory=boundaries.content_components.map(c=>{
  if(!c.original)return {id:c.id,kind:c.kind,byteStart:null,byteEnd:null,sha256:null,
   disposition:"exclude" as const};
  return {id:c.id,kind:c.kind,byteStart:c.original.byte_start,byteEnd:c.original.byte_end,
   sha256:digest(bytes.subarray(c.original.byte_start,c.original.byte_end)),
   disposition:c.disposition==="qa_text_only"?"qa_text_only" as const:"exclude" as const};
 });
 if(inventory.length!==6||inventory.filter(c=>c.kind==="WORK_CONTENT").length!==1||
    inventory.some(c=>c.kind==="TRANSLATION")||
    inventory.some(c=>c.kind==="ASSET"&&c.byteStart!==null))
  throw Error("Unexpected pinned edition components; manual review required");
 const sourceId=snapshot.snapshot_ref,editionId="pg11:gitenberg:2016-frozen";
 const snapshots=inventory.filter(c=>c.byteStart!==null&&c.byteEnd!==null&&c.sha256!==null)
  .map(c=>({id:c.id,kind:c.kind,sourceId,editionId,sha256:c.sha256!,
   byteLength:c.byteEnd!-c.byteStart!,capturedAt:at,
   archiveRef:"repo:"+repoPath+"@blob:"+PG11_GIT_BLOB_SHA1+
    "#byte="+c.byteStart+"-"+c.byteEnd}));
 const dossier:RightsScanDossier={
  format:"artales-rights-dossier-v1",candidateId:"pilot:alice:original-en",
  sourceId,editionId,snapshotSetId:sourceId,targetJurisdiction:"EU_CZ",
  policyVersion:"artales-legal-desk-v1",scanner:{engine:"source-byte-desk-review",version:"1",ranAt:at},
  capture:{rawSourceSha256:snapshot.bytes_sha256,rawSourceByteLength:snapshot.bytes_length,
   rawSourceArchiveRef:"repo:"+repoPath+"@blob:"+PG11_GIT_BLOB_SHA1,
   capturedAt:at,inventoryComplete:true,collectorVersion:"pinned-source-qa-v1"},
  snapshots,evidence:[],
  decisions:snapshots.map(c=>c.kind==="WORK_CONTENT"?
   {componentId:c.id,action:"hold" as const,finding:"unknown" as const,
    confidence:"medium" as const,evidenceIds:[],
    rationale:"Original author death and EU term verified by cited external sources; edition-specific clearance and immutable external evidence archive remain unapproved."}:
   {componentId:c.id,action:"exclude" as const,finding:"unknown" as const,
    confidence:"low" as const,evidenceIds:[],
    exclusionMethod:"omit_from_ingest" as const,
    rationale:"Exclude Gutenberg licensing, trademark or Millennium Fulcrum edition material from the new literary text; retain exact bytes for provenance."}),
 };
 const scan=evaluateRightsScan(dossier);
 if(scan.outcome!=="needs_specialist_review"||scan.publicationAuthorized!==false||
    scan.includedSnapshotIds.length!==0||scan.excludedSnapshotIds.length!==0)
  throw Error("Alice desk review cannot silently grant publication or partial include");
 return {
  source:{uri:PG11_URI,sha256:PG11_BYTES_SHA256,git_blob_sha1:PG11_GIT_BLOB_SHA1,
   bytes:snapshot.bytes_length,source_archived:true as const},
  componentInventory:inventory,
  evidenceReferences:[
   {url:"https://www.gutenberg.org/ebooks/11",role:"catalog_author_death_and_us_status",archived:false as const},
   {url:"https://mze.gov.cz/public/portal/mze/legislativa/vap49278-8779",role:"cz_copyright_act_section_27",archived:false as const},
   {url:"https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006L0116",role:"eu_directive_2006_116_ec_article_1",archived:false as const},
   {url:"https://www.gutenberg.org/policy/license",role:"gutenberg_trademark_and_redistribution",archived:false as const},
   {url:"https://www.gutenberg.org/policy/permission.html",role:"gutenberg_rights_us_only_warning",archived:false as const},
   {url:"https://www.gutenberg.org/ebooks/114",role:"separate_tenniel_illustrations",archived:false as const},
  ],
  legalFinding:{originalEnglishText:"term_expired_preliminary_EU_CZ" as const,
   originalTextAuthorDeathYear:1898 as const,termEndedAfterYear:1968 as const,
   externalImages:"excluded_not_captured" as const,translations:"none_in_pinned_text" as const,
   digitalEdition:"separate_assessment_required" as const,publicationAuthorized:false as const},
  dossier,scan,
 };
}
