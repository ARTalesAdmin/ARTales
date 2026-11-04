import type {SemanticRevision} from "@/lib/semantic/model";
import {verifySemanticRevision} from "@/lib/semantic/compose";
import {selectEditorialEdition} from "@/lib/semantic/editionProjection";
import {getSemanticPageUnits} from "@/lib/semantic/readerProjection";
import SemanticUnitContent from "@/components/reader/SemanticUnitContent";
import "./semantic-public-reader.css";

export type ApprovedSemanticImage={
 anchor_atom_id:string;storage_path:string;caption:string;sha256:string
};
function safeUrl(path:string){
 if(!/^works\/[a-f0-9-]{36}\/inline\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path))
  return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!base||!/^https:\/\//.test(base))return null;
 return base.replace(/\/$/,"")+"/storage/v1/object/public/artales-images/"+
  path.split("/").map(encodeURIComponent).join("/");
}
/** Public reader uses the exact canonical units, edition boundaries and display
 * component tested by the QA reader; it never recomposes or rewrites a book.
 */
export default function SemanticPublicReader({
 revision,title,isPreview,visuals=[],protectedTerms=[]
}:{
 revision:SemanticRevision;title:string;isPreview:boolean;
 visuals?:ApprovedSemanticImage[];protectedTerms?:string[];
}){
 verifySemanticRevision(revision);
 const edition=selectEditorialEdition(revision.source.normalized_text);
 const units=getSemanticPageUnits(revision,edition.range)
  .filter(unit=>unit.kind!=="title_page");
 // Preview is a source-unit-limited excerpt, never the full restricted book.
 const shown=isPreview?units.slice(0,Math.min(4,units.length)):units;
 const images=new Map<string,ApprovedSemanticImage[]>();
 for(const visual of visuals){
  const old=images.get(visual.anchor_atom_id)??[];
  old.push(visual);images.set(visual.anchor_atom_id,old);
 }
 return <article className="artales-semantic-public" data-semantic-revision={revision.revision_sha256}>
  <header><h1>{title}</h1></header>
  {shown.map(unit=><section key={unit.id} className="artales-semantic-public__unit"
   data-page-unit-id={unit.id} data-source-atoms={unit.source_atom_ids.join(",")}>
    <SemanticUnitContent unit={unit} protectedTerms={protectedTerms}/>
    {unit.source_atom_ids.flatMap(atomId=>(images.get(atomId)??[])).map(image=>{
     const url=safeUrl(image.storage_path);
     if(!url)return null;
     return <figure key={image.storage_path} className="artales-semantic-public__illustration">
      {/* eslint-disable-next-line @next/next/no-img-element -- approved public semantic manifest */}
      <img src={url} alt={image.caption||"Ilustrace díla"} loading="lazy"/>
      {image.caption?<figcaption>{image.caption}</figcaption>:null}
     </figure>;
    })}
   </section>)}
  {isPreview?<p><em>Ukázka díla. Plný text je dostupný v režimu čtení.</em></p>:null}
 </article>;
}
