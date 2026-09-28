import { createClient } from "@/lib/supabase/server"
import { fixtureWorkCandidates, getFixtureCandidate, isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates"

export type WorkCandidateStatus =
  | "new" | "checking" | "ready" | "accepted" | "deferred" | "review_required" | "rejected"

export type WorkCandidateRightsStatus =
  | "unknown" | "clear" | "partial" | "alternate_edition_required" | "review_required" | "deferred" | "blocked"

export type WorkCandidateDiscoveryStatus = "unknown" | "pending" | "complete" | "needs_review"
export type WorkCandidateOrigin = "manual" | "internal_list" | "reader_request" | "nexus" | "other"
export type WorkCandidateIdentityStatus = "unknown" | "matched" | "needs_review"

export type WorkCandidate = {
  id: string
  proposed_title: string
  proposed_author_name: string
  origin: WorkCandidateOrigin
  origin_reference: string | null
  status: WorkCandidateStatus
  priority: number
  matched_author_id: string | null
  matched_work_id: string | null
  discovery_status: WorkCandidateDiscoveryStatus
  rights_status: WorkCandidateRightsStatus
  rights_reason: string | null
  jurisdiction: string
  not_before: string | null
  review_required: boolean
  selected_source_type: string | null
  selected_source_reference: string | null
  selected_source_url: string | null
  normalized_title?: string | null
  normalized_author_name?: string | null
  normalized_author_birth_year?: number | null
  normalized_author_death_year?: number | null
  first_publication_year?: number | null
  identity_status?: WorkCandidateIdentityStatus
  identity_reason?: string | null
  preferred_source_id?: string | null
  promoted_at?: string | null
  promoted_by?: string | null
  created_at: string
  updated_at: string
}

export async function getWorkCandidates(): Promise<WorkCandidate[]> {
  if (isCandidatesFixturePreview()) return fixtureWorkCandidates
  const supabase = await createClient()
  const { data, error } = await supabase.from("work_candidates").select("*")
    .order("priority", { ascending: false }).order("created_at", { ascending: true })
  if (error) throw new Error(`Failed to load work candidates: ${error.message}`)
  return (data ?? []) as WorkCandidate[]
}

export async function getWorkCandidateById(id: string): Promise<WorkCandidate | null> {
  if (isCandidatesFixturePreview()) return getFixtureCandidate(id)
  const supabase = await createClient()
  const { data, error } = await supabase.from("work_candidates").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`Failed to load work candidate: ${error.message}`)
  return (data as WorkCandidate | null) ?? null
}
