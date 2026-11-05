import type {SemanticRevision} from "@/lib/semantic/model";
import {verifySemanticRevision} from "@/lib/semantic/compose";
import {selectEditorialEdition} from "@/lib/semantic/editionProjection";
import {getSemanticPageUnits} from "@/lib/semantic/readerProjectionCore";
import type {SupportedLocale} from "@/lib/i18n/config";
import SemanticReaderClient from "@/components/reader/SemanticReaderClient";

export type ApprovedSemanticImage={
 anchor_atom_id:string;storage_path:string;caption:string;sha256:string
};
function safeUrl(path:string){
 if(!/^works\/[a-f0-9-]{36}\/inline\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path))return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!base||!/^https:\/\//.test(base))return null;
 return base.replace(/\/$/,"")+"/storage/v1/object/public/artales-images/"+
  path.split("/").map(encodeURIComponent).join("/");
}
/** Server verifies exact published revision before sending only authorized
 * edition units. Preview never hydrates the remainder of the full work.
 * Original WorkBlock reader is unaffected and remains the per-work fallback.
 */
export default function SemanticPublicReader({
 revision,title,isPreview,visuals=[],protectedTerms=[],locale
}:{
 revision:SemanticRevision;title:string;isPreview:boolean;locale:SupportedLocale;
 visuals?:ApprovedSemanticImage[];protectedTerms?:string[];
}){
 verifySemanticRevision(revision);
 const edition=selectEditorialEdition(revision.source.normalized_text);
 const all=getSemanticPageUnits(revision,edition.range);
 const previewLimit=Math.min(4,all.filter(x=>x.kind!=="title_page").length);
 const units=isPreview?all.filter(x=>x.kind!=="title_page").slice(0,previewLimit):all;
 const allowed=new Set(units.flatMap(x=>x.source_atom_ids));
 const images=visuals.filter(x=>allowed.has(x.anchor_atom_id)).flatMap(x=>{
  const url=safeUrl(x.storage_path);
  return url?[{atomId:x.anchor_atom_id,url,caption:x.caption}]:[];
 });
 return <SemanticReaderClient slug={revision.work_slug} title={title}
  revisionSha={revision.revision_sha256}mode={isPreview?"preview":"full"}
  locale={locale} units={units}images={images}protectedTerms={protectedTerms}/>;
}
