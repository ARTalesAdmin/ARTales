import Link from "next/link"
import { getCollectionBySlug } from "@/lib/dbCollections"
import { getLanguageLabel } from "@/lib/dictionaries/language"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function KolekceDetail({ params }: PageProps) {
  const { slug } = await params
  const collection = await getCollectionBySlug(slug)

  if (!collection) {
    return (
      <main
        style={{
          padding: "48px 32px",
          fontFamily: "serif",
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <h1>Kolekce nenalezena</h1>
        <p>Tato kolekce v ARTales zatím neexistuje nebo není veřejně dostupná.</p>
        <p>
          <Link href="/galerie">{"<- Zpět do Galerie"}</Link>
        </p>
      </main>
    )
  }

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
            Kolekce
          </p>

          <h1
            style={{
              fontSize: "42px",
              lineHeight: 1.1,
              marginTop: 0,
              marginBottom: "14px",
            }}
          >
            {collection.title}
          </h1>

          <p
            style={{
              fontSize: "18px",
              maxWidth: "760px",
              marginBottom: "18px",
            }}
          >
            {collection.description ?? "Popis kolekce zatím nebyl doplněn."}
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
              Projít díla v kolekci
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
            Vizuál / cover kolekce
          </div>
        </aside>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Díla v kolekci</h2>

        {collection.works.length === 0 ? (
          <p>V této kolekci zatím nejsou žádná publikovaná díla.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {collection.works.map((work) => {
              const languageLabel = getLanguageLabel(
                work.canonical_language,
                "public"
              )

              return (
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
                    <strong>Autor:</strong>{" "}
                    {work.author ? (
                      <Link href={`/autor/${work.author.slug}`}>
                        {work.author.name}
                      </Link>
                    ) : (
                      "Neznámý autor"
                    )}
                  </p>

                  {work.subtitle ? (
                    <p style={{ marginTop: 0, marginBottom: "10px", opacity: 0.85 }}>
                      {work.subtitle}
                    </p>
                  ) : null}

                  <p style={{ marginTop: 0, marginBottom: "10px" }}>{work.summary}</p>

                  <p style={{ marginTop: 0, opacity: 0.8 }}>
                    <strong>Language:</strong>{" "}
                    {languageLabel ?? work.canonical_language}
                  </p>

                  <p>
                    <Link href={`/dilo/${work.slug}`}>Zobrazit detail</Link>
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}