import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { notFound } from "next/navigation";
import { getCollectionBySlug } from "@/lib/dbCollections";
import { getCookieLocale } from "@/lib/i18n/server";
import { getPublicDictionary } from "@/lib/i18n/public";
import { pickLocalizedText } from "@/lib/localizedContent";
import { getPublicStorageImageUrl } from "@/lib/storageImages";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CollectionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [collection, locale] = await Promise.all([
    getCollectionBySlug(slug),
    getCookieLocale(),
  ]);

  if (!collection) {
    notFound();
  }

  const { common, public: t } = getPublicDictionary(locale);
  const title =
    pickLocalizedText(locale, {
      cs: collection.title_cs,
      en: collection.title_en,
      fallback: collection.title,
    }) ?? collection.title;
  const subtitle = pickLocalizedText(locale, {
    cs: collection.subtitle_cs,
    en: collection.subtitle_en,
  });
  const description = pickLocalizedText(locale, {
    cs: collection.description_cs,
    en: collection.description_en,
    fallback: collection.description,
  });
  const curatorNote = pickLocalizedText(locale, {
    cs: collection.curator_note_cs,
    en: collection.curator_note_en,
  });
  const coverImageUrl = getPublicStorageImageUrl(collection.cover_image_path);

  return (
    <div className="artales-public-shell">
      <PublicHeader active="collection" />
      <main className="artales-public-main">
        <section style={{ display: "grid", gap: "32px" }}>
        <p style={{ margin: 0 }}>
          <Link href="/collections">{`${common.back} · ${t.collections}`}</Link>
        </p>

        <header
          className="artales-gallery-hero artales-collection-detail-hero"
          style={{
            alignItems: "center",
            display: "grid",
            gap: "clamp(24px, 5vw, 52px)",
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(260px, 420px)",
            marginBottom: "6px",
          }}
        >
          <div>
            <p className="artales-public-kicker">{t.collectionsEyebrow}</p>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
            {description ? <p>{description}</p> : null}
          </div>

          <figure style={{ margin: 0, display: "grid", gap: "10px" }}>
            <div
              style={{
                alignItems: "center",
                aspectRatio: "3 / 2",
                background: coverImageUrl
                  ? `linear-gradient(rgba(23, 16, 10, 0.06), rgba(23, 16, 10, 0.12)), url(${coverImageUrl}) center/cover`
                  : "radial-gradient(circle at top, rgba(217, 183, 110, 0.34), transparent 18rem), linear-gradient(145deg, #fff8e8 0%, #ead9b8 100%)",
                border: "1px solid rgba(217, 183, 110, 0.3)",
                borderRadius: "24px",
                boxShadow: "0 24px 70px rgba(5, 7, 12, 0.18)",
                color: "rgba(13, 21, 40, 0.58)",
                display: "grid",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "1.2rem",
                letterSpacing: "0.12em",
                overflow: "hidden",
                placeItems: "center",
                textAlign: "center",
                textTransform: "uppercase",
              }}
              aria-label={coverImageUrl ? collection.cover_image_alt ?? title : "ARTales collection cover placeholder"}
            >
              {coverImageUrl ? null : "ARTales"}
            </div>
            {collection.cover_image_caption ? (
              <figcaption style={{ color: "#6f6257", fontSize: "13px", lineHeight: 1.5, textAlign: "center" }}>
                {collection.cover_image_caption}
              </figcaption>
            ) : null}
          </figure>
        </header>

        {curatorNote ? (
          <section
            style={{
              background: "rgba(255, 255, 255, 0.62)",
              border: "1px solid rgba(13, 21, 40, 0.1)",
              borderRadius: "24px",
              boxShadow: "0 18px 45px rgba(13, 21, 40, 0.08)",
              maxWidth: "860px",
              padding: "22px 24px",
            }}
          >
            <p className="artales-public-kicker artales-public-kicker--small">
              {t.curatorNote}
            </p>
            <p style={{ color: "#3f362f", lineHeight: 1.75, margin: 0 }}>
              {curatorNote}
            </p>
          </section>
        ) : null}

        <section style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", flexWrap: "wrap" }}>
            <h2
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(30px, 4vw, 46px)",
                letterSpacing: "-0.035em",
                lineHeight: 1.08,
                margin: 0,
              }}
            >
              {t.worksInCollection}
            </h2>
            <span style={{ color: "rgba(42, 30, 22, 0.7)" }}>{`${collection.works.length} ${t.publishedWorks.toLowerCase()}`}</span>
          </div>

          {collection.works.length === 0 ? (
            <p style={{ margin: 0, color: "rgba(42, 30, 22, 0.78)" }}>{t.collectionNoWorks}</p>
          ) : (
            <div className="artales-related-work-grid">
              {collection.works.map((work) => {
                const workCoverImageUrl = getPublicStorageImageUrl(work.cover_image_path);
                const workTitle = pickLocalizedText(locale, {
                  cs: work.title_cs,
                  en: work.title_en,
                  fallback: work.title,
                }) ?? work.title;
                const workSummary = pickLocalizedText(locale, {
                  cs: work.summary_cs,
                  en: work.summary_en,
                  fallback: work.summary,
                }) ?? work.summary;

                return (
                <article key={work.id} className="artales-gallery-card">
                  {workCoverImageUrl ? (
                    <Link
                      href={`/work/${work.slug}`}
                      style={{
                        display: "block",
                        aspectRatio: "2 / 3",
                        borderRadius: "18px",
                        overflow: "hidden",
                        background: `url(${workCoverImageUrl}) center/cover`,
                        boxShadow: "0 14px 34px rgba(5, 7, 12, 0.12)",
                      }}
                      aria-label={workTitle}
                    />
                  ) : (
                    <Link
                      href={`/work/${work.slug}`}
                      style={{
                        display: "grid",
                        placeItems: "center",
                        aspectRatio: "2 / 3",
                        borderRadius: "16px",
                        background:
                          "linear-gradient(135deg, rgba(130, 101, 78, 0.20), rgba(61, 47, 34, 0.10))",
                        color: "rgba(42, 30, 22, 0.62)",
                        textDecoration: "none",
                        textAlign: "center",
                        padding: "18px",
                      }}
                    >
                      ARTales
                    </Link>
                  )}

                  <div className="artales-gallery-card__body">
                    <h2>
                      <Link href={`/work/${work.slug}`}>
                        {workTitle}
                      </Link>
                    </h2>

                    <p className={work.author ? "artales-gallery-card__subtitle" : "artales-gallery-card__subtitle artales-gallery-card__subtitle--empty"}>
                      {work.author?.name || "\u00a0"}
                    </p>

                    <p className="artales-gallery-card__summary">
                      {workSummary}
                    </p>

                    <div className="artales-gallery-card__actions">
                      <Link className="artales-button-secondary" href={`/work/${work.slug}`}>
                        {t.openDetail}
                      </Link>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>
        </section>
      </main>
    </div>
  );
}
