import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {createClient} from "@/lib/supabase/server";
import {getGutenbergBook} from "@/lib/legal/gutenbergCatalog";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;bookId:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)return NextResponse.json({error:"unavailable"},{status:404});
 await requireEditorOrAdmin();
 const {id,bookId}=await params;
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)||!/^[1-9]\d{0,7}$/.test(bookId))return NextResponse.json({error:"invalid"},{status:400});
 const db=await createClient();
 const {data:c}=await db.from("work_candidates").select("id").eq("id",id).maybeSingle();
 if(!c)return NextResponse.json({error:"candidate_missing"},{status:404});
 const book=await getGutenbergBook(Number(bookId));
 return NextResponse.json({book,error:book?"":"source_unavailable",verifiedFileLinks:book?.files.length??0},{status:book?200:503,headers:{"Cache-Control":"private, no-store"}});
}
