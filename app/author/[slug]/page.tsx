import Link from "next/link"
import { getAuthorBySlug } from "@/lib/dbAuthors"
import { getLocalizedLanguageLabel, getLocalizedLanguageLabels } from "@/lib/dictionaries/language"
import { getCountryLabel } from "@/lib/dictionaries/country"
import PublicHeader from "@/components/public/PublicHeader"
import StorageImageDisplay from "@/components/media/StorageImageDisplay"
import WorkCoverImage from "@/components/work/WorkCoverImage"
import { getPublicDictionary } from "@/lib/i18n/public"
import { getCookieLocale } from "@/lib/i18n/server"
import { getCurrentProfile } from "@/lib/auth"
import { isAuthorFollowedByUser } from "@/lib/community"
import AuthorFollowPanel from "@/components/community/AuthorFollowPanel"
import { pickLocalizedText } from "@/lib/localizedContent"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ follow?: string }>
}

function getAuthorTypeLabel(authorType: string, t: ReturnType<typeof getPublicDictionary>["public"]) {

  switch (authorType) {
    case "person":
      return t.authorTypePerson
    case "collective":
      return t.authorTypeCollective
    case "unknown":
      return t.authorTypeUnknown
    default:
      return t.author
  }
}

export default async function AuthorDetail({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { follow } = searchParams ? await searchParams : {}
  const author = await getAuthorBySlug(slug)
  const [profile, locale] = await Promise.all([getCurrentProfile(), getCookieLocale()])
  const { common, public: t } = getPublicDictionary(locale)

  if (!author) {
    return (
      <div className="artales-public-shell">
        <PublicHeader active="author" />
        <main className="artales-public-main artales-author-detail-main artales-public-main--narrow">
          <p style={{ margin: "0 0 22px" }}>
            <Link href="/gallery" style={{ color: "#5f5247" }}>
              {"<- "}{t.backToGallery}
            </Link>
          </p>
          <section
            style={{
              background: "rgba(255, 255, 255, 0.55)",
              border: "1px solid rgba(13, 21, 40, 0.12)",
              borderRadius: "28px",
              boxShadow: "0 22px 60px rgba(13, 21, 40, 0.08)",
              padding: "32px",
            }}
          >
            <h1
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(36px, 6vw, 64px)",
                lineHeight: 1.04,
                margin: "0 0 14px",
              }}
            >
              {t.authorNotFoundTitle}
            </h1>
            <p style={{ color: "#3f362f", margin: 0 }}>{t.authorNotFoundText}</p>
          </section>
        </main>
      </div>
    )
  }

  const isFollowing = await isAuthorFollowedByUser(profile?.id, author.id)

  const countryLabel = getCountryLabel(author.country, locale)
  const primaryLanguageLabel = getLocalizedLanguageLabel(author.primary_language, locale)
  const writingLanguageLabels = getLocalizedLanguageLabels(author.writing_languages, locale)

  const years =
    author.birth_year || author.death_year
      ? `${author.birth_year ?? "?"}–${author.death_year ?? "?"}`
      : null

  return (
    <div className="artales-public-shell">
      <PublicHeader active="author" />

      <main className="artales-public-main artales-author-detail-main">
        <p style={{ margin: "0 0 22px" }}>
          <Link href="/gallery" style={{ color: "#5f5247" }}>
            {"<- "}{t.backToGallery}
          </Link>
        </p>

        <section
          className="artales-author-detail-card"
          style={{
            background: "rgba(255, 255, 255, 0.58)",
            border: "1px solid rgba(13, 21, 40, 0.1)",
            borderRadius: "32px",
            boxShadow: "0 24px 70px rgba(13, 21, 40, 0.08)",
            marginBottom: "38px",
            padding: "clamp(28px, 5vw, 52px)",
          }}
        >
          <div className="artales-author-hero">
            <div>
              <p
                style={{
              color: "#8a6a2d",
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "0.16em",
              margin: "0 0 12px",
              textTransform: "uppercase",
            }}
          >
            {getAuthorTypeLabel(author.author_type, t)}
          </p>

          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(44px, 7vw, 82px)",
              letterSpacing: "-0.05em",
              lineHeight: 1,
              margin: "0 0 18px",
            }}
          >
            {author.name}
          </h1>

          <div
            style={{
              color: "#5f5247",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px 18px",
              marginBottom: "22px",
            }}
          >
            {years ? (
              <span><strong>{t.years}:</strong> {years}</span>
            ) : null}
            {countryLabel ? (
              <span><strong>{t.country}:</strong> {countryLabel}</span>
            ) : null}
            {primaryLanguageLabel ? (
              <span><strong>{t.primaryLanguage}:</strong> {primaryLanguageLabel}</span>
            ) : null}
            {writingLanguageLabels.length > 0 ? (
              <span><strong>{common.language}:</strong> {writingLanguageLabels.join(", ")}</span>
            ) : null}
          </div>

          <p
            style={{
              color: "#3f362f",
              fontSize: "18px",
              margin: 0,
              maxWidth: "820px",
            }}
          >
            {author.bio ?? t.authorBioMissing}
          </p>

          {follow === "ok" ? (
            <p className="artales-account-success" style={{ marginTop: "18px" }}>
              {t.authorFollowSaved}
            </p>
          ) : null}
          {follow === "removed" ? (
            <p className="artales-account-success" style={{ marginTop: "18px" }}>
              {t.authorFollowRemoved}
            </p>
          ) : null}
          {follow === "error" ? (
            <p className="artales-account-alert" style={{ marginTop: "18px" }}>
              {t.authorFollowError}
            </p>
          ) : null}

          <div style={{ marginTop: "24px" }}>
            <AuthorFollowPanel
              authorId={author.id}
              slug={author.slug}
              isSignedIn={Boolean(profile)}
              isFollowing={isFollowing}
              labels={t}
            />
          </div>
            </div>

            <aside>
              <StorageImageDisplay
                title={author.name}
                imagePath={author.portrait_image_path}
                alt={author.portrait_image_alt}
                caption={author.portrait_image_caption}
                variant="author-portrait"
              />
            </aside>
          </div>
        </section>

        <section>
          <h2
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(32px, 5vw, 52px)",
              letterSpacing: "-0.035em",
              lineHeight: 1.06,
              margin: "0 0 22px",
            }}
          >
            {t.publishedWorks}
          </h2>

          {author.works.length === 0 ? (
            <p style={{ color: "#5f5247" }}>{t.authorNoWorks}</p>
          ) : (
            <div className="artales-related-work-grid">
              {author.works.map((work) => {
                const title = pickLocalizedText(locale, {
                  cs: work.title_cs,
                  en: work.title_en,
                  fallback: work.title,
                }) ?? work.title;
                const subtitle = pickLocalizedText(locale, {
                  cs: work.subtitle_cs,
                  en: work.subtitle_en,
                  fallback: work.subtitle,
                });
                const summary = pickLocalizedText(locale, {
                  cs: work.summary_cs,
                  en: work.summary_en,
                  fallback: work.summary,
                }) ?? work.summary;
                const collectionTitle = work.collection
                  ? pickLocalizedText(locale, {
                      cs: work.collection.title_cs,
                      en: work.collection.title_en,
                      fallback: work.collection.title,
                    }) ?? work.collection.title
                  : null;

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
                    <h2>
                      <Link href={`/work/${work.slug}`}>
                        {title}
                      </Link>
                    </h2>

                    <p className={subtitle ? "artales-gallery-card__subtitle" : "artales-gallery-card__subtitle artales-gallery-card__subtitle--empty"}>
                      {subtitle || "\u00a0"}
                    </p>

                    {work.collection ? (
                      <p className="artales-gallery-card__meta">
                        <span>
                          {common.collection}:{" "}
                          <Link href={`/collections/${work.collection.slug}`}>
                            {collectionTitle}
                          </Link>
                        </span>
                      </p>
                    ) : null}

                    <p className="artales-gallery-card__summary">
                      {summary}
                    </p>
                  </div>

                  <div className="artales-gallery-card__actions">
                    <Link className="artales-button-secondary" href={`/work/${work.slug}`}>
                      {t.openDetail}
                    </Link>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
