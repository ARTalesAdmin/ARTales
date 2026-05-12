export const blockFormatPresetIds = ["defaultReader", "editionClassic"] as const
export type BlockFormatPresetId = (typeof blockFormatPresetIds)[number]

export type BlockFormatPreset = {
  id: BlockFormatPresetId
  label: string
  description: string
  className: string
}

export const blockFormatPresets: Record<BlockFormatPresetId, BlockFormatPreset> = {
  defaultReader: {
    id: "defaultReader",
    label: "Default reader",
    description: "Clean responsive reading profile for the public web reader.",
    className: "artales-renderer--default-reader",
  },
  editionClassic: {
    id: "editionClassic",
    label: "Classic edition",
    description: "More formal book-like profile prepared for print/PDF evolution.",
    className: "artales-renderer--edition-classic",
  },
}

export function getBlockFormatPreset(id: BlockFormatPresetId = "defaultReader") {
  return blockFormatPresets[id] ?? blockFormatPresets.defaultReader
}
