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

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function DiloDetail({ params }: PageProps) {
  const { id } = await params

  const work = getWorkBySlug(id)

  if (!work) {
    return (
      <main style={{ padding: "40px", fontFamily: "serif" }}>
        <h1>Dílo nebylo nalezeno</h1>
        <p>Požadované dílo v ARTales zatím neexistuje.</p>
        <p>
          <Link href="/galerie">Zpět do Galerie</Link>
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

  return (
    <main style={{ padding: "40px", fontFamily: "serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/galerie">← Zpět do Galerie</Link>
      </p>

      <h1>{work.title}</h1>

      <p>
  <strong>Autor:</strong>{" "}
  {mainAuthor ? (
    <Link href={`/autor/${encodeURIComponent(mainAuthor.entityName)}`}>
      {mainAuthor.entityName}
    </Link>
  ) : (
    "Neznámý autor"
  )}
</p>

      <p>
        <strong>Typ díla:</strong> {work.workType}
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
            <strong>Odvozená díla:</strong>
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
          <strong>Právní status:</strong> {workRights.legalStatus}
        </p>
      )}

      <hr />

      <h2>O tomto díle</h2>
      <p>{work.summary}</p>

      <hr />

      <h2>Text</h2>
      <p style={{ whiteSpace: "pre-wrap" }}>
        {currentVersion ? currentVersion.content : "Text zatím není dostupný."}
      </p>

      <hr />

      <h2>Tiráž / vrstvy</h2>
      <ul>
        {workContributors.map((contributor: any) => (
          <li key={contributor.id}>
            {contributor.entityName} — {contributor.roleType}
          </li>
        ))}
      </ul>

      <hr />

      <h2>Možnosti</h2>
      <ul>
        <li>Přečíst celé</li>
        <li>Stáhnout PDF</li>
        <li>Objednat tisk</li>
        <li>Sledovat dílo</li>
      </ul>
    </main>
  )
}