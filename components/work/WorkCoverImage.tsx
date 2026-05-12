import Image from "next/image"
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
  const isCard = variant === "card"
  const minHeight = isCard ? 260 : 440

  return (
    <figure
      style={{
        margin: 0,
        display: "grid",
        gap: caption && !isCard ? "10px" : 0,
      }}
    >
      <div
        aria-label={imageUrl ? undefined : "Work cover placeholder"}
        style={{
          position: "relative",
          minHeight: `${minHeight}px`,
          overflow: "hidden",
          border: "1px solid rgba(23, 19, 15, 0.16)",
          background:
            "linear-gradient(145deg, #f2eadf 0%, #d9cbb9 46%, #b9a48d 100%)",
          boxShadow: isCard ? "none" : "0 18px 45px rgba(23, 19, 15, 0.12)",
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={alt?.trim() || `Cover image for ${title}`}
            fill
            sizes={isCard ? "(max-width: 768px) 100vw, 320px" : "(max-width: 768px) 100vw, 360px"}
            style={{
              objectFit: "cover",
            }}
            priority={!isCard}
          />
        ) : (
          <div
            style={{
              minHeight: `${minHeight}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isCard ? "20px" : "28px",
              textAlign: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "12px",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(23, 19, 15, 0.58)",
                }}
              >
                ARTales Edition
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: isCard ? "24px" : "28px",
                  lineHeight: 1.15,
                  color: "#17130f",
                }}
              >
                {title}
              </p>
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
