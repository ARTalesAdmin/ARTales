import Link from "next/link"
import { getWorksForGallery } from "@/lib/dbWorks"
import { getLocalizedLanguageLabel } from "@/lib/dictionaries/language"
import WorkCoverImage from "@/components/work/WorkCoverImage"
import PublicHeader from "@/components/public/PublicHeader"
import { getPublicDictionary } from "@/lib/i18n/public"
import { getCookieLocale } from "@/lib/i18n/server"
import { pickLocalizedText } from "@/lib/localizedContent"

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
                const languageLabel = getLocalizedLanguageLabel(
                  work.canonical_language,
                  locale
                )
                const title = pickLocalizedText(locale, {
                  cs: work.title_cs,
                  en: work.title_en,
                  fallback: work.title,
                }) ?? work.title
                const subtitle = pickLocalizedText(locale, {
                  cs: work.subtitle_cs,
                  en: work.subtitle_en,
                  fallback: work.subtitle,
                })
                const summary = pickLocalizedText(locale, {
                  cs: work.summary_cs,
                  en: work.summary_en,
                  fallback: work.summary,
                }) ?? work.summary
                const collectionTitle = work.collection
                  ? pickLocalizedText(locale, {
                      cs: work.collection.title_cs,
                      en: work.collection.title_en,
                      fallback: work.collection.title,
                    }) ?? work.collection.title
                  : null

                return (
                  <article key={work.id} className="artales-gallery-card">
                    <Link href={`/work/${work.slug}`} aria-label={`${t.openDetail}: ${title}`}>
                      <WorkCoverImage
                        title={title}
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
                        <Link href={`/work/${work.slug}`}>{title}</Link>
                      </h2>

                      <p className={subtitle ? "artales-gallery-card__subtitle" : "artales-gallery-card__subtitle artales-gallery-card__subtitle--empty"}>
                        {subtitle || "\u00a0"}
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
                            {common.collection}: <Link href={`/collections/${work.collection.slug}`}>{collectionTitle}</Link>
                          </span>
                        ) : null}
                        <span>{common.language}: {languageLabel ?? work.canonical_language}</span>
                      </div>

                      <p className="artales-gallery-card__summary">{summary}</p>
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
