"use client"

import { useState } from "react"
import Image from "next/image"
import ArtalesBrand from "@/components/brand/ArtalesBrand"
import { getPublicStorageImageUrl } from "@/lib/storageImages"

type StorageImageDisplayVariant = "author-portrait" | "collection-cover" | "editor-preview"

type StorageImageDisplayProps = {
  imagePath?: string | null
  alt?: string | null
  caption?: string | null
  title: string
  variant?: StorageImageDisplayVariant
}

function getVariantClassName(variant: StorageImageDisplayVariant) {
  if (variant === "author-portrait") return "artales-storage-image--author"
  if (variant === "collection-cover") return "artales-storage-image--collection"
  return "artales-storage-image--editor"
}

export default function StorageImageDisplay({
  imagePath,
  alt,
  caption,
  title,
  variant = "editor-preview",
}: StorageImageDisplayProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const imageUrl = getPublicStorageImageUrl(imagePath)
  const shouldShowImage = Boolean(imageUrl) && !hasImageError

  return (
    <figure className={`artales-storage-image ${getVariantClassName(variant)}`}>
      <div className="artales-storage-image__frame">
        {shouldShowImage && imageUrl ? (
          <Image
            src={imageUrl}
            alt={alt?.trim() || title}
            fill
            sizes={
              variant === "author-portrait"
                ? "(max-width: 720px) 180px, 220px"
                : "(max-width: 720px) 90vw, 360px"
            }
            className="artales-storage-image__img"
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div className="artales-storage-image__placeholder" aria-hidden="true">
            <ArtalesBrand href="" variant="dark" size="md" showMark />
            <span>{title}</span>
          </div>
        )}
      </div>

      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}
