/**
 * ARTales Alice E2: reproducible, throwaway LOCAL migration replay builder.
 * Requires a file first created by "supabase migration new" on the CI runner.
 * Neither this script nor its generated output may target production.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";

const target=process.argv[2];
if(!target || !/^supabase\/migrations\/\d{14}_artales_alice_e2_preview\.sql$/.test(target)){
  throw Error("Expected CLI-created local preview migration path");
}
const files=[
  "supabase/ci/alice_e2_signed_draft_assembly.sql",
  "supabase/ci/alice_e2_approval_proof.sql"
];
const bodies=[];
for(const file of files){
  const source=readFileSync(file,"utf8").replace(/\r\n/g,"\n");
  const first=/^begin;[ \t]*$/gm.exec(source);
  const commits=[...source.matchAll(/^commit;[ \t]*$/gm)];
  const last=commits.at(-1);
  if(!first || !last || first.index>=last.index ||
    source.slice(last.index+last[0].length).trim()!=="" ||
    !/disposable|local|isolated|provisional|proof/i.test(source.slice(0,first.index))){
    throw Error("Local-only SQL framing drift; review manually: "+file);
  }
  const body=source.slice(first.index+first[0].length,last.index).trim();
  if(body.length<3000)throw Error("Unexpectedly short SQL: "+file);
  bodies.push("\n-- BEGIN reviewed local SQL: "+file+"\n"+body+"\n-- END reviewed local SQL: "+file+"\n");
}
const compiled="-- ARTales E2-1 Alice private editor schema: DISPOSABLE LOCAL CI ONLY.\n"+
  "-- NOT a production migration. Do not commit under supabase/migrations.\n"+
  "-- Canonical cloud promotion needs separate security audit and authorization.\n"+
  bodies.join("\n");
writeFileSync(target,compiled,"utf8");
console.log("ALICE_LOCAL_MIGRATION_REPLAY sha256="+createHash("sha256").update(compiled).digest("hex")+
  " bytes="+Buffer.byteLength(compiled));
