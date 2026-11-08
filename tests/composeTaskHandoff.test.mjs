import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
test("compose task assignment works without revealing other editor profiles",()=>{
 const sql=read("supabase/migrations/20261108093500_artales_compose_assignee_rls.sql");
 assert.match(sql,/CREATE SCHEMA IF NOT EXISTS artales_private/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/SET search_path = ''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION .* FROM PUBLIC/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION .* TO authenticated/);
 assert.match(sql,/actor\.role::text='admin'/);
 assert.match(sql,/assignee\.role::text IN \('admin','editor'\)/);
 assert.match(sql,/assignee\.is_active/);
 assert.match(sql,/assigned_to IS NULL/);
 assert.match(sql,/created_by=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/revision\.revision_sha256=artales_editorial_tasks\.revision_sha256/);
 assert.doesNotMatch(sql,/CREATE POLICY.*profiles|ALTER POLICY.*profiles/);
});
test("every compose entrypoint redirects to permanent work card, not directly QA",()=>{
 for(const path of [
  "app/api/member/snapshot/[candidateId]/auto-compose/route.ts",
  "app/api/member/semantic/[candidateId]/compose/route.ts"]){
  const route=read(path);
  assert.match(route,/\/member\/editorial-detail\/.*\?composed=1#tasks/);
  assert.doesNotMatch(route,/NextResponse\.redirect\(new URL\("\/member\/semantic\//);
 }
 const component=read("components/snapshot/AutomaticSnapshotCompose.tsx");
 assert.match(component,/destination\.pathname==="\/member\/editorial-detail\/"/);
 assert.match(component,/router\.push\(destination\.pathname\+destination\.search\+destination\.hash\)/);
});
test("redaction work card lists tasks and uses existing audited reassignment RPC",()=>{
 const page=read("app/member/editorial-detail/[candidateId]/page.tsx");
 const actions=read("app/member/editorial-detail/[candidateId]/actions.ts");
 assert.match(page,/id="tasks"/);
 assert.match(page,/activeTasks\.map\(task/);
 assert.match(page,/eligibleFor\(task\.kind\)/);
 assert.match(page,/action=\{reassignCandidateTask\}/);
 assert.match(page,/href=\{"\/member\/semantic\/"/);
 assert.match(actions,/actor\.role!=="admin"/);
 assert.match(actions,/task\.candidate_id!==candidateId/);
 assert.match(actions,/artales_reassign_editorial_task/);
 assert.match(actions,/revalidatePath\(back\)/);
});
