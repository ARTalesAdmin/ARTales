import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(path,"utf8");
const sql=read("supabase/migrations/20261108104500_artales_candidate_authority_task_routing.sql");
test("origin creator / legal reviewer remain distinct auditable authorities",()=>{
 assert.match(sql,/v_origin='manual' THEN RETURN v_creator=v_actor/);
 assert.match(sql,/candidate_legal_decisions d/);
 assert.match(sql,/d.reviewed_by=v_actor/);
 assert.match(sql,/v_role='admin' THEN RETURN true/);
 assert.match(sql,/can_assign_candidate/);
 assert.match(sql,/auth.uid\(\)/);
 assert.doesNotMatch(sql,/^UPDATE public\.work_candidates|^DELETE FROM public\./m);
 // Existing audited reassignment RPC legitimately updates a task by id.
});
test("routing is competence-based, supports visual fallback and preserves prior QA ownership",()=>{
 assert.match(sql,/artales_private\.editorial_assignee_eligible/);
 assert.match(sql,/artales_editorial_capabilities/);
 assert.match(sql,/p_previous_owner IS NOT NULL/);
 assert.match(sql,/artales_legacy_transfers/);
 assert.match(sql,/artales_editorial_default_owners/);
 assert.match(sql,/\('cover_art','Obálka díla'\)/);
 assert.match(sql,/\('work_description','Anotace díla'\)/);
 assert.match(sql,/ON CONFLICT\(candidate_id,revision_sha256,kind\) DO NOTHING/);
});
test("admin reassignment is comment optional but emits immutable event, editor scoped",()=>{
 assert.match(sql,/IF v_role='admin' AND v_note=''/);
 assert.match(sql,/editorial_assignment_authority_required/);
 assert.match(sql,/artales_editorial_events/);
 assert.match(sql,/artales_private\.editorial_assignee_eligible\(p_new_assignee,v_task.kind\)/);
 const actions=read("app/member/editorial-detail/[candidateId]/actions.ts");
 assert.match(actions,/canAssignCandidate/);
 assert.match(actions,/actor.role!=="admin"&&reason.length<20/);
});
test("a single automatic compose resumes or opens the work card, no bypass through duplicate button",()=>{
 const page=read("app/member/snapshot/[candidateId]/page.tsx");
 assert.match(page,/AutomaticSnapshotCompose candidateId=\{candidateId\}/);
 assert.doesNotMatch(page,/Převést EPUB na bloky/);
 assert.doesNotMatch(page,/\/api\/member\/semantic\/.*\/compose/);
 const auto=read("app/api/member/snapshot/[candidateId]/auto-compose/route.ts");
 assert.match(auto,/if\(existingResult.data\)return NextResponse.redirect/);
 assert.match(auto,/canProgressCandidate/);
});
test("manual candidate creator displayed and protected across legal and snapshot",()=>{
 const list=read("app/member/candidates/page.tsx");
 assert.match(list,/Vložil\(a\):/);
 const detail=read("app/member/candidates/[id]/page.tsx");
 assert.match(detail,/canProgressCandidate/);
 const legal=read("app/member/candidates/[id]/legal/automatic/route.ts");
 const decision=read("app/member/legal/[id]/decision/route.ts");
 const snapshot=read("app/api/member/snapshot/[candidateId]/route.ts");
 const composition=read("app/api/member/snapshot/[candidateId]/auto-compose/route.ts");
 for(const s of [legal,decision,snapshot,composition])assert.match(s,/canProgressCandidate/);
});
