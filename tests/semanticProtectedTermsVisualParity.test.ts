import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ProtectedProseText from "../components/reader/ProtectedProseText";
import {projectSemanticProseText} from "../lib/semantic/displayText";
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

test("all displayed prose prevents automatic hyphenation, including offscreen page measurement",()=>{
 assert.match(css,/hyphens:manual/);
 assert.doesNotMatch(css,/hyphens:auto/);
 assert.match(css,/overflow-wrap:normal/);
 assert.match(css,/word-break:normal/);
 assert.match(lab,/\{unitView\(u,protectedTerms\)\}<\/div>/);
});

test("typographic phrase protection preserves source text and groups common language constructs",()=>{
 const raw="Dr. Raymond met Mr. Smith and A. C. Doyle at 12 km. Raymond returned.";
 const expected=projectSemanticProseText(raw);
 const markup=renderToStaticMarkup(createElement(ProtectedProseText,{raw,terms:["Raymond"]}));
 assert.match(markup,/data-work-protected-term="Dr\. Raymond"/);
 assert.match(markup,/data-work-protected-term="Mr\. Smith"/);
 assert.match(markup,/data-work-protected-term="A\. C\. Doyle"/);
 assert.match(markup,/data-work-protected-term="12 km"/);
 assert.match(markup,/data-work-protected-term="Raymond"/);
 assert.equal(markup.replace(/<[^>]+>/g,""),expected);
});
