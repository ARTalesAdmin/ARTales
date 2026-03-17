import Link from "next/link"
import {
  getCollectionBySlug,
  getWorksByCollectionId,
} from "@/publishing/helpers"
import { getMainAuthor } from "@/core/helpers"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function KolekceDetail({ params }: PageProps) {
  const { id } = await params

  const collection = getCollectionBySlug(id)

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
        <p>Tato kolekce v ARTales zatim neexistuje.</p>
        <p>
          <Link href="/galerie">{"<- Zpet do Galerie"}</Link>
        </p>
      </main>
    )
  }

  const works = getWorksByCollectionId(collection.id)

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
            {collection.description}
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
              Projit dila v kolekci
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
            Vizual / cover kolekce
          </div>
        </aside>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Dila v kolekci</h2>

        {works.length === 0 ? (
          <p>V teto kolekci zatim nejsou zadna dila.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {works.map((work: any) => {
              const mainAuthor = getMainAuthor(work.id)

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
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}