import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { canEditContent } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getUnresolvedImageBlocks, validateWorkBlocks } from "@/lib/blocks";
import { getCombinedContentBlocksForWorkId } from "@/lib/dbWorks";
import {
  applyWorkContentChangeSet,
  countInsertedBlocks,
  hasWorkContentChanges,
  sanitizeWorkContentChangeSet,
} from "@/lib/workContentChanges";
import {
  mapWorkFormValuesToUpdatePayload,
  validateWorkFormValues,
  type WorkFormValues,
} from "@/lib/forms/workForm";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type FormPayload = Partial<Record<keyof WorkFormValues, unknown>>;

type ContentChangesPayload = {
  form?: FormPayload;
  contentChangeSet?: unknown;
};

function toErrorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function getDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  return "code" in error ? String((error as { code?: unknown }).code ?? "") : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

function valuesFromPayload(form: FormPayload | undefined): WorkFormValues {
  const title = text(form?.title);
  const rawSlug = text(form?.slug);

  return {
    content_update_mode: "metadata_only",
    title,
    title_cs: text(form?.title_cs),
    title_en: text(form?.title_en),
    slug: rawSlug ? slugify(rawSlug) : slugify(title),
    subtitle: text(form?.subtitle),
    subtitle_cs: text(form?.subtitle_cs),
    subtitle_en: text(form?.subtitle_en),
    summary: text(form?.summary),
    summary_cs: text(form?.summary_cs),
    summary_en: text(form?.summary_en),
    canonical_language: text(form?.canonical_language),
    origin_type: text(form?.origin_type) as WorkFormValues["origin_type"],
    source_label: text(form?.source_label) as WorkFormValues["source_label"],
    source_reference: text(form?.source_reference),
    edition_title: text(form?.edition_title),
    edition_version: text(form?.edition_version),
    edition_language: text(form?.edition_language),
    original_language: text(form?.original_language),
    edition_source_url: text(form?.edition_source_url),
    edition_license: text(form?.edition_license),
    edition_publisher: text(form?.edition_publisher),
    publication_year: text(form?.publication_year),
    isbn: text(form?.isbn),
    isbn_status: text(form?.isbn_status) || "not_required",
    isbn_note: text(form?.isbn_note),
    edition_note_public: text(form?.edition_note_public),
    edition_note_internal: text(form?.edition_note_internal),
    contributor_summary: text(form?.contributor_summary),
    cover_image_request: text(form?.cover_image_request),
    cover_image_path: text(form?.cover_image_path),
    cover_image_alt: text(form?.cover_image_alt),
    cover_image_caption: text(form?.cover_image_caption),
    status: text(form?.status),
    primary_author_id: text(form?.primary_author_id),
    collection_id: text(form?.collection_id),
    tag_ids: textArray(form?.tag_ids),
    content_blocks: [],
    content_plain_text: "",
  };
}

function applyPublicationFields<T extends Record<string, unknown>>(
  payload: T,
  status: string,
  profileId: string,
) {
  if (status === "published") {
    return {
      ...payload,
      published_at: new Date().toISOString(),
      published_by: profileId,
    };
  }

  return {
    ...payload,
    published_at: null,
    published_by: null,
  };
}

async function syncWorkCollections(
  supabase: SupabaseClient,
  profileId: string,
  workId: string,
  primaryCollectionId: string,
) {
  const { error: resetError } = await supabase
    .from("work_collections")
    .update({ is_primary: false, updated_by: profileId })
    .eq("work_id", workId);

  if (resetError) throw new Error(resetError.message);

  if (!primaryCollectionId) return;

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
    { onConflict: "work_id,collection_id" },
  );

  if (error) throw new Error(error.message);
}

