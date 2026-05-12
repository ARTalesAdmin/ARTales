import Link from "next/link"
import { notFound } from "next/navigation"
import ArtalesBrand from "@/components/brand/ArtalesBrand"
import WorkContentRenderer from "@/components/work/WorkContentRenderer"
import { getWorkBySlug } from "@/lib/dbWorks"
import { getPublicDictionary } from "@/lib/i18n/public"
import { getPreviewBlocks, getPreviewFallbackContent } from "@/lib/workPreview"

type ReaderPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ mode?: string }>
}

export const dynamic = "force-dynamic"

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  const { slug } = await params
  const { mode } = await searchParams
  const work = await getWorkBySlug(slug)

  if (!work) {
    notFound()
  }

  const { public: publicText, reader } = getPublicDictionary()
  const isPreview = mode !== "full"
  const blocks = isPreview ? getPreviewBlocks(work.content_blocks) : work.content_blocks
  const fallbackContent = isPreview
    ? getPreviewFallbackContent(work.content)
    : work.content

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(217, 183, 110, 0.2), transparent 30rem), linear-gradient(180deg, #090b0d 0%, #0d1528 100%)",
        color: "#fff8e7",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <header
        style={{
          alignItems: "center",
          display: "flex",
          gap: "18px",
          justifyContent: "space-between",
          padding: "18px clamp(18px, 4vw, 42px)",
          borderBottom: "1px solid rgba(217, 183, 110, 0.18)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(18px)",
          background: "rgba(9, 11, 13, 0.72)",
        }}
      >
        <ArtalesBrand variant="dark" size="sm" showMark />
        <div
          style={{
            minWidth: 0,
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 3px",
              color: "rgba(241, 216, 157, 0.72)",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {isPreview ? reader.preview : reader.onlineReader}
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(18px, 3vw, 28px)",
              lineHeight: 1.12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "52vw",
            }}
          >
            {work.title}
          </h1>
          {work.author?.name ? (
            <p style={{ margin: "3px 0 0", color: "rgba(255, 248, 231, 0.7)", fontSize: "13px" }}>
              {publicText.byAuthor} {work.author.name}
            </p>
          ) : null}
        </div>
        <Link
          href={`/dilo/${work.slug}`}
          style={{
            border: "1px solid rgba(241, 216, 157, 0.34)",
            borderRadius: "999px",
            color: "#fff8e7",
            fontWeight: 800,
            padding: "0.68rem 0.9rem",
            textDecoration: "none",
          }}
        >
          × {reader.exitReader}
        </Link>
      </header>

      <section
        style={{
          padding: "clamp(24px, 5vw, 58px) clamp(14px, 4vw, 42px) clamp(52px, 7vw, 92px)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #fffaf0 0%, #fbf5ea 100%)",
            border: "1px solid rgba(217, 183, 110, 0.28)",
            borderRadius: "28px",
            boxShadow: "var(--artales-shadow)",
            color: "#17130f",
            margin: "0 auto",
            maxWidth: "920px",
            minHeight: "min(78vh, 1120px)",
            padding: "clamp(34px, 6vw, 76px) clamp(22px, 7vw, 96px)",
          }}
        >
          <WorkContentRenderer
            blocks={blocks}
            fallbackContent={fallbackContent}
            formatPreset="editionClassic"
          />

          {isPreview ? (
            <div
              style={{
                borderTop: "1px solid rgba(13, 21, 40, 0.14)",
                margin: "44px auto 0",
                maxWidth: "700px",
                paddingTop: "28px",
                textAlign: "center",
              }}
            >
              <p style={{ color: "#5f5247", margin: "0 0 18px" }}>
                {reader.previewCta}
              </p>
              <Link className="artales-button" href={`/reader/${work.slug}?mode=full`}>
                {reader.continueReading}
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
