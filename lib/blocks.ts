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
  "image",
  "table",
] as const;

export type WorkBlockType = (typeof WORK_BLOCK_TYPES)[number];

export type TableBlockAlignment = "left" | "center" | "right";
export type TableBlockResponsiveMode = "scroll" | "stack";

export type TableBlockFields = {
  headers?: string[];
  rows: string[][];
  caption?: string;
  first_column_header?: boolean;
  show_column_headers?: boolean;
  border_outer?: boolean;
  border_rows?: boolean;
  border_columns?: boolean;
  alignment?: TableBlockAlignment[];
  responsive_mode?: TableBlockResponsiveMode;
  column_widths?: number[];
  column_backgrounds?: string[];
  row_backgrounds?: string[];
  cell_backgrounds?: string[][];
};

export type WorkBlockFieldValue =
  | string
  | string[]
  | string[][]
  | number[]
  | boolean
  | number
  | null
  | undefined;

export type WorkBlockFields = Record<string, WorkBlockFieldValue>;

export type WorkBlock = {
  id: string;
  type: WorkBlockType;
  content: string;
  editor_note: string | null;
  fields?: WorkBlockFields;
};

export const WORK_BLOCK_TYPE_META: Record<
  WorkBlockType,
  {
    internalLabel: string;
    internalHelp: string;
    publicLabel: string;
    preservesLineBreaks: boolean;
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
    internalHelp:
      "Krátký výrazný titulek uvnitř textu nebo vloženého dokumentu.",
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
  image: {
    internalLabel: "Obrázek",
    internalHelp:
      "Samostatný obrázek nebo ilustrace mezi bloky. Editor může nahrát soubor přímo v bloku; prázdný obrázek lze uložit jako draft, ale ne publikovat.",
    publicLabel: "Image",
    preservesLineBreaks: false,
  },
  table: {
    internalLabel: "Tabulka",
    internalHelp:
      "Jednoduchá literární tabulka, kde význam závisí na řádcích a sloupcích.",
    publicLabel: "Table",
    preservesLineBreaks: false,
  },
};

export function isWorkBlockType(value: string): value is WorkBlockType {
  return WORK_BLOCK_TYPES.includes(value as WorkBlockType);
}

export function getWorkBlockTypeOptions() {
  return WORK_BLOCK_TYPES.map((type) => ({
    value: type,
    label: WORK_BLOCK_TYPE_META[type].internalLabel,
    help: WORK_BLOCK_TYPE_META[type].internalHelp,
  }));
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
    };
  }

  if (type === "image") {
    return {
      id: crypto.randomUUID(),
      type,
      content: "",
      editor_note: null,
      fields: {
        image_request: "",
        storage_path: "",
        alt: "",
        caption: "",
        alignment: "center",
        size: "normal",
        source_note: "",
      },
    };
  }

  if (type === "table") {
    return {
      id: crypto.randomUUID(),
      type,
      content: "",
      editor_note: null,
      fields: {
        headers: ["Sloupec 1", "Sloupec 2"],
        rows: [["", ""]],
        caption: "",
        first_column_header: false,
        show_column_headers: false,
        border_outer: false,
        border_rows: false,
        border_columns: false,
        alignment: ["left", "left"],
        responsive_mode: "scroll",
        column_backgrounds: ["", ""],
        row_backgrounds: [""],
        cell_backgrounds: [["", ""]],
      },
    };
  }

  return {
    id: crypto.randomUUID(),
    type,
    content: type === "separator" ? "* * *" : "",
    editor_note: null,
  };
}

function normalizeEditorNote(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeContent(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

function normalizeFields(value: unknown): WorkBlockFields | undefined {
  if (!value || typeof value !== "object") return undefined;

  const raw = value as Record<string, unknown>;
  const fields: WorkBlockFields = {};

  for (const [key, rawValue] of Object.entries(raw)) {
    fields[key] = rawValue == null ? null : String(rawValue);
  }

  return fields;
}

function normalizeTextArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => normalizeContent(item));
}

function normalizeTableRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((row) => Array.isArray(row))
    .map((row) => (row as unknown[]).map((cell) => normalizeContent(cell)));
}

function normalizeTableBoolean(value: unknown, fallback: boolean) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

function normalizeTableColor(value: unknown) {
  const color = normalizeContent(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
}

function normalizeTableColorArray(value: unknown, length: number) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length }).map((_, index) =>
    normalizeTableColor(source[index]),
  );
}

