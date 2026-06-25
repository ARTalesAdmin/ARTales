import type { SupportedLocale } from "@/lib/i18n/config"

export const LANGUAGE_DICTIONARY = {
  cs: {
    publicLabel: "Czech",
    internalLabel: "Čeština",
  },
  en: {
    publicLabel: "English",
    internalLabel: "Angličtina",
  },
  de: {
    publicLabel: "German",
    internalLabel: "Němčina",
  },
  fr: {
    publicLabel: "French",
    internalLabel: "Francouzština",
  },
  it: {
    publicLabel: "Italian",
    internalLabel: "Italština",
  },
  la: {
    publicLabel: "Latin",
    internalLabel: "Latina",
  },
  el: {
    publicLabel: "Greek",
    internalLabel: "Řečtina",
  },
  es: {
    publicLabel: "Spanish",
    internalLabel: "Španělština",
  },
  ru: {
    publicLabel: "Russian",
    internalLabel: "Ruština",
  },
  pl: {
    publicLabel: "Polish",
    internalLabel: "Polština",
  },
  pt: {
    publicLabel: "Portuguese",
    internalLabel: "Portugalština",
  },
  uk: {
    publicLabel: "Ukrainian",
    internalLabel: "Ukrajinština",
  },
  sk: {
    publicLabel: "Slovak",
    internalLabel: "Slovenština",
  },
} as const

export type LanguageCode = keyof typeof LANGUAGE_DICTIONARY

export const LANGUAGE_CODES = Object.keys(
  LANGUAGE_DICTIONARY
) as LanguageCode[]

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGE_CODES.includes(value as LanguageCode)
}

export function normalizeLanguageCodes(values: string[]): LanguageCode[] {
  const seen = new Set<LanguageCode>()

  for (const value of values) {
    const trimmed = value.trim()
    if (isLanguageCode(trimmed)) {
      seen.add(trimmed)
    }
  }

  return Array.from(seen)
}

export function getLanguageLabel(
  value: string | null | undefined,
  context: "public" | "internal"
): string | null {
  if (!value) return null

  if (!isLanguageCode(value)) {
    return value
  }

  return context === "public"
    ? LANGUAGE_DICTIONARY[value].publicLabel
    : LANGUAGE_DICTIONARY[value].internalLabel
}

export function getLanguageLabels(
  values: string[] | null | undefined,
  context: "public" | "internal"
): string[] {
  if (!Array.isArray(values)) return []

  return values
    .map((value) => getLanguageLabel(value, context))
    .filter((label): label is string => Boolean(label))
}

export function getLanguageOptions(context: "internal" | "public") {
  return LANGUAGE_CODES.map((code) => ({
    value: code,
    label:
      context === "public"
        ? LANGUAGE_DICTIONARY[code].publicLabel
        : LANGUAGE_DICTIONARY[code].internalLabel,
  }))
}

export function getLocalizedLanguageLabel(
  value: string | null | undefined,
  locale: SupportedLocale
): string | null {
  if (!value) return null

  return getLanguageLabel(value, locale === "cs" ? "internal" : "public")
}

export function getLocalizedLanguageLabels(
  values: string[] | null | undefined,
  locale: SupportedLocale
): string[] {
  if (!Array.isArray(values)) return []

  return values
    .map((value) => getLocalizedLanguageLabel(value, locale))
    .filter((label): label is string => Boolean(label))
}
