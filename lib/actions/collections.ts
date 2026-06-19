"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireEditorOrAdmin } from "@/lib/guards"
import {
  mapCollectionFormValuesToInsertPayload,
  mapCollectionFormValuesToUpdatePayload,
  parseCollectionFormData,
  validateCollectionFormValues,
} from "@/lib/forms/collectionForm"

export async function createCollection(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseCollectionFormData(formData)
  const validationError = validateCollectionFormValues(values)

  if (validationError) {
    redirect(`/member/collections/new?error=${validationError}`)
  }

  const payload = mapCollectionFormValuesToInsertPayload(values, profile.id)

  const { error } = await supabase
    .from("collections")
    .insert(payload)
    .select("slug")
    .single()

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect("/member/collections/new?error=slug_taken")
    }

    redirect("/member/collections/new?error=save_failed")
  }

  redirect(`/member/collections/${payload.slug}/edit?success=collection_created`)
}

export async function updateCollection(
  originalSlug: string,
  formData: FormData
): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseCollectionFormData(formData)
  const validationError = validateCollectionFormValues(values)

  if (validationError) {
    redirect(`/member/collections/${originalSlug}/edit?error=${validationError}`)
  }

  const payload = mapCollectionFormValuesToUpdatePayload(values, profile.id)

  const { error } = await supabase
    .from("collections")
    .update(payload)
    .eq("slug", originalSlug)

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(`/member/collections/${originalSlug}/edit?error=slug_taken`)
    }

    redirect(`/member/collections/${originalSlug}/edit?error=save_failed`)
  }

  redirect(
    `/member/collections/${payload.slug}/edit?success=collection_updated`
  )
}

export async function updateCollectionWorkAssignments(
  collectionId: string,
  collectionSlug: string,
  formData: FormData
): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const assignedWorkIds = formData
    .getAll("assigned_work_ids")
    .map((value) => String(value).trim())
    .filter(Boolean)

  const uniqueWorkIds = Array.from(new Set(assignedWorkIds))

  const { data: existing, error: existingError } = await supabase
    .from("work_collections")
    .select("work_id")
    .eq("collection_id", collectionId)

  if (existingError) {
    redirect(`/member/collections/${collectionSlug}/edit?works_error=load_failed`)
  }

  const existingIds = new Set(
    ((existing ?? []) as { work_id: string }[]).map((row) => String(row.work_id))
  )

  const toDelete = Array.from(existingIds).filter(
    (workId) => !uniqueWorkIds.includes(workId)
  )

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("work_collections")
      .delete()
      .eq("collection_id", collectionId)
      .in("work_id", toDelete)

    if (deleteError) {
      redirect(`/member/collections/${collectionSlug}/edit?works_error=save_failed`)
    }
  }

  if (uniqueWorkIds.length > 0) {
    const positionPayload = uniqueWorkIds.map((workId, index) => {
      const rawSort = String(formData.get(`sort_order_${workId}`) ?? "").trim()
      const parsed = Number(rawSort)
      return {
        work_id: workId,
        collection_id: collectionId,
        sort_order: Number.isFinite(parsed) ? parsed : (index + 1) * 10,
        is_primary: formData.get(`is_primary_${workId}`) === "on",
        created_by: profile.id,
        updated_by: profile.id,
      }
    })

    const { error: upsertError } = await supabase
      .from("work_collections")
      .upsert(positionPayload, { onConflict: "work_id,collection_id" })

    if (upsertError) {
      redirect(`/member/collections/${collectionSlug}/edit?works_error=save_failed`)
    }
  }

  redirect(`/member/collections/${collectionSlug}/edit?success=collection_works_updated`)
}
