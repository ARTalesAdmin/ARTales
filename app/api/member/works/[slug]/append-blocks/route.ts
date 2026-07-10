import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { canEditContent } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  sanitizeWorkBlocks,
  validateWorkBlocks,
} from "@/lib/blocks";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type AppendBlocksPayload = {
  blocks?: unknown;
  insertAfterBlockId?: unknown;
  batchIndex?: unknown;
  batchCount?: unknown;
};

function toErrorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function getDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  return "code" in error ? String((error as { code?: unknown }).code ?? "") : null;
}

export async function POST(request: Request, context: RouteContext) {
  const profile = await getCurrentProfile();

  if (!canEditContent(profile)) {
    return toErrorResponse("Nemáš oprávnění upravovat díla.", 403);
  }

  const { slug } = await context.params;
  const supabase = await createClient();

  let payload: AppendBlocksPayload;

  try {
    payload = (await request.json()) as AppendBlocksPayload;
  } catch {
    return toErrorResponse("Nepodařilo se načíst odeslané bloky.");
  }

  const appendedBlocks = sanitizeWorkBlocks(Array.isArray(payload.blocks) ? payload.blocks : []);
  const insertAfterBlockId =
    typeof payload.insertAfterBlockId === "string" && payload.insertAfterBlockId.trim() !== ""
      ? payload.insertAfterBlockId.trim()
      : null;
  const batchIndex = typeof payload.batchIndex === "number" ? payload.batchIndex : null;
  const batchCount = typeof payload.batchCount === "number" ? payload.batchCount : null;

  if (appendedBlocks.length === 0) {
    return toErrorResponse("Nejsou připravené žádné nové bloky k uložení.");
  }

  const appendedBlocksError = validateWorkBlocks(appendedBlocks);

  if (appendedBlocksError) {
    return toErrorResponse(`Nové bloky nejsou platné: ${appendedBlocksError}`);
  }

  const { data: work, error: loadError } = await supabase
    .from("works")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (loadError) {
    console.error("Large work append load failed:", loadError);
    return toErrorResponse("Dílo se nepodařilo načíst před uložením nových bloků.", 500);
  }

  if (!work) {
    return toErrorResponse("Dílo nebylo nalezeno.", 404);
  }

  const { error: insertError } = await supabase.from("work_content_block_batches").insert({
    work_id: work.id,
    blocks: appendedBlocks,
    created_by: profile?.id ?? null,
    metadata: {
      source: "large_work_append",
      block_count: appendedBlocks.length,
      batch_index: batchIndex,
      batch_count: batchCount,
      insert_after_block_id: insertAfterBlockId,
      work_slug: slug,
      actor_profile_id: profile?.id ?? null,
      saved_via: "smart_save",
    },
  });

  if (insertError) {
    console.error("Large work append batch insert failed:", insertError);

    if (getDatabaseErrorCode(insertError) === "42P01") {
      return toErrorResponse(
        "Chybí databázová tabulka pro dávkové ukládání bloků. Spusť prosím SQL migraci z patche v0.10.12j a zkus to znovu.",
        500,
      );
    }

    return toErrorResponse(insertError.message || "Nové bloky se nepodařilo uložit.", 500);
  }

  return NextResponse.json({
    ok: true,
    appendedCount: appendedBlocks.length,
    skippedCount: 0,
    stagedOnly: true,
    message: `Uloženo ${appendedBlocks.length} nových bloků do dávkové vrstvy. Po obnovení stránky budou součástí editoru.`,
  });
}
