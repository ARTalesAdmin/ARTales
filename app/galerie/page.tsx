import Link from "next/link"
import { works } from "../../data/works"

export default function Galerie() {
  return (
    <main style={{ padding: "40px", fontFamily: "serif" }}>
      <h1>Galerie ARTales</h1>

      <p>
        Digitální knihovna živých knih. Čtěte klasická díla,
        sledujte vznik nových textů a zapojte se do literárního procesu.
      </p>

      <hr />

      <h2>Díla</h2>

      <ul>
        {works.map((work) => (
          <li key={work.id} style={{ marginBottom: "20px" }}>
            <h3>
              <Link href={`/dilo/${work.id}`}>{work.title}</Link>
            </h3>
            <p>
              {work.author} {work.year ? `(${work.year})` : ""}
            </p>
            <p>{work.shortDesc}</p>
            <p>
              <strong>Tagy:</strong> {work.tags.join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}