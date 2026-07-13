import type { ReactNode } from "react"
import type { WorkBlock } from "@/lib/blocks"
import { WORK_BLOCK_TYPE_META } from "@/lib/blocks"
import { getBlockFormatPreset, type BlockFormatPresetId } from "@/lib/rendering/blockFormats"
import { getPublicStorageImageUrl } from "@/lib/storageImages"
import "./work-content-renderer.css"

type Props = {
  blocks: WorkBlock[]
  fallbackContent?: string | null
  className?: string
  formatPreset?: BlockFormatPresetId
  footnotesLabel?: string
}

type RenderBlockProps = {
  block: WorkBlock
  index: number
  footnoteNumberByBlockId: Map<string, number>
}

function getBlockText(block: WorkBlock): string {
  if (block.type === "letter") {
    return String(block.fields?.body ?? block.content ?? "").trim()
  }

  return String(block.content ?? "").trim()
}

function getLetterField(block: WorkBlock, fieldName: string): string {
  return String(block.fields?.[fieldName] ?? "").trim()
}

function getImageField(block: WorkBlock, fieldName: string): string {
  return String(block.fields?.[fieldName] ?? "").trim()
}

function getStableBlockKey(block: WorkBlock, index: number): string {
  return block.id?.trim() ? block.id : `${block.type}-${index}`
}

function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function normalizeInlineMarkup(text: string) {
  return text
    .replace(/&lt;(\/?(?:em|i))&gt;/gi, "<$1>")
    .replace(/<\s*(em|i)\s*>/gi, "<$1>")
    .replace(/<\s*\/\s*(em|i)\s*>/gi, "</$1>")
}

function renderInlineRichText(text: string) {
  const normalizedText = normalizeInlineMarkup(text)
  const parts: ReactNode[] = []
  const pattern = /<(em|i)>([\s\S]*?)<\/\1>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(normalizedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(normalizedText.slice(lastIndex, match.index))
    }

    parts.push(<em key={`em-${match.index}`}>{match[2]}</em>)
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < normalizedText.length) {
    parts.push(normalizedText.slice(lastIndex))
  }

  return parts.length > 0 ? parts : normalizedText
}

function renderMultiParagraphText(text: string, className?: string) {
  const paragraphs = splitParagraphs(text)

  if (paragraphs.length === 0) return null

  return paragraphs.map((paragraph, index) => (
    <p key={index} className={className}>
      {renderInlineRichText(paragraph)}
    </p>
  ))
}

