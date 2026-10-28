import test from "node:test";
import assert from "node:assert/strict";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {admission,inventoryFromDirectory,PROJECT,REPO} from "../scripts/artales-migration-plan-core.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const original=inventoryFromDirectory(join(root,"supabase","migrations"))
 .filter(m=>m.version<="20261027081945");
const NOW="2026-10-28T12:30:00.000Z",HEAD="a".repeat(40);
function fixture(items=original){
 return {inventory:items,checkoutSha:HEAD,nowISO:NOW,
  readback:{schema:"artales-migration-readback/v0",source:"operator-attested-provider-readback",
   projectRef:PROJECT,observedAt:"2026-10-28T12:29:00.000Z",
   migrations:original.map(i=>({version:i.version,name:i.name,
    ...(i.version==="20260926142755"?{}:{statementMd5:i.md5})}))},
  request:{schema:"artales-migration-request/v0",projectRef:PROJECT,
   repository:REPO,ref:"refs/heads/main",headSha:HEAD,expectedPending:[]}};
}
function blocked(f){assert.throws(()=>admission(f),/artales_admission_blocked/);}
test("current canonical history is verified and never grants apply",()=>{
 const p=admission(fixture());
 assert.equal(p.appliedCount,5);assert.deepEqual(p.pending,[]);
 assert.equal(p.liveCliDryRunVerified,false);assert.equal(p.productionApplyAuthorized,false);
 assert.equal(p.mayApply,false);assert.match(p.planDigest,/^[a-f0-9]{64}$/);
});
test("wrong project, repo, ref and checkout head all fail closed",()=>{
 for(const [key,value] of [["projectRef","another"],["repository","other/other"],
  ["ref","refs/heads/develop"],["headSha","b".repeat(40)]]){
  const f=fixture();f.request[key]=value;blocked(f);
 }
});
test("stale/future readback and unknown source are denied",()=>{
 for(const change of [{observedAt:"2026-10-28T11:59:00.000Z"},
  {observedAt:"2026-10-28T12:40:00.000Z"},{source:"synthetic"}]){
  const f=fixture();Object.assign(f.readback,change);blocked(f);
 }
});
test("missing, wrong name, invalid hash, duplicate and reordered remote records denied",()=>{
 const gone=fixture();gone.readback.migrations.pop();blocked(gone);
 const renamed=fixture();renamed.readback.migrations[1].name="wrong";blocked(renamed);
 const bad=fixture();bad.readback.migrations[1].statementMd5="0".repeat(32);blocked(bad);
 const duplicate=fixture();duplicate.readback.migrations.push({...duplicate.readback.migrations[4]});blocked(duplicate);
 const reversed=fixture();reversed.readback.migrations.reverse();blocked(reversed);
});
const next={version:"20261028091029",name:"artales_identity_role_authority_v1",
 filename:"20261028091029_artales_identity_role_authority_v1.sql",
 sha256:"f".repeat(64),md5:"e".repeat(32)};
test("one future exact SQL hash generates a source-only plan",()=>{
 const f=fixture([...original,next]);
 f.request.expectedPending=[{filename:next.filename,sha256:next.sha256}];
 const plan=admission(f);assert.equal(plan.pending.length,1);assert.equal(plan.mayApply,false);
 const wrong=fixture([...original,next]);blocked(wrong);
 const hash=fixture([...original,next]);
 hash.request.expectedPending=[{filename:next.filename,sha256:"0".repeat(64)}];blocked(hash);
});
test("multiple pending, backdated, or duplicate migration identifiers denied",()=>{
 blocked(fixture([...original,next,{...next,version:"20261028091030",
  name:"another",filename:"20261028091030_another.sql"}]));
 blocked(fixture([...original,{...next,version:"20261025080000",
  filename:"20261025080000_artales_identity_role_authority_v1.sql"}]));
 blocked(fixture([...original,{...next,version:original[4].version,
  filename:original[4].filename}]));
});
