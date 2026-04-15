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