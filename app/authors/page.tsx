import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import StorageImageDisplay from "@/components/media/StorageImageDisplay";
import { getAuthorsForPublicGallery } from "@/lib/dbAuthors";
import { getLocalizedLanguageLabel } from "@/lib/dictionaries/language";
import { getCountryLabel } from "@/lib/dictionaries/country";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale } from "@/lib/i18n/server";
import { pickLocalizedText } from "@/lib/localizedContent";

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

      <main className="artales-public-main artales-authors-surface">
        <section className="artales-gallery-hero">
          <p className="artales-public-kicker">{t.authorsEyebrow}</p>
          <h1>{t.authorsTitle}</h1>
          <p>{t.authorsIntro}</p>
        </section>

        {authors.length === 0 ? (
          <p>{t.noPublicAuthors}</p>
        ) : (
          <section className="artales-author-grid">
            {authors.map((author) => {
              const authorName = pickLocalizedText(locale, {
                cs: author.name_cs,
                en: author.name_en,
                fallback: author.name,
              }) ?? author.name;
              const years = formatYears(author.birth_year, author.death_year);
              const countryLabel = getCountryLabel(author.country, locale);
              const primaryLanguage = author.primary_language
                ? getLocalizedLanguageLabel(author.primary_language, locale) ??
                  author.primary_language
                : null;
              const writingLanguages = author.writing_languages
                .map((language) =>
                  getLocalizedLanguageLabel(language, locale) ?? language
                )
                .join(", ");

              return (
                <article key={author.id} className="artales-author-card">
                  <div className="artales-author-card-portrait">
                    <StorageImageDisplay
                      title={authorName}
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
                      {authorName}
                    </Link>
                  </h2>

                  {years ? (
                    <p style={{ color: "#5f5247", margin: 0 }}>
                      <strong>{t.years}:</strong> {years}
                    </p>
                  ) : null}

                  {countryLabel ? (
                    <p style={{ color: "#5f5247", margin: 0 }}>
                      <strong>{t.country}:</strong> {countryLabel}
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
