"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireEditorOrAdmin } from "@/lib/guards"
import {
  parseWorkFormData,
  validateWorkFormValues,
  mapWorkFormValuesToInsertPayload,
  mapWorkFormValuesToUpdatePayload,
} from "@/lib/forms/workForm"

function encodeDbError(message: string) {
  return encodeURIComponent(message.slice(0, 300))
}

function applyPublicationFields<T extends Record<string, unknown>>(
  payload: T,
  status: string,
  profileId: string
) {
  if (status === "published") {
    return {
      ...payload,
      published_at: new Date().toISOString(),
      published_by: profileId,
    }
  }

  return {
    ...payload,
    published_at: null,
    published_by: null,
  }
}

export async function createWork(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseWorkFormData(formData)
  const validationError = validateWorkFormValues(values)

  if (validationError) {
    redirect(`/member/works/new?error=${validationError}`)
  }

  const basePayload = mapWorkFormValuesToInsertPayload(values, profile.id)
  const payload = applyPublicationFields(basePayload, values.status, profile.id)

  const { error } = await supabase
    .from("works")
    .insert(payload)
    .select("slug")
    .single()

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect("/member/works/new?error=slug_taken")
    }

    redirect(
      `/member/works/new?error=save_failed&db_error=${encodeDbError(error.message)}`
    )
  }

  redirect(`/member/works/${payload.slug}/edit?success=work_created`)
}

export async function updateWork(
  originalSlug: string,
  formData: FormData
): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseWorkFormData(formData)
  const validationError = validateWorkFormValues(values)

  if (validationError) {
    redirect(`/member/works/${originalSlug}/edit?error=${validationError}`)
  }

  const basePayload = mapWorkFormValuesToUpdatePayload(values, profile.id)
  const payload = applyPublicationFields(basePayload, values.status, profile.id)

  const { error } = await supabase
    .from("works")
    .update(payload)
    .eq("slug", originalSlug)

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(`/member/works/${originalSlug}/edit?error=slug_taken`)
    }

    redirect(
      `/member/works/${originalSlug}/edit?error=save_failed&db_error=${encodeDbError(
        error.message
      )}`
    )
  }

  redirect(`/member/works/${payload.slug}/edit?success=work_updated`)
}