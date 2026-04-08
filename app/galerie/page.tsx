import Link from "next/link"
import { getWorksForGallery } from "@/lib/dbWorks"

function getWorkLabel(originType: string) {
  switch (originType) {
    case "public_domain":
      return "Volné dílo"
    case "original":
      return "Původní dílo"
    case "translation":
      return "Překlad"
    case "other":
      return "Jiná vrstva"
    default:
      return "Literární dílo"
  }
}

export default async function Galerie() {
  const works = await getWorksForGallery()

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
      <section style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            opacity: 0.7,
            marginBottom: "10px",
          }}
        >
          ARTales
        </p>

        <h1
          style={{
            fontSize: "42px",
            marginBottom: "14px",
            lineHeight: 1.1,
          }}
        >
          Galerie ARTales
        </h1>

        <p
          style={{
            fontSize: "19px",
            maxWidth: "760px",
            marginBottom: "20px",
          }}
        >
          Procházej původní díla, překlady a první publikované vrstvy. Galerie je
          veřejná vstupní vrstva systému ARTales.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            href="/galerie/volna-dila"
            style={{
              padding: "10px 16px",
              border: "1px solid #111",
              textDecoration: "none",
              color: "#111",
            }}
          >
            Volná díla
          </Link>

          <Link
            href="/kolekce/gothic-classics"
            style={{
              padding: "10px 16px",
              border: "1px solid #ccc",
              textDecoration: "none",
              color: "#111",
            }}
          >
            Kolekce
          </Link>
        </div>
      </section>

      <hr style={{ margin: "24px 0 32px 0" }} />

      <section>
        {works.length === 0 ? (
          <p>V galerii zatím nejsou žádná publikovaná díla.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {works.map((work) => (
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
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "13px",
                      opacity: 0.7,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {getWorkLabel(work.origin_type)}
                  </p>

                  <h2
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "28px",
                      lineHeight: 1.15,
                    }}
                  >
                    <Link
                      href={`/dilo/${work.slug}`}
                      style={{ textDecoration: "none", color: "#111" }}
                    >
                      {work.title}
                    </Link>
                  </h2>

                  {work.subtitle ? (
                    <p style={{ margin: "0 0 8px 0", opacity: 0.85 }}>
                      {work.subtitle}
                    </p>
                  ) : null}

                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Autor:</strong>{" "}
                    {work.author ? (
                      <Link href={`/autor/${work.author.slug}`}>
                        {work.author.name}
                      </Link>
                    ) : (
                      "Neznámý autor"
                    )}
                  </p>

                  {work.collection ? (
                    <p style={{ margin: "0 0 8px 0" }}>
                      <strong>Kolekce:</strong>{" "}
                      <Link href={`/kolekce/${work.collection.slug}`}>
                        {work.collection.title}
                      </Link>
                    </p>
                  ) : null}

                  <p style={{ margin: "0 0 10px 0" }}>{work.summary}</p>

                  <p style={{ margin: 0, opacity: 0.8 }}>
                    <strong>Jazyk:</strong> {work.canonical_language}
                  </p>
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