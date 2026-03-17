import Link from "next/link"
import {
  getWorkBySlug,
  getCurrentVersion,
  getWorkContributors,
  getMainAuthor,
  getWorkSource,
  getWorkRights,
  getParentWork,
  getChildWorks,
} from "@/core/helpers"
import {
  getEditionsWithProductsByWorkId,
  getCollectionsByWorkId,
} from "@/publishing/helpers"

type PageProps = {
  params: Promise<{ id: string }>
}

function getPrimaryActions(editionsWithProducts: any[]) {
  const allProducts = editionsWithProducts.flatMap((item) => item.products)

  const hasPdf = allProducts.some(
    (product: any) => product.productType === "digital_download"
  )

  const hasPrint = allProducts.some(
    (product: any) =>
      product.productType === "paperback" ||
      product.productType === "hardcover"
  )

  return {
    hasPdf,
    hasPrint,
  }
}

export default async function DiloDetail({ params }: PageProps) {
  const { id } = await params

  const work = getWorkBySlug(id)

  if (!work) {
    return (
      <main style={{ padding: "40px", fontFamily: "serif" }}>
        <h1>Dilo nebylo nalezeno</h1>
        <p>Pozadovane dilo v ARTales zatim neexistuje.</p>
        <p>
          <Link href="/galerie">Zpet do Galerie</Link>
        </p>
      </main>
    )
  }

  const currentVersion = getCurrentVersion(work.id)
  const workContributors = getWorkContributors(work.id)
  const mainAuthor = getMainAuthor(work.id)
  const workSource = getWorkSource(work.id)
  const workRights = getWorkRights(work.id)
  const parentWork = getParentWork(work.id)
  const childWorks = getChildWorks(work.id)
  const editionsWithProducts = getEditionsWithProductsByWorkId(work.id)
  const collections = getCollectionsByWorkId(work.id)

  const excerpt =
    currentVersion?.content
      ? currentVersion.content.slice(0, 420) +
        (currentVersion.content.length > 420 ? "..." : "")
      : "Ukazka textu zatim neni dostupna."

  const actions = getPrimaryActions(editionsWithProducts)

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
          gridTemplateColumns: "minmax(0, 1fr) 260px",
          gap: "32px",
          alignItems: "start",
          marginBottom: "36px",
        }}
      >
        <div>
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

          <p style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px" }}>
            <strong>Autor:</strong>{" "}
            {mainAuthor ? (
              <Link href={`/autor/${encodeURIComponent(mainAuthor.entityName)}`}>
                {mainAuthor.entityName}
              </Link>
            ) : (
              "Neznamy autor"
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

          {collections.length > 0 && (
            <div style={{ marginBottom: "18px" }}>
              <p style={{ marginBottom: "8px" }}>
                <strong>Zarazeno v kolekcich:</strong>
              </p>
              <ul style={{ marginTop: 0 }}>
                {collections.map((collection: any) => (
                  <li key={collection.id}>
                    <Link href={`/kolekce/${collection.slug}`}>
                      {collection.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              Cist ukazku
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
              Cist online
            </button>

            {actions.hasPdf && (
              <button
                style={{
                  padding: "12px 18px",
                  border: "1px solid #111",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                }}
              >
                Koupit PDF
              </button>
            )}

            {actions.hasPrint && (
              <button
                style={{
                  padding: "12px 18px",
                  border: "1px solid #111",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                }}
              >
                Objednat tisk
              </button>
            )}

            <button
              style={{
                padding: "12px 18px",
                border: "1px solid #ccc",
                background: "#fff",
                color: "#111",
                cursor: "pointer",
              }}
            >
              Sledovat dilo
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
            Obalka / vizual dila
          </div>
        </aside>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Ukazka textu</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{excerpt}</p>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Dostupne verze</h2>

        {editionsWithProducts.length === 0 ? (
          <p>Pro toto dilo zatim nejsou dostupne zadne edice ani produkty.</p>
        ) : (
          <div>
            {editionsWithProducts.map((item: any) => (
              <div
                key={item.edition.id}
                style={{
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                <p>
                  <strong>{item.edition.title}</strong>
                </p>
                <p>
                  Format: {item.edition.format} | Jazyk: {item.edition.language}
                </p>

                {item.products.length === 0 ? (
                  <p>Pro tuto edici zatim nejsou produkty.</p>
                ) : (
                  <ul>
                    {item.products.map((product: any) => (
                      <li key={product.id}>
                        <span>{product.title}</span>
                        <span>{" - "}</span>
                        <span>{product.productType}</span>
                        {product.priceCzk ? (
                          <span>
                            {" - " +
                              product.priceCzk +
                              " " +
                              (product.currency || "")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Vztahy a souvislosti</h2>

        {parentWork && (
          <p>
            <strong>Vychazi z:</strong>{" "}
            <Link href={`/dilo/${parentWork.slug}`}>{parentWork.title}</Link>
          </p>
        )}

        {childWorks.length > 0 && (
          <div>
            <p>
              <strong>Dalsi vrstvy a odvozena dila:</strong>
            </p>
            <ul>
              {childWorks.map((child: any) => (
                <li key={child.id}>
                  <Link href={`/dilo/${child.slug}`}>{child.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!parentWork && childWorks.length === 0 && (
          <p>Toto dilo zatim nema navazane zadne dalsi vrstvy.</p>
        )}
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>Tiraz a puvod</h2>

        <ul>
          {workContributors.map((contributor: any) => (
            <li key={contributor.id}>
              {contributor.entityName} - {contributor.roleType}
            </li>
          ))}
        </ul>

        {workSource && (
          <p>
            <strong>Zdroj:</strong> {workSource.sourceLabel}
          </p>
        )}

        {workRights && (
          <p>
            <strong>Pravni status:</strong> {workRights.legalStatus}
          </p>
        )}
      </section>
    </main>
  )
}