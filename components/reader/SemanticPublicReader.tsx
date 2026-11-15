import type {SemanticRevision,SemanticPageUnit,SemanticTitlePage} from "@/lib/semantic/model";
import type {SupportedLocale} from "@/lib/i18n/config";
import {selectEditorialEdition} from "@/lib/semantic/editionProjection";
import {getSemanticPageUnits} from "@/lib/semantic/readerProjection";
import type {ApprovedSemanticImage} from "@/components/reader/SemanticPageUnit";
import SemanticReaderClient from "@/components/reader/SemanticReaderClient";

/** Published source of truth remains the sealed semantic revision. This server
 * boundary verifies and strips Gutenberg/source text before sending only
 * authorized display units to the interactive Reader.
 * The old ReaderClient remains the fallback for legacy works in the route.
 */
export default function SemanticPublicReader({revision,title,author,slug,locale,isPreview,visuals=[],protectedTerms=[]}:{
 revision:SemanticRevision;title:string;author:string;slug:string;locale:SupportedLocale;
 isPreview:boolean;visuals?:ApprovedSemanticImage[];protectedTerms?:string[];
}){
 const edition=selectEditorialEdition(revision.source.normalized_text);
 const sourceUnits=getSemanticPageUnits(revision,edition.range)
  .filter(unit=>unit.kind!=="title_page");
 // Title is a layout-only, always separate page. The public catalog is
 // authoritative for public name/byline; no source Gutenberg title is altered.
 const cover:SemanticTitlePage={
  kind:"title_page",id:"title:"+revision.work_id,title,
  authors:[author||revision.title_page?.authors.join(" · ")||"Autor neuveden"],
  brand:"ARTales",template:"artales-typographic-draft-v0",
  review_state:"awaiting_editor_review",
 };
 const coverUnit:SemanticPageUnit={
  id:cover.id,kind:"title_page",node:cover,chapter_id:null,
  source_atom_ids:[],estimated_height:440,
 };
 // Never send the whole revision or raw original Gutenberg source to preview.
 // Preview contains at most a dozen visible semantic units after the cover.
 const visibleUnits=isPreview?sourceUnits.slice(0,12):sourceUnits;
 const ids=new Set(visibleUnits.flatMap(u=>u.source_atom_ids));
 const allowedVisuals=visuals.filter(v=>ids.has(v.anchor_atom_id));
 return <SemanticReaderClient title={title} slug={slug} locale={locale}
  mode={isPreview?"preview":"full"}
  revisionSha={revision.revision_sha256}
  units={[coverUnit,...visibleUnits]}
  protectedTerms={protectedTerms} visuals={allowedVisuals}/>;
}
