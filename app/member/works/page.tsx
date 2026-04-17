import Link from "next/link"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getWorksForMember } from "@/lib/dbWorks"
import { getLanguageLabel } from "@/lib/dictionaries/language"
import { getStatusLabel } from "@/lib/dictionaries/status"

export default async function MemberWorksPage() {
  await requireEditorOrAdmin()

  const works = await getWorksForMember()

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
          Díla
        </h1>

        <p style={{ maxWidth: "720px", marginBottom: "18px" }}>
          Přehled děl v systému ARTales. Odtud můžeš zakládat a upravovat obsah
          přes blokový editor.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            href="/member/works/new"
            style={{
              padding: "10px 14px",
              border: "1px solid #111",
              textDecoration: "none",
              color: "#111",
              fontWeight: 600,
            }}
          >
            Nové dílo
          </Link>
        </div>
      </section>

      <hr style={{ margin: "24px 0 32px 0" }} />

      {works.length === 0 ? (
        <p>Zatím neexistují žádná díla.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
          }}
        >
          {works.map((work) => {
            const languageLabel = getLanguageLabel(
              work.canonical_language,
              "internal"
            )
            const statusLabel = getStatusLabel(work.status, "internal")

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
                  <h2
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "28px",
                      lineHeight: 1.15,
                    }}
                  >
                    {work.title}
                  </h2>

                  {work.subtitle ? (
                    <p style={{ margin: "0 0 8px 0", opacity: 0.85 }}>
                      {work.subtitle}
                    </p>
                  ) : null}

                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Autor:</strong>{" "}
                    {work.author ? work.author.name : "—"}
                  </p>

                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Jazyk:</strong> {languageLabel ?? work.canonical_language}
                  </p>

                  <p style={{ margin: "0 0 8px 0" }}>
                    <strong>Status:</strong> {statusLabel ?? work.status}
                  </p>

                  {work.collection ? (
                    <p style={{ margin: 0 }}>
                      <strong>Kolekce:</strong> {work.collection.title}
                    </p>
                  ) : null}
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/dilo/${work.slug}`}
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
                    href={`/member/works/${work.slug}/edit`}
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