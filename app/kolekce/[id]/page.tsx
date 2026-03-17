import Link from "next/link"
import { getCollectionBySlug, getWorksByCollectionId } from "@/publishing/helpers"
import { getMainAuthor } from "@/core/helpers"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function KolekceDetail({ params }: PageProps) {
  const { id } = await params

  const collection = getCollectionBySlug(id)

  if (!collection) {
    return (
      <main style={{ padding: "40px", fontFamily: "serif" }}>
        <h1>Kolekce nenalezena</h1>
        <p>Tato kolekce v ARTales zatím neexistuje.</p>
        <p>
          <Link href="/galerie">Zpět do Galerie</Link>
        </p>
      </main>
    )
  }

  const works = getWorksByCollectionId(collection.id)

  return (
    <main style={{ padding: "40px", fontFamily: "serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/galerie">{"<- Zpet do Galerie"}</Link>
      </p>

      <h1>{collection.title}</h1>
      <p>{collection.description}</p>

      <hr />

      <h2>Díla v kolekci</h2>

      {works.length === 0 ? (
        <p>V této kolekci zatím nejsou žádná díla.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {works.map((work: any) => {
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
                    <Link href={`/autor/${encodeURIComponent(mainAuthor.entityName)}`}>
                      {mainAuthor.entityName}
                    </Link>
                  ) : (
                    "Neznamy autor"
                  )}
                </p>

                <p style={{ margin: "4px 0" }}>{work.summary}</p>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
