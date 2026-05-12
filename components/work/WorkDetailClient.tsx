"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { WorkDetailItem } from "@/lib/dbWorks"
import {
  getPreviewBlocks,
  getPreviewFallbackContent,
} from "@/lib/workPreview"
import WorkReaderOverlay from "@/components/work/WorkReaderOverlay"
import WorkCoverImage from "@/components/work/WorkCoverImage"

type ReaderMode = "preview" | "full" | null

type WorkDetailClientProps = {
  work: WorkDetailItem
  languageLabel: string
  statusLabel: string
  originLabel: string
  sourceLabel: string
}

function ActionButton({
  children,
  variant = "secondary",
  disabled = false,
  onClick,
  title,
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "ghost"
  disabled?: boolean
  onClick?: () => void
  title?: string
}) {
  const isPrimary = variant === "primary"
  const isGhost = variant === "ghost"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "12px 17px",
        border: isPrimary ? "1px solid #17130f" : "1px solid rgba(23, 19, 15, 0.22)",
        background: disabled ? "#f4f1ed" : isPrimary ? "#17130f" : isGhost ? "#fff" : "#fbfaf7",
        color: disabled ? "#8b8177" : isPrimary ? "#fff" : "#17130f",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        opacity: disabled ? 0.82 : 1,
      }}
    >
      {children}
    </button>
  )
}

function ComingSoonBadge() {
  return (
    <span
      style={{
        marginLeft: "8px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "#8b8177",
      }}
    >
      Coming soon
    </span>
  )
}

