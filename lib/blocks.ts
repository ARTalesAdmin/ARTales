export const WORK_BLOCK_TYPES = [
  "book_part",
  "chapter",
  "paragraph",
  "headline",
  "quote",
  "poem",
  "letter",
  "newspaper_article",
  "place_line",
  "separator",
  "note",
  "footnote",
  "dedication",
  "preface",
  "afterword",
  "acknowledgement",
] as const

export type WorkBlockType = (typeof WORK_BLOCK_TYPES)[number]

export type WorkBlock = {
  id: string
  type: WorkBlockType
  content: string
  editor_note: string | null
  fields?: Record<string, string | null>
}

export const WORK_BLOCK_TYPE_META: Record<
  WorkBlockType,
  {
    internalLabel: string
    internalHelp: string
    publicLabel: string
    preservesLineBreaks: boolean
  }
> = {
  book_part: {
    internalLabel: "Část knihy",
    internalHelp: "Vyšší členění knihy nad kapitolami, například Část první.",
    publicLabel: "Book part",
    preservesLineBreaks: false,
  },
  chapter: {
    internalLabel: "Kapitola / nadpis kapitoly",
    internalHelp: "Nadpis nové kapitoly nebo větší sekce.",
    publicLabel: "Chapter",
    preservesLineBreaks: false,
  },
  paragraph: {
    internalLabel: "Odstavec",
    internalHelp: "Základní běžný text prózy.",
    publicLabel: "Paragraph",
    preservesLineBreaks: false,
  },
  headline: {
    internalLabel: "Titulek",
    internalHelp: "Krátký výrazný titulek uvnitř textu nebo vloženého dokumentu.",
    publicLabel: "Headline",
    preservesLineBreaks: false,
  },
  quote: {
    internalLabel: "Citace / motto",
    internalHelp: "Kratší odlišený blok, motto nebo vložená citace.",
    publicLabel: "Quote",
    preservesLineBreaks: false,
  },
  poem: {
    internalLabel: "Báseň / veršovaný text",
    internalHelp: "Text, u kterého je důležité zachovat zalomení řádků.",
    publicLabel: "Poem",
    preservesLineBreaks: true,
  },
  letter: {
    internalLabel: "Dopis / stylizovaný dokument",
    internalHelp:
      "Dopis se samostatným polem pro místo/letopočet, tělo dopisu a datum/podpis.",
    publicLabel: "Letter",
    preservesLineBreaks: true,
  },
  newspaper_article: {
    internalLabel: "Novinový článek",
    internalHelp: "Stylizovaný vložený novinový článek nebo tisková zpráva.",
    publicLabel: "Newspaper article",
    preservesLineBreaks: true,
  },
  place_line: {
    internalLabel: "Místo / čas / datace",
    internalHelp:
      "Krátký odlišený řádek typu Londýn, 1897. Není to kapitola ani podkapitola.",
    publicLabel: "Place / date line",
    preservesLineBreaks: false,
  },
  separator: {
    internalLabel: "Oddělovač / předěl",
    internalHelp: "Krátký předěl mezi scénami, časový nebo obsahový zlom.",
    publicLabel: "Separator",
    preservesLineBreaks: false,
  },
  note: {
    internalLabel: "Poznámka",
    internalHelp:
      "Veřejná vysvětlující poznámka v textu. Není to interní poznámka editora.",
    publicLabel: "Note",
    preservesLineBreaks: false,
  },
  footnote: {
    internalLabel: "Poznámka pod čarou",
    internalHelp:
      "Poznámka pod čarou jako samostatný blok. Přesné číslování a render se dořeší později.",
    publicLabel: "Footnote",
    preservesLineBreaks: false,
  },
  dedication: {
    internalLabel: "Věnování",
    internalHelp: "Krátké věnování na začátku díla.",
    publicLabel: "Dedication",
    preservesLineBreaks: true,
  },
  preface: {
    internalLabel: "Předmluva",
    internalHelp: "Úvodní text před hlavním obsahem díla.",
    publicLabel: "Preface",
    preservesLineBreaks: true,
  },
  afterword: {
    internalLabel: "Doslov",
    internalHelp: "Závěrečný text po hlavním obsahu díla.",
    publicLabel: "Afterword",
    preservesLineBreaks: true,
  },
  acknowledgement: {
    internalLabel: "Poděkování",
    internalHelp: "Sekce poděkování na konci nebo začátku díla.",
    publicLabel: "Acknowledgement",
    preservesLineBreaks: true,
  },
}

export function isWorkBlockType(value: string): value is WorkBlockType {
  return WORK_BLOCK_TYPES.includes(value as WorkBlockType)
}

