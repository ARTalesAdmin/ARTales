import Link from "next/link"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getCollectionsForMember } from "@/lib/dbCollections"

export default async function MemberCollectionsPage() {
  await requireEditorOrAdmin()

  const collections = await getCollectionsForMember()

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
          Kolekce
        </h1>

        <p style={{ maxWidth: "720px", marginBottom: "18px" }}>
          Přehled kolekcí v systému ARTales. Kolekce slouží jako veřejné i interní
          seskupení děl.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            href="/member/collections/new"
            style={{
              padding: "10px 14px",
              border: "1px solid #111",
              textDecoration: "none",
              color: "#111",
              fontWeight: 600,
            }}
          >
            Nová kolekce
          </Link>
        </div>
      </section>

      <hr style={{ margin: "24px 0 32px 0" }} />

      {collections.length === 0 ? (
        <p>Zatím neexistují žádné kolekce.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
          }}
        >
          {collections.map((collection) => (
            <article
              key={collection.id}
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
                  {collection.title}
                </h2>

                {collection.description ? (
                  <p style={{ margin: "0 0 8px 0", opacity: 0.85 }}>
                    {collection.description}
                  </p>
                ) : (
                  <p style={{ margin: "0 0 8px 0", opacity: 0.65 }}>
                    Popis zatím nebyl doplněn.
                  </p>
                )}

                <p style={{ margin: "0 0 8px 0" }}>
                  <strong>Slug:</strong> {collection.slug}
                </p>

                <p style={{ margin: 0, opacity: 0.8 }}>
                  <strong>Veřejná:</strong>{" "}
                  {collection.is_public_visible ? "ano" : "ne"}
                </p>
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
                  href={`/kolekce/${collection.slug}`}
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
                  href={`/member/collections/${collection.slug}/edit`}
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
          ))}
        </div>
      )}
    </main>
  )
}