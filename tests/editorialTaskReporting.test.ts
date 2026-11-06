import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {buildEditorialTaskReport} from "../lib/editorial/taskReport";
const file=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=file("ops/sql/20261106_artales_editorial_completion_bilingual_guard.sql");
const page=file("app/member/editorial-detail/[candidateId]/page.tsx");
const actions=file("app/member/editorial-detail/[candidateId]/actions.ts");
const report=file("app/member/admin/editorial-performance/page.tsx");
const nav=file("components/member/MemberZoneNav.tsx");
test("bilingual metadata completion is gated by both languages; every existing evidence kind preserved",()=>{
 assert.match(sql,/WHEN 'work_description' THEN[\s\S]*work_description_cs[\s\S]*work_description_en/);
 for(const kind of ["collection_curation","cover_art","author_bio","author_visual"])
  assert.match(sql,new RegExp("WHEN '"+kind+"' THEN"));
 assert.doesNotMatch(sql,/WHEN 'work_description' THEN length\(btrim\(coalesce\(m\.work_description,/);
});
test("saved metadata never silently reports task completion when evidence fails",()=>{
 assert.match(actions,/closeout=pending/);
 assert.match(page,/err\.closeout==="pending"/);
 assert.match(page,/taskStatus\("work_description"\)/);
 assert.match(page,/taskStatus\("author_bio"\)/);
 assert.match(page,/taskStatus\("collection_curation"\)/);
 assert.match(page,/taskStatus\("cover_art"\)/);
});
test("admin-only report supports complete paginated reads and role-gated navigation",()=>{
 assert.match(report,/await requireAdmin\(\)/);
 assert.match(report,/\.range\(offset,offset\+PAGE_SIZE-1\)/);
 assert.match(nav,/role === "admin"/);
 assert.match(nav,/\/member\/admin\/editorial-performance/);
});
test("task totals and monthly cohorts never count merely saved metadata as completed",()=>{
 const now="2026-11";const rows=[
  {id:"a",candidate_id:"pan",kind:"author_bio",assigned_to:"p",
   status:"claimed",created_at:"2026-11-02T12:00:00Z",completed_at:null,completed_by:null},
  {id:"b",candidate_id:"pan",kind:"work_description",assigned_to:"p",
   status:"completed",created_at:"2026-11-03T12:00:00Z",completed_at:"2026-11-05T12:00:00Z",completed_by:"p"},
  {id:"c",candidate_id:"pan",kind:"cover_art",assigned_to:"i",
   status:"open",created_at:"2026-11-04T12:00:00Z",completed_at:null,completed_by:null},
  {id:"d",candidate_id:"pan",kind:"text_review",assigned_to:"l",
   status:"superseded",created_at:"2026-10-02T12:00:00Z",completed_at:null,completed_by:null},
 ];
 const x=buildEditorialTaskReport(rows,[{id:"p",name:"Pavla"},{id:"i",name:"Ivana"}],
  [{id:"pan",title:"The Great God Pan"}],now);
 assert.equal(x.total,4);assert.equal(x.completed,1);assert.equal(x.active,2);
 assert.equal(x.members.find(m=>m.id==="p")!.completed,1);
 assert.equal(x.members.find(m=>m.id==="p")!.active,1);
 assert.equal(x.members.find(m=>m.id==="p")!.assignedThisMonth,2);
 assert.equal(x.months.find(m=>m.month==="2026-11")!.assigned,3);
 assert.equal(x.months.find(m=>m.month==="2026-11")!.completed,1);
});
test("monthly assigned/completed member columns and bounded month selection",()=>{
 assert.match(report,/assignedThisMonth/);
 assert.match(report,/searchParams:Promise<\{month\?:string\}>/);
 assert.match(report,/<select id="report-month" name="month"/);
});
test("single save of author biography/portrait closes only owner's claimed and validated candidate tasks",()=>{
 const authorAction=file("lib/actions/authors.ts");
 const authorEdit=file("app/member/authors/[slug]/edit/page.tsx");
 assert.match(authorAction,/\.eq\("author_id", savedAuthor\.id\)/);
 assert.match(authorAction,/\.eq\("assigned_to", profile\.id\)/);
 assert.match(authorAction,/\.eq\("status", "claimed"\)/);
 assert.match(authorAction,/\.in\("kind", kinds\)/);
 assert.match(authorAction,/artales_complete_editorial_task/);
 assert.match(authorAction,/bioReady/);
 assert.match(authorAction,/closeoutFailed/);
 assert.match(authorEdit,/editorial_closeout === "pending"/);
 assert.match(actions,/field==="author"\?\["author_bio","author_visual"\]/);
});
