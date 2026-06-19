export const TAG_TYPE_OPTIONS = [
  { value: "genre", label: "Žánr" },
  { value: "form", label: "Forma" },
  { value: "theme", label: "Téma" },
  { value: "mood", label: "Atmosféra" },
  { value: "period", label: "Období / kontext" },
  { value: "language", label: "Jazyk" },
  { value: "difficulty", label: "Obtížnost" },
  { value: "reading_mode", label: "Čtenářský režim" },
  { value: "format", label: "Formát" },
  { value: "audience", label: "Publikum" },
  { value: "content_note", label: "Obsahová poznámka" },
  { value: "other", label: "Jiné" },
] as const

export type TagType = (typeof TAG_TYPE_OPTIONS)[number]["value"]

export function isTagType(value: string): value is TagType {
  return TAG_TYPE_OPTIONS.some((option) => option.value === value)
}

export function getTagTypeLabel(value: string): string {
  return TAG_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
}
