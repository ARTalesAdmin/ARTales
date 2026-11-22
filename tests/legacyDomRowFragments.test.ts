import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_LEGACY_BLOCK_STYLES} from "../lib/rendering/legacyBlockStyles";
import {defaultReaderSettings} from "../lib/reader/readerSettings";
import {paginateReaderBlocks,prepareLegacyReaderFragments} from "../lib/reader/paginateBlocks";

const make=(content:string)=>({id:"prose",type:"paragraph" as const,content,editor_note:null});
const data=(content:string,cut:number)=>({
 contentHeightPx:110,contentWidthPx:450,blockHeightsPx:[220],blockRows:[4],
 paragraphRows:[{textHeightPx:200,rows:[
  {sourceEnd:cut,bottomPx:50},{sourceEnd:cut+5,bottomPx:100},
  {sourceEnd:cut+10,bottomPx:150},{sourceEnd:content.length,bottomPx:200},
 ]}]
});
test("plain prose is not prefragmented by old character budget for DOM measurement",()=>{
 const prose=make("word ".repeat(600).trim()+".");
 const measured=prepareLegacyReaderFragments([prose],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,true);
 const legacy=prepareLegacyReaderFragments([prose],defaultReaderSettings);
 assert.equal(measured.length,1);
 assert.ok(legacy.length>1);
 assert.equal(measured[0].content,prose.content);
});
test("one paragraph splits at physical DOM source-word offsets with full coverage",()=>{
 const content="a ".repeat(120).trim()+".";
 const geometry={
  contentHeightPx:110,contentWidthPx:450,
  blockHeightsPx:[220],blockRows:[4],
  paragraphRows:[{textHeightPx:200,rows:[
   {sourceEnd:58,bottomPx:50},{sourceEnd:118,bottomPx:100},
   {sourceEnd:178,bottomPx:150},{sourceEnd:content.length,bottomPx:200}
  ]}]
 };
 const pages=paginateReaderBlocks([make(content)],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry);
 assert.equal(pages.length,2);
 const fragments=pages.flatMap(p=>p.blocks);
 assert.equal(fragments.map(x=>x.content).join(""),content);
 assert.deepEqual(fragments.map(x=>x.fields?.legacyReaderContinuation),[false,true]);
 assert.equal(fragments[0].content.length,118);
 assert.equal(fragments[1].content.length,content.length-118);
});
test("unsupported inline rich prose remains on original legacy split path",()=>{
 const original=make("A <em>highlighted</em> passage continues in the old book.");
 const prepared=prepareLegacyReaderFragments([original],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,true);
 assert.equal(prepared[0].content,original.content);
 assert.notEqual(prepared[0].id,original.id);
});
test("invalid row offsets cannot discard text",()=>{
 const content="abc ".repeat(120);
 const geometry={contentHeightPx:110,contentWidthPx:450,blockHeightsPx:[250],blockRows:[3],
 paragraphRows:[{textHeightPx:220,rows:[
 {sourceEnd:110,bottomPx:50},{sourceEnd:100,bottomPx:100},{sourceEnd:content.length,bottomPx:220}
 ]}]};
 const pages=paginateReaderBlocks([make(content.trim())],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry);
 assert.equal(pages.flatMap(p=>p.blocks).map(x=>x.content).join("").replace(/\s+/g," ").trim(),content.trim());
});