export default function WorkDetailClient({
  work,
  languageLabel,
  statusLabel,
  originLabel,
  sourceLabel,
}: WorkDetailClientProps) {
  const [readerMode, setReaderMode] = useState<ReaderMode>(null)
  const previewBlocks = useMemo(() => getPreviewBlocks(work.content_blocks), [work.content_blocks])
  const previewFallbackContent = useMemo(
    () => getPreviewFallbackContent(work.content),
    [work.content]
  )
  const authorName = work.author?.name ?? "Unknown author"

  return (
    <main
      style={{
        padding: "42px 24px 56px",
        fontFamily: "Arial, Helvetica, sans-serif",
        lineHeight: 1.6,
        maxWidth: "1180px",
        margin: "0 auto",
        color: "#17130f",
      }}
    >
      <p style={{ margin: "0 0 22px" }}>
        <Link href="/galerie" style={{ color: "#5f5247" }}>
          {"<- Back to Gallery"}
        </Link>
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 320px) minmax(0, 1fr)",
          gap: "clamp(24px, 5vw, 56px)",
          alignItems: "start",
          marginBottom: "36px",
        }}
      >
        <aside>
          <WorkCoverImage
            title={work.title}
            imagePath={work.cover_image_path}
            alt={work.cover_image_alt}
            caption={work.cover_image_caption}
            variant="detail"
          />
        </aside>

        <div>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: "13px",
              color: "#7a6b5d",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 700,
            }}
          >
            {originLabel}
          </p>

          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(38px, 6vw, 68px)",
              lineHeight: 1.02,
              margin: "0 0 14px",
              letterSpacing: "-0.04em",
            }}
          >
            {work.title}
          </h1>

          {work.subtitle ? (
            <p style={{ margin: "0 0 12px", fontSize: "20px", color: "#5f5247" }}>
              {work.subtitle}
            </p>
          ) : null}

          <p style={{ margin: "0 0 18px", fontSize: "18px" }}>
            by{" "}
            {work.author ? (
              <Link href={`/autor/${work.author.slug}`} style={{ color: "#17130f", fontWeight: 700 }}>
                {work.author.name}
              </Link>
            ) : (
              <strong>Unknown author</strong>
            )}
          </p>

          <p
            style={{
              margin: "0 0 24px",
              fontSize: "18px",
              maxWidth: "760px",
              color: "#3f362f",
            }}
          >
            {work.summary}
          </p>

          {work.collection ? (
            <p style={{ margin: "0 0 22px", color: "#5f5247" }}>
              Part of{" "}
              <Link href={`/kolekce/${work.collection.slug}`} style={{ color: "#17130f", fontWeight: 700 }}>
                {work.collection.title}
              </Link>
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "20px",
            }}
          >
            <ActionButton variant="primary" onClick={() => setReaderMode("preview")}>
              Read preview
            </ActionButton>
            <ActionButton onClick={() => setReaderMode("full")}>
              Read online
            </ActionButton>
            <ActionButton disabled title="User accounts will enable saved works later.">
              Save for later <ComingSoonBadge />
            </ActionButton>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "12px",
            }}
          >
            <ActionButton disabled>
              Buy PDF <ComingSoonBadge />
            </ActionButton>
            <ActionButton disabled>
              Buy EPUB <ComingSoonBadge />
            </ActionButton>
            <ActionButton disabled>
              Audiobook <ComingSoonBadge />
            </ActionButton>
          </div>
        </div>
      </section>

      <section
        style={{
          borderTop: "1px solid rgba(23, 19, 15, 0.14)",
          borderBottom: "1px solid rgba(23, 19, 15, 0.14)",
          padding: "18px 0",
          marginBottom: "32px",
        }}
      >
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 800,
              fontSize: "18px",
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            About this edition
          </summary>

          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(140px, 220px) minmax(0, 1fr)",
              gap: "8px 20px",
              margin: "18px 0 0",
              color: "#3f362f",
            }}
          >
            <dt style={{ fontWeight: 700 }}>Author</dt>
            <dd style={{ margin: 0 }}>{authorName}</dd>

            <dt style={{ fontWeight: 700 }}>Language</dt>
            <dd style={{ margin: 0 }}>{languageLabel}</dd>

            <dt style={{ fontWeight: 700 }}>Edition type</dt>
            <dd style={{ margin: 0 }}>{originLabel}</dd>

            <dt style={{ fontWeight: 700 }}>Source</dt>
            <dd style={{ margin: 0 }}>{sourceLabel}</dd>

            {work.source_reference ? (
              <>
                <dt style={{ fontWeight: 700 }}>Reference</dt>
                <dd style={{ margin: 0 }}>{work.source_reference}</dd>
              </>
            ) : null}

            <dt style={{ fontWeight: 700 }}>Publication status</dt>
            <dd style={{ margin: 0 }}>{statusLabel}</dd>
          </dl>
        </details>
      </section>

      {work.author?.bio ? (
        <section style={{ marginBottom: "32px", maxWidth: "780px" }}>
          <h2
            style={{
              margin: "0 0 12px",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "28px",
            }}
          >
            About the author
          </h2>
          <p style={{ margin: 0, color: "#3f362f" }}>{work.author.bio}</p>
        </section>
      ) : null}

      {work.collection?.description ? (
        <section style={{ marginBottom: "32px", maxWidth: "780px" }}>
          <h2
            style={{
              margin: "0 0 12px",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "28px",
            }}
          >
            About the collection
          </h2>
          <p style={{ margin: 0, color: "#3f362f" }}>{work.collection.description}</p>
        </section>
      ) : null}

      <WorkReaderOverlay
        isOpen={readerMode === "preview"}
        mode="preview"
        title={work.title}
        authorName={work.author?.name}
        blocks={previewBlocks}
        fallbackContent={previewFallbackContent}
        onClose={() => setReaderMode(null)}
        onContinueReading={() => setReaderMode("full")}
      />

      <WorkReaderOverlay
        isOpen={readerMode === "full"}
        mode="full"
        title={work.title}
        authorName={work.author?.name}
        blocks={work.content_blocks}
        fallbackContent={work.content}
        onClose={() => setReaderMode(null)}
      />
    </main>
  )
}
