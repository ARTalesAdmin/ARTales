"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireEditorOrAdmin } from "@/lib/guards"
import {
  mapAuthorFormValuesToInsertPayload,
  mapAuthorFormValuesToUpdatePayload,
  parseAuthorFormData,
  validateAuthorFormValues,
} from "@/lib/forms/authorForm"
import {readyAuthorTaskKinds} from "@/lib/editorial/authorTaskEvidence"
import {candidateIdFromAuthorReturnTo,safeAuthorReturnTo,newAuthorMatchesCandidateName} from "@/lib/editorial/candidateAuthorCreation"
import {matchesExistingAuthor} from "@/lib/editorial/existingAuthorMatch"
import {ARTALES_IMAGES_BUCKET} from "@/lib/storageImages"

function withReturnTo(basePath: string, returnTo?: string) {
  const safeReturnTo=safeAuthorReturnTo(returnTo)
  if (!safeReturnTo) return basePath

  const separator = basePath.includes("?") ? "&" : "?"
  return `${basePath}${separator}returnTo=${encodeURIComponent(safeReturnTo)}`
}

function appendCreatedAuthorId(returnTo: string, authorId: string) {
  if (!safeAuthorReturnTo(returnTo)) {
    return `/autor?createdAuthorId=${encodeURIComponent(authorId)}`
  }

  const separator = returnTo.includes("?") ? "&" : "?"
  return `${returnTo}${separator}createdAuthorId=${encodeURIComponent(authorId)}`
}

export async function createAuthor(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()
  const returnTo = safeAuthorReturnTo(String(formData.get("returnTo") ?? ""))
  const candidateId = candidateIdFromAuthorReturnTo(returnTo)
  const values = parseAuthorFormData(formData)
  // General author creation keeps mandatory bilingual text. A claimed author
  // task may create an internal draft; evidence remains task-specific.
  const validationError = validateAuthorFormValues(values,!candidateId)
  if(validationError)
    redirect(withReturnTo("/member/authors/new?error="+validationError,returnTo??undefined))

  let authorId:string|null=null
  let reusedExisting=false
  if(candidateId){
    const {data:candidate,error:candidateError}=await supabase.from("work_candidates")
      .select("proposed_author_name").eq("id",candidateId).maybeSingle()
    if(candidateError||!candidate)
      redirect("/member/editorial-pipeline?error=unavailable")
    if(profile.role!=="admin"){
      const {data:claimed,error:taskError}=await supabase.from("artales_editorial_tasks")
        .select("id").eq("candidate_id",candidateId).eq("assigned_to",profile.id)
        .eq("status","claimed").in("kind",["author_bio","author_visual"])
        .limit(1).maybeSingle()
      if(taskError||!claimed)
        redirect("/member/editorial-detail/"+candidateId+"?error=not_claimed#author")
    }
    if(!newAuthorMatchesCandidateName(candidate.proposed_author_name,values.name_en))
      redirect("/member/editorial-detail/"+candidateId+"?error=author_name_mismatch#author")

    // Search the whole bounded catalog before insert, not just an exact slug;
    // otherwise "Sheridan Le Fanu" could duplicate Joseph Sheridan Le Fanu.
    const {data:authors,error:listError,count}=await supabase.from("authors")
      .select("id,name,name_en",{count:"exact"}).order("name").range(0,999)
    if(listError||!authors||count===null||count>1000)
      redirect("/member/editorial-detail/"+candidateId+
        "?error=author_identity_check_failed#author")
    const matching=authors.filter(a=>
      matchesExistingAuthor(candidate.proposed_author_name,a.name)||
      matchesExistingAuthor(candidate.proposed_author_name,a.name_en??""))
    if(matching.length>1)
      redirect("/member/editorial-detail/"+candidateId+
        "?error=author_identity_ambiguous#author")
    if(matching.length===1){
      authorId=matching[0].id
      reusedExisting=true
    }
    values.is_public_visible=false
  }

  if(!authorId){
    const payload=mapAuthorFormValuesToInsertPayload(values,profile.id)
    const {data,error}=await supabase.from("authors").insert(payload)
      .select("id,slug").single()
    if(error){
      const message=error.message.toLowerCase()
      if(message.includes("duplicate")||message.includes("unique"))
        redirect(withReturnTo("/member/authors/new?error=slug_taken",returnTo??undefined))
      redirect(withReturnTo("/member/authors/new?error=save_failed",returnTo??undefined))
    }
    authorId=String(data.id)
    if(!candidateId){
      if(returnTo)redirect(appendCreatedAuthorId(returnTo,authorId))
      redirect("/member/authors/"+payload.slug+"/edit?success=author_created")
    }
  }

  if(!candidateId)return
  // Existing actor-scoped RPC remains the authoritative candidate→author link.
  const {data:link,error:linkError}=await supabase.rpc("artales_save_candidate_editorial_field",{
    p_candidate_id:candidateId,p_field:"author",p_value:authorId,p_alt:null,p_caption:null
  })
  let linkedId:string|null=null
  let readFailed=false
  if(!linkError&&link?.result==="saved"){
    const {data:linked,error:readError}=await supabase
      .from("artales_candidate_editorial_metadata").select("author_id")
      .eq("candidate_id",candidateId).maybeSingle()
    linkedId=linked?.author_id??null
    readFailed=Boolean(readError)
  }
  if(linkError||link?.result!=="saved"||readFailed||linkedId!==authorId){
    // Partial failure is explicit: preserve created author ID for manual retry.
    // Neither silent deletion nor a second author insert is attempted.
    redirect("/member/editorial-detail/"+candidateId+
      "?error=author_link_failed&createdAuthorId="+encodeURIComponent(authorId)+"#author")
  }

  let closed=0,failed=0
  const readyKinds=reusedExisting?[]:readyAuthorTaskKinds(values)
  if(readyKinds.length){
    const {data:owned,error:tasksError}=await supabase.from("artales_editorial_tasks")
      .select("id,kind").eq("candidate_id",candidateId)
      .eq("assigned_to",profile.id).eq("status","claimed").in("kind",readyKinds)
    if(tasksError)failed++
    else for(const task of owned??[]){
      const {data:finished,error:finishError}=await supabase.rpc(
        "artales_complete_editorial_task",{
          p_task_id:task.id,p_note:
          "Nový autor byl propojen s dílem a redakční úkol dokončen po nezávislém ověření uložených podkladů."
        })
      if(finishError||finished?.result!=="completed")failed++
      else closed++
    }
  }
  revalidatePath("/member/editorial-detail/"+candidateId)
  revalidatePath("/member/editorial-pipeline")
  revalidatePath("/member","layout")
  const q=new URLSearchParams({saved:"author",createdAuthorId:authorId})
  if(closed)q.set("closed","1")
  if(failed)q.set("closeout","pending")
  if(reusedExisting)q.set("authorReused","1")
  redirect("/member/editorial-detail/"+candidateId+"?"+q.toString()+"#author")
}


