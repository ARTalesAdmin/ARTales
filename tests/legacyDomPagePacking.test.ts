import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_LEGACY_BLOCK_STYLES} from "../lib/rendering/legacyBlockStyles";
import {defaultReaderSettings} from "../lib/reader/readerSettings";
import {paginateReaderBlocks,paginateReaderBlocksWithDiagnostics,prepareLegacyReaderFragments} from "../lib/reader/paginateBlocks";
const make=(id:string,content:string)=>({id,type:"paragraph" as const,content,editor_note:null});
const geometry=(heights:number[],capacity=220)=>({
 contentHeightPx:capacity,contentWidthPx:480,blockHeightsPx:heights,
 blockRows:heights.map(()=>1),
 paragraphRows:heights.map(h=>({textHeightPx:h,rows:[{sourceEnd:1,bottomPx:h}]}))
});
test("DOM height, not weight, determines pages",()=>{
 const b=[make("a","Short."),make("b","Another short."),make("c","Last.")];
 const p=paginateReaderBlocks(b,defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry([90,90,90]));
 assert.deepEqual(p.map(x=>x.blocks.map(y=>y.id.replace(/-page-\d+-\d+$/,""))),[["a","b"],["c"]]);
 assert.deepEqual(p.map(x=>x.estimatedWeight),[180,90]);
});
test("changed row height changes page count",()=>{
 const b=[make("a","A"),make("b","B"),make("c","C")];
 const a=paginateReaderBlocks(b,defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry([60,60,60]));
 const c=paginateReaderBlocks(b,defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry([120,120,120]));
 assert.deepEqual(a.map(x=>x.blocks.length),[3]);assert.deepEqual(c.map(x=>x.blocks.length),[1,1,1]);
});
test("staff page-break policy applies to measured pages",()=>{
 const b=[make("a","A"),make("b","B"),make("c","C")];
 const s=structuredClone(DEFAULT_LEGACY_BLOCK_STYLES);s.paragraph={...s.paragraph,page_break_before:true};
 const pages=paginateReaderBlocks(b,defaultReaderSettings,{},s,geometry([20,20,20]));
 assert.deepEqual(pages.map(x=>x.blocks.length),[1,1,1]);
});
test("oversize content is not silently clipped",()=>{
 const b=[make("a","A"),make("b","B")];
 const pages=paginateReaderBlocks(b,defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry([400,30]));
 assert.equal(pages[0].overflow,"scroll_unit");
 assert.deepEqual(pages.map(x=>x.blocks.map(y=>y.id.replace(/-page-\d+-\d+$/,""))),[["a"],["b"]]);
});
test("invalid geometry falls back unchanged",()=>{
 const b=[make("a","A"),make("b","B")];
 const old=paginateReaderBlocks(b,defaultReaderSettings);
 const fallback=paginateReaderBlocks(b,defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry([40]));
 assert.deepEqual(fallback,old);
});
test("measured packing preserves all existing fragment IDs and content",()=>{
 const b=[make("long",Array.from({length:400},(_,i)=>"word"+i).join(" ")+".")];
 const fragments=prepareLegacyReaderFragments(b,defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,true);
 assert.equal(fragments.length,1);
 const pages=paginateReaderBlocks(b,defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry([60]));
 assert.deepEqual(pages.flatMap(x=>x.blocks.map(y=>y.id)),fragments.map(x=>x.id));
 assert.deepEqual(pages.flatMap(x=>x.blocks.map(y=>y.content)),fragments.map(x=>x.content));
});

test("diagnostics report fallback when whole-sheet geometry is invalid",()=>{
 const blocks=[make("a","A"),make("b","B")];
 const result=paginateReaderBlocksWithDiagnostics(blocks,defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry([30]));
 assert.equal(result.diagnostics.mode,"estimated");
 assert.equal(result.diagnostics.reason,"geometry-invalid");
 assert.deepEqual(result.pages,paginateReaderBlocks(blocks,defaultReaderSettings));
});
