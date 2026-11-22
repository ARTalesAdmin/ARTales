import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_LEGACY_BLOCK_STYLES} from "../lib/rendering/legacyBlockStyles";
import {defaultReaderSettings} from "../lib/reader/readerSettings";
import {paginateReaderBlocks,paginateReaderBlocksWithDiagnostics,prepareLegacyReaderFragments} from "../lib/reader/paginateBlocks";
import {parseLegacyInlineProse} from "../lib/reader/inlineProseSource";

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
  contentHeightPx:155,contentWidthPx:450,
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
test("supported inline emphasis reaches DOM measuring without legacy pre-splitting",()=>{
 const original=make(("Opening <em>important " + "words ".repeat(200) + "</em> " +
   "a closing sentence.").trim());
 const prepared=prepareLegacyReaderFragments(
   [original],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,true);
 assert.equal(prepared.length,1);
 assert.deepEqual(prepared[0],original);
});
test("DOM rows split inside emphasis with exact source and valid rendering affixes",()=>{
 const raw="Hello <em>bright warm favorite language</em> there.";
 const parsed=parseLegacyInlineProse(raw);
 assert.ok(parsed);
 const text=parsed!.visibleText;
 const cuts=["Hello","bright","warm","language"].map(word=>{
   const start=text.indexOf(word);
   return parsed!.sourceOffsetAtTextOffset(start+word.length)!;
 });
 const geometry={
   contentHeightPx:120,contentWidthPx:450,
   blockHeightsPx:[180],blockRows:[4],
   paragraphRows:[{textHeightPx:160,rows:cuts.map((sourceEnd,index)=>({
     sourceEnd,bottomPx:40*(index+1),
   }))}],
 };
 const pages=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
   DEFAULT_LEGACY_BLOCK_STYLES,geometry);
 const pieces=pages.flatMap(page=>page.blocks);
 assert.equal(pieces.map(piece=>piece.content).join(""),raw);
 assert.ok(pieces.length>1);
 assert.equal(pieces[0].fields?.legacyReaderInlineSuffix,"</em>");
 assert.equal(pieces[1].fields?.legacyReaderInlinePrefix,"<em>");
});
test("missing row offsets in one paragraph do not switch the whole book to estimates",()=>{
 const first=make("Word ".repeat(120).trim());
 const second={...make("Second measured paragraph."),id:"second"};
 const geo={contentHeightPx:130,contentWidthPx:450,
   blockHeightsPx:[210,45],blockRows:[4,1],
   paragraphRows:[null,{textHeightPx:45,
     rows:[{sourceEnd:second.content.length,bottomPx:45}]}],
 };
 const result=paginateReaderBlocksWithDiagnostics(
   [first,second],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geo);
 assert.equal(result.diagnostics.mode,"dom");
 assert.equal(result.diagnostics.localFallbackBlocks,1);
 assert.equal(result.pages[0].overflow,"scroll_unit");
 assert.equal(result.pages.at(-1)?.blocks[0].id,"second");
 assert.equal(result.pages.flatMap(page=>page.blocks)
   .map(block=>block.content).join(""),first.content+second.content);
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

test("measured paginator uses the last physical row fitting the current sheet",()=>{
 const intro={...make("An introduction."),id:"intro"};
 const raw="one two three four";
 const next={...make(raw),id:"next"};
 const geometry={
  contentHeightPx:170,contentWidthPx:450,
  blockHeightsPx:[110,160],blockRows:[1,4],
  paragraphRows:[
   {textHeightPx:20,rows:[{sourceEnd:intro.content.length,bottomPx:20}]},
   {textHeightPx:160,rows:[
    {sourceEnd:3,bottomPx:40},{sourceEnd:7,bottomPx:80},
    {sourceEnd:13,bottomPx:120},{sourceEnd:18,bottomPx:160},
   ]},
  ],
 };
 const result=paginateReaderBlocksWithDiagnostics(
  [intro,next],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry);
 assert.equal(result.diagnostics.mode,"dom");
 assert.equal(result.pages[0].blocks.length,2,
  "one fitting physical row must not be moved to the next sheet");
 assert.equal(result.pages[0].blocks.at(-1)?.content,"one");
 assert.equal(result.pages.slice(1).flatMap(page=>page.blocks)
  .map(block=>block.content).join("")," two three four");
 assert.equal(result.pages.flatMap(page=>page.blocks)
  .map(block=>block.content).join(""),intro.content+raw);
});
test("hidden empty prose does not invalidate measurements for all remaining pages",()=>{
 const empty=make("   ");
 const real={...make("A long and readable paragraph."),id:"real"};
 const input=[empty,real];
 const fragments=prepareLegacyReaderFragments(input,defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,true);
 assert.deepEqual(fragments,[real]);
 const geo={
  contentHeightPx:180,contentWidthPx:450,
  blockHeightsPx:[55],blockRows:[1],
  paragraphRows:[{textHeightPx:35,rows:[
   {sourceEnd:real.content.length,bottomPx:35},
  ]}],
 };
 const result=paginateReaderBlocksWithDiagnostics(input,defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,geo);
 assert.equal(result.diagnostics.mode,"dom");
 assert.deepEqual(result.pages.flatMap(page=>page.blocks),[real]);
});
