import test from "node:test";
import assert from "node:assert/strict";
import {discoverGutenbergImages,PG114_ILLUSTRATIONS_CATALOG,PG114_ILLUSTRATIONS_SOURCE} from "../lib/ingest/gutenbergImageManifest";
const head="<html><head><title>Tenniel's illustrated Alice</title></head><body>";
const tail="</body></html>";
const figure=(id:number)=>'<img src="images/alice'+String(id).padStart(2,"0")+'.gif" alt="Tenniel '+id+'">';
test("complete ordered 42-image HTML manifest with stable SHA and no false archival claims",()=>{
 const html=head+Array.from({length:42},(_,i)=>figure(i+1)).join("\n")+tail;
 const a=discoverGutenbergImages({html,source_url:PG114_ILLUSTRATIONS_SOURCE,catalog_url:PG114_ILLUSTRATIONS_CATALOG,expected_count:42});
 const b=discoverGutenbergImages({html,source_url:PG114_ILLUSTRATIONS_SOURCE,catalog_url:PG114_ILLUSTRATIONS_CATALOG,expected_count:42});
 assert.deepEqual(a,b);assert.equal(a.images.length,42);
 assert.equal(a.images[0].ordinal,1);assert.equal(a.images[41].ordinal,42);
 assert.ok(a.images[0].source_url.startsWith("https://www.gutenberg.org/files/114/"));
 assert.equal(a.asset_bytes_archived,false);
 assert.ok(a.images.every(i=>i.archive_status==="not_captured"));
});
test("missing illustration, foreign host, duplicate asset, invalid path and rights-free shortcut reject",()=>{
 const html=head+figure(1)+tail;
 assert.throws(()=>discoverGutenbergImages({html,source_url:PG114_ILLUSTRATIONS_SOURCE,catalog_url:PG114_ILLUSTRATIONS_CATALOG,expected_count:42}),/Incomplete/);
 for(const fragment of [
  '<img src="https://elsewhere.invalid/evil.gif">',
  '<img src="../111/alien.gif">',
  '<img src="images/script.svg">',
  figure(1),
 ]){
  const bad=head+figure(1)+fragment+tail;
  assert.throws(()=>discoverGutenbergImages({html:bad,source_url:PG114_ILLUSTRATIONS_SOURCE,catalog_url:PG114_ILLUSTRATIONS_CATALOG}),/Untrusted|repeated|unsupported/i);
 }
});
