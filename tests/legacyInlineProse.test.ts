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

test("literal unknown tags map safely, malformed emphasis remains conservative",()=>{
 const literal=parseLegacyInlineProse("Some <strong>bold</strong> text");
 assert.equal(literal?.visibleText,"Some <strong>bold</strong> text");
 assert.equal(literal?.sourceOffsetAtTextOffset(literal.visibleText.length),
  "Some <strong>bold</strong> text".length);
 assert.equal(parseLegacyInlineProse("Nested <em>outer <i>inner</i></em>"),null);
 assert.equal(parseLegacyInlineProse("Missing <em>ending"),null);
});

test("single source newline stays eligible for physical DOM row measurement",()=>{
 const input="A complete sentence.\nThis is still the same prose block.";
 const result=parseLegacyInlineProse(input);
 assert.ok(result);
 assert.equal(result.visibleText,input);
 assert.equal(result.sourceOffsetAtTextOffset(input.length),input.length);
 const multi=parseLegacyInlineProse("One paragraph.\n\nAnother paragraph.");
 assert.deepEqual(multi?.parts.map(part=>part.text),[
  "One paragraph.","Another paragraph.",
 ]);
 assert.equal(parseLegacyInlineProse("Windows\r\nline breaks need renderer normalization"),null);
});


test("lossless Gutenberg multi-paragraph source map keeps all original separators",()=>{
 const raw="  <em>Some opening words.</em> \n\n\n  Many <strong>literal</strong> later words.  ";
 const source=parseLegacyInlineProse(raw);
 assert.ok(source);
 assert.equal(source.parts.length,2);
 assert.deepEqual(source.parts.map(part=>part.text),[
  "Some opening words.","Many <strong>literal</strong> later words.",
 ]);
 assert.equal(source.visibleText,"Some opening words.\n\nMany <strong>literal</strong> later words.");
 const firstWordEnd=source.visibleText.indexOf("words.")+"words.".length;
 const firstCut=source.sourceOffsetAtTextOffset(firstWordEnd)!;
 assert.equal(raw.slice(firstCut,firstCut+5),"</em>");
 assert.equal(source.activeTagAtSourceOffset(firstCut),"em");
 const secondStart=source.parts[1].textStart;
 const secondCut=source.sourceOffsetAtTextOffset(secondStart)!;
 assert.equal(raw.slice(secondCut,secondCut+4),"Many");
 assert.equal(source.activeTagAtSourceOffset(secondCut),null);
 assert.equal(raw.slice(0,firstCut)+raw.slice(firstCut,secondCut)+raw.slice(secondCut),raw);
});

test("markup crossing a paragraph boundary remains on safe fallback",()=>{
 assert.equal(parseLegacyInlineProse("Opening <em>text\n\nstill open</em>"),null);
 assert.equal(parseLegacyInlineProse("<em>one <em>nested</em> segment</em>"),null);
 assert.equal(parseLegacyInlineProse(" \r\nOld Windows breaks"),null);
});
