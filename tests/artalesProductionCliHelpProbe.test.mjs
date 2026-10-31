import test from "node:test";
import assert from "node:assert/strict";
import {CLI_PIN,planCommands} from "../scripts/artales-migration-plan-v01-core.mjs";
import {compareHelpToPlan} from "../scripts/artales-production-cli-help-probe.mjs";
const commands=planCommands();
const helpFor=argv=>"Usage: supabase command\n"+"F".repeat(200)+"\n"+
 argv.filter(v=>v.startsWith("--")).join("\n");
test("CLI help probe requires exact pin and all PLAN flags",()=>{
 const args={version:CLI_PIN,
  migrationListHelp:helpFor(commands[0].argv),
  dbPushHelp:helpFor(commands[1].argv)};
 assert.equal(compareHelpToPlan(args).compatible,true);
 assert.equal(compareHelpToPlan({...args,version:"0.0.0"}).compatible,false);
 assert.equal(compareHelpToPlan({...args,dbPushHelp:helpFor(commands[1].argv.filter(v=>v!=="--dry-run"))}).compatible,false);
 assert.equal(compareHelpToPlan({...args,migrationListHelp:"no help"}).compatible,false);
});
