import Link from "next/link"
import { getAuthorBySlug } from "@/lib/dbAuthors"
import { getLanguageLabel, getLanguageLabels } from "@/lib/dictionaries/language"
import PublicHeader from "@/components/public/PublicHeader"
import WorkCoverImage from "@/components/work/WorkCoverImage"
import { getPublicDictionary } from "@/lib/i18n/public"

type PageProps = {
  params: Promise<{ slug: string }>
}

function getAuthorTypeLabel(authorType: string) {
  const { public: t } = getPublicDictionary()

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

export default async function AutorDetail({ params }: PageProps) {
  const { slug } = await params
  const author = await getAuthorBySlug(slug)
  const { common, public: t } = getPublicDictionary()

  if (!author) {
    return (
      <div className="artales-public-shell">
        <PublicHeader active="author" />
        <main
          style={{
            color: "var(--artales-ink)",
            fontFamily: "Arial, Helvetica, sans-serif",
            lineHeight: 1.6,
            margin: "0 auto",
            maxWidth: "900px",
            padding: "64px 24px",
          }}
        >
          <p style={{ margin: "0 0 22px" }}>
            <Link href="/galerie" style={{ color: "#5f5247" }}>
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

  const primaryLanguageLabel = getLanguageLabel(author.primary_language, "public")
  const writingLanguageLabels = getLanguageLabels(author.writing_languages, "public")

  const years =
    author.birth_year || author.death_year
      ? `${author.birth_year ?? "?"}–${author.death_year ?? "?"}`
      : null

  return (
    <div className="artales-public-shell">
      <PublicHeader active="author" />

      <main
        style={{
          color: "var(--artales-ink)",
          fontFamily: "Arial, Helvetica, sans-serif",
          lineHeight: 1.6,
          margin: "0 auto",
          maxWidth: "1180px",
          padding: "42px 24px 68px",
        }}
      >
        <p style={{ margin: "0 0 22px" }}>
          <Link href="/galerie" style={{ color: "#5f5247" }}>
            {"<- "}{t.backToGallery}
          </Link>
        </p>

        <section
          style={{
            background: "rgba(255, 255, 255, 0.58)",
            border: "1px solid rgba(13, 21, 40, 0.1)",
            borderRadius: "32px",
            boxShadow: "0 24px 70px rgba(13, 21, 40, 0.08)",
            marginBottom: "38px",
            padding: "clamp(28px, 5vw, 52px)",
          }}
        >
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
            {getAuthorTypeLabel(author.author_type)}
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
            {author.country ? (
              <span><strong>{t.country}:</strong> {author.country}</span>
            ) : null}
            {primaryLanguageLabel ? (
              <span><strong>{t.primaryLanguage}:</strong> {primaryLanguageLabel}</span>
            ) : null}
            {writingLanguageLabels.length > 0 ? (
              <span><strong>Writing languages:</strong> {writingLanguageLabels.join(", ")}</span>
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
            <div
              style={{
                display: "grid",
                gap: "22px",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              {author.works.map((work) => (
                <article
                  key={work.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.58)",
                    border: "1px solid rgba(13, 21, 40, 0.1)",
                    borderRadius: "24px",
                    boxShadow: "0 18px 45px rgba(13, 21, 40, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    padding: "18px",
                  }}
                >
                  <Link href={`/dilo/${work.slug}`} aria-label={`Open ${work.title}`}>
                    <WorkCoverImage
                      title={work.title}
                      imagePath={work.cover_image_path}
                      alt={work.cover_image_alt}
                      caption={work.cover_image_caption}
                      variant="card"
                    />
                  </Link>

                  <div>
                    <h3
                      style={{
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        fontSize: "29px",
                        lineHeight: 1.12,
                        margin: "0 0 8px",
                      }}
                    >
                      <Link
                        href={`/dilo/${work.slug}`}
                        style={{ color: "var(--artales-ink)", textDecoration: "none" }}
                      >
                        {work.title}
                      </Link>
                    </h3>

                    {work.subtitle ? (
                      <p style={{ color: "#5f5247", margin: "0 0 8px" }}>
                        {work.subtitle}
                      </p>
                    ) : null}

                    <p style={{ color: "#3f362f", margin: "0 0 12px" }}>
                      {work.summary}
                    </p>

                    {work.collection ? (
                      <p style={{ margin: 0 }}>
                        <strong>{common.collection}:</strong>{" "}
                        <Link href={`/kolekce/${work.collection.slug}`}>
                          {work.collection.title}
                        </Link>
                      </p>
                    ) : null}
                  </div>

                  <div style={{ marginTop: "auto" }}>
                    <Link className="artales-button-secondary" href={`/dilo/${work.slug}`}>
                      {t.openDetail}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