/** Persist an existing author's portrait immediately after its upload.
 * Completion is limited to this editor's currently claimed author_visual tasks.
 */
export async function persistAuthorPortrait(input:{
 authorId:string;path:string;alt:string;caption:string;
}):Promise<{ok:boolean;closed:number;message:string}>{
 const actor=await requireEditorOrAdmin();
 const fail=(message:string)=>({ok:false,closed:0,message});
 if(!/^[a-f0-9-]{36}$/i.test(input.authorId)||
    input.alt.trim().length<8||input.alt.trim().length>350||
    input.caption.trim().length>500)
  return fail("Neplatný autor nebo alternativní text portrétu.");
 const db=await createClient();
 const {data:author,error:authorError}=await db.from("authors")
  .select("id,slug").eq("id",input.authorId).maybeSingle();
 if(authorError||!author)return fail("Profil autora nebyl nalezen.");
 const folder="authors/"+author.slug+"/portrait";
 if(!input.path.startsWith(folder+"/")||
    !/^portrait-[a-zA-Z0-9_.-]+[.](png|jpg|webp)$/.test(input.path.slice(folder.length+1)))
  return fail("Cesta portrétu neodpovídá profilu autora.");
 const fileName=input.path.slice(folder.length+1);
 const {data:files,error:storageError}=await db.storage.from(ARTALES_IMAGES_BUCKET)
  .list(folder,{limit:100});
 if(storageError||!(files??[]).some(file=>file.name===fileName))
  return fail("Nahraný portrét není ověřitelný v úložišti.");
 const {data:saved,error:saveError}=await db.from("authors")
  .update({portrait_image_path:input.path,portrait_image_alt:input.alt.trim(),
   portrait_image_caption:input.caption.trim()||null,updated_by:actor.id})
  .eq("id",author.id).select("id,portrait_image_path,portrait_image_alt").maybeSingle();
 if(saveError||saved?.portrait_image_path!==input.path||
    saved?.portrait_image_alt!==input.alt.trim())
  return fail("Portrét je nahraný, ale uložení profilu se nepodařilo ověřit.");
 const {data:candidates,error:linkError}=await db.from("artales_candidate_editorial_metadata")
  .select("candidate_id").eq("author_id",author.id);
 if(linkError)return fail("Portrét byl uložen, ale propojení s redakčními úkoly nešlo načíst.");
 let closed=0,failed=0;
 if(candidates?.length){
  const {data:tasks,error:tasksError}=await db.from("artales_editorial_tasks")
    .select("id,candidate_id").in("candidate_id",candidates.map(c=>c.candidate_id))
    .eq("kind","author_visual").eq("assigned_to",actor.id).eq("status","claimed");
  if(tasksError)failed++;
  else for(const task of tasks??[]){
    const {data:finished,error:finishError}=await db.rpc("artales_complete_editorial_task",{
     p_task_id:task.id,p_note:"Portrét autora automaticky uložen po uploadu; ověřeno databázovou evidencí."
    });
    if(finishError||finished?.result!=="completed")failed++;
    else{closed++;revalidatePath("/member/editorial-detail/"+task.candidate_id);}
  }
 }
 revalidatePath("/member/authors/"+author.slug+"/edit");
 revalidatePath("/member/editorial-pipeline");
 revalidatePath("/member","layout");
 return {ok:failed===0,closed,message:failed
  ?"Portrét je propojen s autorem, ale dokončení některého úkolu bylo odmítnuto. Soubor nenahrávej znovu."
  :"Portrét byl uložen a ověřen."+(closed?" Vizuální úkol je dokončen.":"")};
}

