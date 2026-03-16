import Link from "next/link"
import { works } from "@/core/works"
import { getMainAuthor } from "@/core/helpers"

export default function Galerie() {
  return (
    <main style={{ padding: "40px", fontFamily: "serif", lineHeight: 1.6 }}>
      <h1>Galerie ARTales</h1>

      <p>
        Digitální knihovna živých knih. Čtěte klasická díla, sledujte vznik
        nových textů a zapojte se do literárního procesu.
      </p>

<p>
        <Link href="/galerie/volna-dila">Přejít do sekce Volná díla</Link>
      </p>

      <hr />

      <h2>Díla</h2>

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
    </main>
  )
}