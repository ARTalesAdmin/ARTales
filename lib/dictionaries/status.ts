export const STATUS_DICTIONARY = {
  draft: {
    publicLabel: "Draft",
    internalLabel: "Koncept",
  },
  review: {
    publicLabel: "In review",
    internalLabel: "Ke kontrole",
  },
  published: {
    publicLabel: "Published",
    internalLabel: "Publikováno",
  },
  archived: {
    publicLabel: "Archived",
    internalLabel: "Archivováno",
  },
} as const

export type StatusCode = keyof typeof STATUS_DICTIONARY

export const STATUS_CODES = Object.keys(
  STATUS_DICTIONARY
) as StatusCode[]

export function isStatusCode(value: string): value is StatusCode {
  return STATUS_CODES.includes(value as StatusCode)
}

export function getStatusLabel(
  value: string | null | undefined,
  context: "public" | "internal"
): string | null {
  if (!value) return null

  if (!isStatusCode(value)) {
    return value
  }

  return context === "public"
    ? STATUS_DICTIONARY[value].publicLabel
    : STATUS_DICTIONARY[value].internalLabel
}

export function getStatusOptions(context: "internal" | "public") {
  return STATUS_CODES.map((code) => ({
    value: code,
    label:
      context === "public"
        ? STATUS_DICTIONARY[code].publicLabel
        : STATUS_DICTIONARY[code].internalLabel,
  }))
}