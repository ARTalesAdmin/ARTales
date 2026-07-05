"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getUnresolvedImageBlocks } from "@/lib/blocks"
import { getCombinedContentBlocksForWorkId } from "@/lib/dbWorks"
import {
  parseWorkFormData,
  validateWorkFormValues,
  mapWorkFormValuesToInsertPayload,
  mapWorkFormValuesToUpdatePayload,
} from "@/lib/forms/workForm"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

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

async function syncWorkCollections(
  supabase: SupabaseClient,
  profileId: string,
  workId: string,
  primaryCollectionId: string
) {
  const { error: resetError } = await supabase
    .from("work_collections")
    .update({ is_primary: false, updated_by: profileId })
    .eq("work_id", workId)

  if (resetError) {
    throw new Error(resetError.message)
  }

  if (!primaryCollectionId) {
    return
  }

  const { error } = await supabase.from("work_collections").upsert(
    [
      {
        work_id: workId,
        collection_id: primaryCollectionId,
        sort_order: 10,
        is_primary: true,
        created_by: profileId,
        updated_by: profileId,
      },
    ],
    { onConflict: "work_id,collection_id" }
  )

  if (error) {
    throw new Error(error.message)
  }
}

async function syncWorkTags(
  supabase: SupabaseClient,
  profileId: string,
  workId: string,
  tagIds: string[]
) {
  const uniqueTagIds = Array.from(new Set(tagIds.filter(Boolean)))

  const { data: existing, error: loadError } = await supabase
    .from("work_tags")
    .select("tag_id")
    .eq("work_id", workId)

  if (loadError) {
    throw new Error(loadError.message)
  }

  const existingIds = ((existing ?? []) as { tag_id: string }[]).map((row) =>
    String(row.tag_id)
  )
  const toDelete = existingIds.filter((id) => !uniqueTagIds.includes(id))

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("work_tags")
      .delete()
      .eq("work_id", workId)
      .in("tag_id", toDelete)

    if (error) {
      throw new Error(error.message)
    }
  }

  if (uniqueTagIds.length > 0) {
    const { error } = await supabase.from("work_tags").upsert(
      uniqueTagIds.map((tagId, index) => ({
        work_id: workId,
        tag_id: tagId,
        sort_order: (index + 1) * 10,
        created_by: profileId,
        updated_by: profileId,
      })),
      { onConflict: "work_id,tag_id" }
    )

    if (error) {
      throw new Error(error.message)
    }
  }
}

export async function createWork(formData: FormData): Promise<void> {
  const profile = await requireEditorOrAdmin()
  const supabase = await createClient()

  const values = parseWorkFormData(formData)
  const validationError = validateWorkFormValues(values, {
    skipContentBlocks: values.content_update_mode === "metadata_only",
  })

  if (validationError) {
    redirect(`/member/works/new?error=${validationError}`)
  }

  const basePayload = mapWorkFormValuesToInsertPayload(values, profile.id)
  const payload = applyPublicationFields(basePayload, values.status, profile.id)

  const { data, error } = await supabase
    .from("works")
    .insert(payload)
    .select("id, slug")
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

  try {
    await syncWorkCollections(
      supabase,
      profile.id,
      String(data.id),
      values.collection_id
    )
    await syncWorkTags(supabase, profile.id, String(data.id), values.tag_ids)
  } catch (relationError) {
    redirect(
      `/member/works/${payload.slug}/edit?error=save_failed&db_error=${encodeDbError(
        relationError instanceof Error ? relationError.message : "relation_sync_failed"
      )}`
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
  const validationError = validateWorkFormValues(values, {
    skipContentBlocks: values.content_update_mode === "metadata_only",
  })

  if (validationError) {
    redirect(`/member/works/${originalSlug}/edit?error=${validationError}`)
  }

  if (values.content_update_mode === "metadata_only" && values.status === "published") {
    const { data: existingWork, error: existingWorkError } = await supabase
      .from("works")
      .select("id")
      .eq("slug", originalSlug)
      .maybeSingle()

    if (existingWorkError) {
      redirect(
        `/member/works/${originalSlug}/edit?error=save_failed&db_error=${encodeDbError(
          existingWorkError.message
        )}`
      )
    }

    if (!existingWork) {
      redirect(`/member/works/${originalSlug}/edit?error=not_found`)
    }

    const combinedBlocks = await getCombinedContentBlocksForWorkId(
      supabase,
      String(existingWork.id),
    )

    if (getUnresolvedImageBlocks(combinedBlocks).length > 0) {
      redirect(`/member/works/${originalSlug}/edit?error=image_blocks_missing_assets`)
    }
  }

  const basePayload = mapWorkFormValuesToUpdatePayload(values, profile.id)
  const payload = applyPublicationFields(basePayload, values.status, profile.id)

  const { data, error } = await supabase
    .from("works")
    .update(payload)
    .eq("slug", originalSlug)
    .select("id, slug")
    .single()

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

  try {
    await syncWorkCollections(
      supabase,
      profile.id,
      String(data.id),
      values.collection_id
    )
    await syncWorkTags(supabase, profile.id, String(data.id), values.tag_ids)
  } catch (relationError) {
    redirect(
      `/member/works/${originalSlug}/edit?error=save_failed&db_error=${encodeDbError(
        relationError instanceof Error ? relationError.message : "relation_sync_failed"
      )}`
    )
  }

  redirect(`/member/works/${payload.slug}/edit?success=work_updated`)
}
