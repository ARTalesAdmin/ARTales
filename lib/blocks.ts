export const WORK_BLOCK_TYPES = [
  "chapter",
  "paragraph",
  "quote",
  "poem",
  "letter",
  "separator",
  "note",
] as const

export type WorkBlockType = (typeof WORK_BLOCK_TYPES)[number]

export type WorkBlock = {
  id: string
  type: WorkBlockType
  content: string
  editor_note: string | null
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
      "Dopis, deníkový zápis, novinový článek nebo jiný stylizovaný text.",
    publicLabel: "Letter",
    preservesLineBreaks: true,
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

export function createEmptyBlock(type: WorkBlockType = "paragraph"): WorkBlock {
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

export function sanitizeWorkBlocks(input: unknown): WorkBlock[] {
  if (!Array.isArray(input)) return []

  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null

      const candidate = raw as Record<string, unknown>
      const type = String(candidate.type ?? "")
      const content = normalizeContent(candidate.content)
      const editor_note = normalizeEditorNote(candidate.editor_note)

      if (!isWorkBlockType(type)) return null

      return {
        id:
          typeof candidate.id === "string" && candidate.id.trim() !== ""
            ? candidate.id
            : crypto.randomUUID(),
        type,
        content,
        editor_note,
      } satisfies WorkBlock
    })
    .filter((block): block is WorkBlock => block !== null)
}

export function validateWorkBlocks(blocks: WorkBlock[]): string | null {
  if (blocks.length === 0) {
    return "blocks_missing"
  }

  const hasVisibleContent = blocks.some(
    (block) =>
      block.type === "separator" || block.content.trim() !== ""
  )

  if (!hasVisibleContent) {
    return "blocks_empty"
  }

  for (const block of blocks) {
    if (block.type !== "separator" && block.content.trim() === "") {
      return "block_content_missing"
    }
  }

  return null
}

export function flattenBlocksToPlainText(blocks: WorkBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "chapter":
          return block.content.trim()

        case "paragraph":
          return block.content.trim()

        case "quote":
          return block.content.trim()

        case "poem":
          return block.content.trim()

        case "letter":
          return block.content.trim()

        case "separator":
          return "* * *"

        case "note":
          return `[Poznámka] ${block.content.trim()}`

        default:
          return block.content.trim()
      }
    })
    .filter(Boolean)
    .join("\n\n")
}