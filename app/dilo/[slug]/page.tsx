import Link from "next/link"
import { getWorkBySlug } from "@/lib/dbWorks"
import { getLanguageLabel } from "@/lib/dictionaries/language"

type PageProps = {
  params: Promise<{ slug: string }>
}

function getOriginLabel(originType: string) {
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

function getSourceLabel(sourceLabel: string) {
  switch (sourceLabel) {
    case "gutenberg":
      return "Project Gutenberg"
    case "web":
      return "Web"
    case "manual":
      return "Ruční vložení"
    case "original":
      return "Původní zdroj"
    default:
      return sourceLabel
  }
}

export default async function DiloDetail({ params }: PageProps) {
  const { slug } = await params
  const work = await getWorkBySlug(slug)

  if (!work) {
    return (
      <main style={{ padding: "40px", fontFamily: "serif" }}>
        <h1>Dílo nebylo nalezeno</h1>
        <p>Požadované dílo v ARTales zatím neexistuje nebo není veřejně dostupné.</p>
        <p>
          <Link href="/galerie">Zpět do Galerie</Link>
        </p>
      </main>
    )
  }

  const languageLabel = getLanguageLabel(work.canonical_language, "public")

  const excerpt =
    work.content.length > 800
      ? work.content.slice(0, 800) + "..."
      : work.content

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
          gridTemplateColumns: "minmax(0, 1fr) 260px",
          gap: "32px",
          alignItems: "start",
          marginBottom: "36px",
        }}
      >
        <div>
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
            {getOriginLabel(work.origin_type)}
          </p>

          <h1
            style={{
              fontSize: "44px",
              lineHeight: 1.1,
              marginTop: 0,
              marginBottom: "12px",
            }}
          >
            {work.title}
          </h1>

          {work.subtitle ? (
            <p style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px", opacity: 0.85 }}>
              {work.subtitle}
            </p>
          ) : null}

          <p style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px" }}>
            <strong>Autor:</strong>{" "}
            {work.author ? (
              <Link href={`/autor/${work.author.slug}`}>
                {work.author.name}
              </Link>
            ) : (
              "Neznámý autor"
            )}
          </p>

          <p
            style={{
              marginTop: 0,
              marginBottom: "18px",
              fontSize: "18px",
              maxWidth: "760px",
            }}
          >
            {work.summary}
          </p>

          {work.collection ? (
            <p style={{ marginTop: 0, marginBottom: "18px" }}>
              <strong>Kolekce:</strong>{" "}
              <Link href={`/kolekce/${work.collection.slug}`}>
                {work.collection.title}
              </Link>
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "20px",
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
              Číst ukázku
            </button>

            <button
              style={{
                padding: "12px 18px",
                border: "1px solid #111",
                background: "#fff",
                color: "#111",
                cursor: "pointer",
              }}
            >
              Číst online
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
              Sledovat dílo
            </button>
          </div>
        </div>

        <aside>
          <div
            style={{
              border: "1px solid #ddd",
              minHeight: "360px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              textAlign: "center",
              opacity: 0.75,
            }}
          >
            Obálka / vizuál díla
          </div>
        </aside>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Ukázka textu</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{excerpt}</p>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Původ a metadata</h2>

        <p>
          <strong>Typ vrstvy:</strong> {getOriginLabel(work.origin_type)}
        </p>

        <p>
          <strong>Zdroj:</strong> {getSourceLabel(work.source_label)}
        </p>

        {work.source_reference ? (
          <p>
            <strong>Reference:</strong> {work.source_reference}
          </p>
        ) : null}

        <p>
          <strong>Language:</strong> {languageLabel ?? work.canonical_language}
        </p>

        <p>
          <strong>Stav:</strong> {work.status}
        </p>
      </section>

      {work.author?.bio ? (
        <>
          <hr style={{ margin: "28px 0" }} />

          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ marginBottom: "12px" }}>O autorovi</h2>
            <p>{work.author.bio}</p>
          </section>
        </>
      ) : null}

      {work.collection?.description ? (
        <>
          <hr style={{ margin: "28px 0" }} />

          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ marginBottom: "12px" }}>O kolekci</h2>
            <p>{work.collection.description}</p>
          </section>
        </>
      ) : null}
    </main>
  )
}