import Link from "next/link"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getWorkCandidates } from "@/lib/dbCandidates"
import { csMember } from "@/lib/i18n/dictionaries/cs/member"
import { isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates"

export default async function WorkCandidatesPage() {
  await requireEditorOrAdmin()
  const candidates = await getWorkCandidates()
  const copy = csMember.candidates
  const fixturePreview = isCandidatesFixturePreview()

  return (
    <main style={{ padding: "48px 32px", maxWidth: "1100px", margin: "0 auto", lineHeight: 1.6 }}>
      <p><Link href="/member">{"<- Zpět do členské zóny"}</Link></p>
      {fixturePreview ? <aside style={{ padding: 14, marginBottom: 20, border: "1px solid #d5b56b", background: "#fff8e8" }}><strong>Fixture preview</strong> · Ukázková data nejsou persistentní a žádný zápis nejde do Supabase.</aside> : null}
      <section style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, opacity: .7 }}>ARTales · Editor</p>
        <h1 style={{ fontSize: 40, marginBottom: 10 }}>{copy.title}</h1>
        <p style={{ maxWidth: 760 }}>{copy.intro}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="artales-button-primary" href="/member/candidates/new">{copy.newCandidate}</Link>
          <Link className="artales-button-secondary" href="/member/resources">{copy.methodology}</Link>
        </div>
      </section>

      <section className="artales-member-panel" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>{copy.watcherTitle}</h2>
        <p style={{ marginBottom: 0 }}>{copy.watcherPlaceholder}</p>
      </section>

      {candidates.length === 0 ? <p>{copy.empty}</p> : (
        <div style={{ display: "grid", gap: 14 }}>
          {candidates.map((candidate) => (
            <article key={candidate.id} className="artales-member-panel" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px" }}>{candidate.proposed_title}</h2>
                  <p style={{ margin: "0 0 8px" }}>{candidate.proposed_author_name}</p>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    <strong>{copy.status}:</strong> {copy.statuses[candidate.status]} ·{" "}
                    <strong>{copy.rights}:</strong> {copy.rightsStatuses[candidate.rights_status]} ·{" "}
                    <strong>{copy.priority}:</strong> {candidate.priority}
                  </p>
                  {candidate.rights_reason ? <p style={{ margin: "8px 0 0" }}>{candidate.rights_reason}</p> : null}
                </div>
                <Link className="artales-button-secondary" href={`/member/candidates/${candidate.id}`}>{copy.open}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
