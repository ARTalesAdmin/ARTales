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


test("legacy measured page ends at a semantic semicolon in final 20% of its physical row",()=>{
 const raw="At dawn the market opened; nearby vendors gathered in the square and continued trading until sunset.";
 const firstRow=raw.indexOf("vendors")+"vendors".length;
 const secondRow=raw.indexOf("trading")+"trading".length;
 const mark=raw.indexOf(";")+1;
 const geo={contentHeightPx:80,contentWidthPx:450,
  remeasureRemainder:(_index:number,start:number)=>({
   heightPx:100,textHeightPx:90,rows:[
    {sourceEnd:raw.indexOf("sunset"),bottomPx:40},
    {sourceEnd:raw.length,bottomPx:80},
  ],
  }),
  blockHeightsPx:[150],blockRows:[3],
  paragraphRows:[{textHeightPx:150,rows:[
   {sourceEnd:firstRow,displayEnd:firstRow,bottomPx:40,fill:.96,words:8,
    punctuationCuts:[{displayEnd:mark,fill:.86}]},
   {sourceEnd:secondRow,displayEnd:secondRow,bottomPx:90,fill:.94,words:7,
    punctuationCuts:[]},
   {sourceEnd:raw.length,displayEnd:raw.length,bottomPx:140,fill:.48,words:3,
    punctuationCuts:[]},
  ]}],
 };
 const pages=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,geo);
 const parts=pages.flatMap(page=>page.blocks);
 assert.equal(parts.map(block=>block.content).join(""),raw);
 assert.equal(parts[0].content,"At dawn the market opened; ");
 assert.equal(parts[0].fields?.legacyReaderPageEndReason,"punctuation_80");
 assert.ok(parts.length>=2);
 assert.ok(parts[1].content.startsWith("nearby vendors"));
});

test("legacy measured page does not choose an earlier-row or under-80% marker",()=>{
 const raw="At dawn the market opened; nearby vendors gathered in the square and continued trading until sunset.";
 const firstRow=raw.indexOf("vendors")+"vendors".length;
 const secondRow=raw.indexOf("trading")+"trading".length;
 const mark=raw.indexOf(";")+1;
 const base={contentHeightPx:80,contentWidthPx:450,
  blockHeightsPx:[150],blockRows:[3],
  paragraphRows:[{textHeightPx:150,rows:[
   {sourceEnd:firstRow,displayEnd:firstRow,bottomPx:40,fill:.96,words:8,
    punctuationCuts:[{displayEnd:mark,fill:.79}]},
   {sourceEnd:secondRow,displayEnd:secondRow,bottomPx:90,fill:.94,words:7,
    punctuationCuts:[]},
   {sourceEnd:raw.length,displayEnd:raw.length,bottomPx:140,fill:.48,words:3,
    punctuationCuts:[]},
  ]}],
 };
 const low=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,base);
 assert.equal(low[0].blocks[0].content,raw.slice(0,firstRow));
 assert.equal(low[0].blocks[0].fields?.legacyReaderPageEndReason,undefined);

 const earlier={...base,contentHeightPx:110};
 const later=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,earlier);
 assert.equal(later[0].blocks[0].content,raw.slice(0,secondRow),
  "punctuation in a previous row must not win over the latest fitting row");
});

test("semantic punctuation cut maps through inline emphasis without source loss",()=>{
 const raw="The travelers saw <em>a quiet meadow; many birds</em> beyond the village while daylight remained bright.";
 const inline=parseLegacyInlineProse(raw);
 assert.ok(inline);
 const visible=inline!.visibleText;
 const marker=visible.indexOf(";")+1;
 const firstEnd=visible.indexOf("birds")+"birds".length;
 const sourceFirstEnd=inline!.sourceOffsetAtTextOffset(firstEnd)!;
 const secondEnd=visible.indexOf("daylight")+"daylight".length;
 const geo={contentHeightPx:85,contentWidthPx:450,
  remeasureRemainder:(_index:number,start:number)=>({
   heightPx:100,textHeightPx:90,rows:[
    {sourceEnd:inline!.sourceOffsetAtTextOffset(visible.indexOf("daylight")+"daylight".length)!,bottomPx:43},
    {sourceEnd:raw.length,bottomPx:85},
  ],
  }),
  blockHeightsPx:[170],blockRows:[3],
  paragraphRows:[{textHeightPx:170,rows:[
   {sourceEnd:sourceFirstEnd,displayEnd:firstEnd,bottomPx:42,fill:.97,words:9,
    punctuationCuts:[{displayEnd:marker,fill:.9}]},
   {sourceEnd:inline!.sourceOffsetAtTextOffset(secondEnd)!,displayEnd:secondEnd,
    bottomPx:95,fill:.91,words:7,punctuationCuts:[]},
   {sourceEnd:raw.length,displayEnd:visible.length,bottomPx:160,
    fill:.43,words:3,punctuationCuts:[]},
  ]}],
 };
 const parts=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,geo).flatMap(page=>page.blocks);
 assert.equal(parts.map(x=>x.content).join(""),raw);
 assert.equal(parts[0].fields?.legacyReaderPageEndReason,"punctuation_80");
 assert.equal(parts[0].fields?.legacyReaderInlineSuffix,"</em>");
 assert.equal(parts[1].fields?.legacyReaderInlinePrefix,"<em>");
});

