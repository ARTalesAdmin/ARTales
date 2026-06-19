import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCollectionsForPublicGallery } from "@/lib/dbCollections";
import { getCookieLocale } from "@/lib/i18n/server";
import { getPublicDictionary } from "@/lib/i18n/public";
import { pickLocalizedText } from "@/lib/localizedContent";

export default async function CollectionsPage() {
  const [collections, locale] = await Promise.all([
    getCollectionsForPublicGallery(),
    getCookieLocale(),
  ]);
  const { public: t } = getPublicDictionary(locale);

  return (
    <div className="artales-public-shell">
      <PublicHeader active="collection" />
      <main
        style={{
          minHeight: "100vh",
          padding: "48px 24px 80px",
          background:
            "linear-gradient(180deg, #f5f0e5 0%, rgba(255,255,255,0.96) 220px, #f7f4ed 100%)",
        }}
      >
        <section style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <header
          style={{
            display: "grid",
            gap: "16px",
            marginBottom: "36px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(56, 43, 30, 0.78)",
              fontWeight: 700,
            }}
          >
            {t.collectionsEyebrow}
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2.4rem, 5vw, 4.2rem)",
              lineHeight: 1.05,
              color: "#22170f",
            }}
          >
            {t.collectionsTitle}
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: "760px",
              fontSize: "1.05rem",
              lineHeight: 1.75,
              color: "rgba(42, 30, 22, 0.82)",
            }}
          >
            {t.collectionsIntro}
          </p>
        </header>

        {collections.length === 0 ? (
          <p style={{ color: "rgba(42, 30, 22, 0.82)" }}>{t.noPublicCollections}</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "24px",
            }}
          >
            {collections.map((collection) => {
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

              return (
                <article
                  key={collection.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    background: "rgba(255,255,255,0.92)",
                    borderRadius: "26px",
                    overflow: "hidden",
                    border: "1px solid rgba(68, 50, 34, 0.11)",
                    boxShadow: "0 18px 40px rgba(36, 24, 16, 0.08)",
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      aspectRatio: "3 / 2",
                      background: collection.cover_image_path
                        ? `linear-gradient(rgba(23, 16, 10, 0.08), rgba(23, 16, 10, 0.14)), url(${collection.cover_image_path}) center/cover`
                        : "linear-gradient(135deg, rgba(130, 101, 78, 0.26), rgba(61, 47, 34, 0.12))",
                      color: "rgba(42, 30, 22, 0.58)",
                      display: "grid",
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: "1.2rem",
                      letterSpacing: "0.08em",
                      placeItems: "center",
                      textTransform: "uppercase",
                    }}
                    aria-hidden="true"
                  >
                    {collection.cover_image_path ? null : "ARTales"}
                  </div>

                  <div style={{ padding: "22px 22px 24px", display: "grid", gap: "12px" }}>
                    <div style={{ display: "grid", gap: "6px" }}>
                      <h2 style={{ margin: 0, fontSize: "1.55rem", lineHeight: 1.2, color: "#1f150e" }}>
                        <Link href={`/collections/${collection.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {title}
                        </Link>
                      </h2>
                      {subtitle ? (
                        <p style={{ margin: 0, color: "rgba(42, 30, 22, 0.74)", fontSize: "0.96rem" }}>{subtitle}</p>
                      ) : null}
                    </div>

                    <p style={{ margin: 0, color: "rgba(42, 30, 22, 0.82)", lineHeight: 1.7 }}>
                      {description || t.collectionDescriptionMissing}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", gap: "12px" }}>
                      <span style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(42, 30, 22, 0.56)" }}>
                        {collection.collection_type}
                      </span>

                      <Link href={`/collections/${collection.slug}`} style={{ textDecoration: "none", fontWeight: 600, color: "#24170f" }}>
                        {t.openCollection}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </section>
      </main>
    </div>
  );
}
