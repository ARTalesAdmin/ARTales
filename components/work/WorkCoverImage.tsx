"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import ArtalesBrand from "@/components/brand/ArtalesBrand"
import { getPublicStorageImageUrl } from "@/lib/storageImages"

type WorkCoverImageProps = {
  title: string
  imagePath?: string | null
  alt?: string | null
  caption?: string | null
  variant?: "detail" | "card"
}

export default function WorkCoverImage({
  title,
  imagePath,
  alt,
  caption,
  variant = "detail",
}: WorkCoverImageProps) {
  const imageUrl = getPublicStorageImageUrl(imagePath)
  const [hasImageError, setHasImageError] = useState(false)
  const isCard = variant === "card"
  const minHeight = isCard ? 270 : 460
  const shouldShowImage = Boolean(imageUrl) && !hasImageError

  useEffect(() => {
    setHasImageError(false)
  }, [imageUrl])

  return (
    <figure
      style={{
        margin: 0,
        display: "grid",
        gap: caption && !isCard ? "10px" : 0,
      }}
    >
      <div
        aria-label={shouldShowImage ? undefined : "Work cover placeholder"}
        style={{
          position: "relative",
          minHeight: `${minHeight}px`,
          overflow: "hidden",
          border: "1px solid rgba(217, 183, 110, 0.3)",
          borderRadius: isCard ? "18px" : "24px",
          background:
            "radial-gradient(circle at top, rgba(217, 183, 110, 0.26), transparent 18rem), linear-gradient(145deg, #111827 0%, #090b0d 70%)",
          boxShadow: isCard ? "0 14px 34px rgba(5, 7, 12, 0.12)" : "0 24px 70px rgba(5, 7, 12, 0.22)",
        }}
      >
        {shouldShowImage && imageUrl ? (
          <Image
            src={imageUrl}
            alt={alt?.trim() || `Cover image for ${title}`}
            fill
            sizes={isCard ? "(max-width: 768px) 100vw, 320px" : "(max-width: 768px) 100vw, 380px"}
            style={{
              objectFit: "cover",
            }}
            priority={!isCard}
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div
            style={{
              minHeight: `${minHeight}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isCard ? "22px" : "34px",
              textAlign: "center",
            }}
          >
            <div style={{ display: "grid", justifyItems: "center", gap: "18px" }}>
              <ArtalesBrand href="" variant="dark" size={isCard ? "sm" : "md"} showMark />
              <div>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: "12px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "rgba(241, 216, 157, 0.72)",
                  }}
                >
                  ARTales Edition
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: isCard ? "24px" : "31px",
                    lineHeight: 1.13,
                    color: "#fff8e7",
                  }}
                >
                  {title}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {caption && !isCard ? (
        <figcaption
          style={{
            fontSize: "13px",
            color: "#6f6257",
            lineHeight: 1.5,
          }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
