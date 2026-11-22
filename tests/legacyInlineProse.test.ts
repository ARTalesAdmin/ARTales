import test from "node:test";
import assert from "node:assert/strict";
import {parseLegacyInlineProse} from "../lib/reader/inlineProseSource";

test("source map keeps exact emphasis positions without rewriting source",()=>{
 const raw="Before <em>inside marked phrase</em> after.";
 const result=parseLegacyInlineProse(raw);
 assert.ok(result);
 assert.equal(result.visibleText,"Before inside marked phrase after.");
 const cut=result.sourceOffsetAtTextOffset("Before inside".length);
 assert.equal(cut,raw.indexOf("inside")+"inside".length);
 assert.equal(result.activeTagAtSourceOffset(cut!),"em");
 assert.equal(result.activeTagAtSourceOffset(raw.length),null);
 assert.equal(raw.slice(0,cut!)+raw.slice(cut!),raw);
});

test("escaped Gutenberg markup is mapped identically to the renderer",()=>{
 const raw="Start &lt;i&gt;slanted text&lt;/i&gt; end";
 const result=parseLegacyInlineProse(raw);
 assert.equal(result?.visibleText,"Start slanted text end");
 const cut=result?.sourceOffsetAtTextOffset("Start slanted".length);
 assert.equal(result?.activeTagAtSourceOffset(cut!),"i");
});

test("unknown, nested and incomplete markup use a safe fallback",()=>{
 assert.equal(parseLegacyInlineProse("Some <strong>bold</strong> text"),null);
 assert.equal(parseLegacyInlineProse("Nested <em>outer <i>inner</i></em>"),null);
 assert.equal(parseLegacyInlineProse("Missing <em>ending"),null);
 assert.equal(parseLegacyInlineProse("Multi\nparagraph"),null);
});
