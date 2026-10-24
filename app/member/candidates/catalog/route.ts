import { NextResponse } from "next/server";
import { requireEditorOrAdmin } from "@/lib/guards";
import { CANDIDATES_AB_ENABLED } from "@/lib/candidates/featureFlag";

export const runtime="nodejs";
export async function GET(request:Request){
  await requireEditorOrAdmin();
  if(!CANDIDATES_AB_ENABLED)return NextResponse.json({error:"not_available"},{status:404});
  const q=new URL(request.url).searchParams.get("q")?.trim()??"";
  if(q.length<3||q.length>120)return NextResponse.json({items:[]},{headers:{"Cache-Control":"private, no-store"}});
  const url=new URL("https://openlibrary.org/search.json");
  url.searchParams.set("title",q);
  url.searchParams.set("fields","key,title,author_name,first_publish_year");
  url.searchParams.set("limit","8");
  try{
    const response=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"ARTales-bibliographic-prescreen/1.0 (https://artales.net)"},signal:AbortSignal.timeout(6500),next:{revalidate:3600}});
    if(!response.ok)return NextResponse.json({error:"catalog_unavailable"},{status:503});
    const payload=await response.json() as {docs?:{key?:string;title?:string;author_name?:string[];first_publish_year?:number}[]};
    const seen=new Set<string>();
    const items=(payload.docs??[]).flatMap(d=>{
      const key=d.key?.startsWith("/works/")?d.key:"";
      const title=d.title?.trim()??"",author=d.author_name?.[0]?.trim()??"";
      if(!/^\/works\/OL\d+W$/.test(key)||!title||!author||seen.has(key))return [];
      seen.add(key);
      return [{key,title,author,firstPublished:Number.isInteger(d.first_publish_year)?d.first_publish_year!:null,sourceUrl:"https://openlibrary.org"+key}];
    }).slice(0,8);
    return NextResponse.json({items},{headers:{"Cache-Control":"private, no-store"}});
  }catch{
    return NextResponse.json({error:"catalog_unavailable"},{status:503});
  }
}
