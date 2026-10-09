import { createClient } from "@/lib/supabase/server"

export type PersistedCandidateSourceRow = {
  id: string
  candidate_id: string
  provider: string
  source_type: string
  source_reference: string
  source_url: string | null
  language: string | null
  publication_facts: string | null
  identity_match: "strong" | "partial" | "uncertain"
  status: "candidate" | "needs_review" | "rejected"
  note: string | null
}

export type PersistedCandidateComponentRightRow = {
  id: string
  candidate_id: string
  source_id: string
  component_type:
    | "WORK_CONTENT"
    | "EDITION_CONTENT"
    | "TRANSLATION"
    | "SOURCE_WRAPPER"
    | "EDITORIAL_ADDITION"
    | "ASSET"
    | "UNKNOWN"
  decision:
    | "usable"
    | "exclude"
    | "review_required"
    | "alternate_edition_required"
    | "blocked"
    | "not_applicable"
  reason: string
  publication_effect: "allow" | "exclude_component" | "block_source" | "review"
  not_before: string | null
}

export async function getPersistedCandidateSources(candidateId: string): Promise<PersistedCandidateSourceRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("work_candidate_sources")
    .select("id,candidate_id,provider,source_type,source_reference,source_url,language,publication_facts,identity_match,status,note")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: true })

  if (error) throw new Error(`Failed to load candidate sources: ${error.message}`)
  return (data ?? []) as PersistedCandidateSourceRow[]
}

export async function getPersistedCandidateComponentRights(candidateId: string, sourceId: string): Promise<PersistedCandidateComponentRightRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("work_candidate_component_rights")
    .select("id,candidate_id,source_id,component_type,decision,reason,publication_effect,not_before")
    .eq("candidate_id", candidateId)
    .eq("source_id", sourceId)
    .order("created_at", { ascending: true })

  if (error) throw new Error(`Failed to load candidate component rights: ${error.message}`)
  return (data ?? []) as PersistedCandidateComponentRightRow[]
}