function splitHeadingLines(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function renderChapterHeading(text: string) {
  const lines = splitHeadingLines(text)

  if (lines.length <= 1) {
    return <h3>{renderInlineRichText(text)}</h3>
  }

  const [kicker, ...titleLines] = lines
  const title = titleLines.join(" ")

  return (
    <h3>
      <span className="artales-chapter-kicker">
        {renderInlineRichText(kicker)}
      </span>
      <span className="artales-chapter-title">
        {renderInlineRichText(title)}
      </span>
    </h3>
  )
}

function renderBlock({ block, index, footnoteNumberByBlockId }: RenderBlockProps) {
  const key = getStableBlockKey(block, index)
  const text = getBlockText(block)
  const meta = WORK_BLOCK_TYPE_META[block.type]

  if (block.type !== "separator" && block.type !== "image" && text === "") return null

  switch (block.type) {
    case "book_part":
      return (
        <section
          key={key}
          className="artales-block artales-book-part"
          data-block-type={block.type}
          aria-label={meta.internalLabel}
        >
          <h2>{renderInlineRichText(text)}</h2>
        </section>
      )

    case "chapter":
      return (
        <section
          key={key}
          className="artales-block artales-chapter"
          data-block-type={block.type}
          aria-label={meta.internalLabel}
        >
          {renderChapterHeading(text)}
        </section>
      )

    case "headline":
      return (
        <section key={key} className="artales-block artales-headline" data-block-type={block.type}>
          <h4>{renderInlineRichText(text)}</h4>
        </section>
      )

    case "paragraph":
      return (
        <section key={key} className="artales-block artales-paragraph" data-block-type={block.type}>
          {renderMultiParagraphText(text)}
        </section>
      )

    case "quote":
      return (
        <blockquote key={key} className="artales-block artales-quote" data-block-type={block.type}>
          {renderMultiParagraphText(text)}
        </blockquote>
      )

    case "poem":
      return (
        <section key={key} className="artales-block artales-poem" data-block-type={block.type}>
          <div className="artales-poem-text">{renderInlineRichText(text)}</div>
        </section>
      )

    case "letter": {
      const placeYear = getLetterField(block, "place_year")
      const dateSignature = getLetterField(block, "date_signature")

      return (
        <section key={key} className="artales-block artales-letter" data-block-type={block.type}>
          {placeYear ? <p className="artales-letter-place-year">{renderInlineRichText(placeYear)}</p> : null}
          <div className="artales-letter-body">{renderMultiParagraphText(text)}</div>
          {dateSignature ? (
            <p className="artales-letter-date-signature">{renderInlineRichText(dateSignature)}</p>
          ) : null}
        </section>
      )
    }

    case "newspaper_article":
      return (
        <article key={key} className="artales-block artales-newspaper" data-block-type={block.type}>
          {renderMultiParagraphText(text)}
        </article>
      )

    case "place_line":
      return (
        <p key={key} className="artales-block artales-place-line" data-block-type={block.type}>
          {renderInlineRichText(text)}
        </p>
      )

    case "separator":
      return (
        <div
          key={key}
          className="artales-block artales-separator"
          data-block-type={block.type}
          aria-hidden="true"
        >
          <span>{renderInlineRichText(text || "* * *")}</span>
        </div>
      )


    case "image": {
      const storagePath = getImageField(block, "storage_path") || text
      const imageUrl = getPublicStorageImageUrl(storagePath)
      const caption = getImageField(block, "caption")
      const alt = getImageField(block, "alt") || caption || "ARTales image"
      const alignment = getImageField(block, "alignment") || "center"
      const size = getImageField(block, "size") || "normal"

      if (!imageUrl) return null

      return (
        <figure
          key={key}
          className={`artales-block artales-image artales-image--${alignment} artales-image--${size}`}
          data-block-type={block.type}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Rich text images use Supabase Storage URLs and keep their natural aspect ratio. */}
          <img src={imageUrl} alt={alt} loading="lazy" />
          {caption ? <figcaption>{renderInlineRichText(caption)}</figcaption> : null}
        </figure>
      )
    }

    case "note":
      return (
        <aside key={key} className="artales-block artales-note" data-block-type={block.type}>
          <strong>Note</strong>
          {renderMultiParagraphText(text)}
        </aside>
      )

    case "footnote": {
      const number = footnoteNumberByBlockId.get(block.id) ?? 0

      return (
        <aside
          key={key}
          id={`footnote-ref-${number}`}
          className="artales-block artales-footnote-ref"
          data-block-type={block.type}
        >
          <sup>{number}</sup>
          <span>{renderInlineRichText(text)}</span>
        </aside>
      )
    }

    case "dedication":
      return (
        <section key={key} className="artales-block artales-dedication" data-block-type={block.type}>
          {renderMultiParagraphText(text)}
        </section>
      )

    case "preface":
      return (
        <section key={key} className="artales-block artales-preface" data-block-type={block.type}>
          {renderMultiParagraphText(text)}
        </section>
      )

    case "afterword":
      return (
        <section key={key} className="artales-block artales-afterword" data-block-type={block.type}>
          {renderMultiParagraphText(text)}
        </section>
      )

    case "acknowledgement":
      return (
        <section key={key} className="artales-block artales-acknowledgement" data-block-type={block.type}>
          {renderMultiParagraphText(text)}
        </section>
      )

    default:
      return null
  }
}

export default function WorkContentRenderer({
  blocks,
  fallbackContent,
  className,
  formatPreset = "defaultReader",
  footnotesLabel = "Footnotes",
}: Props) {
  const preset = getBlockFormatPreset(formatPreset)
  const safeBlocks = Array.isArray(blocks) ? blocks : []
  const visibleBlocks = safeBlocks.filter((block) => {
    if (block.type === "separator") return true
    if (block.type === "image") {
      return getImageField(block, "storage_path") !== "" || getBlockText(block) !== ""
    }
    return getBlockText(block) !== ""
  })

  const footnoteBlocks = visibleBlocks.filter((block) => block.type === "footnote")
  const footnoteNumberByBlockId = new Map<string, number>(
    footnoteBlocks.map((block, index) => [block.id, index + 1])
  )

  if (visibleBlocks.length === 0 && fallbackContent?.trim()) {
    return (
      <article
      className={["artales-work-content", preset.className, className]
        .filter(Boolean)
        .join(" ")}
      data-format-preset={preset.id}
    >
        <section className="artales-block artales-paragraph" data-block-type="fallback_content">
          {renderMultiParagraphText(fallbackContent)}
        </section>
      </article>
    )
  }

  return (
    <article
      className={["artales-work-content", preset.className, className]
        .filter(Boolean)
        .join(" ")}
      data-format-preset={preset.id}
    >
      {visibleBlocks.map((block, index) =>
        renderBlock({ block, index, footnoteNumberByBlockId })
      )}

      {footnoteBlocks.length > 0 ? (
        <section className="artales-footnotes" aria-label={footnotesLabel}>
          <h3>{footnotesLabel}</h3>
          <ol>
            {footnoteBlocks.map((block, index) => (
              <li key={getStableBlockKey(block, index)} id={`footnote-${index + 1}`}>
                {renderInlineRichText(getBlockText(block))}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  )
}
