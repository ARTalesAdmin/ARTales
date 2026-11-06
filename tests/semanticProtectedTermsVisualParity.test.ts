import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const lab=readFileSync(new URL("../components/editor/SemanticReaderLab.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../components/editor/semantic-reader.css",import.meta.url),"utf8");
test("measurement and visible QA pages both apply identical protected terms",()=>{
 assert.match(lab,/\{unitView\(u,protectedTerms\)\}<\/div>/);
 assert.match(lab,/\{allUnits\.map\(u=><div[\s\S]+?\{unitView\(u,protectedTerms\)\}<\/div>/);
 assert.doesNotMatch(lab,/\{unitView\(u\)\}<\/div>/);
});
test("changed source and composed blocks are distinguishable from active selection",()=>{
 assert.match(css,/\.semantic-reader__unit\[data-review-fixed="true"\]/);
 assert.match(css,/\.semantic-reader__source-region\[data-review-fixed="true"\]/);
 assert.match(css,/\.semantic-reader__unit\[data-selected="true"\]/);
 assert.match(css,/\.semantic-reader__source-region\[data-selected="true"\]/);
});
