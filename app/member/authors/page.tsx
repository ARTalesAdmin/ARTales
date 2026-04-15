import Link from "next/link"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getAuthorsForMember } from "@/lib/dbAuthors"
import { getLanguageLabel } from "@/lib/dictionaries/language"

function formatLifeSpan(birth?: number | null, death?: number | null) {
  if (!birth && !death) return null
  if (birth && !death) return `${birth}–`
  if (birth && death) return `${birth}–${death}`
  return null
}

export default async function MemberAuthorsPage() {
  await requireEditorOrAdmin()
  const authors = await getAuthorsForMember()

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
        <Link href="/member">{"<- Zpět do členské zóny"}</Link>
      </p>

      <section style={{ marginBottom: "28px" }}>
        <p
          style={{
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            opacity: 0.7,
            marginBottom: "10px",
          }}
        >
          ARTales · Editor
        </p>

        <h1
          style={{
            fontSize: "40px",
            lineHeight: 1.1,
            marginTop: 0,
            marginBottom: "14px",
          }}
        >
          Autoři
        </h1>

        <p style={{ maxWidth: "720px", marginBottom: "18px" }}>
          Interní přehled autorů v systému ARTales.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            href="/member/authors/new"
            style={{
              padding: "10px 14px",
              border: "1px solid #111",
              textDecoration: "none",
              color: "#111",
              fontWeight: 600,
            }}
          >
            Nový autor
          </Link>
        </div>
      </section>

      <hr style={{ margin: "24px 0 32px 0" }} />

      {authors.length === 0 ? (
        <p>V systému zatím nejsou žádní autoři.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "18px",
          }}
        >
          {authors.map((author) => {
            const languageLabel = getLanguageLabel(author.primary_language, "internal")
            const lifeSpan = formatLifeSpan(author.birth_year, author.death_year)

            return (
              <article
                key={author.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "13px",
                      opacity: 0.7,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {author.author_type}
                  </p>

                  <h2
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "28px",
                      lineHeight: 1.15,
                    }}
                  >
                    {author.name}
                  </h2>

                  {lifeSpan ? (
                    <p style={{ margin: "0 0 8px 0" }}>
                      <strong>Roky:</strong> {lifeSpan}
                    </p>
                  ) : null}

                  {author.country ? (
                    <p style={{ margin: "0 0 8px 0" }}>
                      <strong>Země:</strong> {author.country}
                    </p>
                  ) : null}

                  {languageLabel ? (
                    <p style={{ margin: "0 0 8px 0" }}>
                      <strong>Jazyk:</strong> {languageLabel}
                    </p>
                  ) : null}

                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Slug:</strong> {author.slug}
                  </p>

                  <p style={{ margin: 0, opacity: 0.8 }}>
                    <strong>Veřejný:</strong>{" "}
                    {author.is_public_visible ? "ano" : "ne"}
                  </p>
                </div>

                <div style={{ marginTop: "auto", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <Link
                    href={`/autor/${author.slug}`}
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #ccc",
                      textDecoration: "none",
                      color: "#111",
                    }}
                  >
                    Veřejný detail
                  </Link>

                  <Link
                    href={`/member/authors/${author.slug}/edit`}
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #111",
                      textDecoration: "none",
                      color: "#111",
                      fontWeight: 600,
                    }}
                  >
                    Editovat
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}