export async function updateAuthor(
  originalSlug: string,
  formData: FormData
): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseAuthorFormData(formData)
  const validationError = validateAuthorFormValues(values)

  if (validationError) {
    redirect(`/member/authors/${originalSlug}/edit?error=${validationError}`)
  }

  const payload = mapAuthorFormValuesToUpdatePayload(values, profile.id)

  const { data: savedAuthor, error } = await supabase
    .from("authors")
    .update(payload)
    .eq("slug", originalSlug)
    .select("id")
    .maybeSingle()

  if (error || !savedAuthor) {
    const message = error?.message.toLowerCase() ?? ""

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(`/member/authors/${originalSlug}/edit?error=slug_taken`)
    }

    redirect(`/member/authors/${originalSlug}/edit?error=save_failed`)
  }

  // A save of a valid bilingual biography or portrait is the editorial action.
  // The owner-bound completion RPC independently checks durable evidence.
  // Non-eligible edits remain allowed without closing anybody else's task.
  const kinds=readyAuthorTaskKinds(values)
  let closeoutFailed = false
  if (kinds.length > 0) {
    const {data: candidates, error: linkedError} = await supabase
      .from("artales_candidate_editorial_metadata")
      .select("candidate_id")
      .eq("author_id", savedAuthor.id)
    if (linkedError) closeoutFailed = true
    else if (candidates?.length) {
      const candidateIds = candidates.map(c => c.candidate_id)
      const {data: owned, error: tasksError} = await supabase
        .from("artales_editorial_tasks")
        .select("id,candidate_id,kind")
        .in("candidate_id", candidateIds)
        .eq("assigned_to", profile.id)
        .eq("status", "claimed")
        .in("kind", kinds)
      if (tasksError) closeoutFailed = true
      else for (const task of owned ?? []) {
        const {data: finished, error: finishError} = await supabase.rpc(
          "artales_complete_editorial_task", {
            p_task_id: task.id,
            p_note: "Automatické dokončení po uložení autora: ověřená metadata " +
              "a platné podklady v databázi kandidáta ARTales."
          }
        )
        if (finishError || finished?.result !== "completed") closeoutFailed = true
        else revalidatePath("/member/editorial-detail/" + task.candidate_id)
      }
    }
  }
  revalidatePath("/member/editorial-pipeline")
  revalidatePath("/member", "layout")
  redirect(`/member/authors/${payload.slug}/edit?success=author_updated` +
    (closeoutFailed ? "&editorial_closeout=pending" : ""))
}