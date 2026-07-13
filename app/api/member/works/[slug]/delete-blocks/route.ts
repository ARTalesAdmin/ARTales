import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { canEditContent } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { sanitizeWorkBlocks, validateWorkBlocks } from "@/lib/blocks";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type DeleteBlocksPayload = {
  blockIds?: unknown;
  changedBlocks?: unknown;
};

function toErrorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function getDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  return "code" in error ? String((error as { code?: unknown }).code ?? "") : null;
}

function normalizeBlockIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

export async function POST(request: Request, context: RouteContext) {
  const profile = await getCurrentProfile();

  if (!canEditContent(profile)) {
    return toErrorResponse("Nemáš oprávnění upravovat díla.", 403);
  }

  const { slug } = await context.params;
  const supabase = await createClient();

  let payload: DeleteBlocksPayload;

  try {
    payload = (await request.json()) as DeleteBlocksPayload;
  } catch {
    return toErrorResponse("Nepodařilo se načíst seznam bloků ke smazání.");
  }

  const blockIds = normalizeBlockIds(payload.blockIds);
  const changedBlocks = sanitizeWorkBlocks(Array.isArray(payload.changedBlocks) ? payload.changedBlocks : []);

  if (blockIds.length === 0) {
    return toErrorResponse("Nejsou vybrané žádné bloky ke smazání.");
  }

  const changedBlocksError =
    changedBlocks.length > 0 ? validateWorkBlocks(changedBlocks) : null;

  if (changedBlocksError) {
    return toErrorResponse(`Upravené ponechané bloky nejsou platné: ${changedBlocksError}`);
  }

  const { data: work, error: loadError } = await supabase
    .from("works")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (loadError) {
    console.error("Large work delete load failed:", loadError);
    return toErrorResponse("Dílo se nepodařilo načíst před uložením smazaných bloků.", 500);
  }

  if (!work) {
    return toErrorResponse("Dílo nebylo nalezeno.", 404);
  }

  const { error: insertError } = await supabase.from("work_content_block_batches").insert({
    work_id: work.id,
    blocks: [],
    created_by: profile?.id ?? null,
    metadata: {
      source: "large_work_delete",
      deleted_block_ids: blockIds,
      deleted_count: blockIds.length,
      updated_blocks: changedBlocks,
      updated_count: changedBlocks.length,
      work_slug: slug,
      actor_profile_id: profile?.id ?? null,
      saved_via: "smart_delete",
    },
  });

  if (insertError) {
    console.error("Large work delete batch insert failed:", insertError);

    if (getDatabaseErrorCode(insertError) === "42P01") {
      return toErrorResponse(
        "Chybí databázová tabulka pro dávkové ukládání bloků. Spusť prosím SQL migraci z patche v0.10.12j a zkus to znovu.",
        500,
      );
    }

    return toErrorResponse(insertError.message || "Smazání bloků se nepodařilo uložit.", 500);
  }

  return NextResponse.json({
    ok: true,
    deletedCount: blockIds.length,
    changedCount: changedBlocks.length,
    message:
      changedBlocks.length > 0
        ? `Uloženo smazání ${blockIds.length} bloků a úprava ${changedBlocks.length} ponechaných bloků. Po obnovení stránky bude editor i čtečka načítat novou verzi.`
        : `Uloženo smazání ${blockIds.length} bloků. Po obnovení stránky už nebudou součástí editoru ani čtečky.`,
  });
}
