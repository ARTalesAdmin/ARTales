import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCollectionsForPublicGallery } from "@/lib/dbCollections";
import { getPublicDictionary } from "@/lib/i18n/public";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const collections = await getCollectionsForPublicGallery();
  const { public: t } = getPublicDictionary();

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
          padding: "52px 32px 68px",
        }}
      >
        <section style={{ marginBottom: "38px" }}>
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
            {t.collectionsEyebrow}
          </p>

          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(44px, 7vw, 78px)",
              letterSpacing: "-0.045em",
              lineHeight: 1.02,
              margin: "0 0 16px",
            }}
          >
            {t.collectionsTitle}
          </h1>

          <p
            style={{
              color: "#3f362f",
              fontSize: "19px",
              margin: "0 0 24px",
              maxWidth: "820px",
            }}
          >
            {t.collectionsIntro}
          </p>
        </section>

        {collections.length === 0 ? (
          <p>{t.noPublicCollections}</p>
        ) : (
          <section
            style={{
              display: "grid",
              gap: "22px",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {collections.map((collection) => (
              <article
                key={collection.id}
                style={{
                  background: "rgba(255, 255, 255, 0.64)",
                  border: "1px solid rgba(13, 21, 40, 0.12)",
                  borderRadius: "24px",
                  boxShadow: "0 18px 45px rgba(13, 21, 40, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  minHeight: "240px",
                  padding: "24px",
                }}
              >
                <p
                  style={{
                    color: "#8a6a2d",
                    fontSize: "12px",
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    margin: 0,
                    textTransform: "uppercase",
                  }}
                >
                  {t.collection}
                </p>

                <h2
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "34px",
                    lineHeight: 1.08,
                    margin: 0,
                  }}
                >
                  <Link
                    href={`/collections/${collection.slug}`}
                    style={{ color: "var(--artales-ink)", textDecoration: "none" }}
                  >
                    {collection.title}
                  </Link>
                </h2>

                <p style={{ color: "#3f362f", margin: 0 }}>
                  {collection.description ?? t.collectionDescriptionMissing}
                </p>

                <div style={{ marginTop: "auto", paddingTop: "10px" }}>
                  <Link
                    className="artales-button-secondary"
                    href={`/collections/${collection.slug}`}
                  >
                    {t.openCollection}
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
