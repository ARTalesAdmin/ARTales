import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {composeSemanticRevision,verifySemanticRevision} from "../lib/semantic/compose";
import {getSemanticPageUnits,projectSemanticUnits,verifyReaderProjection} from "../lib/semantic/readerProjection";
import {selectEditorialEdition} from "../lib/semantic/editionProjection";
import {anchorForSemanticPage,pageForSemanticAnchor,validateSemanticPosition,semanticPositionKey} from "../lib/semantic/readerPosition";
const load=(file:string)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const source=["CHAPTER ONE.",
 ...Array.from({length:9},(_,i)=>"The complete paragraph "+i+
   " should retain exactly the source letters while the reader changes screen width, font and pagination. "+
   "Every sentence carries the original punctuation; no source text can be rewritten by layout."),
 "CHAPTER TWO.","The ending belongs only to the authorized published edition."].join("\n\n");
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const rev=composeSemanticRevision({work_id:"semantic-public-test",work_slug:"semantic-public-test",
 snapshot_ref:"sha256:"+sha("snapshot"),source_bytes_sha256:sha(source),
 component_id:"epub:body",original_byte_start:0,original_raw:source});
const all=getSemanticPageUnits(rev,selectEditorialEdition(source).range);
test("the public preview sends only authorized units to browser pagination",()=>{
 verifySemanticRevision(rev,source);
 assert(all.length>4);
 const preview=all.filter(x=>x.kind!=="title_page").slice(0,4);
 const layout={mode:"paged" as const,viewport_width:325,viewport_height:520,font_scale:1};
 const fullPages=projectSemanticUnits(all,layout);
 const previewPages=projectSemanticUnits(preview,layout);
 assert(fullPages.length>=previewPages.length);
 assert.deepEqual(new Set(previewPages.flatMap(p=>p.units.flatMap(u=>u.source_atom_ids))),
  new Set(preview.flatMap(u=>u.source_atom_ids)));
 assert.deepEqual(verifyReaderProjection(rev,fullPages,selectEditorialEdition(source).range).ok,true);
});
test("semantic anchor survives reflow across mobile and desktop without writing legacy position",()=>{
 const small=projectSemanticUnits(all,{mode:"paged",viewport_width:320,viewport_height:520,font_scale:1.2});
 const large=projectSemanticUnits(all,{mode:"paged",viewport_width:760,viewport_height:980,font_scale:1});
 const origin=anchorForSemanticPage(small.find(p=>p.units.some(u=>u.source_atom_ids.length))!);
 assert(origin);
 const newIndex=pageForSemanticAnchor(large,origin.atomId,origin.offset);
 assert(newIndex!==null);
 assert(large[newIndex!].units.some(u=>u.source_atom_ids.includes(origin.atomId)));
 assert.equal(pageForSemanticAnchor(large,"invalid-atom",0),null);
 assert.equal(pageForSemanticAnchor(large,origin.atomId,-1),null);
 const record={schema:"artales.semantic.saved-position.v1",slug:rev.work_slug,
  revisionSha:rev.revision_sha256,atomId:origin.atomId,offset:origin.offset,
  updatedAt:new Date("2026-11-04T00:00:00Z").toISOString()};
 assert.deepEqual(validateSemanticPosition(record,rev.work_slug,rev.revision_sha256),record);
 assert.equal(validateSemanticPosition(record,"different-book",rev.revision_sha256),null);
 assert.equal(validateSemanticPosition(record,rev.work_slug,"different-sha"),null);
 const v2={...record,schema:"artales.semantic.saved-position.v2",
  atomSourceSha:"source-verified-digest"};
 assert.deepEqual(validateSemanticPosition(v2,rev.work_slug,"next-layout-sha",
  atomId=>atomId===record.atomId?"source-verified-digest":null),v2);
 assert.equal(validateSemanticPosition(v2,rev.work_slug,"next-layout-sha",()=>null),null);
 assert.equal(semanticPositionKey(rev.work_slug),"artales.semantic.position:"+rev.work_slug);
});
test("semantic reader keeps legacy reader and its local progress isolated",()=>{
 const shell=load("components/reader/SemanticReaderClient.tsx");
 const route=load("app/reader/[slug]/page.tsx");
 const publicReader=load("components/reader/SemanticPublicReader.tsx");
 const core=load("lib/semantic/readerProjectionCore.ts");
 assert.match(route,/<ReaderClient/);
 assert.match(route,/<SemanticPublicReader/);
 assert.match(publicReader,/const units=isPreview\?all.filter/);
 assert.match(publicReader,/const allowed=new Set/);
 assert.match(shell,/semanticPositionKey\(slug\)/);
 assert.match(shell,/restoreComplete/);
 assert.match(shell,/ReaderToolbar/);
 assert.match(shell,/ResizeObserver/);
 assert.match(shell,/projectSemanticUnits/);
 assert.doesNotMatch(shell,/saveReaderProgress\(|getReaderProgressKey\(|paginateReaderBlocks\(/);
 assert.doesNotMatch(core,/from ["']\.\/compose["']/);
 assert.doesNotMatch(shell,/from ["']@\/lib\/semantic\/compose["']/);
});
