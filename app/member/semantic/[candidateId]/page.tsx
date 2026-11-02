import {notFound} from "next/navigation";
import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import SemanticReaderLab from "@/components/editor/SemanticReaderLab";
import {verifySemanticRevision} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";
export const dynamic="force-dynamic";
export default async function EditorialSemanticPreview({params}:{params:Promise<{candidateId:string}>}){
 const {candidateId}=await params;
 await requireEditorOrAdmin();
 if(!/^[a-f0-9-]{36}$/i.test(candidateId))notFound();
 const db=await createClient();
 const {data,error}=await db.from("candidate_semantic_revisions")
  .select("revision,source_text,revision_sha256,status").eq("candidate_id",candidateId)
  .order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!data||typeof data.source_text!=="string")notFound();
 const revision=data.revision as SemanticRevision;
 try{verifySemanticRevision(revision,data.source_text);}
 catch{notFound();}
 return <main><p style={{margin:"20px"}}><Link href={`/member/snapshot/${candidateId}`}>← Snapshot</Link>
  {" · "}<strong>{data.status}</strong> · {data.revision_sha256.slice(0,12)}</p>
  <SemanticReaderLab revision={revision} original={data.source_text}/></main>;
}
