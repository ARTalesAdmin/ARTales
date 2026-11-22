import { createClient } from "@/lib/supabase/server";
import { WORK_BLOCK_TYPES } from "@/lib/blocks";
import { DEFAULT_LEGACY_BLOCK_STYLES, parseLegacyBlockStyle, type LegacyBlockStyleMap } from "./legacyBlockStyles";

/** Shared data source for the legacy Reader and the staff format editor. */
export async function getLegacyBlockStyles(): Promise<LegacyBlockStyleMap> {
  const db = await createClient();
  const { data, error } = await db.from("artales_legacy_block_styles")
    .select("block_type,style");
  if (error) throw new Error("legacy_block_styles_unavailable");
  const styles: LegacyBlockStyleMap = structuredClone(DEFAULT_LEGACY_BLOCK_STYLES);
  for (const row of data ?? []) {
    if (!WORK_BLOCK_TYPES.some(t => t === row.block_type)) {
      throw new Error("legacy_block_styles_unknown_type");
    }
    const type = row.block_type as keyof LegacyBlockStyleMap;
    const style = parseLegacyBlockStyle(type, row.style);
    if (!style) throw new Error("legacy_block_styles_invalid");
    styles[type] = style;
  }
  return styles;
}
