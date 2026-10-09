import Link from "next/link"
import { notFound } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates"

const scenarios = [
  {
    title: "Kandidát připravený k vytvoření konceptu",
    state: "modelový úspěch",
    eligible: true,
    checks: [
      ["Autor", "jednoznačně spárován"],
      ["Původní text", "práva ověřena"],
      ["Konkrétní edice", "ověřena, doplňky vyloučeny"],
      ["Gutenberg wrapper", "vyloučit z importu"],
      ["Ilustrace", "nezahrnovat; zvlášť ověřit"],
      ["Výsledek", "1 nový koncept, bez publikace"],
    ],
  },
  {
    title: "Chybí propojení se skutečným autorem",
    state: "blokováno",
    eligible: false,
    checks: [["Autor", "nutno ručně potvrdit autora v ARTales"],["Výsledek", "bez zápisu do works"]],
  },
  {
    title: "Překlad má jiného držitele práv",
    state: "blokováno",
    eligible: false,
    checks: [["Původní dílo", "práva mohou být volná"],["Překlad", "nepoužitelný pro tuto edici"],["Výsledek", "zvolit původní jazyk nebo jiné vydání"]],
  },
  {
    title: "Konkrétní edice čeká na prověření",
    state: "blokováno",
    eligible: false,
    checks: [["Původní text", "práva ověřena"],["Edice / přepis", "zatím nepotvrzeno"],["Výsledek", "nevytvářet koncept z neověřeného zdroje"]],
  },
]

export default async function CandidatePromotionPreviewPage() {
  if (!isCandidatesFixturePreview()) notFound()
  await requireEditorOrAdmin()

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px", lineHeight: 1.55 }}>
      <p><Link href="/member/candidates">{"← Zpět na kandidáty"}</Link></p>
      <p style={{ textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 12, opacity: 0.7 }}>ARTales · Editor · P1-2C1</p>
      <h1 style={{ fontSize: 36, lineHeight: 1.15, marginBottom: 12 }}>Kandidát → koncept díla</h1>
      <aside style={{ border: "1px solid #b49c71", padding: 16, background: "#fff8eb", marginBottom: 24 }}>
        <strong>Bezpečný interaktivně neaktivní náhled workflow.</strong>
        <p style={{ marginBottom: 0 }}>Všechny níže uvedené případy jsou testovací scénáře. Žádný z nich nevytváří dílo, nečte produkční data ani neposílá požadavek na databázový zápis. Funkční převod bude dostupný až po ověření atomické transakce.</p>
      </aside>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px,1fr))", gap: 18 }}>
        {scenarios.map((scenario) => (
          <section key={scenario.title} className="artales-member-panel" style={{ padding: 20, display: "grid", gap: 14 }}>
            <div>
              <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>{scenario.eligible ? "✓" : "!"} {scenario.state}</span>
              <h2 style={{ fontSize: 21, margin: "8px 0 0" }}>{scenario.title}</h2>
            </div>
            <dl style={{ margin: 0, display: "grid", gap: 9 }}>
              {scenario.checks.map(([label, result]) => (
                <div key={label} style={{ display: "grid", gap: 2, paddingBottom: 9, borderBottom: "1px solid #ddd" }}>
                  <dt style={{ fontWeight: 600 }}>{label}</dt>
                  <dd style={{ margin: 0, fontSize: 14 }}>{result}</dd>
                </div>
              ))}
            </dl>
            <button type="button" disabled style={{ padding: "10px 14px", cursor: "not-allowed", opacity: .65 }}>
              {scenario.eligible ? "Vytvořit koncept (dosud neaktivní)" : "Nelze vytvořit koncept"}
            </button>
          </section>
        ))}
      </div>
      <p style={{ marginTop: 24, fontSize: 14, opacity: .7 }}>
        Další krok: ověřit serverovou transakci, autory a audit na dočasné databázi; teprve potom povolit skutečnou akci.
      </p>
    </main>
  )
}
