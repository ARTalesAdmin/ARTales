import Link from "next/link"
import { getWorksForGallery } from "@/lib/dbWorks"
import { getLanguageLabel } from "@/lib/dictionaries/language"
import WorkCoverImage from "@/components/work/WorkCoverImage"
import PublicHeader from "@/components/public/PublicHeader"
import { getPublicDictionary } from "@/lib/i18n/public"
import { getCookieLocale } from "@/lib/i18n/server"

export const dynamic = "force-dynamic"

function getWorkLabel(originType: string, labels: ReturnType<typeof getPublicDictionary>["public"]) {
  switch (originType) {
    case "public_domain":
      return labels.publicDomain
    case "original":
      return labels.original
    case "translation":
      return labels.translation
    case "other":
      return labels.otherLayer
    default:
      return labels.literaryWork
  }
}

export default async function GalleryPage() {
  const [works, locale] = await Promise.all([getWorksForGallery(), getCookieLocale()])
  const { common, public: t } = getPublicDictionary(locale)

  return (
    <div className="artales-public-shell">
      <PublicHeader active="gallery" />

      <main className="artales-public-main artales-gallery-surface">
        <section className="artales-gallery-hero">
          <p className="artales-public-kicker">{t.galleryEyebrow}</p>
          <h1>{t.galleryTitle}</h1>
          <p>{t.galleryIntro}</p>

        </section>

        <section>
          {works.length === 0 ? (
            <p>{t.noPublishedWorks}</p>
          ) : (
            <div className="artales-gallery-grid">
              {works.map((work) => {
                const languageLabel = getLanguageLabel(
                  work.canonical_language,
                  "public"
                )

                return (
                  <article key={work.id} className="artales-gallery-card">
                    <Link href={`/work/${work.slug}`} aria-label={`${t.openDetail}: ${work.title}`}>
                      <WorkCoverImage
                        title={work.title}
                        imagePath={work.cover_image_path}
                        alt={work.cover_image_alt}
                        caption={work.cover_image_caption}
                        variant="card"
                      />
                    </Link>

                    <div className="artales-gallery-card__body">
                      <p className="artales-public-kicker artales-public-kicker--small">
                        {getWorkLabel(work.origin_type, t)}
                      </p>

                      <h2>
                        <Link href={`/work/${work.slug}`}>{work.title}</Link>
                      </h2>

                      <p className={work.subtitle ? "artales-gallery-card__subtitle" : "artales-gallery-card__subtitle artales-gallery-card__subtitle--empty"}>
                        {work.subtitle || "\u00a0"}
                      </p>

                      <div className="artales-gallery-card__meta">
                        <span>
                          {common.author}: {work.author ? (
                            <Link className="artales-gallery-card__author-link" href={`/author/${work.author.slug}`}>{work.author.name}</Link>
                          ) : (
                            t.unknownAuthor
                          )}
                        </span>
                        {work.collection ? (
                          <span>
                            {common.collection}: <Link href={`/collections/${work.collection.slug}`}>{work.collection.title}</Link>
                          </span>
                        ) : null}
                        <span>{common.language}: {languageLabel ?? work.canonical_language}</span>
                      </div>

                      <p className="artales-gallery-card__summary">{work.summary}</p>
                    </div>

                    <div className="artales-gallery-card__actions">
                      <Link className="artales-button" href={`/reader/${work.slug}`}>
                        {t.readPreview}
                      </Link>
                      <Link className="artales-button-secondary" href={`/work/${work.slug}`}>
                        {t.openDetail}
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
