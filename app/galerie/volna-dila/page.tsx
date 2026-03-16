import Link from "next/link"
import { getPublicDomainGutenbergWorks, getMainAuthor } from "@/core/helpers"

export default function VolnaDilaPage() {
  const works = getPublicDomainGutenbergWorks()

  return (
    <main style={{ padding: "40px", fontFamily: "serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/galerie">← Zpět do Galerie</Link>
      </p>

      <h1>Volná díla</h1>

      <p>
        Tato sekce obsahuje texty z veřejné domény. V aktuální implementaci jde
        o díla vedená jako public domain a současně importovaná z Project
        Gutenberg.
      </p>

      <hr />

      {works.length === 0 ? (
        <p>V této sekci zatím nejsou žádná díla.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {works.map((work) => {
            const mainAuthor = getMainAuthor(work.id)

            return (
              <li
                key={work.id}
                style={{
                  marginBottom: "24px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                <h3 style={{ marginBottom: "6px" }}>
                  <Link href={`/dilo/${work.slug}`}>{work.title}</Link>
                </h3>

                <p style={{ margin: "4px 0" }}>
                  <strong>Autor:</strong>{" "}
                  {mainAuthor ? (
                    <Link
                      href={`/autor/${encodeURIComponent(mainAuthor.entityName)}`}
                    >
                      {mainAuthor.entityName}
                    </Link>
                  ) : (
                    "Neznámý autor"
                  )}
                </p>

                <p style={{ margin: "4px 0" }}>{work.summary}</p>

                <p style={{ margin: "4px 0" }}>
                  <strong>Typ:</strong> {work.workType} | <strong>Jazyk:</strong>{" "}
                  {work.canonicalLanguage} | <strong>Stav:</strong> {work.status}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}