export function getWorkBlockTypeOptions() {
  return WORK_BLOCK_TYPES.map((type) => ({
    value: type,
    label: WORK_BLOCK_TYPE_META[type].internalLabel,
    help: WORK_BLOCK_TYPE_META[type].internalHelp,
  }))
}

export function createEmptyBlock(type: WorkBlockType = "chapter"): WorkBlock {
  if (type === "letter") {
    return {
      id: crypto.randomUUID(),
      type,
      content: "",
      editor_note: null,
      fields: {
        place_year: "",
        body: "",
        date_signature: "",
      },
    }
  }

  return {
    id: crypto.randomUUID(),
    type,
    content: type === "separator" ? "* * *" : "",
    editor_note: null,
  }
}

function normalizeEditorNote(value: unknown): string | null {
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function normalizeContent(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.replace(/\r\n/g, "\n").trim()
}

function normalizeFields(value: unknown): Record<string, string | null> | undefined {
  if (!value || typeof value !== "object") return undefined

  const raw = value as Record<string, unknown>
  const fields: Record<string, string | null> = {}

  for (const [key, rawValue] of Object.entries(raw)) {
    fields[key] = rawValue == null ? null : String(rawValue)
  }

  return fields
}

function normalizeLetterBlock(candidate: Record<string, unknown>): WorkBlock {
  const rawFields = normalizeFields(candidate.fields) ?? {}

  const placeYear = normalizeContent(rawFields.place_year ?? "")
  const body = normalizeContent(rawFields.body ?? candidate.content ?? "")
  const dateSignature = normalizeContent(rawFields.date_signature ?? "")

  return {
    id:
      typeof candidate.id === "string" && candidate.id.trim() !== ""
        ? candidate.id
        : crypto.randomUUID(),
    type: "letter",
    content: body,
    editor_note: normalizeEditorNote(candidate.editor_note),
    fields: {
      place_year: placeYear,
      body,
      date_signature: dateSignature,
    },
  }
}

export function sanitizeWorkBlocks(input: unknown): WorkBlock[] {
  if (!Array.isArray(input)) return []

  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null

      const candidate = raw as Record<string, unknown>
      const type = String(candidate.type ?? "")

      if (!isWorkBlockType(type)) return null

      if (type === "letter") {
        return normalizeLetterBlock(candidate)
      }

      const content = normalizeContent(candidate.content)
      const editor_note = normalizeEditorNote(candidate.editor_note)

      return {
        id:
          typeof candidate.id === "string" && candidate.id.trim() !== ""
            ? candidate.id
            : crypto.randomUUID(),
        type,
        content,
        editor_note,
        fields: normalizeFields(candidate.fields),
      } satisfies WorkBlock
    })
    .filter((block): block is WorkBlock => block !== null)
}

export function validateWorkBlocks(blocks: WorkBlock[]): string | null {
  if (blocks.length === 0) {
    return "blocks_missing"
  }

  const hasVisibleContent = blocks.some((block) => {
    if (block.type === "separator") return true
    if (block.type === "letter") {
      return String(block.fields?.body ?? block.content ?? "").trim() !== ""
    }

    return block.content.trim() !== ""
  })

  if (!hasVisibleContent) {
    return "blocks_empty"
  }

  for (const block of blocks) {
    if (block.type === "separator") continue

    if (block.type === "letter") {
      const body = String(block.fields?.body ?? block.content ?? "").trim()

      if (body === "") {
        return "block_content_missing"
      }

      continue
    }

    if (block.content.trim() === "") {
      return "block_content_missing"
    }
  }

  return null
}

export function flattenBlocksToPlainText(blocks: WorkBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "book_part":
        case "chapter":
        case "paragraph":
        case "headline":
        case "quote":
        case "poem":
        case "newspaper_article":
        case "place_line":
        case "dedication":
        case "preface":
        case "afterword":
        case "acknowledgement":
          return block.content.trim()

        case "letter": {
          const placeYear = String(block.fields?.place_year ?? "").trim()
          const body = String(block.fields?.body ?? block.content ?? "").trim()
          const dateSignature = String(block.fields?.date_signature ?? "").trim()

          return [placeYear, body, dateSignature].filter(Boolean).join("\n\n")
        }

        case "separator":
          return "* * *"

        case "note":
          return `[Poznámka] ${block.content.trim()}`

        case "footnote":
          return `[Poznámka pod čarou] ${block.content.trim()}`

        default:
          return block.content.trim()
      }
    })
    .filter(Boolean)
    .join("\n\n")
}