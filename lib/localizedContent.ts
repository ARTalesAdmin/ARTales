import type { SupportedLocale } from "@/lib/i18n/config"

export function pickLocalizedText(
  locale: SupportedLocale,
  options: {
    cs?: string | null
    en?: string | null
    fallback?: string | null
  }
): string | null {
  const cs = normalizeOptionalText(options.cs)
  const en = normalizeOptionalText(options.en)
  const fallback = normalizeOptionalText(options.fallback)

  if (locale === "cs") {
    return cs ?? en ?? fallback ?? null
  }

  return en ?? cs ?? fallback ?? null
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}
