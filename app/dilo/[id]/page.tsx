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
import { getEditionsWithProductsByWorkId } from "@/publishing/helpers"

type PageProps = {
  params: Promise<{ id: string }>
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

  return (
    <main style={{ padding: "40px", fontFamily: "serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/galerie">{"<- Zpet do Galerie"}</Link>
      </p>

      <h1>{work.title}</h1>

      <p>
        <strong>Autor:</strong>{" "}
        {mainAuthor ? (
          <Link href={`/autor/${encodeURIComponent(mainAuthor.entityName)}`}>
            {mainAuthor.entityName}
          </Link>
        ) : (
          "Neznamy autor"
        )}
      </p>

      <p>
        <strong>Typ dila:</strong> {work.workType}
      </p>

      <p>
        <strong>Jazyk:</strong> {work.canonicalLanguage}
      </p>

      <p>
        <strong>Stav:</strong> {work.status}
      </p>

      {parentWork && (
        <p>
          <strong>Odvozeno z:</strong>{" "}
          <Link href={`/dilo/${parentWork.slug}`}>{parentWork.title}</Link>
        </p>
      )}

      {childWorks.length > 0 && (
        <div>
          <p>
            <strong>Odvozena dila:</strong>
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

      <hr />

      <h2>O tomto dile</h2>
      <p>{work.summary}</p>

      <hr />

      <h2>Text</h2>
      <p style={{ whiteSpace: "pre-wrap" }}>
        {currentVersion ? currentVersion.content : "Text zatim neni dostupny."}
      </p>

      <hr />

      <h2>Tiraz / vrstvy</h2>
      <ul>
        {workContributors.map((contributor: any) => (
          <li key={contributor.id}>
            {contributor.entityName} - {contributor.roleType}
          </li>
        ))}
      </ul>

      <hr />

      <h2>Edice a produkty</h2>

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
                <strong>Edice:</strong> {item.edition.title}
              </p>
              <p>
                <strong>Format:</strong> {item.edition.format} |{" "}
                <strong>Jazyk:</strong> {item.edition.language} |{" "}
                <strong>Stav:</strong> {item.edition.status}
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
          <span>{" - " + product.priceCzk + " " + (product.currency || "")}</span>
        ) : null}
      </li>
    ))}
  </ul>
)}
              )
            </div>
          ))}
        </div>
      )}

      <hr />

      <h2>Moznosti</h2>
      <ul>
        <li>Precist cele</li>
        <li>Stahnout PDF</li>
        <li>Objednat tisk</li>
        <li>Sledovat dilo</li>
      </ul>
    </main>
  )
}