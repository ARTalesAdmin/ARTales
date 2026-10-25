import test from "node:test";
import assert from "node:assert/strict";
import {parseGutenbergOpds} from "../lib/legal/gutenbergOpds";
const xml=`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry>
<id>https://www.gutenberg.org/ebooks/11</id><title>Alice &amp; Wonderland</title>
<author><name>Carroll, Lewis, 1832-1898</name></author>
<link rel="http://opds-spec.org/acquisition/open-access" type="text/plain" href="https://www.gutenberg.org/ebooks/11.txt.utf-8"/>
<link rel="http://opds-spec.org/acquisition/open-access" type="text/html" href="https://evil.example/page.html"/>
</entry></feed>`;
test("OPDS returns exact Gutenberg acquisition file, not evil URL",()=>{
 const items=parseGutenbergOpds(xml);
 assert.equal(items.length,1);assert.equal(items[0].id,11);
 assert.equal(items[0].authors[0].died,1898);
 assert.equal(items[0].files.length,1);
 assert.equal(items[0].files[0].format,"plain_text");
});
test("catalog may contain no files without inventing URLs",()=>{
 assert.equal(parseGutenbergOpds('<feed><entry><id>https://www.gutenberg.org/ebooks/55</id><title>Unknown</title></entry></feed>')[0].files.length,0);
});
test("reject malformed OPDS",()=>assert.throws(()=>parseGutenbergOpds("<html/>")));
