import Link from "next/link"
import ArtalesBrand from "@/components/brand/ArtalesBrand"
import { getPublicDictionary } from "@/lib/i18n/public"

type PublicHeaderProps = {
  active?: "home" | "gallery" | "author" | "collection" | "work" | "reader"
}

export default function PublicHeader({ active }: PublicHeaderProps) {
  const { public: t } = getPublicDictionary()

  return (
    <header className="artales-public-header">
      <ArtalesBrand variant="dark" size="md" showMark />
      <nav className="artales-public-header__nav" aria-label="Public navigation">
        <Link
          className="artales-public-link"
          href="/galerie"
          aria-current={active === "gallery" ? "page" : undefined}
        >
          {t.gallery}
        </Link>
        <Link className="artales-public-link" href="/member">
          {t.memberZone}
        </Link>
      </nav>
    </header>
  )
}
