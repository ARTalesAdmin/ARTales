import {strict as assert} from "node:assert";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {getProtectedTextSpans,isProtectedTextBoundary} from "../lib/semantic/protectedSpans";
import {chooseSemanticParagraphBreak} from "../lib/semantic/readerProjection";
import {projectSemanticProseText} from "../lib/semantic/displayText";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("canonical protections preserve source and match proper names, abbreviations and units",()=>{
 const raw="We spoke to Dr. Raymond and then Arthur Machen wrote 20 km farther.";
 const normalized=projectSemanticProseText(raw);
 const ranges=getProtectedTextSpans(raw,["Raymond"]);
 assert(ranges.some(x=>normalized.slice(x.start,x.end).includes("Dr. Raymond")));
 assert(ranges.some(x=>normalized.slice(x.start,x.end)==="Arthur Machen"));
 assert(ranges.some(x=>normalized.slice(x.start,x.end)==="20 km"));
 assert.equal(raw,"We spoke to Dr. Raymond and then Arthur Machen wrote 20 km farther.");
});
test("a reflow can never split a protected personal name at a page boundary",()=>{
 const raw="Here is a long first sentence, which sets the scene for Arthur Machen and the story. There is more prose after the name.";
 const middle=raw.indexOf("Arthur")+"Arthur ".length;
 assert.equal(isProtectedTextBoundary(raw,middle),true);
 assert.notEqual(chooseSemanticParagraphBreak(raw,0,middle,raw.length,true,25,[]),middle);
 assert.equal(isProtectedTextBoundary(raw,raw.indexOf("which")+2,["which sets"]),true);
});
test("the same canonical typographic constraints apply to QA and public reflow",()=>{
 const css=read("components/editor/semantic-reader.css");
 const qa=read("components/editor/SemanticReaderLab.tsx");
 const client=read("components/reader/SemanticReaderClient.tsx");
 const display=read("components/reader/ProtectedProseText.tsx");
 assert.match(css,/text-align:justify/);
 assert.match(css,/hyphens:manual/);
 assert.match(css,/overflow-wrap:normal/);
 assert.match(css,/word-break:normal/);
 assert.match(qa,/protected_terms:protectedTerms/);
 assert.match(client,/protected_terms:protectedTerms/);
 assert.match(display,/getProtectedTextSpans/);
 assert.match(client,/loadReaderSettings/);
 assert.match(client,/saveReaderSettings/);
});
test("approved book rules are readable only after published release",()=>{
 const sql=read("supabase/migrations/20261115112000_artales_public_published_typography_rules.sql");
 assert.match(sql,/GRANT SELECT \(candidate_id,term\)/);
 assert.match(sql,/artales_semantic_publications/);
 assert.match(sql,/w.status='published'/);
 assert.doesNotMatch(sql,/DROP POLICY artales_work_rules_staff_read/);
});
