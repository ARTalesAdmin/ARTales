/** ARTales administrative task reporting. Pure aggregation, no PII or service keys. */
export type EditorialReportTask={
 id:string;candidate_id:string;kind:string;status:string;
 assigned_to:string|null;created_at:string;completed_at:string|null;
 completed_by:string|null;
};
export type MemberSummary={
 id:string;name:string;assigned:number;active:number;completed:number;completedThisMonth:number;
};
export type TitleSummary={
 id:string;title:string;assigned:number;active:number;completed:number;unassigned:number;
};
export type MonthlySummary={month:string;assigned:number;completed:number};
const activeStatuses=new Set(["open","claimed","returned"]);
export function monthKey(date:string|null):string{
 if(!date)return "";
 const timestamp=Date.parse(date);
 return Number.isFinite(timestamp)?new Date(timestamp).toISOString().slice(0,7):"";
}
export function buildEditorialTaskReport(
 tasks:EditorialReportTask[],
 members:{id:string;name:string}[],
 titles:{id:string;title:string}[],
 currentMonth:string,
){
 const users=new Map(members.map(m=>[m.id,m.name]));
 const works=new Map(titles.map(t=>[t.id,t.title]));
 const byMember=new Map<string,MemberSummary>(members.map(m=>[m.id,{
  id:m.id,name:m.name,assigned:0,active:0,completed:0,completedThisMonth:0
 }]));
 const byTitle=new Map<string,TitleSummary>();
 const monthly=new Map<string,MonthlySummary>();
 function monthRow(month:string){
  let row=monthly.get(month);
  if(!row){row={month,assigned:0,completed:0};monthly.set(month,row);}
  return row;
 }
 for(const t of tasks){
  if(!byTitle.has(t.candidate_id))byTitle.set(t.candidate_id,{
   id:t.candidate_id,title:works.get(t.candidate_id)??"Dílo bez názvu",
   assigned:0,active:0,completed:0,unassigned:0
  });
  const title=byTitle.get(t.candidate_id)!;
  const active=activeStatuses.has(t.status);
  const finished=t.status==="completed";
  if(!t.assigned_to)title.unassigned++;
  else{
   title.assigned++;
   if(!byMember.has(t.assigned_to))byMember.set(t.assigned_to,{
    id:t.assigned_to,name:users.get(t.assigned_to)??"Neaktivní editor",
    assigned:0,active:0,completed:0,completedThisMonth:0
   });
   const owner=byMember.get(t.assigned_to)!;
   owner.assigned++;
   if(active)owner.active++;
  }
  if(active)title.active++;
  if(finished){
   title.completed++;
   const doer=t.completed_by??t.assigned_to;
   if(doer){
    if(!byMember.has(doer))byMember.set(doer,{
     id:doer,name:users.get(doer)??"Neaktivní editor",
     assigned:0,active:0,completed:0,completedThisMonth:0
    });
    const actor=byMember.get(doer)!;
    actor.completed++;
    if(monthKey(t.completed_at)===currentMonth)actor.completedThisMonth++;
   }
   if(t.completed_at)monthRow(monthKey(t.completed_at)).completed++;
  }
  // Created-month is a cohort of tasks currently owned by the member, NOT an
  // audit of when initial allocation or reassignment actually occurred.
  if(t.assigned_to)monthRow(monthKey(t.created_at)).assigned++;
 }
 const allMonths=[...monthly.values()].filter(m=>m.month).sort((a,b)=>a.month.localeCompare(b.month));
 const membersOut=[...byMember.values()].sort((a,b)=>a.name.localeCompare(b.name,"cs"));
 const titlesOut=[...byTitle.values()].sort((a,b)=>a.title.localeCompare(b.title,"cs"));
 return{
  total:tasks.length,
  completed:tasks.filter(t=>t.status==="completed").length,
  active:tasks.filter(t=>activeStatuses.has(t.status)).length,
  assigned:tasks.filter(t=>t.assigned_to!==null).length,
  members:membersOut,titles:titlesOut,months:allMonths,
  currentMonth,
 };
}