function normalizeTableColorMatrix(
  value: unknown,
  rowCount: number,
  columnCount: number,
) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: rowCount }).map((_, rowIndex) => {
    const row = Array.isArray(source[rowIndex]) ? source[rowIndex] : [];
    return Array.from({ length: columnCount }).map((__, columnIndex) =>
      normalizeTableColor(row[columnIndex]),
    );
  });
}

function getTableColumnCount(fields: TableBlockFields): number {
  if (fields.headers && fields.headers.length > 0) return fields.headers.length;
  return fields.rows[0]?.length ?? 0;
}

export function normalizeTableBlockFields(value: unknown): TableBlockFields {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const rows = normalizeTableRows(raw.rows);
  const headers = normalizeTextArray(raw.headers);
  const rawResponsiveMode = normalizeContent(raw.responsive_mode ?? "scroll");
  const responsiveMode: TableBlockResponsiveMode =
    rawResponsiveMode === "stack" ? "stack" : "scroll";
  const rawAlignment = normalizeTextArray(raw.alignment);
  const alignment = rawAlignment?.map((item) =>
    item === "center" || item === "right" ? item : "left",
  ) as TableBlockAlignment[] | undefined;
  const columnCount = headers?.length || rows[0]?.length || 0;
  const columnWidths = Array.isArray(raw.column_widths)
    ? raw.column_widths
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
    : undefined;
  const columnBackgrounds = normalizeTableColorArray(
    raw.column_backgrounds,
    columnCount,
  );
  const rowBackgrounds = normalizeTableColorArray(
    raw.row_backgrounds,
    rows.length,
  );
  const cellBackgrounds = normalizeTableColorMatrix(
    raw.cell_backgrounds,
    rows.length,
    columnCount,
  );

  return {
    ...(headers && headers.length > 0 ? { headers } : {}),
    rows,
    caption: normalizeContent(raw.caption ?? ""),
    first_column_header:
      raw.first_column_header === true || raw.first_column_header === "true",
    show_column_headers: normalizeTableBoolean(raw.show_column_headers, true),
    border_outer: normalizeTableBoolean(raw.border_outer, true),
    border_rows: normalizeTableBoolean(raw.border_rows, true),
    border_columns: normalizeTableBoolean(raw.border_columns, false),
    ...(alignment && alignment.length > 0 ? { alignment } : {}),
    responsive_mode: responsiveMode,
    ...(columnWidths && columnWidths.length === columnCount
      ? { column_widths: columnWidths }
      : {}),
    column_backgrounds: columnBackgrounds,
    row_backgrounds: rowBackgrounds,
    cell_backgrounds: cellBackgrounds,
  };
}

export function validateTableBlockFields(
  fields: TableBlockFields,
): string | null {
  if (!fields.rows || fields.rows.length === 0)
    return "Tabulka musí mít alespoň jeden řádek.";

  const columnCount = getTableColumnCount(fields);
  if (columnCount < 2) return "Tabulka musí mít alespoň dva sloupce.";

  const invalidRowIndex = fields.rows.findIndex(
    (row) => row.length !== columnCount,
  );
  if (invalidRowIndex !== -1) {
    return `Řádek ${invalidRowIndex + 1} má jiný počet buněk než zbytek tabulky.`;
  }

  if (
    fields.headers &&
    fields.headers.length > 0 &&
    fields.headers.length !== columnCount
  ) {
    return "Počet hlaviček musí odpovídat počtu sloupců.";
  }

  return null;
}

export function getTableBlockPlainText(fields: TableBlockFields): string {
  const lines: string[] = [];
  if (fields.caption) lines.push(fields.caption);
  if (
    fields.show_column_headers !== false &&
    fields.headers &&
    fields.headers.length > 0
  ) {
    lines.push(fields.headers.join(" | "));
  }
  for (const row of fields.rows) lines.push(row.join(" | "));
  return lines.join("\n");
}

function getTableCellWidthScore(value: string) {
  const text = value
    .replace(/<\/?(?:em|i)>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;

  const words = text.split(" ").filter(Boolean);
  const longestWord = words.reduce(
    (longest, word) => Math.max(longest, word.length),
    0,
  );

  return (
    Math.sqrt(Math.min(text.length, 180)) +
    Math.sqrt(Math.min(longestWord, 48)) * 0.8
  );
}

function getTableScorePercentile(values: number[], percentile: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * percentile)),
  );
  return sorted[index];
}

