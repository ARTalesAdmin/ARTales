import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { canEditContent } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  flattenBlocksToPlainText,
  sanitizeWorkBlocks,
  validateWorkBlocks,
  type WorkBlock,
} from "@/lib/blocks";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type AppendBlocksPayload = {
  blocks?: unknown;
};

function toErrorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function mergeBlocks(existingBlocks: WorkBlock[], appendedBlocks: WorkBlock[]) {
  const existingIds = new Set(existingBlocks.map((block) => block.id));
  const uniqueAppendedBlocks = appendedBlocks.filter((block) => !existingIds.has(block.id));

  return {
    mergedBlocks: [...existingBlocks, ...uniqueAppendedBlocks],
    appendedCount: uniqueAppendedBlocks.length,
    skippedCount: appendedBlocks.length - uniqueAppendedBlocks.length,
  };
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

  if (appendedBlocks.length === 0) {
    return toErrorResponse("Nejsou připravené žádné nové bloky k uložení.");
  }

  const appendedBlocksError = validateWorkBlocks(appendedBlocks);

  if (appendedBlocksError) {
    return toErrorResponse(`Nové bloky nejsou platné: ${appendedBlocksError}`);
  }

  const { data: work, error: loadError } = await supabase
    .from("works")
    .select("id, content_blocks")
    .eq("slug", slug)
    .maybeSingle();

  if (loadError) {
    console.error("Large work append load failed:", loadError);
    return toErrorResponse("Dílo se nepodařilo načíst před uložením nových bloků.", 500);
  }

  if (!work) {
    return toErrorResponse("Dílo nebylo nalezeno.", 404);
  }

  const existingBlocks = sanitizeWorkBlocks(Array.isArray(work.content_blocks) ? work.content_blocks : []);
  const { mergedBlocks, appendedCount, skippedCount } = mergeBlocks(existingBlocks, appendedBlocks);

  if (appendedCount === 0) {
    return NextResponse.json({
      ok: true,
      appendedCount,
      skippedCount,
      message: "Všechny odeslané bloky už byly u díla uložené.",
    });
  }

  const mergedBlocksError = validateWorkBlocks(mergedBlocks);

  if (mergedBlocksError) {
    return toErrorResponse(`Výsledný obsah díla není platný: ${mergedBlocksError}`);
  }

  const { error: updateError } = await supabase
    .from("works")
    .update({
      content_blocks: mergedBlocks,
      content: flattenBlocksToPlainText(mergedBlocks),
      updated_by: profile?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", work.id);

  if (updateError) {
    console.error("Large work append update failed:", updateError);
    return toErrorResponse(updateError.message || "Nové bloky se nepodařilo uložit.", 500);
  }

  return NextResponse.json({
    ok: true,
    appendedCount,
    skippedCount,
    message: `Uloženo ${appendedCount} nových bloků.${skippedCount > 0 ? ` ${skippedCount} bloků už bylo uložených.` : ""}`,
  });
}
