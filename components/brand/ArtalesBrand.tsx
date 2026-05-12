import Image from "next/image"
import Link from "next/link"

type ArtalesBrandProps = {
  href?: string
  variant?: "dark" | "light" | "text"
  size?: "sm" | "md" | "lg"
  label?: string
  showMark?: boolean
}

const wordmarkSrc = {
  dark: "/brand/artales-wordmark-dark.webp",
  light: "/brand/artales-wordmark-light.webp",
}

const markSrc = {
  dark: "/brand/artales-mark-dark.webp",
  light: "/brand/artales-mark-light.webp",
}

function getWordmarkSize(size: NonNullable<ArtalesBrandProps["size"]>) {
  switch (size) {
    case "sm":
      return { width: 132, height: 35 }
    case "lg":
      return { width: 240, height: 63 }
    case "md":
    default:
      return { width: 172, height: 45 }
  }
}

function getMarkSize(size: NonNullable<ArtalesBrandProps["size"]>) {
  switch (size) {
    case "sm":
      return { width: 28, height: 46 }
    case "lg":
      return { width: 48, height: 78 }
    case "md":
    default:
      return { width: 34, height: 55 }
  }
}

export default function ArtalesBrand({
  href = "/galerie",
  variant = "dark",
  size = "md",
  label = "ARTales",
  showMark = false,
}: ArtalesBrandProps) {
  const isTextOnly = variant === "text"
  const imageVariant = variant === "light" ? "light" : "dark"
  const wordmarkSize = getWordmarkSize(size)
  const markSize = getMarkSize(size)

  const content = (
    <span className={`artales-brand artales-brand--${variant} artales-brand--${size}`}>
      {showMark && !isTextOnly ? (
        <Image
          src={markSrc[imageVariant]}
          alt=""
          width={markSize.width}
          height={markSize.height}
          className="artales-brand__mark"
          priority={size !== "sm"}
        />
      ) : null}

      {isTextOnly ? (
        <span className="artales-brand__text">ARTales</span>
      ) : (
        <Image
          src={wordmarkSrc[imageVariant]}
          alt={label}
          width={wordmarkSize.width}
          height={wordmarkSize.height}
          className="artales-brand__wordmark"
          priority={size !== "sm"}
        />
      )}
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} className="artales-brand-link" aria-label={label}>
      {content}
    </Link>
  )
}
