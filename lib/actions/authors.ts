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

function withReturnTo(basePath: string, returnTo?: string) {
  if (!returnTo || !returnTo.startsWith("/")) {
    return basePath
  }

  const separator = basePath.includes("?") ? "&" : "?"
  return `${basePath}${separator}returnTo=${encodeURIComponent(returnTo)}`
}

function appendCreatedAuthorId(returnTo: string, authorId: string) {
  if (!returnTo.startsWith("/")) {
    return `/autor?createdAuthorId=${encodeURIComponent(authorId)}`
  }

  const separator = returnTo.includes("?") ? "&" : "?"
  return `${returnTo}${separator}createdAuthorId=${encodeURIComponent(authorId)}`
}

export async function createAuthor(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const returnTo = String(formData.get("returnTo") ?? "").trim()

  const values = parseAuthorFormData(formData)
  const validationError = validateAuthorFormValues(values,true)

  if (validationError) {
    redirect(withReturnTo(`/member/authors/new?error=${validationError}`, returnTo))
  }

  const payload = mapAuthorFormValuesToInsertPayload(values, profile.id)

  const { data, error } = await supabase
    .from("authors")
    .insert(payload)
    .select("id, slug")
    .single()

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(withReturnTo("/member/authors/new?error=slug_taken", returnTo))
    }

    redirect(withReturnTo("/member/authors/new?error=save_failed", returnTo))
  }

  if (returnTo && returnTo.startsWith("/")) {
    redirect(appendCreatedAuthorId(returnTo, String(data.id)))
  }

  redirect(`/member/authors/${payload.slug}/edit?success=author_created`)
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
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(`/member/authors/${originalSlug}/edit?error=slug_taken`)
    }

    redirect(`/member/authors/${originalSlug}/edit?error=save_failed`)
  }

  // A save of a valid bilingual biography or portrait is the editorial action.
  // The owner-bound completion RPC independently checks durable evidence.
  // Non-eligible edits remain allowed without closing anybody else's task.
  const kinds: string[] = []
  const bioReady = [values.bio_cs, values.bio_en].every(
    value => value.trim().length >= 200 && value.trim().length <= 800
  )
  if (bioReady) kinds.push("author_bio")
  if (values.portrait_image_path && values.portrait_image_alt.trim().length >= 8)
    kinds.push("author_visual")
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