test("period can be selected at the same natural-row threshold",()=>{
 const raw="Thoughtful neighbors settled the argument. Then the conversation continued through the evening.";
 const firstEnd=raw.indexOf("conversation")+"conversation".length;
 const mark=raw.indexOf(".")+1;
 const geo={contentHeightPx:90,contentWidthPx:450,
  remeasureRemainder:(_index:number,start:number)=>({
   heightPx:100,textHeightPx:90,rows:[
    {sourceEnd:raw.indexOf("evening"),bottomPx:43},
    {sourceEnd:raw.length,bottomPx:85},
  ],
  }),
  blockHeightsPx:[130],blockRows:[2],
  paragraphRows:[{textHeightPx:130,rows:[
   {sourceEnd:firstEnd,displayEnd:firstEnd,bottomPx:40,fill:.98,words:8,
    punctuationCuts:[{displayEnd:mark,fill:.88}]},
   {sourceEnd:raw.length,displayEnd:raw.length,bottomPx:120,fill:.72,words:8,
    punctuationCuts:[]},
  ]}],
 };
 const parts=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,geo).flatMap(page=>page.blocks);
 assert.equal(parts[0].fields?.legacyReaderPageEndReason,"punctuation_80");
 assert.equal(parts[0].content,"Thoughtful neighbors settled the argument. ");
 assert.equal(parts.map(x=>x.content).join(""),raw);
});


test("multi-paragraph prose and literal unsupported tags stay uncut until DOM measures them",()=>{
 const source=("  <em>A long opening discussion with many words. </em> "+
   "This is the rest of the introduction. \n\n "+
   "A second paragraph has a <strong>literal tag</strong> and more text. ").repeat(8).trim();
 const original=make(source);
 const measured=prepareLegacyReaderFragments([original],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,true);
 assert.deepEqual(measured,[original]);
 const map=parseLegacyInlineProse(source);
 assert.ok(map);
 assert.ok(map.parts.length>=2);
 assert.equal(map.parts[0].sourceStart,0);
 // Every DOM mapping still identifies original source offsets, not a
 // rewritten, normalized, or word-budget fragment.
 assert.equal(map.sourceOffsetAtTextOffset(map.parts[1].textStart),
  source.indexOf("A second paragraph"));
});

