"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireEditorOrAdmin } from "@/lib/guards"
import {
  mapAuthorFormValuesToInsertPayload,
  mapAuthorFormValuesToUpdatePayload,
  parseAuthorFormData,
  validateAuthorFormValues,
} from "@/lib/forms/authorForm"

export async function createAuthor(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseAuthorFormData(formData)
  const validationError = validateAuthorFormValues(values)

  if (validationError) {
    redirect(`/member/authors/new?error=${validationError}`)
  }

  const payload = mapAuthorFormValuesToInsertPayload(values, profile.id)

  const { error } = await supabase
    .from("authors")
    .insert(payload)
    .select("slug")
    .single()

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect("/member/authors/new?error=slug_taken")
    }

    redirect("/member/authors/new?error=save_failed")
  }

  redirect(`/autor/${payload.slug}?success=author_created`)
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

  const { error } = await supabase
    .from("authors")
    .update(payload)
    .eq("slug", originalSlug)

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(`/member/authors/${originalSlug}/edit?error=slug_taken`)
    }

    redirect(`/member/authors/${originalSlug}/edit?error=save_failed`)
  }

  redirect(`/member/authors/${payload.slug}/edit?success=author_updated`)
}