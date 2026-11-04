import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {composeSemanticRevision,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
import {getSemanticPageUnits} from "../lib/semantic/readerProjection";
import {selectEditorialEdition} from "../lib/semantic/editionProjection";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const publicReader=read("components/reader/SemanticPublicReader.tsx");
const qaReader=read("components/editor/SemanticReaderLab.tsx");
const shared=read("components/reader/SemanticUnitContent.tsx");
const legacy=read("components/reader/ReaderClient.tsx");
const entry=read("app/reader/[slug]/page.tsx");
const sha=(x:string)=>createHash("sha256").update(x).digest("hex");

test("QA and public semantic reader use the exact same block renderer and canonical edition units",()=>{
 assert.match(qaReader,/import SemanticUnitContent/);
 assert.match(publicReader,/import SemanticUnitContent/);
 assert.match(qaReader,/getSemanticPageUnits\(activeRevision,edition.range\)/);
 assert.match(publicReader,/getSemanticPageUnits\(revision,edition.range\)/);
 assert.match(publicReader,/selectEditorialEdition\(revision.source.normalized_text\)/);
 assert.doesNotMatch(publicReader,/function within\(/);
 assert.doesNotMatch(publicReader,/function withoutExclusions\(/);
 assert.doesNotMatch(publicReader,/function node\(/);
 assert.doesNotMatch(publicReader,/paginateReaderBlocks/);
 assert.match(shared,/ProtectedProseText/);
});
test("layout presentation belongs to semantic edition; all rendering is immutable",()=>{
 assert.match(shared,/semanticPresentationStyle/);
 assert.match(shared,/unit\.node\.presentation/);
 assert.match(shared,/unit\.fragment/);
 assert.match(shared,/unit\.node\.atom\.raw\.slice\(start,end\)/);
 assert.doesNotMatch(shared,/\.update\(|\.insert\(|\.rpc\(|fetch\(/);
});
test("legacy content and reader are retained for pre-migration published works",()=>{
 assert.match(entry,/if\(semanticRelease\?\.semantic_revision\)/);
 assert.match(entry,/<ReaderClient/);
 assert.match(legacy,/paginateReaderBlocks/);
});
test("dual-mode public routing is per published work; legacy stays byte-for-byte independent",()=>{
 assert.match(entry,/\.eq\("work_id",work\.id\)/);
 assert.match(entry,/if\(semanticRelease\?\.semantic_revision\)/);
 assert.match(entry,/verifySemanticRevision\(revision\)/);
 assert.match(entry,/published_semantic_revision_invalid/);
 assert.match(entry,/<SemanticPublicReader/);
 assert.match(entry,/<ReaderClient/);
 assert.match(entry,/content_blocks/);
 assert.doesNotMatch(entry,/convertLegacy|migrateLegacy|toSemantic|composeSemanticRevision/);
 assert.doesNotMatch(shared,/WorkBlock|paginateReaderBlocks/);
});
test("source units are identical whether the reader is opened in QA or public mode",()=>{
 const raw="CHAPTER I.\n\nA source paragraph with a protected name like Anne Shirley.\n\nA second paragraph remains intact.";
 const revision=composeSemanticRevision({work_id:"canonical-read",work_slug:"canonical-read",
  snapshot_ref:"sha256:"+sha("canonical"),source_bytes_sha256:sha(raw),
  component_id:"epub:body",original_byte_start:0,original_raw:raw});
 verifySemanticRevision(revision,raw);
 const range=selectEditorialEdition(raw).range;
 const units=getSemanticPageUnits(revision,range);
 assert(units.length>0);
 const ids=units.flatMap(unit=>unit.source_atom_ids);
 const originalIds=new Set(walkSemanticAtoms(revision.blocks).map(atom=>atom.id));
 assert(ids.every(id=>originalIds.has(id)));
 assert.equal(new Set(ids).size,ids.length);
});