test("multi-paragraph physical DOM cuts preserve source even across newline separators",()=>{
 const raw="First paragraph ends here.\n\nSecond paragraph extends with lots of following words.";
 const map=parseLegacyInlineProse(raw);
 assert.ok(map);
 const firstEnd=map.sourceOffsetAtTextOffset("First paragraph ends here.".length)!;
 const secondTextEnd=map.visibleText.indexOf("extends")+"extends".length;
 const secondEnd=map.sourceOffsetAtTextOffset(secondTextEnd)!;
 const geo={contentHeightPx:90,contentWidthPx:450,
  blockHeightsPx:[145],blockRows:[3],
  paragraphRows:[{textHeightPx:130,rows:[
   {sourceEnd:firstEnd,displayEnd:"First paragraph ends here.".length,
    bottomPx:30,fill:.9,words:4,punctuationCuts:[]},
   {sourceEnd:secondEnd,displayEnd:secondTextEnd,
    bottomPx:73,fill:.92,words:5,punctuationCuts:[]},
   {sourceEnd:raw.length,displayEnd:map.visibleText.length,
    bottomPx:130,fill:.75,words:6,punctuationCuts:[]},
  ]}],
 };
 const result=paginateReaderBlocksWithDiagnostics([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,geo);
 assert.equal(result.diagnostics.mode,"dom");
 assert.equal(result.diagnostics.localFallbackBlocks,0);
 assert.equal(result.pages.flatMap(page=>page.blocks).map(b=>b.content).join(""),raw);
 assert.ok(result.pages.length>1);
});

test("all DOM-rendered prose types share the same measured source-boundary paginator",()=>{
 const types=["paragraph","quote","newspaper_article","preface","afterword","acknowledgement"] as const;
 const raw=("An opening phrase with <em>carefully chosen words</em> and "+
   "a following observation about the page. ").repeat(4).trim();
 const offset=Math.floor(raw.length/2);
 const legalCut=raw.indexOf("page. ",offset)+"page.".length;
 const geometry={
   contentHeightPx:95,contentWidthPx:450,
   blockHeightsPx:[145],blockRows:[3],
   paragraphRows:[{textHeightPx:130,rows:[
     {sourceEnd:legalCut,bottomPx:39},
     {sourceEnd:Math.min(raw.length-3,legalCut+30),bottomPx:86},
     {sourceEnd:raw.length,bottomPx:130},
   ]}],
 };
 for(const type of types){
   const block={id:"shared-"+type,type,content:raw,editor_note:null};
   const uncut=prepareLegacyReaderFragments(
     [block],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,true);
   assert.deepEqual(uncut,[block],"uncut source: "+type);
   const result=paginateReaderBlocksWithDiagnostics(
     [block],defaultReaderSettings,{},DEFAULT_LEGACY_BLOCK_STYLES,geometry);
   assert.equal(result.diagnostics.mode,"dom",type);
   assert.equal(result.diagnostics.localFallbackBlocks,0,type);
   const pieces=result.pages.flatMap(page=>page.blocks);
   assert.ok(pieces.length>=2,type);
   assert.equal(pieces.map(piece=>piece.content).join(""),raw,type);
   assert.ok(pieces.every(piece=>piece.type===type),type);
 }
});


test("discretionary punctuation cuts are refused without measured reflow",()=>{
 const raw="First a complete sentence. Then a long continuation proceeds with several words to the following page.";
 const cut=raw.indexOf("continuation")+"continuation".length;
 const mark=raw.indexOf(".")+1;
 const geo={contentHeightPx:100,contentWidthPx:450,
  blockHeightsPx:[170],blockRows:[3],
  paragraphRows:[{textHeightPx:155,rows:[
   {sourceEnd:cut,displayEnd:cut,bottomPx:43,fill:.98,words:8,
    punctuationCuts:[{displayEnd:mark,fill:.87}]},
   {sourceEnd:raw.indexOf("following")+"following".length,bottomPx:89},
   {sourceEnd:raw.length,bottomPx:155},
  ]}],
 };
 const pages=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,geo);
 const first=pages[0].blocks[0];
 assert.equal(first.fields?.legacyReaderPageEndReason,undefined);
 assert.equal(first.content,raw.slice(0,cut));
 assert.equal(pages.flatMap(page=>page.blocks).map(x=>x.content).join(""),raw);
});

test("punctuation reflows the very next page from its first real row",()=>{
 const raw="Many gathered here; then their discussion continued with unusually many careful words across a lengthy afternoon.";
 const mark=raw.indexOf(";")+1;
 const originalFirst=raw.indexOf("discussion")+"discussion".length;
 let calls=0;
 const geo={contentHeightPx:90,contentWidthPx:450,
  blockHeightsPx:[190],blockRows:[4],
  remeasureRemainder:(_index:number,start:number,displayStart:number)=>{
   calls++;
   assert.equal(start,raw.indexOf(" then")+1);
   assert.equal(displayStart,start);
   return {heightPx:125,textHeightPx:110,rows:[
    // This word now fits on the FIRST row after a fresh wrap. In the original
    // page it belonged to the previous row, so old rowStart=endRow was wrong.
    {sourceEnd:raw.indexOf("careful")+"careful".length,
     displayEnd:raw.indexOf("careful")+"careful".length,bottomPx:37},
    {sourceEnd:raw.indexOf("lengthy")+"lengthy".length,
     displayEnd:raw.indexOf("lengthy")+"lengthy".length,bottomPx:68},
    {sourceEnd:raw.length,displayEnd:raw.length,bottomPx:110},
   ]};
  },
  paragraphRows:[{textHeightPx:185,rows:[
   {sourceEnd:originalFirst,displayEnd:originalFirst,bottomPx:38,
    fill:.96,words:9,punctuationCuts:[{displayEnd:mark,fill:.87}]},
   {sourceEnd:raw.indexOf("unusually")+"unusually".length,bottomPx:90},
   {sourceEnd:raw.indexOf("afternoon")+"afternoon".length,bottomPx:115},
   {sourceEnd:raw.length,bottomPx:185},
  ]}],
 };
 const pages=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,geo);
 const fragments=pages.flatMap(page=>page.blocks);
 assert.equal(calls,1,"only the chosen discretionary cut remeasures");
 assert.equal(fragments[0].fields?.legacyReaderPageEndReason,"punctuation_80");
 assert.equal(fragments[1].content,
  raw.slice(raw.indexOf(" then")+1,raw.indexOf("lengthy")+"lengthy".length));
 assert.equal(fragments.map(x=>x.content).join(""),raw);
});


