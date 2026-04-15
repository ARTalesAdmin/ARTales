import Link from "next/link"
import { getAuthorBySlug } from "@/lib/dbAuthors"
import { getLanguageLabel } from "@/lib/dictionaries/language"

type PageProps = {
  params: Promise<{ slug: string }>
}

function getAuthorTypeLabel(authorType: string) {
  switch (authorType) {
    case "person":
      return "Osoba"
    case "collective":
      return "Kolektiv"
    case "unknown":
      return "Neznámý autor"
    default:
      return "Autor"
  }
}

export default async function AutorDetail({ params }: PageProps) {
  const { slug } = await params
  const author = await getAuthorBySlug(slug)

  if (!author) {
    return (
      <main style={{ padding: "40px", fontFamily: "serif" }}>
        <h1>Autor nebyl nalezen</h1>
        <p>Požadovaný autor v ARTales zatím neexistuje nebo není veřejně dostupný.</p>
        <p>
          <Link href="/galerie">Zpět do Galerie</Link>
        </p>
      </main>
    )
  }

  const primaryLanguageLabel = getLanguageLabel(author.primary_language, "public")

  const years =
    author.birth_year || author.death_year
      ? `${author.birth_year ?? "?"}–${author.death_year ?? "?"}`
      : null

  return (
    <main
      style={{
        padding: "48px 32px",
        fontFamily: "serif",
        lineHeight: 1.6,
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <p style={{ marginBottom: "20px" }}>
        <Link href="/galerie">{"<- Zpět do Galerie"}</Link>
      </p>

      <section style={{ marginBottom: "36px" }}>
        <p
          style={{
            marginTop: 0,
            marginBottom: "10px",
            fontSize: "13px",
            opacity: 0.7,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {getAuthorTypeLabel(author.author_type)}
        </p>

        <h1
          style={{
            fontSize: "44px",
            lineHeight: 1.1,
            marginTop: 0,
            marginBottom: "12px",
          }}
        >
          {author.name}
        </h1>

        <div style={{ marginBottom: "18px", opacity: 0.85 }}>
          {years ? (
            <p style={{ margin: "0 0 6px 0" }}>
              <strong>Roky:</strong> {years}
            </p>
          ) : null}

          {author.country ? (
            <p style={{ margin: "0 0 6px 0" }}>
              <strong>Země:</strong> {author.country}
            </p>
          ) : null}

          {primaryLanguageLabel ? (
            <p style={{ margin: "0 0 6px 0" }}>
              <strong>Primary language:</strong> {primaryLanguageLabel}
            </p>
          ) : null}
        </div>

        {author.bio ? (
          <p
            style={{
              marginTop: 0,
              marginBottom: "18px",
              fontSize: "18px",
              maxWidth: "760px",
            }}
          >
            {author.bio}
          </p>
        ) : (
          <p style={{ marginTop: 0, marginBottom: "18px", opacity: 0.8 }}>
            Biografie autora zatím nebyla doplněna.
          </p>
        )}
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section>
        <h2 style={{ marginBottom: "16px" }}>Publikovaná díla</h2>

        {author.works.length === 0 ? (
          <p>Tento autor zatím nemá v galerii žádná publikovaná díla.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {author.works.map((work) => (
              <article
                key={work.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "26px",
                      lineHeight: 1.15,
                    }}
                  >
                    <Link
                      href={`/dilo/${work.slug}`}
                      style={{ textDecoration: "none", color: "#111" }}
                    >
                      {work.title}
                    </Link>
                  </h3>

                  {work.subtitle ? (
                    <p style={{ margin: "0 0 8px 0", opacity: 0.85 }}>
                      {work.subtitle}
                    </p>
                  ) : null}

                  <p style={{ margin: "0 0 10px 0" }}>{work.summary}</p>

                  {work.collection ? (
                    <p style={{ margin: 0, opacity: 0.8 }}>
                      <strong>Kolekce:</strong>{" "}
                      <Link href={`/kolekce/${work.collection.slug}`}>
                        {work.collection.title}
                      </Link>
                    </p>
                  ) : null}
                </div>

                <div style={{ marginTop: "auto" }}>
                  <Link
                    href={`/dilo/${work.slug}`}
                    style={{
                      display: "inline-block",
                      marginTop: "8px",
                      padding: "10px 14px",
                      border: "1px solid #111",
                      textDecoration: "none",
                      color: "#111",
                      fontWeight: 600,
                    }}
                  >
                    Zobrazit detail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}