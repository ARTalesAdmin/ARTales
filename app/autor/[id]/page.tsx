import Link from "next/link"
import { contributors } from "@/core/contributors"
import { works } from "@/core/works"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AutorDetail({ params }: PageProps) {
  const { id } = await params
  const authorId = decodeURIComponent(id)

  const authorContributions = contributors.filter(
    (c) => c.entityName === authorId && c.roleType === "author"
  )

  if (authorContributions.length === 0) {
    return (
      <main style={{ padding: "40px", fontFamily: "serif" }}>
        <h1>Autor nenalezen</h1>
        <p>Tento autor zatím v ARTales neexistuje.</p>
        <Link href="/galerie">Zpět do Galerie</Link>
      </main>
    )
  }

  const authorName = authorContributions[0].entityName

  const authoredWorks = authorContributions
    .map((c) => works.find((w) => w.id === c.workId))
    .filter(Boolean)

  return (
    <main style={{ padding: "40px", fontFamily: "serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/galerie">← Zpět do Galerie</Link>
      </p>

      <h1>{authorName}</h1>

      <p>Autor publikovaný v systému ARTales.</p>

      <hr />

      <h2>Díla</h2>

      <ul>
        {authoredWorks.map((work: any) => (
          <li key={work.id}>
            <Link href={`/dilo/${work.slug}`}>{work.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}