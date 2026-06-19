import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import StorageImageDisplay from "@/components/media/StorageImageDisplay";
import { getAuthorsForPublicGallery } from "@/lib/dbAuthors";
import { getLanguageLabel } from "@/lib/dictionaries/language";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function getAuthorTypeLabel(type: string, t: ReturnType<typeof getPublicDictionary>["public"]) {

  switch (type) {
    case "person":
      return t.authorTypePerson;
    case "collective":
      return t.authorTypeCollective;
    default:
      return t.authorTypeUnknown;
  }
}

function formatYears(birthYear: number | null, deathYear: number | null) {
  if (!birthYear && !deathYear) return null;
  return `${birthYear ?? "?"}–${deathYear ?? ""}`;
}

export default async function AuthorsPage() {
  const [authors, locale] = await Promise.all([
    getAuthorsForPublicGallery(),
    getCookieLocale(),
  ]);
  const { common, public: t } = getPublicDictionary(locale);

  return (
    <div className="artales-public-shell">
      <PublicHeader active="authors" />

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
            {t.authorsEyebrow}
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
            {t.authorsTitle}
          </h1>

          <p
            style={{
              color: "#3f362f",
              fontSize: "19px",
              margin: "0 0 24px",
              maxWidth: "820px",
            }}
          >
            {t.authorsIntro}
          </p>
        </section>

        {authors.length === 0 ? (
          <p>{t.noPublicAuthors}</p>
        ) : (
          <section
            style={{
              display: "grid",
              gap: "22px",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {authors.map((author) => {
              const years = formatYears(author.birth_year, author.death_year);
              const primaryLanguage = author.primary_language
                ? getLanguageLabel(author.primary_language, "public") ??
                  author.primary_language
                : null;
              const writingLanguages = author.writing_languages
                .map((language) => getLanguageLabel(language, "public") ?? language)
                .join(", ");

              return (
                <article
                  key={author.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.64)",
                    border: "1px solid rgba(13, 21, 40, 0.12)",
                    borderRadius: "24px",
                    boxShadow: "0 18px 45px rgba(13, 21, 40, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    padding: "22px",
                  }}
                >
                  <div className="artales-author-card-portrait">
                    <StorageImageDisplay
                      title={author.name}
                      imagePath={author.portrait_image_path}
                      alt={author.portrait_image_alt}
                      caption={author.portrait_image_caption}
                      variant="author-portrait"
                    />
                  </div>

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
                    {getAuthorTypeLabel(author.author_type, t)}
                  </p>

                  <h2
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: "32px",
                      lineHeight: 1.1,
                      margin: 0,
                    }}
                  >
                    <Link
                      href={`/author/${author.slug}`}
                      style={{ color: "var(--artales-ink)", textDecoration: "none" }}
                    >
                      {author.name}
                    </Link>
                  </h2>

                  {years ? (
                    <p style={{ color: "#5f5247", margin: 0 }}>
                      <strong>{t.years}:</strong> {years}
                    </p>
                  ) : null}

                  {author.country ? (
                    <p style={{ color: "#5f5247", margin: 0 }}>
                      <strong>{t.country}:</strong> {author.country}
                    </p>
                  ) : null}

                  {primaryLanguage ? (
                    <p style={{ color: "#5f5247", margin: 0 }}>
                      <strong>{t.primaryLanguage}:</strong> {primaryLanguage}
                    </p>
                  ) : null}

                  {writingLanguages ? (
                    <p style={{ color: "#5f5247", margin: 0 }}>
                      <strong>{common.language}:</strong> {writingLanguages}
                    </p>
                  ) : null}

                  <div style={{ marginTop: "auto", paddingTop: "10px" }}>
                    <Link className="artales-button-secondary" href={`/author/${author.slug}`}>
                      {t.openAuthor}
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
