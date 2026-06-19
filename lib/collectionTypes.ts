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
