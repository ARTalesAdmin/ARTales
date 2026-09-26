"use server"

import { redirect } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_STATUS = new Set(["new","checking","ready","accepted","deferred","review_required","rejected"])
const ALLOWED_RIGHTS = new Set(["unknown","clear","partial","alternate_edition_required","review_required","deferred","blocked"])
const ALLOWED_DISCOVERY = new Set(["unknown","pending","complete","needs_review"])
const ALLOWED_ORIGIN = new Set(["manual","internal_list","reader_request","nexus","other"])

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

function nullable(value: string) {
  return value === "" ? null : value
}

export async function createWorkCandidate(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const proposedTitle = value(formData, "proposed_title")
  const proposedAuthorName = value(formData, "proposed_author_name")
  const origin = value(formData, "origin") || "manual"
  const originReference = value(formData, "origin_reference")
  const priorityRaw = Number(value(formData, "priority") || "50")
  const priority = Number.isInteger(priorityRaw) ? Math.min(100, Math.max(0, priorityRaw)) : 50

  if (!proposedTitle || !proposedAuthorName) {
    redirect("/member/candidates/new?error=required")
  }

  if (!ALLOWED_ORIGIN.has(origin)) {
    redirect("/member/candidates/new?error=origin_invalid")
  }

  const { data, error } = await supabase
    .from("work_candidates")
    .insert({
      proposed_title: proposedTitle,
      proposed_author_name: proposedAuthorName,
      origin,
      origin_reference: nullable(originReference),
      priority,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single()

  if (error) {
    redirect("/member/candidates/new?error=save_failed")
  }

  redirect(`/member/candidates/${data.id}?success=created`)
}

export async function updateWorkCandidate(id: string, formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const proposedTitle = value(formData, "proposed_title")
  const proposedAuthorName = value(formData, "proposed_author_name")
  const status = value(formData, "status")
  const discoveryStatus = value(formData, "discovery_status")
  const rightsStatus = value(formData, "rights_status")
  const rightsReason = value(formData, "rights_reason")
  const jurisdiction = value(formData, "jurisdiction") || "EU_CZ"
  const notBefore = value(formData, "not_before")
  const selectedSourceType = value(formData, "selected_source_type")
  const selectedSourceReference = value(formData, "selected_source_reference")
  const selectedSourceUrl = value(formData, "selected_source_url")
  const origin = value(formData, "origin")
  const originReference = value(formData, "origin_reference")
  const priorityRaw = Number(value(formData, "priority") || "50")
  const priority = Number.isInteger(priorityRaw) ? Math.min(100, Math.max(0, priorityRaw)) : 50

  if (!proposedTitle || !proposedAuthorName) {
    redirect(`/member/candidates/${id}?error=required`)
  }
  if (!ALLOWED_STATUS.has(status) || !ALLOWED_RIGHTS.has(rightsStatus) || !ALLOWED_DISCOVERY.has(discoveryStatus) || !ALLOWED_ORIGIN.has(origin)) {
    redirect(`/member/candidates/${id}?error=status_invalid`)
  }

  const reviewRequired =
    rightsStatus === "review_required" ||
    discoveryStatus === "needs_review" ||
    status === "review_required"

  const { error } = await supabase
    .from("work_candidates")
    .update({
      proposed_title: proposedTitle,
      proposed_author_name: proposedAuthorName,
      origin,
      origin_reference: nullable(originReference),
      status,
      priority,
      discovery_status: discoveryStatus,
      rights_status: rightsStatus,
      rights_reason: nullable(rightsReason),
      jurisdiction,
      not_before: nullable(notBefore),
      review_required: reviewRequired,
      selected_source_type: nullable(selectedSourceType),
      selected_source_reference: nullable(selectedSourceReference),
      selected_source_url: nullable(selectedSourceUrl),
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    redirect(`/member/candidates/${id}?error=save_failed`)
  }

  redirect(`/member/candidates/${id}?success=updated`)
}
