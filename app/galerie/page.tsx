import Link from "next/link"
import { works } from "@/core/works"
import { getMainAuthor } from "@/core/helpers"

function getWorkLabel(work: any) {
  if (work.slug === "dracula-cz-translation") {
    return "Cesky preklad puvodniho dila"
  }

  if (work.workType === "original") {
    return "Puvodni dilo"
  }

  if (work.workType === "translation") {
    return "Preklad"
  }

  if (work.workType === "remix") {
    return "Odvozene dilo"
  }

  return "Literarni dilo"
}

export default function Galerie() {
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
          Prochazej puvodni dila, preklady, odvozene vrstvy a prvni publikacni
          formy. Galerie je verejna vstupni vrstva systemu ARTales.
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
            Volna dila
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
          }}
        >
          {works.map((work) => {
            const mainAuthor = getMainAuthor(work.id)

            return (
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
                    {getWorkLabel(work)}
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

                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Autor:</strong>{" "}
                    {mainAuthor ? (
                      <Link
                        href={`/autor/${encodeURIComponent(
                          mainAuthor.entityName
                        )}`}
                      >
                        {mainAuthor.entityName}
                      </Link>
                    ) : (
                      "Neznamy autor"
                    )}
                  </p>

                  <p style={{ margin: "0 0 10px 0" }}>{work.summary}</p>

                  <p style={{ margin: 0, opacity: 0.8 }}>
                    <strong>Jazyk:</strong> {work.canonicalLanguage}
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
            )
          })}
        </div>
      </section>
    </main>
  )
}