import { works } from "../../../data/works"
import Link from "next/link"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function DiloDetail({ params }: PageProps) {
  const { id } = await params

  const work = works.find((item) => item.id === id)

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

  return (
    <main style={{ padding: "40px", fontFamily: "serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/galerie">← Zpět do Galerie</Link>
      </p>

      <h1>{work.title}</h1>

      <p>
        <strong>Autor:</strong> {work.author}
      </p>

      {work.year && (
        <p>
          <strong>Rok:</strong> {work.year}
        </p>
      )}

      <p>
        <strong>Jazyk:</strong> {work.language}
      </p>

      <p>
        <strong>Stav:</strong> {work.status}
      </p>

      <p>
        <strong>Typ zdroje:</strong> {work.sourceType}
      </p>

      <p>
        <strong>Tagy:</strong> {work.tags.join(", ")}
      </p>

      <hr />

      <h2>O tomto díle</h2>
      <p>{work.shortDesc}</p>

      <hr />

      <h2>Ukázka textu</h2>
      <p style={{ whiteSpace: "pre-wrap" }}>{work.text}</p>

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