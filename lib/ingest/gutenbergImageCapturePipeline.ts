import {captureIllustration,type IllustrationSnapshot} from "./illustrationSnapshot";
import {archiveAndVerifyIllustration,type ServerStorageClient} from "./illustrationStorageAdapter";
import type {ArchivedIllustration} from "./illustrationArchiveChoice";
import type {GutenbergImageReference} from "./gutenbergImageManifest";
import type {RightsPerson} from "../rights/sourceTextEligibility";
import {createHash} from "node:crypto";

export type IllustrationCaptureProof=Readonly<{snapshot:IllustrationSnapshot;archive:ArchivedIllustration}>;
export type AuthenticatedCaptureGrant=Readonly<{
 authenticated:true;
 role:"admin"|"editor";
 assigned_candidate_id:string;
 approved_gutenberg_catalog:string;
}>;
type SourceFetcher=(uri:string)=>Promise<Readonly<{status:number;contentType:string;bytes:Uint8Array}>>;
const sha=(data:Uint8Array)=>createHash("sha256").update(data).digest("hex");
/** Reject arbitrary URLs before any network request (SSRF / source substitution). */
export function validateGutenbergImageReference(ref:GutenbergImageReference){
 const catalog=new URL(ref.catalog_url);
 const source=new URL(ref.source_url);
 const match=/^\/ebooks\/(\d+)\/?$/.exec(catalog.pathname);
 if(!match||catalog.hostname!=="www.gutenberg.org"||catalog.protocol!=="https:"||
   source.hostname!=="www.gutenberg.org"||source.protocol!=="https:"||
   !source.pathname.startsWith("/files/"+match[1]+"/")||
   !/\.(?:gif|png|jpe?g)$/i.test(source.pathname)||source.search||source.hash||
   catalog.search||catalog.hash||!/^gutenberg:\d+:image:\d{3}$/.test(ref.component_id)||
   !/^[a-f0-9]{64}$/.test(ref.index_sha256))
  throw Error("Untrusted Gutenberg image provenance");
}
/**
 * Server-side orchestration only. The caller must supply a trusted grant
 * resolved from the authenticated server session and assigned candidate.
 * Never accept grants from client JSON or expose privileged keys.
 */
export async function captureAndArchiveGutenbergImage(args:Readonly<{
 grant:AuthenticatedCaptureGrant;
 reference:GutenbergImageReference;
 candidate_id:string;
 text_snapshot_ref:string;
 captured_at:string;
 checked_at:string;
 artist:RightsPerson;
 artist_provenance:"original_artist"|"other_edition_artist"|"unknown";
 us_catalog_status:"public_domain"|"copyrighted"|"permission_only"|"unknown";
 express_no_reuse:boolean;
 fetchSource:SourceFetcher;
 storage:ServerStorageClient;
}>):Promise<IllustrationCaptureProof>{
 const {grant,reference}=args;
 if(!grant.authenticated||!["admin","editor"].includes(grant.role)||
    grant.assigned_candidate_id!==args.candidate_id||
    grant.approved_gutenberg_catalog!==reference.catalog_url)
  throw Error("Image ingest grant denied");
 validateGutenbergImageReference(reference);
 const response=await args.fetchSource(reference.source_url);
 if(response.status!==200||response.bytes.length===0||response.bytes.length>10_000_000)
  throw Error("Unusable Gutenberg image download");
 const advertised=response.contentType.split(";")[0]?.toLowerCase().trim();
 if(!["image/gif","image/png","image/jpeg"].includes(advertised))
  throw Error("Unsupported Gutenberg media response");
 const snapshot=captureIllustration({
  candidate_id:args.candidate_id,text_snapshot_ref:args.text_snapshot_ref,
  component_id:reference.component_id,role:"interior_illustration",
  source:{asset_url:reference.source_url,catalog_url:reference.catalog_url,
   archive_ref:"gutenberg-index-sha256:"+reference.index_sha256,
   captured_at:args.captured_at,sha256:sha(response.bytes),bytes:response.bytes},
  author:args.artist,provenance:args.artist_provenance,
  us_catalog_status:args.us_catalog_status,express_no_reuse:args.express_no_reuse
 },args.checked_at);
 if(snapshot.media_type!==advertised)throw Error("Downloaded image signature does not match response");
 if(snapshot.decision!=="eligible_for_editorial_draft")
  throw Error("Image rights prevent automatic binary capture; retain discovery metadata only");
 const archive=await archiveAndVerifyIllustration(args.storage,snapshot,response.bytes);
 return {snapshot,archive};
}
