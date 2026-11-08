import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireEditorOrAdmin} from "@/lib/guards";

export type EditorialPerson = {
 id:string; display_name:string|null; role:string; is_active:boolean;
};

/** Only staff routes can access the editorial directory; keys never reach clients. */
export async function getEditorialPeople(ids?:string[]):Promise<EditorialPerson[]>{
 await requireEditorOrAdmin();
 const db=createAdminClient();
 const filtered=ids===undefined?undefined:[...new Set(ids.filter(Boolean))];
 if(filtered&&filtered.length===0)return [];
 const entries:EditorialPerson[]=[];
 const pages=filtered
  ?Array.from({length:Math.ceil(filtered.length/100)},(_,i)=>filtered.slice(i*100,(i+1)*100))
  :[null];
 for(const page of pages){
  const query=db.from("profiles").select("id,display_name,role,is_active");
  const result=page?await query.in("id",page):
   await query.in("role",["admin","editor"]).limit(500);
  if(result.error)throw new Error("Nelze nacist redakcni adresar.");
  entries.push(...(result.data??[]) as EditorialPerson[]);
 }
 return entries;
}

/** Internal capability lookup for assignment UI. RPC enforces rights separately. */
export async function getEditorialCompetencies():Promise<{profile_id:string;kind:string}[]>{
 await requireEditorOrAdmin();
 const {data,error}=await createAdminClient().from("artales_editorial_capabilities")
  .select("profile_id,kind").limit(500);
 if(error)throw new Error("Nelze nacist redakcni kompetence.");
 return data??[];
}
