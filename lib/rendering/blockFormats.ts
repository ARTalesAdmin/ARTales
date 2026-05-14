export const blockFormatPresetIds = [
  "defaultReader",
  "editionClassic",
  "readerComfort",
  "readerCompact",
] as const;
export type BlockFormatPresetId = (typeof blockFormatPresetIds)[number];

export type BlockFormatPreset = {
  id: BlockFormatPresetId;
  label: string;
  description: string;
  className: string;
};

export const blockFormatPresets: Record<
  BlockFormatPresetId,
  BlockFormatPreset
> = {
  defaultReader: {
    id: "defaultReader",
    label: "Default reader",
    description: "Clean responsive reading profile for the public web reader.",
    className: "artales-renderer--default-reader",
  },
  editionClassic: {
    id: "editionClassic",
    label: "Classic edition",
    description:
      "More formal book-like profile prepared for print/PDF evolution.",
    className: "artales-renderer--edition-classic",
  },
  readerComfort: {
    id: "readerComfort",
    label: "Reader comfort",
    description: "Comfortable long-form reading profile for blob-heavy texts.",
    className: "artales-renderer--reader-comfort",
  },
  readerCompact: {
    id: "readerCompact",
    label: "Reader compact",
    description: "Denser long-form reading profile for experienced readers.",
    className: "artales-renderer--reader-compact",
  },
};

export function getBlockFormatPreset(
  id: BlockFormatPresetId = "defaultReader",
) {
  return blockFormatPresets[id] ?? blockFormatPresets.defaultReader;
}
