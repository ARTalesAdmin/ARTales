import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {searchGutenberg} from "@/lib/legal/gutenbergCatalog";

export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)return NextResponse.json({error:"not_available"},{status:404});
 await requireEditorOrAdmin();
 const {id}=await params;
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
  return NextResponse.json({error:"bad_candidate"},{status:400});
 const db=await createClient();
 const {data:c,error}=await db.from("work_candidates")
   .select("proposed_title,proposed_author_name").eq("id",id).maybeSingle();
 if(error||!c)return NextResponse.json({error:"not_found"},{status:404});
 try{
  const items=await searchGutenberg(c.proposed_title,c.proposed_author_name);
  return NextResponse.json({items,notice:"Gutenberg metadata and US copyright flags are not clearance for CZ/EU."},
   {headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return NextResponse.json({items:[],error:"catalog_unavailable"},
   {status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
