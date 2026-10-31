import test from "node:test";
import assert from "node:assert/strict";
import {disposableCommands,verifyDisposableCommands} from "../scripts/artales-disposable-cli-json-proof.mjs";
test("disposable probe is pinned to localhost and dry-run only",()=>{
 const commands=disposableCommands();
 assert.equal(verifyDisposableCommands(commands),true);
 assert.ok(commands[0].includes("--db-url"));
 assert.equal(commands[1].includes("--dry-run"),true);
 assert.equal(commands.some(c=>c.includes("--linked")),false);
});
test("refuses switched host, missing dry-run and production ref",()=>{
 const mutation=[
  a=>{a[0][3]="postgresql://prod.example.com/postgres";},
  a=>{a[1]=a[1].filter(x=>x!=="--dry-run");},
  a=>{a[0].push("--linked");},
  a=>{a[1].push("--project-ref","nmhdwmszbwgrgfbmlguu");}
 ];
 for(const m of mutation){const c=disposableCommands();m(c);assert.throws(()=>verifyDisposableCommands(c));}
});
