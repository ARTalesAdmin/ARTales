"use client"

import WorkContentRenderer from "@/components/work/WorkContentRenderer"
import type { WorkBlock } from "@/lib/blocks"

type WorkReaderOverlayProps = {
  isOpen: boolean
  mode: "preview" | "full"
  title: string
  authorName?: string | null
  blocks: WorkBlock[]
  fallbackContent?: string | null
  onClose: () => void
  onContinueReading?: () => void
}

export default function WorkReaderOverlay({
  isOpen,
  mode,
  title,
  authorName,
  blocks,
  fallbackContent,
  onClose,
  onContinueReading,
}: WorkReaderOverlayProps) {
  if (!isOpen) return null

  const isPreview = mode === "preview"

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isPreview ? "Read preview" : "Read online"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(12, 10, 8, 0.72)",
        padding: "20px",
      }}
    >
      <div
        style={{
          minHeight: "100%",
          maxHeight: "100%",
          overflow: "hidden",
          background: "#fbfaf7",
          color: "#17130f",
          border: "1px solid rgba(23, 19, 15, 0.16)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "18px 24px",
            borderBottom: "1px solid rgba(23, 19, 15, 0.12)",
            background: "rgba(255, 255, 255, 0.7)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: "12px",
                lineHeight: 1.2,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#7a6b5d",
              }}
            >
              {isPreview ? "Preview" : "Online reader"}
            </p>
            <h2
              style={{
                margin: 0,
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(20px, 3vw, 30px)",
                lineHeight: 1.15,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </h2>
            {authorName ? (
              <p style={{ margin: "4px 0 0", color: "#6b5f54", fontSize: "14px" }}>
                by {authorName}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close reader"
            style={{
              flex: "0 0 auto",
              width: "42px",
              height: "42px",
              borderRadius: "999px",
              border: "1px solid rgba(23, 19, 15, 0.28)",
              background: "#fff",
              color: "#17130f",
              cursor: "pointer",
              fontSize: "24px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            flex: "1 1 auto",
            overflow: "auto",
            padding: "clamp(24px, 5vw, 56px) clamp(18px, 6vw, 72px)",
          }}
        >
          <WorkContentRenderer blocks={blocks} fallbackContent={fallbackContent} />

          {isPreview ? (
            <div
              style={{
                maxWidth: "760px",
                margin: "40px auto 0",
                padding: "28px",
                borderTop: "1px solid rgba(23, 19, 15, 0.14)",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 16px", color: "#6b5f54" }}>
                This is a short preview. Continue to the full online reader.
              </p>
              <button
                type="button"
                onClick={onContinueReading}
                style={{
                  padding: "13px 20px",
                  border: "1px solid #17130f",
                  background: "#17130f",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Continue reading
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
