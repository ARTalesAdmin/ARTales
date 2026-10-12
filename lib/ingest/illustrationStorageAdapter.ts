import {createHash} from "node:crypto";
import {planPrivateIllustrationArchive,verifyPrivateIllustrationArchive,
 type ArchivedIllustration} from "./illustrationArchiveChoice";
import type {IllustrationSnapshot} from "./illustrationSnapshot";

/** Minimal server-only Storage surface; do not expose the archive bucket to clients. */
type StorageFile=Readonly<{arrayBuffer():Promise<ArrayBuffer>}>;
export type ServerStorageClient=Readonly<{
 storage:{from(bucket:string):{
  upload(path:string,bytes:Uint8Array,options:{
   contentType:string;upsert:false;cacheControl:string;
  }):Promise<{error:unknown}>;
  download(path:string):Promise<{data:StorageFile|null;error:unknown}>;
 }};
}>;
const sha=(data:Uint8Array)=>createHash("sha256").update(data).digest("hex");
/**
 * Write-once and verify by re-downloading the actual original binary.
 * Caller must authenticate an authorized ingest worker against private bucket.
 * Duplicate-object rejection intentionally fails closed rather than upserting.
 */
export async function archiveAndVerifyIllustration(
 client:ServerStorageClient,snapshot:IllustrationSnapshot,bytes:Uint8Array,
):Promise<ArchivedIllustration>{
 const plan=planPrivateIllustrationArchive(snapshot,bytes);
 const storage=client.storage.from(plan.bucket);
 const upload=await storage.upload(plan.path,plan.bytes,{
  contentType:plan.contentType,upsert:false,cacheControl:plan.cacheControl,
 });
 if(upload.error)throw Error("Private illustration upload refused");
 const fetched=await storage.download(plan.path);
 if(fetched.error||!fetched.data)throw Error("Private illustration readback unavailable");
 const actual=new Uint8Array(await fetched.data.arrayBuffer());
 if(actual.length!==bytes.length||sha(actual)!==snapshot.sha256)
  throw Error("Private illustration archived bytes changed");
 const archived:ArchivedIllustration={
  component_id:snapshot.component_id,source_sha256:snapshot.sha256,
  source_archive_path:plan.path,source_bucket:plan.bucket,
  source_byte_length:actual.length,captured_at:snapshot.captured_at,
  storage_verified:true,
 };
 verifyPrivateIllustrationArchive(snapshot,archived,actual);
 return archived;
}