test("shared page policy prefers a measured 76%-filled sentence to an orphan 'But the'",()=>{
 const raw="The people carefully considered the long explanation. But the extraordinarily detailed continuation is still here.";
 const sentenceEnd=raw.indexOf(" But the")+1;
 const rowEnd=raw.indexOf("But the")+"But the".length;
 const secondEnd=raw.indexOf("continuation")+"continuation".length;
 for(const type of ["paragraph","quote","newspaper_article"] as const){
  let remeasured=0;
  const geometry={
   contentHeightPx:93,contentWidthPx:460,
   blockHeightsPx:[170],blockRows:[3],
   paragraphRows:[{textHeightPx:155,rows:[
    {sourceEnd:rowEnd,displayEnd:rowEnd,bottomPx:41,fill:.97,words:12,
     punctuationCuts:[{displayEnd:raw.indexOf(".")+1,fill:.76}]},
    {sourceEnd:secondEnd,displayEnd:secondEnd,bottomPx:98,fill:.91,words:5,
     punctuationCuts:[]},
    {sourceEnd:raw.length,displayEnd:raw.length,bottomPx:155,fill:.56,words:4,
     punctuationCuts:[]},
   ]}],
   remeasureRemainder:(_index:number,sourceStart:number,displayStart:number)=>{
    assert.equal(sourceStart,sentenceEnd);
    assert.equal(displayStart,sentenceEnd);
    remeasured++;
    return {heightPx:103,textHeightPx:90,rows:[
     {sourceEnd:secondEnd,displayEnd:secondEnd,bottomPx:42},
     {sourceEnd:raw.length,displayEnd:raw.length,bottomPx:90},
    ]};
   },
  };
  const block={...make(raw),type,id:"common-"+type};
  const pages=paginateReaderBlocks([block],defaultReaderSettings,{},
   DEFAULT_LEGACY_BLOCK_STYLES,geometry);
  const pieces=pages.flatMap(page=>page.blocks);
  assert.equal(remeasured,1,type);
  assert.equal(pieces[0].content,raw.slice(0,sentenceEnd),type);
  assert.equal(pieces[0].fields?.legacyReaderPageEndReason,"punctuation_80",type);
  assert.equal(pieces.map(x=>x.content).join(""),raw,type);
  assert.ok(pieces.every(x=>x.type===type),type);
 }
});
test("a hanging tail never authorizes a half-empty measured sentence break",()=>{
 const raw="The people carefully considered the long explanation. But the extraordinarily detailed continuation is still here.";
 const rowEnd=raw.indexOf("But the")+"But the".length;
 const geo={contentHeightPx:93,contentWidthPx:460,
  blockHeightsPx:[170],blockRows:[3],
  paragraphRows:[{textHeightPx:155,rows:[
   {sourceEnd:rowEnd,displayEnd:rowEnd,bottomPx:41,fill:.97,words:12,
    punctuationCuts:[{displayEnd:raw.indexOf(".")+1,fill:.62}]},
   {sourceEnd:raw.indexOf("continuation")+"continuation".length,bottomPx:98},
   {sourceEnd:raw.length,bottomPx:155},
  ]}],
  remeasureRemainder:()=>{throw Error("unacceptable cut must never be remeasured");},
 };
 const pages=paginateReaderBlocks([make(raw)],defaultReaderSettings,{},
  DEFAULT_LEGACY_BLOCK_STYLES,geo);
 const first=pages[0].blocks[0];
 assert.equal(first.fields?.legacyReaderPageEndReason,undefined);
 assert.equal(first.content,raw.slice(0,rowEnd));
 assert.equal(pages.flatMap(x=>x.blocks).map(x=>x.content).join(""),raw);
});
