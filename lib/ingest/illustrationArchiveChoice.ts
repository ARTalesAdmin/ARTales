import {createHash} from "node:crypto";
import type {IllustrationSnapshot} from "./illustrationSnapshot";
export const PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET="artales-source-archive";
export const PUBLIC_ILLUSTRATION_BUCKET="artales-images";
const sha=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const extension={"image/gif":"gif","image/png":"png","image/jpeg":"jpg"} as const;
export type ArchivedIllustration=Readonly<{
 component_id:string;source_sha256:string;source_archive_path:string;
 source_bucket:typeof PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET;
 source_byte_length:number;storage_verified:boolean;captured_at:string;
}>;
export function planPrivateIllustrationArchive(snapshot:IllustrationSnapshot,bytes:Uint8Array){
 if(snapshot.role!=="interior_illustration"||snapshot.sha256!==sha(bytes)||
    snapshot.byte_length!==bytes.length)throw Error("Image bytes do not match immutable snapshot");
 const path="source/"+snapshot.sha256.slice(0,2)+"/"+snapshot.sha256+"."+extension[snapshot.media_type];
 return {bucket:PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET,path,bytes,contentType:snapshot.media_type,
  upsert:false as const,cacheControl:"3600"};
}
export function verifyPrivateIllustrationArchive(snapshot:IllustrationSnapshot,
 archived:ArchivedIllustration,readback:Uint8Array){
 const expected=planPrivateIllustrationArchive(snapshot,readback);
 if(!archived.storage_verified||archived.component_id!==snapshot.component_id||
  archived.source_sha256!==snapshot.sha256||archived.source_bucket!==expected.bucket||
  archived.source_archive_path!==expected.path||
  archived.source_byte_length!==readback.length||archived.captured_at!==snapshot.captured_at)
  throw Error("Illustration archive readback missing or changed");
 return true;
}
export type VisualChoice=Readonly<{
 component_id:string;
 mode:"original"|"custom"|"omit";
 custom_storage_path:string|null;
 note:string;
 editor_id:string;
 chosen_at:string;
}>;
export type IllustrationReleaseChoice=Readonly<{
 component_id:string;source_archive_path:string;
 mode:VisualChoice["mode"];display_path:string|null;
 pending_reason:string|null;
}>;
/** Selection is independent of immutable origin, never a publish command. */
export function decideIllustrationDisplay(snapshot:IllustrationSnapshot,archived:ArchivedIllustration,
 choice:VisualChoice,approvedPublicDerivative:{path:string;sha256:string}|null):
 IllustrationReleaseChoice{
 if(!archived.storage_verified||archived.source_sha256!==snapshot.sha256||
    archived.component_id!==snapshot.component_id||!choice.editor_id||
    !Number.isFinite(Date.parse(choice.chosen_at))||choice.component_id!==snapshot.component_id)
  throw Error("Unverified visual decision or archive");
 const basic={component_id:snapshot.component_id,source_archive_path:archived.source_archive_path,
  mode:choice.mode};
 if(choice.mode==="omit")return {...basic,display_path:null,pending_reason:"visual_omitted"};
 if(choice.mode==="custom"){
  if(!choice.custom_storage_path||!/^works\/[a-z0-9-]+\/inline\/[a-zA-Z0-9/_-]+\.(png|jpg|webp)$/.test(choice.custom_storage_path)||
    choice.custom_storage_path.startsWith(archived.source_archive_path))
    throw Error("Invalid independently authored ARTales visual reference");
  return {...basic,display_path:choice.custom_storage_path,pending_reason:"custom_visual_requires_separate_approval"};
 }
 if(snapshot.decision!=="eligible_for_editorial_draft")
  return {...basic,display_path:null,pending_reason:"original_illustration_not_cleared"};
 if(!approvedPublicDerivative||!/^works\/[a-z0-9-]+\/inline\/[a-zA-Z0-9/_-]+\.(png|jpg|webp)$/.test(approvedPublicDerivative.path)||
  !/^[a-f0-9]{64}$/.test(approvedPublicDerivative.sha256))
  return {...basic,display_path:null,pending_reason:"approved_image_derivative_missing"};
 return {...basic,display_path:approvedPublicDerivative.path,pending_reason:null};
}
