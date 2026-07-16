import Image from "next/image"
import Link from "next/link"

type ArtalesBrandProps = {
  href?: string
  variant?: "dark" | "light" | "text" | "adaptive"
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
      return { width: 124, height: 33 }
    case "lg":
      return { width: 236, height: 62 }
    case "md":
    default:
      return { width: 172, height: 45 }
  }
}

function getMarkSize(size: NonNullable<ArtalesBrandProps["size"]>) {
  switch (size) {
    case "sm":
      return { width: 22, height: 33 }
    case "lg":
      return { width: 42, height: 62 }
    case "md":
    default:
      return { width: 30, height: 44 }
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
  const isAdaptive = variant === "adaptive"
  const imageVariant = variant === "light" ? "light" : "dark"
  const wordmarkSize = getWordmarkSize(size)
  const markSize = getMarkSize(size)

  const content = (
    <span className={`artales-brand artales-brand--${variant} artales-brand--${size}`}>
      {isAdaptive ? (
        <>
          <span className="artales-brand__variant artales-brand__variant--dark">
            {showMark ? (
              <Image
                src={markSrc.dark}
                alt=""
                width={markSize.width}
                height={markSize.height}
                className="artales-brand__mark"
                priority={size !== "sm"}
              />
            ) : null}
            <Image
              src={wordmarkSrc.dark}
              alt={label}
              width={wordmarkSize.width}
              height={wordmarkSize.height}
              className="artales-brand__wordmark"
              priority={size !== "sm"}
            />
          </span>
          <span className="artales-brand__variant artales-brand__variant--light" aria-hidden="true">
            {showMark ? (
              <Image
                src={markSrc.light}
                alt=""
                width={markSize.width}
                height={markSize.height}
                className="artales-brand__mark"
                priority={false}
              />
            ) : null}
            <Image
              src={wordmarkSrc.light}
              alt=""
              width={wordmarkSize.width}
              height={wordmarkSize.height}
              className="artales-brand__wordmark"
              priority={false}
            />
          </span>
        </>
      ) : (
        <>
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
        </>
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
