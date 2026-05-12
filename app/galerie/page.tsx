import Link from "next/link"
import { getWorksForGallery } from "@/lib/dbWorks"
import { getLanguageLabel } from "@/lib/dictionaries/language"
import WorkCoverImage from "@/components/work/WorkCoverImage"
import PublicHeader from "@/components/public/PublicHeader"
import { getPublicDictionary } from "@/lib/i18n/public"

export const dynamic = "force-dynamic"

function getWorkLabel(originType: string) {
  const t = getPublicDictionary().public

  switch (originType) {
    case "public_domain":
      return t.publicDomain
    case "original":
      return t.original
    case "translation":
      return t.translation
    case "other":
      return t.otherLayer
    default:
      return t.literaryWork
  }
}

export default async function Galerie() {
  const works = await getWorksForGallery()
  const { common, public: t } = getPublicDictionary()

  return (
    <div className="artales-public-shell">
      <PublicHeader active="gallery" />

      <main
        style={{
          padding: "52px 32px 68px",
          fontFamily: "Arial, Helvetica, sans-serif",
          lineHeight: 1.6,
          maxWidth: "1180px",
          margin: "0 auto",
          color: "var(--artales-ink)",
        }}
      >
        <section style={{ marginBottom: "38px" }}>
          <p
            style={{
              fontSize: "13px",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "#8a6a2d",
              fontWeight: 800,
              marginBottom: "12px",
            }}
          >
            {t.galleryEyebrow}
          </p>

          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(44px, 7vw, 78px)",
              marginBottom: "16px",
              lineHeight: 1.02,
              letterSpacing: "-0.045em",
            }}
          >
            {t.galleryTitle}
          </h1>

          <p
            style={{
              fontSize: "19px",
              maxWidth: "780px",
              marginBottom: "24px",
              color: "#3f362f",
            }}
          >
            {t.galleryIntro}
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link className="artales-button-secondary" href="/kolekce/gothic-classics">
              {t.collections}
            </Link>

          </div>
        </section>

        <section>
          {works.length === 0 ? (
            <p>{t.noPublishedWorks}</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "22px",
              }}
            >
              {works.map((work) => {
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
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
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
                      <p
                        style={{
                          margin: "0 0 8px 0",
                          fontSize: "12px",
                          color: "#8a6a2d",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          fontWeight: 800,
                        }}
                      >
                        {getWorkLabel(work.origin_type)}
                      </p>

                      <h2
                        style={{
                          margin: "0 0 8px 0",
                          fontFamily: "Georgia, 'Times New Roman', serif",
                          fontSize: "29px",
                          lineHeight: 1.12,
                        }}
                      >
                        <Link
                          href={`/dilo/${work.slug}`}
                          style={{ textDecoration: "none", color: "var(--artales-ink)" }}
                        >
                          {work.title}
                        </Link>
                      </h2>

                      {work.subtitle ? (
                        <p style={{ margin: "0 0 8px 0", color: "#5f5247" }}>
                          {work.subtitle}
                        </p>
                      ) : null}

                      <p style={{ margin: "0 0 8px 0" }}>
                        <strong>{common.author}:</strong>{" "}
                        {work.author ? (
                          <Link href={`/autor/${work.author.slug}`}>
                            {work.author.name}
                          </Link>
                        ) : (
                          t.unknownAuthor
                        )}
                      </p>

                      {work.collection ? (
                        <p style={{ margin: "0 0 8px 0" }}>
                          <strong>{common.collection}:</strong>{" "}
                          <Link href={`/kolekce/${work.collection.slug}`}>
                            {work.collection.title}
                          </Link>
                        </p>
                      ) : null}

                      <p style={{ margin: "0 0 12px 0", color: "#3f362f" }}>{work.summary}</p>

                      <p style={{ margin: 0, color: "#5f5247" }}>
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
