import {createHash} from "node:crypto";
import type {SemanticRevision,SemanticPage} from "./model";
import {verifySemanticRevision} from "./compose";
import {projectSemanticReader,verifyReaderProjection,type SemanticReaderLayout} from "./readerProjection";

/** Preset is a cacheable break manifest, not copied book text or final browser geometry. */
export type LayoutPreset=Readonly<{
 schema:"artales.semantic-layout-preset.v1";
 revision_ref:string;
 revision_sha256:string;
 layout_algorithm:"semantic-reader-projection-v2";
 profile:Readonly<{mode:"paged"|"spread"|"scroll";viewport_width:number;viewport_height:number;font_scale:number;density:"compact"|"comfortable"}>;
 pages:readonly (readonly string[])[];
 page_count:number;
 layout_sha256:string;
}>;
const sha=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function createLayoutPreset(revision:SemanticRevision,profile:LayoutPreset["profile"]):LayoutPreset{
 verifySemanticRevision(revision);
 const pages=projectSemanticReader(revision,profile);
 verifyReaderProjection(revision,pages);
 const payload={
  schema:"artales.semantic-layout-preset.v1" as const,
  revision_ref:revision.revision_ref,revision_sha256:revision.revision_sha256,
  layout_algorithm:"semantic-reader-projection-v2" as const,
  profile:{...profile},
  pages:pages.map(page=>page.units.map(unit=>unit.id)),
  page_count:pages.length,
 };
 return {...payload,layout_sha256:sha(payload)};
}
/**
 * Replays the deterministic algorithm rather than trusting cached page IDs.
 * DOM font rendering remains authoritative and may cause a local relayout.
 */
export function verifyLayoutPreset(revision:SemanticRevision,preset:LayoutPreset):SemanticPage[]{
 verifySemanticRevision(revision);
 const {layout_sha256,...payload}=preset;
 if(preset.schema!=="artales.semantic-layout-preset.v1"||
  preset.layout_algorithm!=="semantic-reader-projection-v2"||
  preset.revision_ref!==revision.revision_ref||
  preset.revision_sha256!==revision.revision_sha256||
  layout_sha256!==sha(payload))throw Error("Stale or invalid layout preset");
 const pages=projectSemanticReader(revision,preset.profile as SemanticReaderLayout);
 verifyReaderProjection(revision,pages);
 if(pages.length!==preset.page_count||
   pages.some((page,i)=>JSON.stringify(page.units.map(unit=>unit.id))!==JSON.stringify(preset.pages[i])))
  throw Error("Layout preset no longer matches projection algorithm");
 return pages;
}
export const COMMON_LAYOUT_PROFILES=[
 {mode:"paged",viewport_width:360,viewport_height:700,font_scale:1,density:"comfortable"},
 {mode:"paged",viewport_width:420,viewport_height:760,font_scale:1,density:"comfortable"},
 {mode:"spread",viewport_width:710,viewport_height:850,font_scale:1,density:"comfortable"},
 {mode:"scroll",viewport_width:420,viewport_height:760,font_scale:1,density:"comfortable"},
] as const satisfies readonly LayoutPreset["profile"][];
