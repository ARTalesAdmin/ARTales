import {
  getTableBlockPlainText,
  normalizeTableBlockFields,
  validateTableBlockFields,
  type WorkBlock,
  type WorkBlockType,
} from "@/lib/blocks";

const MARKUP_TAG_TO_BLOCK_TYPE: Record<string, WorkBlockType> = {
  book_part: "book_part",
  chapter: "chapter",
  headline: "headline",
  paragraph: "paragraph",
  quote: "quote",
  poem: "poem",
  letter: "letter",
  newspaper_article: "newspaper_article",
  place_line: "place_line",
  separator: "separator",
  note: "note",
  footnote: "footnote",
  dedication: "dedication",
  preface: "preface",
  afterword: "afterword",
  acknowledgement: "acknowledgement",
  image: "image",
  table: "table",
};

export const ARTALES_TEXT_PREPROCESSOR_PROMPT = `Jsi ARTales text preprocessor.

Tvůj jediný úkol je připravit literární text pro import do ARTales editoru.

ZÁKLADNÍ PRAVIDLA:
- Neměň obsah textu.
- Neopravuj styl, pravopis, interpunkci, archaické výrazy ani formulace autora.
- Pokud je část textu v originále kurzívou, zachovej ji inline značkou <em>...</em>. Nepoužívej Markdown hvězdičky.
- Nezkracuj.
- Neparafrázuj.
- Nedoplňuj vlastní komentáře.
- Nevysvětluj, co děláš.
- Výstup musí být pouze původní text doplněný o strukturální značky ARTales.

ZNAČKY:
Používej pouze tyto značky, vždy samostatně na řádku:
::book_part
::chapter
::headline
::paragraph
::quote
::poem
::letter
::newspaper_article
::place_line
::separator
::note
::footnote
::dedication
::preface
::afterword
::acknowledgement
::image
::table

METODIKA:
- Každý skutečný odstavec prózy označ jako samostatný blok ::paragraph.
- Nadpis kapitoly označ jako ::chapter.
- Vyšší část knihy označ jako ::book_part.
- Krátký vnitřní titulek označ jako ::headline.
- Předmluvu označ jako ::preface.
- Doslov označ jako ::afterword.
- Věnování označ jako ::dedication.
- Poděkování označ jako ::acknowledgement.
- Veršovaný úsek označ jako ::poem a zachovej původní zalomení řádků.
- Dopis označ jako ::letter a zachovej jeho vnitřní strukturu.
- Vložený novinový článek označ jako ::newspaper_article.
- Místo, datum nebo dataci na samostatném řádku označ jako ::place_line.
- Oddělovače typu * * * nebo --- označ jako ::separator.
- Poznámku označ jako ::note.
- Poznámku pod čarou označ jako ::footnote.
- Obrázek, ilustraci, mapu, tabuli nebo jasné místo pro obrázek označ jako ::image. Do bloku napiš původní popisek, název obrázku nebo stručnou poznámku. Obrázek nesmí z textu zmizet, i když samotný soubor zatím není k dispozici.
- Jednoduchou literární tabulku, seznam ve sloupcích, paralelní přehled šachových tahů nebo podobný obsah, jehož význam závisí na řádcích a sloupcích, označ jako ::table. Za značku vlož pouze validní JSON s poli caption, headers, rows, first_column_header, alignment a responsive_mode. Neměň text buněk.

PŘÍMÁ ŘEČ VS. CITACE:
- Běžná přímá řeč a dialog v próze zůstávají ::paragraph.
- Věta v uvozovkách uvnitř odstavce není automaticky ::quote.
- ::quote použij pouze pro skutečně vyčleněnou citaci, motto, epigraf nebo samostatný citovaný blok mimo běžné vyprávění.
- Pokud si nejsi jistý, zda jde o dialog nebo citaci, použij raději ::paragraph.

FORMÁT VÝSTUPU:
- Značka vždy určuje typ následujícího bloku.
- Značka musí být sama na řádku.
- Za značkou nech text daného bloku.
- Neobaluj výstup do Markdownu.
- Nepřidávej úvod ani závěr.

PŘÍKLAD:
::chapter
Kapitola I

::paragraph
První odstavec textu.

::paragraph
Druhý odstavec textu.

::separator
* * *

::poem
První verš
druhý verš
třetí verš

::image
::table
Obrázek 1 – mapa okolí. Editor později nahraje soubor.`;