function normalizeTableWidthPercentages(
  values: number[],
  columnCount: number,
): number[] | null {
  if (
    values.length !== columnCount ||
    values.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const result = values.map((value) =>
    Number(((value / total) * 100).toFixed(1)),
  );
  const roundedTotal = result.reduce((sum, value) => sum + value, 0);
  result[result.length - 1] = Number(
    (result[result.length - 1] + 100 - roundedTotal).toFixed(1),
  );
  return result;
}

export function getAdaptiveTableColumnWidths(
  fields: TableBlockFields,
): number[] {
  const columnCount = getTableColumnCount(fields);
  if (columnCount <= 0) return [];
  if (columnCount === 1) return [100];

  const explicitWidths = normalizeTableWidthPercentages(
    fields.column_widths ?? [],
    columnCount,
  );
  if (explicitWidths) return explicitWidths;

  const scores = Array.from({ length: columnCount }, (_, columnIndex) => {
    const bodyScores = fields.rows
      .map((row) => getTableCellWidthScore(row[columnIndex] ?? ""))
      .filter((score) => score > 0);
    const average =
      bodyScores.length > 0
        ? bodyScores.reduce((sum, score) => sum + score, 0) /
          bodyScores.length
        : 0;
    const upperQuartile = getTableScorePercentile(bodyScores, 0.75);
    const headerScore =
      fields.show_column_headers !== false
        ? getTableCellWidthScore(fields.headers?.[columnIndex] ?? "")
        : 0;

    return Math.max(
      1,
      average * 0.55 + upperQuartile * 0.35 + headerScore * 0.35,
    );
  });

  const minimumShare =
    columnCount >= 5
      ? 0.1
      : columnCount === 4
        ? 0.12
        : columnCount === 3
          ? 0.15
          : 0.22;
  const maximumShare =
    columnCount >= 5
      ? 0.5
      : columnCount === 4
        ? 0.58
        : columnCount === 3
          ? 0.65
          : 0.78;

  const widths = scores.map((score) => score / scores.reduce((a, b) => a + b, 0));

  // Iteratively clamp extreme columns and redistribute the remaining space.
  for (let pass = 0; pass < columnCount * 2; pass += 1) {
    let fixedShare = 0;
    let flexibleScore = 0;
    const fixed = new Set<number>();

    widths.forEach((share, index) => {
      if (share <= minimumShare) {
        widths[index] = minimumShare;
        fixedShare += minimumShare;
        fixed.add(index);
      } else if (share >= maximumShare) {
        widths[index] = maximumShare;
        fixedShare += maximumShare;
        fixed.add(index);
      } else {
        flexibleScore += scores[index];
      }
    });

    if (fixed.size === 0 || fixed.size === columnCount) break;

    const remainingShare = Math.max(0, 1 - fixedShare);
    let changed = false;
    widths.forEach((_, index) => {
      if (fixed.has(index)) return;
      const next =
        flexibleScore > 0
          ? (scores[index] / flexibleScore) * remainingShare
          : remainingShare / (columnCount - fixed.size);
      if (Math.abs(next - widths[index]) > 0.0001) changed = true;
      widths[index] = next;
    });
    if (!changed) break;
  }

  return (
    normalizeTableWidthPercentages(widths, columnCount) ??
    new Array(columnCount).fill(Number((100 / columnCount).toFixed(1)))
  );
}

function normalizeLetterBlock(candidate: Record<string, unknown>): WorkBlock {
  const rawFields = normalizeFields(candidate.fields) ?? {};

  const placeYear = normalizeContent(rawFields.place_year ?? "");
  const body = normalizeContent(rawFields.body ?? candidate.content ?? "");
  const dateSignature = normalizeContent(rawFields.date_signature ?? "");

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
  };
}

function normalizeImageBlock(candidate: Record<string, unknown>): WorkBlock {
  const rawFields = normalizeFields(candidate.fields) ?? {};
  const storagePath = normalizeContent(
    rawFields.storage_path ?? candidate.content ?? "",
  );
  const imageRequest = normalizeContent(rawFields.image_request ?? "");
  const alt = normalizeContent(rawFields.alt ?? "");
  const caption = normalizeContent(rawFields.caption ?? "");
  const sourceNote = normalizeContent(
    rawFields.source_note ?? rawFields.image_request ?? "",
  );
  const rawAlignment = normalizeContent(rawFields.alignment ?? "center");
  const rawSize = normalizeContent(rawFields.size ?? "normal");

  const alignment = ["center", "left", "right", "wide"].includes(rawAlignment)
    ? rawAlignment
    : "center";
  const size = ["normal", "wide", "full"].includes(rawSize)
    ? rawSize
    : "normal";

  return {
    id:
      typeof candidate.id === "string" && candidate.id.trim() !== ""
        ? candidate.id
        : crypto.randomUUID(),
    type: "image",
    content: storagePath,
    editor_note: normalizeEditorNote(candidate.editor_note),
    fields: {
      image_request: imageRequest,
      storage_path: storagePath,
      alt,
      caption,
      alignment,
      size,
      source_note: sourceNote,
    },
  };
}

