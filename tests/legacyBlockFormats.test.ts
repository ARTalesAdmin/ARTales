import test from "node:test";
import assert from "node:assert/strict";
import {WORK_BLOCK_TYPES} from "../lib/blocks";
import {
 DEFAULT_LEGACY_BLOCK_STYLES,legacyBlockStyleVars,parseLegacyBlockStyle,
 legacyBlockWeightMultiplier
} from "../lib/rendering/legacyBlockStyles";

test("canonical block type registry covers all legacy renderable types",()=>{
 assert.ok(WORK_BLOCK_TYPES.length > 0);
 assert.deepEqual(Object.keys(DEFAULT_LEGACY_BLOCK_STYLES).sort(),[...WORK_BLOCK_TYPES].sort());
 for(const type of WORK_BLOCK_TYPES){
  assert.deepEqual(parseLegacyBlockStyle(type,DEFAULT_LEGACY_BLOCK_STYLES[type]),
   DEFAULT_LEGACY_BLOCK_STYLES[type]);
 }
});
test("formats reject unsafe values and unknown properties",()=>{
 assert.equal(parseLegacyBlockStyle("paragraph",{font_size_em:-2}),null);
 assert.equal(parseLegacyBlockStyle("paragraph",{font_family:"url(https://bad.tld)"}),null);
 assert.equal(parseLegacyBlockStyle("paragraph",{unexpected_rule:"display:none"}),null);
 assert.equal(parseLegacyBlockStyle("paragraph",{own_page:"true"}),null);
});
test("all pagination fields and CSS variables come from the same style",()=>{
 const value=parseLegacyBlockStyle("paragraph",{
  own_page:true,page_break_before:true,keep_together:true,
  font_size_em:1.3,line_height:1.8
 });
 assert.ok(value);
 const css=legacyBlockStyleVars(value!);
 assert.equal(css.breakBefore,"page");
 assert.equal(css.breakAfter,"page");
 assert.equal(css.breakInside,"avoid");
 assert.equal(css["--artales-block-size" as keyof typeof css],"1.3em");
 assert.ok(legacyBlockWeightMultiplier(value!)>1);
});

test("page breaks, isolated pages and font scaling affect the old Reader pagination",async()=>{
 const {paginateReaderBlocks}=await import("../lib/reader/paginateBlocks");
 const {defaultReaderSettings}=await import("../lib/reader/readerSettings");
 const make=(id:string,text:string)=>({id,type:"paragraph" as const,content:text,editor_note:null});
 const blocks=[
  make("a","First short sentence."),
  make("b","Second short sentence."),
  make("c","Third short sentence.")
 ];
 const normal=paginateReaderBlocks(blocks,defaultReaderSettings);
 assert.equal(normal.length,1);
 const styled=structuredClone(DEFAULT_LEGACY_BLOCK_STYLES);
 styled.paragraph={...styled.paragraph,page_break_before:true,own_page:true,keep_together:true};
 const separate=paginateReaderBlocks(blocks,defaultReaderSettings,{},styled);
 assert.equal(separate.length,3);
 assert.deepEqual(separate.map(p=>p.blocks.map(b=>b.id)),[["a"],["b"],["c"]]);
 const reset=structuredClone(DEFAULT_LEGACY_BLOCK_STYLES);
 reset.paragraph={...reset.paragraph,own_page:false,page_break_before:false};
 assert.equal(paginateReaderBlocks(blocks,defaultReaderSettings,{},reset).length,1);
});

test("oversized styled paragraphs preserve every word across fragments",async()=>{
 const {paginateReaderBlocks}=await import("../lib/reader/paginateBlocks");
 const {defaultReaderSettings}=await import("../lib/reader/readerSettings");
 const styles=structuredClone(DEFAULT_LEGACY_BLOCK_STYLES);
 styles.paragraph={...styles.paragraph,font_size_em:2.8,line_height:2.4};
 const raw=Array.from({length:120},(_,i)=>"word"+i).join(" ")+".";
 const pages=paginateReaderBlocks([{id:"long",type:"paragraph",content:raw,editor_note:null}],defaultReaderSettings,{},styles);
 const flattened=pages.flatMap(p=>p.blocks).map(b=>b.content).join(" ");
 assert.equal(flattened,raw);
 assert.ok(pages.length>1);
});
