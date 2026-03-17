import Link from "next/link"
import { contributors } from "@/core/contributors"
import { works } from "@/core/works"

type PageProps = {
  params: Promise<{ id: string }>
}

function getAuthorIntro(authorName: string) {
  if (authorName === "ARTales") {
    return "ARTales zde vystupuje jako organizacni autor a vydavatelska vrstva pro interni preklady, edice a dalsi textove vrstvy vznikajici v systemu."
  }

  return "Autor nebo autorska entita publikovana v systemu ARTales."
}

export default async function AutorDetail({ params }: PageProps) {
  const { id } = await params
  const authorId = decodeURIComponent(id)

  const authorContributions = contributors.filter(
    (c) => c.entityName === authorId && c.roleType === "author"
  )

  if (authorContributions.length === 0) {
    return (
      <main
        style={{
          padding: "48px 32px",
          fontFamily: "serif",
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <h1>Autor nenalezen</h1>
        <p>Tento autor zatim v ARTales neexistuje.</p>
        <p>
          <Link href="/galerie">{"<- Zpet do Galerie"}</Link>
        </p>
      </main>
    )
  }

  const authorName = authorContributions[0].entityName

  const authoredWorks = authorContributions
    .map((c) => works.find((w) => w.id === c.workId))
    .filter(Boolean)

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
        <Link href="/galerie">{"<- Zpet do Galerie"}</Link>
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 240px",
          gap: "32px",
          alignItems: "start",
          marginBottom: "36px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "14px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              opacity: 0.7,
              marginBottom: "10px",
            }}
          >
            Autor
          </p>

          <h1
            style={{
              fontSize: "42px",
              lineHeight: 1.1,
              marginTop: 0,
              marginBottom: "14px",
            }}
          >
            {authorName}
          </h1>

          <p
            style={{
              fontSize: "18px",
              maxWidth: "760px",
              marginBottom: "18px",
            }}
          >
            {getAuthorIntro(authorName)}
          </p>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              style={{
                padding: "12px 18px",
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Projit dila autora
            </button>

            <button
              style={{
                padding: "12px 18px",
                border: "1px solid #ccc",
                background: "#fff",
                color: "#111",
                cursor: "pointer",
              }}
            >
              Sledovat autora
            </button>
          </div>
        </div>

        <aside>
          <div
            style={{
              border: "1px solid #ddd",
              minHeight: "260px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "20px",
              opacity: 0.75,
            }}
          >
            Fotka / vizual autora
          </div>
        </aside>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Bio / kontext</h2>
        <p>
          Tato sekce bude pozdeji slouzit pro rozsireny profil autora, bio,
          kontext tvorby, vztah k ARTales a dalsi profilove vrstvy.
        </p>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Dila v ARTales</h2>

        {authoredWorks.length === 0 ? (
          <p>Tento autor zatim nema v ARTales zadna dila.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {authoredWorks.map((work: any) => (
              <article
                key={work.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "18px",
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: "10px" }}>
                  <Link href={`/dilo/${work.slug}`}>{work.title}</Link>
                </h3>

                <p style={{ marginTop: 0, marginBottom: "10px" }}>
                  {work.summary}
                </p>

                <p style={{ marginTop: 0, opacity: 0.8 }}>
                  <strong>Jazyk:</strong> {work.canonicalLanguage}
                </p>

                <p>
                  <Link href={`/dilo/${work.slug}`}>Zobrazit detail</Link>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}