import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { notFound } from "next/navigation";
import { getCollectionBySlug } from "@/lib/dbCollections";
import { getCookieLocale } from "@/lib/i18n/server";
import { getPublicDictionary } from "@/lib/i18n/public";
import { pickLocalizedText } from "@/lib/localizedContent";

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

  return (
    <div className="artales-public-shell">
      <PublicHeader active="collection" />
      <main
        style={{
          minHeight: "100vh",
          padding: "48px 24px 80px",
          background:
            "linear-gradient(180deg, #f4efe5 0%, rgba(255,255,255,0.97) 260px, #f7f4ee 100%)",
        }}
      >
        <section style={{ maxWidth: "1140px", margin: "0 auto", display: "grid", gap: "28px" }}>
        <p style={{ margin: 0 }}>
          <Link href="/collections">{`${common.back} · ${t.collections}`}</Link>
        </p>

        <header
          style={{
            display: "grid",
            gap: "18px",
            padding: "28px",
            borderRadius: "28px",
            background: collection.cover_image_path
              ? `linear-gradient(135deg, rgba(24, 16, 11, 0.62), rgba(24, 16, 11, 0.42)), url(${collection.cover_image_path}) center/cover`
              : "linear-gradient(135deg, rgba(70, 52, 35, 0.92), rgba(104, 80, 59, 0.78))",
            color: "#fffaf4",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.82 }}>
            {t.collectionsEyebrow}
          </p>
          <div style={{ display: "grid", gap: "8px", maxWidth: "820px" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 5vw, 4.2rem)", lineHeight: 1.05 }}>{title}</h1>
            {subtitle ? <p style={{ margin: 0, fontSize: "1.08rem", opacity: 0.9 }}>{subtitle}</p> : null}
          </div>
          {description ? (
            <p style={{ margin: 0, maxWidth: "860px", lineHeight: 1.8, color: "rgba(255,250,244,0.92)" }}>{description}</p>
          ) : null}
          {curatorNote ? (
            <div style={{ maxWidth: "860px", paddingTop: "8px", borderTop: "1px solid rgba(255,250,244,0.18)" }}>
              <p style={{ margin: "0 0 6px 0", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.78 }}>
                Curator note
              </p>
              <p style={{ margin: 0, lineHeight: 1.8, color: "rgba(255,250,244,0.94)" }}>{curatorNote}</p>
            </div>
          ) : null}
        </header>

        <section style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.8rem", color: "#20160f" }}>{t.worksInCollection}</h2>
            <span style={{ color: "rgba(42, 30, 22, 0.7)" }}>{`${collection.works.length} ${t.publishedWorks.toLowerCase()}`}</span>
          </div>

          {collection.works.length === 0 ? (
            <p style={{ margin: 0, color: "rgba(42, 30, 22, 0.78)" }}>{t.collectionNoWorks}</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "24px",
              }}
            >
              {collection.works.map((work) => (
                <article
                  key={work.id}
                  style={{
                    display: "grid",
                    gap: "12px",
                    padding: "18px",
                    borderRadius: "22px",
                    background: "rgba(255, 255, 255, 0.92)",
                    border: "1px solid rgba(68, 50, 34, 0.11)",
                    boxShadow: "0 16px 34px rgba(36, 24, 16, 0.07)",
                  }}
                >
                  {work.cover_image_path ? (
                    <Link
                      href={`/work/${work.slug}`}
                      style={{
                        display: "block",
                        aspectRatio: "2 / 3",
                        borderRadius: "16px",
                        overflow: "hidden",
                        background: `url(${work.cover_image_path}) center/cover`,
                      }}
                      aria-label={work.title}
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

                  <div style={{ display: "grid", gap: "8px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.18rem", lineHeight: 1.25 }}>
                      <Link
                        href={`/work/${work.slug}`}
                        style={{ color: "#20160f", textDecoration: "none" }}
                      >
                        {work.title}
                      </Link>
                    </h3>

                    {work.author ? (
                      <p style={{ margin: 0, color: "rgba(42, 30, 22, 0.68)", fontSize: "0.92rem" }}>
                        {work.author.name}
                      </p>
                    ) : null}

                    <p
                      style={{
                        margin: 0,
                        color: "rgba(42, 30, 22, 0.78)",
                        lineHeight: 1.55,
                        fontSize: "0.94rem",
                      }}
                    >
                      {work.summary}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        </section>
      </main>
    </div>
  );
}