export type ParsedWorkBlocksResult = {
  blocks: WorkBlock[];
  usedMarkup: boolean;
  stats: {
    totalBlocks: number;
    chapters: number;
    paragraphs: number;
    poems: number;
    separators: number;
    quotes: number;
    placeLines: number;
    images: number;
    tables: number;
    markedBlocks: number;
  };
};

function createBlock(
  type: WorkBlockType,
  content: string,
  editorNote?: string,
): WorkBlock {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `parsed-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    content: content.trim(),
    editor_note: editorNote ?? null,
  };
}

function createImagePlaceholderBlock(
  content: string,
  editorNote?: string,
): WorkBlock {
  const cleaned = content.trim();

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `parsed-image-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "image",
    content: "",
    editor_note:
      editorNote ?? "Parser: placeholder obrázku. Nahraj asset před publikací.",
    fields: {
      image_request: cleaned,
      storage_path: "",
      alt: "",
      caption: cleaned,
      alignment: "center",
      size: "normal",
      source_note: cleaned || "Parser označil místo pro obrázek.",
    },
  };
}

function createTableBlockFromJson(content: string): WorkBlock[] {
  const cleaned = content.trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const fields = normalizeTableBlockFields(parsed);
    const error = validateTableBlockFields(fields);

    if (error) {
      return [
        createBlock(
          "paragraph",
          cleaned,
          `Parser: značka ::table nebyla převedena na tabulku. ${error}`,
        ),
      ];
    }

    return [
      {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `parsed-table-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "table",
        content: getTableBlockPlainText(fields),
        editor_note: "Parser: vloženo podle ARTales značky ::table.",
        fields,
      },
    ];
  } catch {
    return [
      createBlock(
        "paragraph",
        cleaned,
        "Parser: značka ::table obsahovala neplatný JSON. Zkontroluj a případně vytvoř tabulku ručně.",
      ),
    ];
  }
}

function normalizeRawText(rawText: string) {
  return rawText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function splitIntoParagraphCandidates(text: string) {
  return text
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function compactInlineText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNonEmptyLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readMarkupTag(line: string): WorkBlockType | null {
  const match = line.trim().match(/^::([a-z_]+)$/);
  if (!match) return null;

  return MARKUP_TAG_TO_BLOCK_TYPE[match[1]] ?? null;
}

function hasRecognizedMarkup(text: string) {
  return text.split("\n").some((line) => readMarkupTag(line) !== null);
}

function normalizeContentForType(type: WorkBlockType, content: string) {
  if (type === "separator") {
    const separator = compactInlineText(content);
    return separator || "* * *";
  }

  if (
    type === "poem" ||
    type === "letter" ||
    type === "newspaper_article" ||
    type === "dedication" ||
    type === "acknowledgement" ||
    type === "image" ||
    type === "table"
  ) {
    return content.trim();
  }

  return compactInlineText(content);
}

function createMarkedBlocks(type: WorkBlockType, content: string): WorkBlock[] {
  const cleaned = content.trim();

  if (type === "separator") {
    return [
      createBlock(
        "separator",
        normalizeContentForType("separator", cleaned),
        "Parser: vloženo podle ARTales značky ::separator.",
      ),
    ];
  }

  if (type === "image") {
    return [
      createImagePlaceholderBlock(
        cleaned,
        "Parser: vloženo podle ARTales značky ::image. Nahraj obrázek před publikací.",
      ),
    ];
  }

  if (type === "table") {
    if (!cleaned) return [];
    return createTableBlockFromJson(cleaned);
  }

  if (!cleaned) return [];

  // Even if AI forgets to split a long prose section into several ::paragraph blocks,
  // keep the clean model: one real paragraph = one ARTales paragraph block.
  if (type === "paragraph") {
    return splitIntoParagraphCandidates(cleaned).map((paragraph) =>
      createBlock(
        "paragraph",
        compactInlineText(paragraph),
        "Parser: vloženo podle ARTales značky ::paragraph.",
      ),
    );
  }

  return [
    createBlock(
      type,
      normalizeContentForType(type, cleaned),
      `Parser: vloženo podle ARTales značky ::${type}.`,
    ),
  ];
}

function parseMarkedTextToWorkBlocks(text: string): WorkBlock[] {
  const blocks: WorkBlock[] = [];
  const lines = text.split("\n");

  let currentType: WorkBlockType | null = null;
  let buffer: string[] = [];

  function flush() {
    if (!currentType) return;
    blocks.push(...createMarkedBlocks(currentType, buffer.join("\n")));
    buffer = [];
  }

  for (const line of lines) {
    const tag = readMarkupTag(line);

    if (tag) {
      flush();
      currentType = tag;
      buffer = [];
      continue;
    }

    if (!currentType) {
      // Text before the first marker is not thrown away. It becomes conservative paragraph text.
      if (line.trim()) buffer.push(line);
      continue;
    }

    buffer.push(line);
  }

  if (!currentType && buffer.join("\n").trim()) {
    return splitIntoParagraphCandidates(buffer.join("\n")).map((paragraph) =>
      createBlock(
        "paragraph",
        compactInlineText(paragraph),
        "Parser: text před první značkou převeden jako odstavec.",
      ),
    );
  }

  flush();

  return blocks.filter(
    (block) =>
      block.content.trim() !== "" ||
      block.type === "separator" ||
      block.type === "image" ||
      block.type === "table",
  );
}

function isSeparator(lines: string[]) {
  if (lines.length !== 1) return false;
  return /^(\*\s*){3,}$/.test(lines[0]) || /^[-—–]{3,}$/.test(lines[0]);
}

function isBookPart(lines: string[]) {
  if (lines.length > 2) return false;
  const text = compactInlineText(lines.join("\n"));

  return /^(část|cast|part|book|kniha)\b/i.test(text) && text.length <= 90;
}

function isStrongPrefaceHeading(lines: string[]) {
  if (lines.length !== 1) return null;
  const text = lines[0].trim();

  if (/^(předmluva|predmluva|preface)$/i.test(text)) return "preface" as const;
  if (/^(doslov|afterword)$/i.test(text)) return "afterword" as const;
  if (/^(věnování|venovani|dedication)$/i.test(text))
    return "dedication" as const;
  if (/^(poděkování|podekovani|acknowledgement|acknowledgments)$/i.test(text))
    return "acknowledgement" as const;

  return null;
}

function isChapterHeading(lines: string[], index: number) {
  if (lines.length > 2) return false;

  const text = compactInlineText(lines.join("\n"));
  if (!text || text.length > 120) return false;

  if (/^(kapitola|chapter)\s+([0-9ivxlcdm]+|[a-z]+)\b/i.test(text)) return true;
  if (/^(prolog|epilog|úvod|uvod)$/i.test(text)) return true;
  if (/^[IVXLCDM]{1,8}\.?$/i.test(text)) return true;
  if (/^\d{1,3}\.?$/.test(text)) return true;
  if (/^\d{1,3}[.)]\s+\S+/.test(text)) return true;

  const looksLikeTitle =
    index === 0 &&
    text.length <= 80 &&
    !/[.!?…]$/.test(text) &&
    text.split(/\s+/).length <= 10;

  return looksLikeTitle;
}

function isPlaceLine(lines: string[]) {
  if (lines.length !== 1) return false;
  const text = lines[0];

  return (
    text.length <= 90 &&
    (/\b(1[5-9]\d{2}|20\d{2})\b/.test(text) ||
      /,\s*[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž]+\.?$/.test(text)) &&
    !/[!?]$/.test(text)
  );
}

function isQuote(lines: string[]) {
  const text = compactInlineText(lines.join("\n"));
  if (text.length > 500) return false;

  const looksLikeDialogue =
    /^([„“\"'‚‘’»«]|—\s*)/.test(text) &&
    /[,!?…][“\"'‘’»«]?\s+(řekl|řekla|pravil|pravila|odpověděl|odpověděla|zeptal|zeptala|zvolal|zvolala|said|asked|answered|replied)\b/i.test(
      text,
    );

  if (looksLikeDialogue) return false;

  const looksLikeEpigraph =
    lines.length <= 4 &&
    (/^([„“\"'‚‘’»«])/.test(text) || /[“\"'‘’»«]$/.test(text)) &&
    !/[.!?…][“\"'‘’»«]?\s+[a-záčďéěíňóřšťúůýž]/.test(text);

  return looksLikeEpigraph;
}

function isImagePlaceholder(lines: string[]) {
  if (lines.length > 4) return false;
  const text = compactInlineText(lines.join("\n"));

  return (
    /^(obrázek|obrazek|ilustrace|mapa|tabule|figure|fig\.|image|illustration|plate)\b/i.test(
      text,
    ) || /^\[(obrázek|obrazek|ilustrace|image|figure)[^\]]*\]$/i.test(text)
  );
}

function isLikelyPoem(lines: string[]) {
  if (lines.length < 3) return false;
  if (lines.length > 40) return false;

  const averageLength =
    lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
  const shortLines = lines.filter((line) => line.length <= 70).length;
  const terminalPunctuation = lines.filter((line) =>
    /[.!?…]$/.test(line),
  ).length;

  return (
    averageLength <= 58 &&
    shortLines / lines.length >= 0.8 &&
    terminalPunctuation / lines.length < 0.75
  );
}

function blockFromCandidate(candidate: string, index: number): WorkBlock {
  const lines = getNonEmptyLines(candidate);

  if (lines.length === 0) {
    return createBlock("paragraph", "");
  }

  if (isSeparator(lines)) {
    return createBlock("separator", "* * *", "Parser: rozpoznaný předěl.");
  }

  if (isImagePlaceholder(lines)) {
    return createImagePlaceholderBlock(
      candidate,
      "Parser: rozpoznané místo pro obrázek. Nahraj asset před publikací.",
    );
  }

  const strongIntroBlock = isStrongPrefaceHeading(lines);
  if (strongIntroBlock) {
    return createBlock(
      strongIntroBlock,
      compactInlineText(candidate),
      "Parser: rozpoznaný jasný úvodní/závěrečný blok.",
    );
  }

  if (isBookPart(lines)) {
    return createBlock(
      "book_part",
      compactInlineText(candidate),
      "Parser: rozpoznaná část knihy.",
    );
  }

  if (isChapterHeading(lines, index)) {
    return createBlock(
      "chapter",
      compactInlineText(candidate),
      "Parser: rozpoznaný nadpis / kapitola.",
    );
  }

  if (isPlaceLine(lines)) {
    return createBlock(
      "place_line",
      compactInlineText(candidate),
      "Parser: možná datace / místo.",
    );
  }

  if (isLikelyPoem(lines)) {
    return createBlock(
      "poem",
      lines.join("\n"),
      "Parser: pravděpodobně veršovaný blok. Zkontrolovat ručně.",
    );
  }

  if (isQuote(lines)) {
    return createBlock(
      "quote",
      compactInlineText(candidate),
      "Parser: pravděpodobná citace / motto.",
    );
  }

  return createBlock("paragraph", compactInlineText(candidate));
}

function calculateStats(
  blocks: WorkBlock[],
  usedMarkup: boolean,
): ParsedWorkBlocksResult["stats"] {
  return {
    totalBlocks: blocks.length,
    chapters: blocks.filter(
      (block) => block.type === "chapter" || block.type === "book_part",
    ).length,
    paragraphs: blocks.filter((block) => block.type === "paragraph").length,
    poems: blocks.filter((block) => block.type === "poem").length,
    separators: blocks.filter((block) => block.type === "separator").length,
    quotes: blocks.filter((block) => block.type === "quote").length,
    placeLines: blocks.filter((block) => block.type === "place_line").length,
    images: blocks.filter((block) => block.type === "image").length,
    tables: blocks.filter((block) => block.type === "table").length,
    markedBlocks: usedMarkup ? blocks.length : 0,
  };
}

export function parseRawTextToWorkBlocks(
  rawText: string,
): ParsedWorkBlocksResult {
  const text = normalizeRawText(rawText);

  if (!text) {
    return {
      blocks: [],
      usedMarkup: false,
      stats: calculateStats([], false),
    };
  }

  const usedMarkup = hasRecognizedMarkup(text);
  const blocks = usedMarkup
    ? parseMarkedTextToWorkBlocks(text)
    : splitIntoParagraphCandidates(text)
        .map((candidate, index) => blockFromCandidate(candidate, index))
        .filter(
          (block) =>
            block.content.trim() !== "" ||
            block.type === "image" ||
            block.type === "table",
        );

  return {
    blocks,
    usedMarkup,
    stats: calculateStats(blocks, usedMarkup),
  };
}
