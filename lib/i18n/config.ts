export const supportedLocales = ["en", "cs"] as const
export type SupportedLocale = (typeof supportedLocales)[number]

export const defaultPublicLocale: SupportedLocale = "en"
export const defaultInternalLocale: SupportedLocale = "cs"

export type I18nArea = "public" | "internal"

export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null
  const normalized = value.toLowerCase().split("-")[0]
  return supportedLocales.includes(normalized as SupportedLocale)
    ? (normalized as SupportedLocale)
    : null
}

export function getDefaultLocale(area: I18nArea): SupportedLocale {
  return area === "internal" ? defaultInternalLocale : defaultPublicLocale
}
