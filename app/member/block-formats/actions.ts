"use server";

import { revalidatePath } from "next/cache";
import { requireEditorOrAdmin } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";
import { isLegacyBlockType, parseLegacyBlockStyle } from "@/lib/rendering/legacyBlockStyles";

export async function saveLegacyBlockFormat(
  blockType: string, input: unknown
): Promise<{ok: boolean; message: string}> {
  const profile = await requireEditorOrAdmin();
  if (!isLegacyBlockType(blockType)) return {ok:false,message:"Neznámý typ bloku."};
  const style = parseLegacyBlockStyle(blockType, input);
  if (!style) return {ok:false,message:"Formát má nepovolené hodnoty."};

  const db = await createClient();
  const {error} = await db.from("artales_legacy_block_styles").upsert({
    block_type:blockType, style, updated_by:profile.id,
    updated_at:new Date().toISOString(),
  },{onConflict:"block_type"});
  if (error) {
    console.error("Legacy block format save error:",error.code);
    return {ok:false,message:"Formát se nepodařilo uložit."};
  }
  revalidatePath("/member/block-formats");
  revalidatePath("/reader/[slug]","page");
  revalidatePath("/member/works/[slug]/reader","page");
  return {ok:true,message:"Formát bloku byl uložen a je platný pro starý Reader."};
}
