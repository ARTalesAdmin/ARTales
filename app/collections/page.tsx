import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCollectionsForPublicGallery } from "@/lib/dbCollections";
import { getCookieLocale } from "@/lib/i18n/server";
import { getPublicDictionary } from "@/lib/i18n/public";
import { pickLocalizedText } from "@/lib/localizedContent";
import { getPublicStorageImageUrl } from "@/lib/storageImages";

export default async function CollectionsPage() {
  const [collections, locale] = await Promise.all([
    getCollectionsForPublicGallery(),
    getCookieLocale(),
  ]);
  const { public: t } = getPublicDictionary(locale);

  return (
    <div className="artales-public-shell">
      <PublicHeader active="collection" />
      <main className="artales-public-main">
        <section>
          <header className="artales-gallery-hero">
            <p className="artales-public-kicker">{t.collectionsEyebrow}</p>
            <h1>{t.collectionsTitle}</h1>
            <p>{t.collectionsIntro}</p>
          </header>

        {collections.length === 0 ? (
          <p style={{ color: "rgba(42, 30, 22, 0.82)" }}>{t.noPublicCollections}</p>
        ) : (
          <div className="artales-gallery-grid">
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
              const coverImageUrl = getPublicStorageImageUrl(collection.cover_image_path);

              return (
                <article key={collection.id} className="artales-gallery-card">
                  <Link
                    href={`/collections/${collection.slug}`}
                    aria-label={`${t.openCollection}: ${title}`}
                    style={{ display: "block", textDecoration: "none" }}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        aspectRatio: "3 / 2",
                        background: coverImageUrl
                          ? `linear-gradient(rgba(23, 16, 10, 0.08), rgba(23, 16, 10, 0.14)), url(${coverImageUrl}) center/cover`
                          : "radial-gradient(circle at top, rgba(217, 183, 110, 0.34), transparent 18rem), linear-gradient(145deg, #fff8e8 0%, #ead9b8 100%)",
                        border: "1px solid rgba(217, 183, 110, 0.3)",
                        borderRadius: "18px",
                        boxShadow: "0 14px 34px rgba(5, 7, 12, 0.12)",
                        color: "rgba(13, 21, 40, 0.58)",
                        display: "grid",
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        fontSize: "1.05rem",
                        letterSpacing: "0.12em",
                        overflow: "hidden",
                        placeItems: "center",
                        textAlign: "center",
                        textTransform: "uppercase",
                      }}
                    >
                      {coverImageUrl ? null : "ARTales"}
                    </div>
                  </Link>

                  <div className="artales-gallery-card__body">
                    <p className="artales-public-kicker artales-public-kicker--small">
                      {collection.collection_type}
                    </p>

                    <h2>
                      <Link href={`/collections/${collection.slug}`}>
                        {title}
                      </Link>
                    </h2>

                    <p className={subtitle ? "artales-gallery-card__subtitle" : "artales-gallery-card__subtitle artales-gallery-card__subtitle--empty"}>
                      {subtitle || "\u00a0"}
                    </p>

                    <p className="artales-gallery-card__summary">
                      {description || t.collectionDescriptionMissing}
                    </p>

                    <div className="artales-gallery-card__actions">
                      <Link className="artales-button-secondary" href={`/collections/${collection.slug}`}>
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
