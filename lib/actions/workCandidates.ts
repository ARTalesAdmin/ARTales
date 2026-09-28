"use server"

import { redirect } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { createClient } from "@/lib/supabase/server"
import { isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates"
import { canCandidateAdvance, requiresRightsReason } from "@/lib/candidateTriage"
import type {
  WorkCandidateDiscoveryStatus,
  WorkCandidateOrigin,
  WorkCandidateRightsStatus,
  WorkCandidateStatus,
} from "@/lib/dbCandidates"

const ALLOWED_STATUS = new Set<WorkCandidateStatus>(["new","checking","ready","accepted","deferred","review_required","rejected"])
const ALLOWED_RIGHTS = new Set<WorkCandidateRightsStatus>(["unknown","clear","partial","alternate_edition_required","review_required","deferred","blocked"])
const ALLOWED_DISCOVERY = new Set<WorkCandidateDiscoveryStatus>(["unknown","pending","complete","needs_review"])
const ALLOWED_ORIGIN = new Set<WorkCandidateOrigin>(["manual","internal_list","reader_request","nexus","other"])

const COMPONENT_TYPES = [
  "WORK_CONTENT",
  "EDITION_CONTENT",
  "TRANSLATION",
  "SOURCE_WRAPPER",
  "EDITORIAL_ADDITION",
  "ASSET",
  "UNKNOWN",
] as const

const ALLOWED_COMPONENT_DECISIONS = new Set([
  "usable",
  "exclude",
  "review_required",
  "alternate_edition_required",
  "blocked",
  "not_applicable",
])

const ALLOWED_PUBLICATION_EFFECTS = new Set([
  "allow",
  "exclude_component",
  "block_source",
  "review",
])

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

function nullable(input: string) {
  return input === "" ? null : input
}

function parseOptionalYear(input: string) {
  if (!input) return null
  const parsed = Number(input)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 3000 ? parsed : null
}

export async function createWorkCandidate(formData: FormData): Promise<void> {
  if (isCandidatesFixturePreview()) {
    redirect("/member/candidates?fixture=write-disabled")
  }

  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const proposedTitle = value(formData, "proposed_title")
  const proposedAuthorName = value(formData, "proposed_author_name")
  const origin = (value(formData, "origin") || "manual") as WorkCandidateOrigin
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
      normalized_title: proposedTitle,
      normalized_author_name: proposedAuthorName,
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
  if (isCandidatesFixturePreview()) {
    redirect(`/member/candidates/${id}?fixture=write-disabled`)
  }

  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const proposedTitle = value(formData, "proposed_title")
  const proposedAuthorName = value(formData, "proposed_author_name")
  const status = value(formData, "status") as WorkCandidateStatus
  const discoveryStatus = value(formData, "discovery_status") as WorkCandidateDiscoveryStatus
  const rightsStatus = value(formData, "rights_status") as WorkCandidateRightsStatus
  const rightsReason = value(formData, "rights_reason")
  const jurisdiction = value(formData, "jurisdiction") || "EU_CZ"
  const notBefore = value(formData, "not_before")
  const selectedSourceType = value(formData, "selected_source_type")
  const selectedSourceReference = value(formData, "selected_source_reference")
  const selectedSourceUrl = value(formData, "selected_source_url")
  const origin = value(formData, "origin") as WorkCandidateOrigin
  const originReference = value(formData, "origin_reference")
  const priorityRaw = Number(value(formData, "priority") || "50")
  const priority = Number.isInteger(priorityRaw) ? Math.min(100, Math.max(0, priorityRaw)) : 50

  const normalizedTitle = value(formData, "normalized_title") || proposedTitle
  const normalizedAuthorName = value(formData, "normalized_author_name") || proposedAuthorName
  const normalizedAuthorBirthYear = parseOptionalYear(value(formData, "normalized_author_birth_year"))
  const normalizedAuthorDeathYear = parseOptionalYear(value(formData, "normalized_author_death_year"))
  const firstPublicationYear = parseOptionalYear(value(formData, "first_publication_year"))
  const identityReason = value(formData, "identity_reason")

  if (!proposedTitle || !proposedAuthorName) {
    redirect(`/member/candidates/${id}?error=required`)
  }

  if (
    !ALLOWED_STATUS.has(status) ||
    !ALLOWED_RIGHTS.has(rightsStatus) ||
    !ALLOWED_DISCOVERY.has(discoveryStatus) ||
    !ALLOWED_ORIGIN.has(origin)
  ) {
    redirect(`/member/candidates/${id}?error=status_invalid`)
  }

  if (requiresRightsReason(rightsStatus) && !rightsReason) {
    redirect(`/member/candidates/${id}?error=rights_reason_required`)
  }

  if (!canCandidateAdvance(status, discoveryStatus, rightsStatus, nullable(notBefore))) {
    redirect(`/member/candidates/${id}?error=triage_blocked`)
  }

  if (
    normalizedAuthorBirthYear !== null &&
    normalizedAuthorDeathYear !== null &&
    normalizedAuthorDeathYear < normalizedAuthorBirthYear
  ) {
    redirect(`/member/candidates/${id}?error=identity_invalid`)
  }

  const { data: existingCandidate, error: existingError } = await supabase
    .from("work_candidates")
    .select("id,preferred_source_id")
    .eq("id", id)
    .single()

  if (existingError || !existingCandidate) {
    redirect(`/member/candidates/${id}?error=save_failed`)
  }

  let preferredSourceId = existingCandidate.preferred_source_id as string | null
  const hasSource = Boolean(selectedSourceType || selectedSourceReference || selectedSourceUrl)

  if (hasSource) {
    const sourcePayload = {
      candidate_id: id,
      provider: "Selected source",
      source_type: selectedSourceType || "unknown",
      source_reference: selectedSourceReference || selectedSourceUrl || "selected source",
      source_url: nullable(selectedSourceUrl),
      identity_match: discoveryStatus === "complete" ? "strong" : "uncertain",
      status: "candidate",
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }

    if (preferredSourceId) {
      const { error: sourceUpdateError } = await supabase
        .from("work_candidate_sources")
        .update(sourcePayload)
        .eq("id", preferredSourceId)
        .eq("candidate_id", id)

      if (sourceUpdateError) {
        redirect(`/member/candidates/${id}?error=save_failed`)
      }
    } else {
      const { data: source, error: sourceInsertError } = await supabase
        .from("work_candidate_sources")
        .insert({
          ...sourcePayload,
          created_by: profile.id,
        })
        .select("id")
        .single()

      if (sourceInsertError || !source) {
        redirect(`/member/candidates/${id}?error=save_failed`)
      }

      preferredSourceId = source.id
    }

    const { data: existingRights, error: rightsReadError } = await supabase
      .from("work_candidate_component_rights")
      .select("component_type,created_by")
      .eq("candidate_id", id)
      .eq("source_id", preferredSourceId)

    if (rightsReadError) {
      redirect(`/member/candidates/${id}?error=save_failed`)
    }

    const createdByByComponent = new Map(
      (existingRights ?? []).map((row: { component_type: string; created_by: string }) => [row.component_type, row.created_by])
    )

    const componentRows = COMPONENT_TYPES.flatMap((componentType) => {
      const decision = value(formData, `component_decision__${componentType}`)
      const publicationEffect = value(formData, `component_effect__${componentType}`)
      const reason = value(formData, `component_reason__${componentType}`)

      if (!decision && !publicationEffect && !reason) return []
      if (
        !ALLOWED_COMPONENT_DECISIONS.has(decision) ||
        !ALLOWED_PUBLICATION_EFFECTS.has(publicationEffect) ||
        !reason
      ) {
        redirect(`/member/candidates/${id}?error=component_rights_invalid`)
      }

      return [{
        candidate_id: id,
        source_id: preferredSourceId,
        component_type: componentType,
        decision,
        publication_effect: publicationEffect,
        reason,
        jurisdiction,
        not_before: nullable(notBefore),
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        created_by: createdByByComponent.get(componentType) ?? profile.id,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      }]
    })

    if (componentRows.length === 0) {
      componentRows.push(
        {
          candidate_id: id,
          source_id: preferredSourceId,
          component_type: "WORK_CONTENT",
          decision: rightsStatus === "clear" ? "usable" : "review_required",
          publication_effect: rightsStatus === "clear" ? "allow" : "review",
          reason: rightsReason || "Derived from candidate-level rights status.",
          jurisdiction,
          not_before: nullable(notBefore),
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          created_by: createdByByComponent.get("WORK_CONTENT") ?? profile.id,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        {
          candidate_id: id,
          source_id: preferredSourceId,
          component_type: "EDITION_CONTENT",
          decision: "review_required",
          publication_effect: "review",
          reason: "Edition-specific rights require explicit review before ingest.",
          jurisdiction,
          not_before: nullable(notBefore),
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          created_by: createdByByComponent.get("EDITION_CONTENT") ?? profile.id,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
      )
    }

    const { error: rightsError } = await supabase
      .from("work_candidate_component_rights")
      .upsert(componentRows, { onConflict: "source_id,component_type" })

    if (rightsError) {
      redirect(`/member/candidates/${id}?error=save_failed`)
    }
  }

  const reviewRequired =
    rightsStatus === "review_required" ||
    discoveryStatus === "needs_review" ||
    status === "review_required"

  const identityStatus =
    discoveryStatus === "complete"
      ? "matched"
      : discoveryStatus === "needs_review"
        ? "needs_review"
        : "unknown"

  const { error: candidateError } = await supabase
    .from("work_candidates")
    .update({
      proposed_title: proposedTitle,
      proposed_author_name: proposedAuthorName,
      normalized_title: normalizedTitle,
      normalized_author_name: normalizedAuthorName,
      normalized_author_birth_year: normalizedAuthorBirthYear,
      normalized_author_death_year: normalizedAuthorDeathYear,
      first_publication_year: firstPublicationYear,
      identity_status: identityStatus,
      identity_reason: nullable(identityReason),
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
      preferred_source_id: preferredSourceId,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (candidateError) {
    redirect(`/member/candidates/${id}?error=save_failed`)
  }

  redirect(`/member/candidates/${id}?success=updated`)
}