async function syncWorkTags(
  supabase: SupabaseClient,
  profileId: string,
  workId: string,
  tagIds: string[],
) {
  const uniqueTagIds = Array.from(new Set(tagIds.filter(Boolean)));

  const { data: existing, error: loadError } = await supabase
    .from("work_tags")
    .select("tag_id")
    .eq("work_id", workId);

  if (loadError) throw new Error(loadError.message);

  const existingIds = ((existing ?? []) as { tag_id: string }[]).map((row) =>
    String(row.tag_id),
  );
  const toDelete = existingIds.filter((id) => !uniqueTagIds.includes(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("work_tags")
      .delete()
      .eq("work_id", workId)
      .in("tag_id", toDelete);

    if (error) throw new Error(error.message);
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
      { onConflict: "work_id,tag_id" },
    );

    if (error) throw new Error(error.message);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const profile = await getCurrentProfile();

  if (!canEditContent(profile) || !profile?.id) {
    return toErrorResponse("Nemáš oprávnění upravovat díla.", 403);
  }

  const profileId = profile.id;
  const { slug } = await context.params;
  const supabase = await createClient();

  let payload: ContentChangesPayload;

  try {
    payload = (await request.json()) as ContentChangesPayload;
  } catch {
    return toErrorResponse("Nepodařilo se načíst změnovou sadu díla.");
  }

  const values = valuesFromPayload(payload.form);
  const validationError = validateWorkFormValues(values, { skipContentBlocks: true });

  if (validationError) {
    return toErrorResponse(`Metadata díla nejsou platná: ${validationError}`);
  }

  const changeSet = sanitizeWorkContentChangeSet(payload.contentChangeSet);
  const insertedCount = countInsertedBlocks(changeSet);

  if (!hasWorkContentChanges(changeSet)) {
    return toErrorResponse("Změnová sada neobsahuje žádné úpravy bloků.");
  }

  const updatedBlocksError =
    changeSet.updatedBlocks.length > 0 ? validateWorkBlocks(changeSet.updatedBlocks) : null;

  if (updatedBlocksError) {
    return toErrorResponse(`Upravené bloky nejsou platné: ${updatedBlocksError}`);
  }

  for (const run of changeSet.insertRuns) {
    const insertedBlocksError = validateWorkBlocks(run.blocks);
    if (insertedBlocksError) {
      return toErrorResponse(`Nové bloky nejsou platné: ${insertedBlocksError}`);
    }
  }

  const { data: work, error: loadError } = await supabase
    .from("works")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (loadError) {
    console.error("Unified work save load failed:", loadError);
    return toErrorResponse("Dílo se nepodařilo načíst před uložením změn.", 500);
  }

  if (!work) {
    return toErrorResponse("Dílo nebylo nalezeno.", 404);
  }

  const workId = String(work.id);

  if (values.status === "published") {
    const currentBlocks = await getCombinedContentBlocksForWorkId(supabase, workId);
    const nextBlocks = applyWorkContentChangeSet(currentBlocks, changeSet);

    if (getUnresolvedImageBlocks(nextBlocks).length > 0) {
      return toErrorResponse("Publikované dílo má obrázkové bloky bez nahraného souboru.");
    }
  }

  const basePayload = mapWorkFormValuesToUpdatePayload(values, profileId);
  const updatePayload = applyPublicationFields(basePayload, values.status, profileId);

  const { data: updatedWork, error: updateError } = await supabase
    .from("works")
    .update(updatePayload)
    .eq("slug", slug)
    .select("id, slug")
    .single();

  if (updateError) {
    console.error("Unified work metadata update failed:", updateError);
    return toErrorResponse(updateError.message || "Metadata díla se nepodařilo uložit.", 500);
  }

  try {
    await syncWorkCollections(supabase, profileId, workId, values.collection_id);
    await syncWorkTags(supabase, profileId, workId, values.tag_ids);
  } catch (relationError) {
    return toErrorResponse(
      relationError instanceof Error
        ? relationError.message
        : "Vazby díla se nepodařilo uložit.",
      500,
    );
  }

  const { error: insertError } = await supabase.from("work_content_block_batches").insert({
    work_id: workId,
    blocks: [],
    created_by: profileId,
    metadata: {
      source: "large_work_content_change_set",
      content_change_set: {
        deleted_block_ids: changeSet.deletedBlockIds,
        updated_blocks: changeSet.updatedBlocks,
        insert_runs: changeSet.insertRuns.map((run) => ({
          insert_after_block_id: run.insertAfterBlockId,
          blocks: run.blocks,
        })),
      },
      deleted_count: changeSet.deletedBlockIds.length,
      updated_count: changeSet.updatedBlocks.length,
      inserted_count: insertedCount,
      work_slug: slug,
      next_work_slug: String(updatedWork.slug),
      actor_profile_id: profileId,
      saved_via: "unified_smart_save",
    },
  });

  if (insertError) {
    console.error("Unified work change batch insert failed:", insertError);

    if (getDatabaseErrorCode(insertError) === "42P01") {
      return toErrorResponse(
        "Chybí databázová tabulka pro dávkové ukládání bloků. Spusť prosím SQL migraci z patche v0.10.12j a zkus to znovu.",
        500,
      );
    }

    return toErrorResponse(insertError.message || "Změny bloků se nepodařilo uložit.", 500);
  }

  return NextResponse.json({
    ok: true,
    slug: String(updatedWork.slug),
    deletedCount: changeSet.deletedBlockIds.length,
    updatedCount: changeSet.updatedBlocks.length,
    insertedCount,
    message: `Uloženo: ${insertedCount} nových, ${changeSet.updatedBlocks.length} upravených a ${changeSet.deletedBlockIds.length} smazaných bloků.`,
  });
}
