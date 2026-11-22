import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const reader=readFileSync("components/reader/ReaderClient.tsx","utf8");
const style=readFileSync("components/work/legacy-block-typography.css","utf8");
const helper=readFileSync("lib/reader/legacyLastRow.ts","utf8");

test("legacy last-line uses canonical semantic measurement, not a copied threshold",()=>{
 assert.match(helper,/import \{applySemanticProseLastRowJustification\} from "@\/lib\/semantic\/domLineGeometry"/);
 assert.doesNotMatch(helper,/\.83|\.83\b|7\s*\*|words\s*>=/);
});
test("last-row pass applies only to visible old prose after page settlement",()=>{
 assert.match(reader,/if \(!measurementReady\) return;/);
 assert.match(reader,/applyLegacyPaperLastRowJustification\(paper\)/);
 assert.match(reader,/classList\.contains\("artales-reader__paper--blank"\)/);
 // Justified prose uses one canonical measured pass regardless of block type.
 assert.match(helper,/\[data-legacy-block-style\]/);
 for(const type of ["artales-paragraph","artales-quote","artales-letter-body",
   "artales-newspaper","artales-preface","artales-afterword","artales-acknowledgement"]){
  assert.ok(helper.includes(type),"missing prose selector: "+type);
  assert.ok(style.includes(type),"missing CSS coverage: "+type);
 }
 assert.doesNotMatch(helper,/"pride-and-prejudice"|workId|slug/);
 assert.doesNotMatch(helper,/innerHTML|textContent\s*=/);
});
test("legacy last-row CSS is scoped and preserves semantic Reader",()=>{
 assert.match(style,/artales-reader:not\(\.artales-reader--semantic\)/);
 assert.match(style,/semantic-reader__prose--justify-last/);
 assert.match(style,/text-align-last:\s*justify/);
});

test("scoped CSS does not force last rows in verse or editorial alignment",()=>{
 assert.doesNotMatch(style,/\\.artales-poem[^\\n]*p\\.semantic-reader__prose--justify-last/);
 assert.match(helper,/applySemanticProseLastRowJustification\\(paragraph\\)/);
 assert.doesNotMatch(helper,/style\\.textAlign|style\\.wordSpacing/);
});
