import type { WorkBlockType } from "@/lib/blocks";
import type { FixtureIssueCategory } from "./ingestIssue";

/**
 * Fixture catalogue, stable codes suitable for future learning/audit.
 * These are editorial observations, never permissions to change text.
 */
export const EDITORIAL_PRESETS = [
  { id: "unknown", group: "Nejsem si jistý", label: "Nevím, co je špatně", category: "unsure", needsNote: true, blockType: null, boundary: false },
  { id: "type.verse_spacing", group: "Sazba a typografie", label: "Příliš těsné verše / řádkování", category: "typography", needsNote: false, blockType: "poem", boundary: false },
  { id: "type.paragraph_spacing", group: "Sazba a typografie", label: "Nevhodné rozestupy odstavce", category: "typography", needsNote: false, blockType: "paragraph", boundary: false },
  { id: "type.heading_spacing", group: "Sazba a typografie", label: "Málo místa kolem nadpisu", category: "typography", needsNote: false, blockType: "chapter", boundary: false },
  { id: "type.other", group: "Sazba a typografie", label: "Jiný problém se sazbou", category: "typography", needsNote: true, blockType: null, boundary: false },
  { id: "page.bad_break", group: "Stránkování", label: "Nevhodný předěl stránky", category: "pagination", needsNote: false, blockType: null, boundary: true },
  { id: "page.orphan", group: "Stránkování", label: "Osamocený nadpis či řádek", category: "pagination", needsNote: false, blockType: null, boundary: false },
  { id: "line.wrapping", group: "Zalamování", label: "Nevhodné zalomení řádku", category: "line_break", needsNote: false, blockType: null, boundary: false },
  { id: "line.paragraph", group: "Zalamování", label: "Nevhodné rozdělení odstavce", category: "line_break", needsNote: false, blockType: null, boundary: false },
  { id: "structure.order", group: "Členění", label: "Nesprávné členění / struktura", category: "structure", needsNote: false, blockType: null, boundary: false },
  { id: "other", group: "Ostatní", label: "Jiné – doplním vlastními slovy", category: "other", needsNote: true, blockType: null, boundary: false },
] as const satisfies ReadonlyArray<{
  id: string; group: string; label: string; category: FixtureIssueCategory;
  needsNote: boolean; blockType: WorkBlockType | null; boundary: boolean;
}>;

export type EditorialPresetId = (typeof EDITORIAL_PRESETS)[number]["id"];

export function getEditorialPreset(id: string) {
  return EDITORIAL_PRESETS.find((item) => item.id === id) ?? EDITORIAL_PRESETS[0];
}

/** Automatic, fail-closed dispatch: only a known type-safe layout recipe is instant. */
export function routeFixtureIssue(presetId: string, actualType: WorkBlockType | undefined):
  "instant_local" | "deferred_fixture" {
  const preset = getEditorialPreset(presetId);
  return preset.blockType !== null && preset.blockType === actualType
    ? "instant_local" : "deferred_fixture";
}
