import {strict as assert} from "node:assert";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {composeSemanticRevision} from "../lib/semantic/compose";
import {getSemanticPageUnits,paginateSemanticUnits,projectSemanticReader,verifyReaderProjection} from "../lib/semantic/readerProjection";
import {selectEditorialEdition} from "../lib/semantic/editionProjection";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const source="CHAPTER I.\n\nFirst paragraph of the story.\n\nSecond paragraph of the story.";
const revision=composeSemanticRevision({
 work_id:"candidate:test",work_slug:"candidate-test",
 snapshot_ref:"sha256:"+sha("epub"),source_bytes_sha256:sha(source),
 component_id:"epub:spine",original_byte_start:0,original_raw:source
});
test("QA and public use the same verified source-preserving pagination",()=>{
 const range=selectEditorialEdition(source).range;
 const layout={mode:"paged" as const,viewport_width:640,viewport_height:830,
  font_scale:1,density:"comfortable" as const,editionRange:range};
 const editor=projectSemanticReader(revision,layout);
 const units=getSemanticPageUnits(revision,range);
 const publicPages=paginateSemanticUnits(units,layout);
 assert.deepEqual(publicPages,editor);
 assert.equal(verifyReaderProjection(revision,publicPages,range).ok,true);
});
test("public route selects published semantic Reader but retains legacy reader for old books",()=>{
 const route=read("app/reader/[slug]/page.tsx");
 const boundary=read("components/reader/SemanticPublicReader.tsx");
 const publicClient=read("components/reader/SemanticReaderClient.tsx");
 const qa=read("components/editor/SemanticReaderLab.tsx");
 assert.match(route,/artales_semantic_publications/);
 assert.match(route,/verifySemanticRevision\(revision\)/);
 assert.match(route,/<SemanticPublicReader/);
 assert.match(route,/<ReaderClient/);
 assert.match(boundary,/sourceUnits\.slice\(0,12\)/);
 assert.match(boundary,/paginateSemanticUnits|SemanticReaderClient/);
 assert.match(publicClient,/ReaderToolbar/);
 assert.match(publicClient,/import "\.\/reader\.css"/);
 assert.match(publicClient,/artales-reader__paper/);
 assert.match(publicClient,/artales-reader__stage/);
 assert.match(publicClient,/semantic-reader__pages--spread/);
 assert.match(publicClient,/artales-reader--theme-/);
 assert.match(publicClient,/semantic-reader-theme\.css/);
 assert.match(publicClient,/iterateSemanticPages/);
 assert.match(publicClient,/unitView\(unit,protectedTerms,visuals\)/);
 assert.match(qa,/import \{unitView\} from "@\/components\/reader\/SemanticPageUnit"/);
 assert.doesNotMatch(publicClient,/Archivní Gutenberg|Předat nálezy|Dokončit QA|SemanticQaPanel/);
});
test("cover stays a single independent unit and edition flags remain filtered",()=>{
 const boundary=read("components/reader/SemanticPublicReader.tsx");
 assert.match(boundary,/kind:"title_page"/);
 assert.match(boundary,/\.filter\(unit=>unit.kind!=="title_page"\)/);
 const projection=read("lib/semantic/readerProjection.ts");
 assert.match(projection,/revision\.editorial_exclusions\?\.includes\(id\)/);
 assert.match(projection,/classifyGutenbergApparatus/);
});

test("semantic page geometry is derived from the old book sheet and measured with identical inner padding",()=>{
 const client=read("components/reader/SemanticReaderClient.tsx");
 const css=read("components/reader/semantic-public-reader.css");
 const qaCss=read("components/editor/semantic-reader.css");
 assert.match(client,/const pageHeight=Math\.round\(pageWidth\*1\.414\)/);
 assert.match(client,/Math\.round\(pageWidth\*1\.414\)/);
 assert.match(client,/pageContentHeight=Math\.max\(300,pageHeight-210\)/);
 assert.match(client,/viewport_height:actualCapacity\+100,content_height:actualCapacity/);
 assert.match(client,/const contentRect=content\?\.getBoundingClientRect\(\)/);
 assert.match(client,/data-semantic-measure-id=\{unit\.id\}/);
 assert.match(client,/artales-reader__page-content semantic-public-reader__page-content/);
 assert.match(css,/grid-template-rows:32px minmax\(0,1fr\) 34px/);
 assert.match(css,/font-size:calc\(18px \* var\(--reader-font-scale,1\)\)/);
 assert.match(qaCss,/font-size:calc\(18px \* var\(--reader-scale,1\)\)/);
 assert.match(css,/hyphens:manual/);
 assert.match(css,/word-break:normal/);
});
