export const COLLECTION_TYPE_OPTIONS = [
  { value: "curated", label: "Kurátorská" },
  { value: "seasonal", label: "Sezónní" },
  { value: "authorial", label: "Autorská" },
  { value: "editorial", label: "Ediční" },
  { value: "school_library", label: "Škola / knihovna" },
  { value: "community", label: "Komunitní" },
] as const

export type CollectionType = (typeof COLLECTION_TYPE_OPTIONS)[number]["value"]

export function isCollectionType(value: string): value is CollectionType {
  return COLLECTION_TYPE_OPTIONS.some((option) => option.value === value)
}

export function getCollectionTypeLabel(value: string): string {
  return (
    COLLECTION_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    value
  )
}

export function getLocalizedCollectionTypeLabel(
  value: string,
  locale: "cs" | "en"
): string {
  switch (value) {
    case "curated":
      return locale === "cs" ? "Kurátorská" : "Curated"
    case "seasonal":
      return locale === "cs" ? "Sezónní" : "Seasonal"
    case "authorial":
      return locale === "cs" ? "Autorská" : "Authorial"
    case "editorial":
      return locale === "cs" ? "Ediční" : "Editorial"
    case "school_library":
      return locale === "cs" ? "Škola / knihovna" : "School / library"
    case "community":
      return locale === "cs" ? "Komunitní" : "Community"
    default:
      return value
  }
}
