import Link from "next/link"
import { works } from "@/core/works"
import { versions } from "@/core/versions"
import { contributors } from "@/core/contributors"
import { sources } from "@/core/sources"
import { rights } from "@/core/rights"
import { relations } from "@/core/relations"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function DiloDetail({ params }: PageProps) {
  const { id } = await params

  const work = works.find((item) => item.slug === id)

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

  const currentVersion = versions.find(
    (version: any) => version.workId === work.id && version.isCurrent
  )

  const workContributors = contributors.filter(
    (contributor: any) => contributor.workId === work.id
  )

  const mainAuthor =
    workContributors.find((contributor: any) => contributor.roleType === "author") ||
    null

  const workSource =
    sources.find((source: any) => source.workId === work.id) || null

  const workRights =
    rights.find((rightsItem: any) => rightsItem.workId === work.id) || null

  const parentRelation =
    relations.find((relation: any) => relation.childWorkId === work.id) || null

  const parentWork =
    parentRelation
      ? works.find((item) => item.id === parentRelation.parentWorkId) || null
      : null

  const childRelations = relations.filter(
    (relation: any) => relation.parentWorkId === work.id
  )

  const childWorks = childRelations
    .map((relation: any) =>
      works.find((item) => item.id === relation.childWorkId) || null
    )
    .filter(Boolean)

  return (
    <main style={{ padding: "40px", fontFamily: "serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/galerie">← Zpět do Galerie</Link>
      </p>

      <h1>{work.title}</h1>

      <p>
        <strong>Autor:</strong>{" "}
        {mainAuthor ? mainAuthor.entityName : "Neznámý autor"}
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
          <p><strong>Odvozená díla:</strong></p>
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
