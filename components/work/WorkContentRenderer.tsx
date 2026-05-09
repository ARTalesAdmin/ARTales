import type { WorkBlock } from "@/lib/blocks"
import { WORK_BLOCK_TYPE_META } from "@/lib/blocks"
import "./work-content-renderer.css"

type Props = {
  blocks: WorkBlock[]
  fallbackContent?: string | null
  className?: string
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

function renderMultiParagraphText(text: string, className?: string) {
  const paragraphs = splitParagraphs(text)

  if (paragraphs.length === 0) return null

  return paragraphs.map((paragraph, index) => (
    <p key={index} className={className}>
      {paragraph}
    </p>
  ))
}

function renderBlock({ block, index, footnoteNumberByBlockId }: RenderBlockProps) {
  const key = getStableBlockKey(block, index)
  const text = getBlockText(block)
  const meta = WORK_BLOCK_TYPE_META[block.type]

  if (block.type !== "separator" && text === "") return null

  switch (block.type) {
    case "book_part":
      return (
        <section
          key={key}
          className="artales-block artales-book-part"
          data-block-type={block.type}
          aria-label={meta.internalLabel}
        >
          <p className="artales-book-part-kicker">Part</p>
          <h2>{text}</h2>
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
          <h3>{text}</h3>
        </section>
      )

    case "headline":
      return (
        <section key={key} className="artales-block artales-headline" data-block-type={block.type}>
          <h4>{text}</h4>
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
          <pre>{text}</pre>
        </section>
      )

    case "letter": {
      const placeYear = getLetterField(block, "place_year")
      const dateSignature = getLetterField(block, "date_signature")

      return (
        <section key={key} className="artales-block artales-letter" data-block-type={block.type}>
          {placeYear ? <p className="artales-letter-place-year">{placeYear}</p> : null}
          <div className="artales-letter-body">{renderMultiParagraphText(text)}</div>
          {dateSignature ? (
            <p className="artales-letter-date-signature">{dateSignature}</p>
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
          {text}
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
          <span>{text || "* * *"}</span>
        </div>
      )

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
          <span>{text}</span>
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
          <h3>Preface</h3>
          {renderMultiParagraphText(text)}
        </section>
      )

    case "afterword":
      return (
        <section key={key} className="artales-block artales-afterword" data-block-type={block.type}>
          <h3>Afterword</h3>
          {renderMultiParagraphText(text)}
        </section>
      )

    case "acknowledgement":
      return (
        <section key={key} className="artales-block artales-acknowledgement" data-block-type={block.type}>
          <h3>Acknowledgement</h3>
          {renderMultiParagraphText(text)}
        </section>
      )

    default:
      return null
  }
}

export default function WorkContentRenderer({ blocks, fallbackContent, className }: Props) {
  const safeBlocks = Array.isArray(blocks) ? blocks : []
  const visibleBlocks = safeBlocks.filter((block) => {
    if (block.type === "separator") return true
    return getBlockText(block) !== ""
  })

  const footnoteBlocks = visibleBlocks.filter((block) => block.type === "footnote")
  const footnoteNumberByBlockId = new Map<string, number>(
    footnoteBlocks.map((block, index) => [block.id, index + 1])
  )

  if (visibleBlocks.length === 0 && fallbackContent?.trim()) {
    return (
      <article className={["artales-work-content", className].filter(Boolean).join(" ")}>
        <section className="artales-block artales-paragraph" data-block-type="fallback_content">
          {renderMultiParagraphText(fallbackContent)}
        </section>
      </article>
    )
  }

  return (
    <article className={["artales-work-content", className].filter(Boolean).join(" ")}>
      {visibleBlocks.map((block, index) =>
        renderBlock({ block, index, footnoteNumberByBlockId })
      )}

      {footnoteBlocks.length > 0 ? (
        <section className="artales-footnotes" aria-label="Footnotes">
          <h3>Footnotes</h3>
          <ol>
            {footnoteBlocks.map((block, index) => (
              <li key={getStableBlockKey(block, index)} id={`footnote-${index + 1}`}>
                {getBlockText(block)}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  )
}
