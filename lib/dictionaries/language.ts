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
} as const

export type LanguageCode = keyof typeof LANGUAGE_DICTIONARY

export const LANGUAGE_CODES = Object.keys(
  LANGUAGE_DICTIONARY
) as LanguageCode[]

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGE_CODES.includes(value as LanguageCode)
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

export function getLanguageOptions(context: "internal" | "public") {
  return LANGUAGE_CODES.map((code) => ({
    value: code,
    label:
      context === "public"
        ? LANGUAGE_DICTIONARY[code].publicLabel
        : LANGUAGE_DICTIONARY[code].internalLabel,
  }))
}