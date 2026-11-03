import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {composeSemanticRevision,verifySemanticRevision} from "../lib/semantic/compose";
const sha=(x:string)=>createHash("sha256").update(x).digest("hex");
const source="The Project Gutenberg eBook of The Great God Pan\n\nCHAPTER I.\n\nA small first paragraph.\n\nAnother paragraph.";
const input={work_id:"98508359-bce1-4e73-b842-b69a9d1112d0",
 work_slug:"candidate-98508359-bce1-4e73-b842-b69a9d1112d0",
 snapshot_ref:"sha256:"+"2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df",
 source_bytes_sha256:sha(source),component_id:"epub:spine",
 original_byte_start:0,original_raw:source};
function reorderJsonb(x:unknown):unknown{
 if(Array.isArray(x))return x.map(reorderJsonb);
 if(!x||typeof x!=="object")return x;
 // PostgreSQL jsonb orders object keys differently than insertion order.
 return Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.length-b.length||a.localeCompare(b))
  .map(([k,v])=>[k,reorderJsonb(v)]));
}
function legacy():Record<string,unknown>{
 const revision=composeSemanticRevision(input);
 const {revision_ref:_ref,revision_sha256:_hash,...payload}=revision;
 void _ref;void _hash;
 const oldSha=sha(JSON.stringify(payload));
 return {...payload,revision_sha256:oldSha,revision_ref:"sha256:"+oldSha};
}
test("new revision survives recursive jsonb key reordering",()=>{
 const revision=composeSemanticRevision(input);
 const fromDb=reorderJsonb(JSON.parse(JSON.stringify(revision)));
 assert.doesNotThrow(()=>verifySemanticRevision(fromDb as typeof revision,source));
 assert.equal((fromDb as ReturnType<typeof composeSemanticRevision>).revision_sha256,revision.revision_sha256);
});
test("legacy v2 round-zero signature still validates after jsonb roundtrip",()=>{
 const old=legacy(),fromDb=reorderJsonb(JSON.parse(JSON.stringify(old)));
 assert.doesNotThrow(()=>verifySemanticRevision(fromDb as ReturnType<typeof composeSemanticRevision>,source));
 assert.equal((fromDb as ReturnType<typeof composeSemanticRevision>).revision_sha256,old.revision_sha256);
});
test("tampered text or metadata never passes legacy compatibility",()=>{
 const old=legacy();
 for(const change of [
  (x:any)=>{x.blocks[0].atom.raw="altered";},
  (x:any)=>{x.work_slug="wrong";},
  (x:any)=>{x.source.normalized_text+="x";},
  (x:any)=>{x.blocks[0].atom.anchor.original_byte_end+=1;}
 ]){
  const candidate=reorderJsonb(JSON.parse(JSON.stringify(old))) as ReturnType<typeof composeSemanticRevision>;
  change(candidate);assert.throws(()=>verifySemanticRevision(candidate,source));
 }
});
