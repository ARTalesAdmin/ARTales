import Link from "next/link"
import { getCollectionBySlug } from "@/lib/dbCollections"
import { getLanguageLabel } from "@/lib/dictionaries/language"
import PublicHeader from "@/components/public/PublicHeader"
import WorkCoverImage from "@/components/work/WorkCoverImage"
import ArtalesBrand from "@/components/brand/ArtalesBrand"
import { getPublicDictionary } from "@/lib/i18n/public"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function KolekceDetail({ params }: PageProps) {
  const { slug } = await params
  const collection = await getCollectionBySlug(slug)
  const { common, public: t } = getPublicDictionary()

  if (!collection) {
    return (
      <div className="artales-public-shell">
        <PublicHeader active="collection" />
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
              {t.collectionNotFoundTitle}
            </h1>
            <p style={{ color: "#3f362f", margin: 0 }}>{t.collectionNotFoundText}</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="artales-public-shell">
      <PublicHeader active="collection" />

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
            alignItems: "stretch",
            display: "grid",
            gap: "clamp(24px, 5vw, 52px)",
            gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 330px)",
            marginBottom: "42px",
          }}
          className="artales-home-hero"
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.58)",
              border: "1px solid rgba(13, 21, 40, 0.1)",
              borderRadius: "32px",
              boxShadow: "0 24px 70px rgba(13, 21, 40, 0.08)",
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
              {t.collection}
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
              {collection.title}
            </h1>

            <p
              style={{
                color: "#3f362f",
                fontSize: "18px",
                margin: "0 0 24px",
                maxWidth: "820px",
              }}
            >
              {collection.description ?? t.collectionDescriptionMissing}
            </p>

            <a className="artales-button" href="#collection-works">
              {t.browseCollectionWorks}
            </a>
          </div>

          <aside
            style={{
              alignItems: "center",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.34))",
              border: "1px solid rgba(13, 21, 40, 0.12)",
              borderRadius: "32px",
              boxShadow: "0 24px 70px rgba(13, 21, 40, 0.08)",
              display: "flex",
              justifyContent: "center",
              minHeight: "320px",
              padding: "32px",
              textAlign: "center",
            }}
          >
            <div>
              <ArtalesBrand href="" variant="dark" size="lg" showMark />
              <p style={{ color: "#5f5247", margin: "22px auto 0", maxWidth: "260px" }}>
                {t.collectionVisualPlaceholder}
              </p>
            </div>
          </aside>
        </section>

        <section id="collection-works">
          <h2
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(32px, 5vw, 52px)",
              letterSpacing: "-0.035em",
              lineHeight: 1.06,
              margin: "0 0 22px",
            }}
          >
            {t.worksInCollection}
          </h2>

          {collection.works.length === 0 ? (
            <p style={{ color: "#5f5247" }}>{t.collectionNoWorks}</p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "22px",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              {collection.works.map((work) => {
                const languageLabel = getLanguageLabel(
                  work.canonical_language,
                  "public"
                )

                return (
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

                      <p style={{ margin: "0 0 8px" }}>
                        <strong>{common.author}:</strong>{" "}
                        {work.author ? (
                          <Link href={`/autor/${work.author.slug}`}>
                            {work.author.name}
                          </Link>
                        ) : (
                          t.unknownAuthor
                        )}
                      </p>

                      {work.subtitle ? (
                        <p style={{ color: "#5f5247", margin: "0 0 8px" }}>
                          {work.subtitle}
                        </p>
                      ) : null}

                      <p style={{ color: "#3f362f", margin: "0 0 12px" }}>
                        {work.summary}
                      </p>

                      <p style={{ color: "#5f5247", margin: 0 }}>
                        <strong>{common.language}:</strong>{" "}
                        {languageLabel ?? work.canonical_language}
                      </p>
                    </div>

                    <div style={{ marginTop: "auto" }}>
                      <Link className="artales-button-secondary" href={`/dilo/${work.slug}`}>
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
