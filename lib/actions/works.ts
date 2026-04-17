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

export async function createWork(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseWorkFormData(formData)
  const validationError = validateWorkFormValues(values)

  if (validationError) {
    redirect(`/member/works/new?error=${validationError}`)
  }

  const payload = mapWorkFormValuesToInsertPayload(values, profile.id)

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

    redirect("/member/works/new?error=save_failed")
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

  const payload = mapWorkFormValuesToUpdatePayload(values, profile.id)

  const { error } = await supabase
    .from("works")
    .update(payload)
    .eq("slug", originalSlug)

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes("duplicate") || message.includes("unique")) {
      redirect(`/member/works/${originalSlug}/edit?error=slug_taken`)
    }

    redirect(`/member/works/${originalSlug}/edit?error=save_failed`)
  }

  redirect(`/member/works/${payload.slug}/edit?success=work_updated`)
}