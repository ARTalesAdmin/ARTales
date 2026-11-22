import test from "node:test";
import assert from "node:assert/strict";
import {WORK_BLOCK_TYPES} from "../lib/blocks";
import {
 DEFAULT_LEGACY_BLOCK_STYLES,legacyBlockStyleVars,parseLegacyBlockStyle,
 legacyBlockWeightMultiplier
} from "../lib/rendering/legacyBlockStyles";

test("canonical block type registry covers all legacy renderable types",()=>{
 assert.equal(WORK_BLOCK_TYPES.length,17);
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
