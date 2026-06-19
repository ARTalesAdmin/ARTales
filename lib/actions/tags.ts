"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireEditorOrAdmin } from "@/lib/guards"
import {
  mapTagFormValuesToInsertPayload,
  mapTagFormValuesToUpdatePayload,
  parseTagFormData,
  validateTagFormValues,
} from "@/lib/forms/tagForm"

export async function createTag(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseTagFormData(formData)
  const validationError = validateTagFormValues(values)

  if (validationError) {
    redirect(`/member/tags/new?error=${validationError}`)
  }

  const payload = mapTagFormValuesToInsertPayload(values, profile.id)

  const { error } = await supabase.from("tags").insert(payload).select("slug").single()

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(`/member/tags/new?error=slug_taken`)
    }
    redirect(`/member/tags/new?error=save_failed`)
  }

  redirect(`/member/tags/${payload.slug}/edit?success=tag_created`)
}

export async function updateTag(
  originalSlug: string,
  formData: FormData
): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseTagFormData(formData)
  const validationError = validateTagFormValues(values)

  if (validationError) {
    redirect(`/member/tags/${originalSlug}/edit?error=${validationError}`)
  }

  const payload = mapTagFormValuesToUpdatePayload(values, profile.id)

  const { error } = await supabase
    .from("tags")
    .update(payload)
    .eq("slug", originalSlug)

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(`/member/tags/${originalSlug}/edit?error=slug_taken`)
    }
    redirect(`/member/tags/${originalSlug}/edit?error=save_failed`)
  }

  redirect(`/member/tags/${payload.slug}/edit?success=tag_updated`)
}