function normalizeTableBlock(candidate: Record<string, unknown>): WorkBlock {
  const fields = normalizeTableBlockFields(candidate.fields);
  const content = normalizeContent(
    candidate.content ?? getTableBlockPlainText(fields),
  );

  return {
    id:
      typeof candidate.id === "string" && candidate.id.trim() !== ""
        ? candidate.id
        : crypto.randomUUID(),
    type: "table",
    content,
    editor_note: normalizeEditorNote(candidate.editor_note),
    fields,
  };
}

export function sanitizeWorkBlocks(input: unknown): WorkBlock[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;

      const candidate = raw as Record<string, unknown>;
      const type = String(candidate.type ?? "");

      if (!isWorkBlockType(type)) return null;

      if (type === "letter") {
        return normalizeLetterBlock(candidate);
      }

      if (type === "image") {
        return normalizeImageBlock(candidate);
      }

      if (type === "table") {
        return normalizeTableBlock(candidate);
      }

      const content = normalizeContent(candidate.content);
      const editor_note = normalizeEditorNote(candidate.editor_note);

      return {
        id:
          typeof candidate.id === "string" && candidate.id.trim() !== ""
            ? candidate.id
            : crypto.randomUUID(),
        type,
        content,
        editor_note,
        fields: normalizeFields(candidate.fields),
      } satisfies WorkBlock;
    })
    .filter((block): block is WorkBlock => block !== null);
}

export function getUnresolvedImageBlocks(blocks: WorkBlock[]): WorkBlock[] {
  return blocks.filter((block) => {
    if (block.type !== "image") return false;

    return (
      String(block.fields?.storage_path ?? block.content ?? "").trim() === ""
    );
  });
}

export function validateWorkBlocks(blocks: WorkBlock[]): string | null {
  if (blocks.length === 0) {
    return "blocks_missing";
  }

  const hasVisibleContent = blocks.some((block) => {
    if (block.type === "separator") return true;
    if (block.type === "image") {
      return (
        String(block.fields?.storage_path ?? block.content ?? "").trim() !==
          "" ||
        String(block.fields?.image_request ?? "").trim() !== "" ||
        String(block.fields?.caption ?? "").trim() !== ""
      );
    }
    if (block.type === "letter") {
      return String(block.fields?.body ?? block.content ?? "").trim() !== "";
    }
    if (block.type === "table") {
      const fields = normalizeTableBlockFields(block.fields);
      return validateTableBlockFields(fields) === null;
    }

    return block.content.trim() !== "";
  });

  if (!hasVisibleContent) {
    return "blocks_empty";
  }

  for (const block of blocks) {
    if (block.type === "separator") continue;
    if (block.type === "image") continue;

    if (block.type === "letter") {
      const body = String(block.fields?.body ?? block.content ?? "").trim();

      if (body === "") {
        return "block_content_missing";
      }

      continue;
    }

    if (block.type === "table") {
      const tableError = validateTableBlockFields(
        normalizeTableBlockFields(block.fields),
      );
      if (tableError) return `table_invalid: ${tableError}`;
      continue;
    }

    if (block.content.trim() === "") {
      return "block_content_missing";
    }
  }

  return null;
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
          return block.content.trim();

        case "table":
          return getTableBlockPlainText(
            normalizeTableBlockFields(block.fields),
          ).trim();

        case "image": {
          const caption = String(block.fields?.caption ?? "").trim();
          const imageRequest = String(block.fields?.image_request ?? "").trim();
          return ["[Obrázek]", caption || imageRequest]
            .filter(Boolean)
            .join(" ");
        }

        case "letter": {
          const placeYear = String(block.fields?.place_year ?? "").trim();
          const body = String(block.fields?.body ?? block.content ?? "").trim();
          const dateSignature = String(
            block.fields?.date_signature ?? "",
          ).trim();

          return [placeYear, body, dateSignature].filter(Boolean).join("\n\n");
        }

        case "separator":
          return "* * *";

        case "note":
          return `[Poznámka] ${block.content.trim()}`;

        case "footnote":
          return `[Poznámka pod čarou] ${block.content.trim()}`;

        default:
          return block.content.trim();
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
