"use client";

import { useState } from "react";
import Image from "next/image";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { getPublicStorageImageUrl } from "@/lib/storageImages";

type WorkCoverImageProps = {
  title: string;
  imagePath?: string | null;
  alt?: string | null;
  caption?: string | null;
  variant?: "detail" | "card";
};

function WorkCoverImageFrame({
  title,
  imageUrl,
  alt,
  caption,
  variant,
}: {
  title: string;
  imageUrl: string | null;
  alt?: string | null;
  caption?: string | null;
  variant: "detail" | "card";
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const isCard = variant === "card";
  const coverClassName = `artales-work-cover artales-work-cover--${variant}`;
  const shouldShowImage = Boolean(imageUrl) && !hasImageError;

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
        className={coverClassName}
        style={{
          background: shouldShowImage
            ? "#f3eadc"
            : "radial-gradient(circle at top, rgba(217, 183, 110, 0.34), transparent 18rem), linear-gradient(145deg, #fff8e8 0%, #ead9b8 100%)",
        }}
      >
        {shouldShowImage && imageUrl ? (
          <Image
            src={imageUrl}
            alt={alt?.trim() || `Cover image for ${title}`}
            fill
            sizes={
              isCard
                ? "(max-width: 768px) 100vw, 320px"
                : "(max-width: 768px) 100vw, 380px"
            }
            style={{ objectFit: "cover" }}
            priority={!isCard}
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div className={isCard ? "artales-cover-placeholder artales-cover-placeholder--card" : "artales-cover-placeholder"}>
            {isCard ? (
              <div className="artales-cover-placeholder__small-edition">
                <span>ARTales</span>
                <span>Editions</span>
              </div>
            ) : (
              <div style={{ display: "grid", justifyItems: "center", gap: "18px" }}>
                <ArtalesBrand href="" variant="dark" size="md" showMark />
                <div>
                  <p className="artales-cover-placeholder__label">ARTales Editions</p>
                  <p className="artales-cover-placeholder__title">{title}</p>
                </div>
              </div>
            )}
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
  );
}

export default function WorkCoverImage({
  title,
  imagePath,
  alt,
  caption,
  variant = "detail",
}: WorkCoverImageProps) {
  const imageUrl = getPublicStorageImageUrl(imagePath);

  return (
    <WorkCoverImageFrame
      key={imageUrl ?? "artales-cover-placeholder"}
      title={title}
      imageUrl={imageUrl}
      alt={alt}
      caption={caption}
      variant={variant}
    />
  );
}
