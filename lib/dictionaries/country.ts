import type { SupportedLocale } from "@/lib/i18n/config"

const COUNTRY_LABELS: Record<string, { en: string; cs: string }> = {
  "austria": { en: "Austria", cs: "Rakousko" },
  "czech republic": { en: "Czech Republic", cs: "Česká republika" },
  "czechia": { en: "Czechia", cs: "Česko" },
  "denmark": { en: "Denmark", cs: "Dánsko" },
  "france": { en: "France", cs: "Francie" },
  "germany": { en: "Germany", cs: "Německo" },
  "greece": { en: "Greece", cs: "Řecko" },
  "ireland": { en: "Ireland", cs: "Irsko" },
  "italy": { en: "Italy", cs: "Itálie" },
  "norway": { en: "Norway", cs: "Norsko" },
  "poland": { en: "Poland", cs: "Polsko" },
  "portugal": { en: "Portugal", cs: "Portugalsko" },
  "russia": { en: "Russia", cs: "Rusko" },
  "spain": { en: "Spain", cs: "Španělsko" },
  "sweden": { en: "Sweden", cs: "Švédsko" },
  "ukraine": { en: "Ukraine", cs: "Ukrajina" },
  "united kingdom": { en: "United Kingdom", cs: "Spojené království" },
  "uk": { en: "United Kingdom", cs: "Spojené království" },
  "great britain": { en: "Great Britain", cs: "Velká Británie" },
  "england": { en: "England", cs: "Anglie" },
  "scotland": { en: "Scotland", cs: "Skotsko" },
  "united states": { en: "United States", cs: "Spojené státy" },
  "united states of america": { en: "United States", cs: "Spojené státy" },
  "usa": { en: "United States", cs: "Spojené státy" },
}

export function getCountryLabel(
  value: string | null | undefined,
  locale: SupportedLocale
): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const known = COUNTRY_LABELS[trimmed.toLowerCase()]
  if (!known) return trimmed

  return locale === "cs" ? known.cs : known.en
}
