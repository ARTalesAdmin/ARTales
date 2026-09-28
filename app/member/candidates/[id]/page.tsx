import Link from "next/link"
import { notFound } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getWorkCandidateById } from "@/lib/dbCandidates"
import { updateWorkCandidate } from "@/lib/actions/workCandidates"
import { csMember } from "@/lib/i18n/dictionaries/cs/member"
import { isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates"
import { getCandidateTriageBlockers } from "@/lib/candidateTriage"
import { getCandidateDiscoveryIdentity, getCandidateSourceOptions } from "@/lib/candidateSources"
import { getCandidateComponentRights, getComponentRightsSummary } from "@/lib/candidateComponentRights"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function WorkCandidateDetailPage({ params, searchParams }: Props) {
  await requireEditorOrAdmin()
  const { id } = await params
  const { error, success } = await searchParams
  const candidate = await getWorkCandidateById(id)
  if (!candidate) notFound()

  const copy = csMember.candidates
  const fixturePreview = isCandidatesFixturePreview()
  const action = updateWorkCandidate.bind(null, id)
  const triageBlockers = getCandidateTriageBlockers(candidate)
  const sourceOptions = getCandidateSourceOptions(candidate)
  const discoveryIdentity = getCandidateDiscoveryIdentity(candidate)
  const componentRights = getCandidateComponentRights(candidate, sourceOptions)
  const componentRightsSummary = getComponentRightsSummary(componentRights)

  return (
    <main style={{ padding: "48px 32px", maxWidth: 900, margin: "0 auto", lineHeight: 1.6 }}>
      <p><Link href="/member/candidates">{"<- Zpět na kandidáty"}</Link></p>
      {fixturePreview ? <aside style={{ padding: 14, marginBottom: 20, border: "1px solid #d5b56b", background: "#fff8e8" }}><strong>Fixture preview</strong> · Změny formuláře se v tomto režimu neukládají.</aside> : null}
      <h1>{candidate.proposed_title}</h1>
      <p style={{ fontSize: 18 }}>{candidate.proposed_author_name}</p>

      {success ? <p style={{ padding: 12, border: "1px solid #9c9", background: "#f6fff6" }}>{copy.saved}</p> : null}
      {error ? <p style={{ padding: 12, border: "1px solid #d99", background: "#fff7f7" }}>{copy.errors[error as keyof typeof copy.errors] ?? copy.errors.save_failed}</p> : null}

      <form action={action} style={{ display: "grid", gap: 22 }}>
        <section className="artales-member-panel" style={{ padding: 22, display: "grid", gap: 16 }}>
          <h2 style={{ margin: 0 }}>{copy.identitySection}</h2>
          <label>{copy.proposedTitle}<input name="proposed_title" required defaultValue={candidate.proposed_title} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.proposedAuthor}<input name="proposed_author_name" required defaultValue={candidate.proposed_author_name} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <label>{copy.status}<select name="status" defaultValue={candidate.status} style={{ display:"block",width:"100%",padding:12 }}>{Object.entries(copy.statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            <label>{copy.priority}<input name="priority" type="number" min="0" max="100" defaultValue={candidate.priority} style={{ display:"block",width:"100%",padding:12 }} /></label>
          </div>
          <label>{copy.origin}<select name="origin" defaultValue={candidate.origin} style={{ display:"block",width:"100%",padding:12 }}>{Object.entries(copy.origins).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label>{copy.originReference}<input name="origin_reference" defaultValue={candidate.origin_reference ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
        </section>

        <section className="artales-member-panel" style={{ padding: 22, display: "grid", gap: 16 }}>
          <h2 style={{ margin: 0 }}>{copy.discoverySection}</h2>
          <label>{copy.discovery}<select name="discovery_status" defaultValue={candidate.discovery_status} style={{ display:"block",width:"100%",padding:12 }}>{Object.entries(copy.discoveryStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>

          <aside style={{ padding: 14, border: "1px solid #d8d0c5", background: "#faf8f4" }}>
            <strong>{copy.discoveryIdentityTitle}</strong>
            <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 12px", marginBottom: 0 }}>
              <dt>{copy.normalizedTitle}</dt><dd>{discoveryIdentity.normalized_title}</dd>
              <dt>{copy.normalizedAuthor}</dt><dd>{discoveryIdentity.normalized_author}</dd>
              <dt>{copy.authorLifeDates}</dt><dd>{discoveryIdentity.author_life_dates ?? "—"}</dd>
              <dt>{copy.firstPublication}</dt><dd>{discoveryIdentity.first_publication ?? "—"}</dd>
              <dt>{copy.discoveryIdentityNote}</dt><dd>{discoveryIdentity.identity_note ?? "—"}</dd>
            </dl>
          </aside>

          <div style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0 }}>{copy.discoveryShortlistTitle}</h3>
            {sourceOptions.length === 0 ? <p style={{ margin: 0 }}>{copy.discoveryShortlistEmpty}</p> : sourceOptions.map((source) => (
              <article key={source.id} style={{ padding: 14, border: "1px solid #d8d0c5", borderRadius: 8, background: source.status === "preferred" ? "#f6fff6" : "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{source.reference}</strong>
                    <div style={{ fontSize: 14, opacity: .8 }}>{copy.discoveryProvider}: {source.provider} · {source.source_type}{source.language ? ` · ${source.language}` : ""}</div>
                  </div>
                  <div style={{ fontSize: 14 }}>
                    <strong>{copy.discoverySourceStatus}:</strong> {copy.sourceStatuses[source.status]} · <strong>{copy.discoveryIdentityMatch}:</strong> {copy.identityMatches[source.identity_match]}
                  </div>
                </div>
                {source.publication_facts ? <p style={{ margin: "10px 0 0" }}><strong>{copy.discoveryPublicationFacts}:</strong> {source.publication_facts}</p> : null}
                {source.note ? <p style={{ margin: "6px 0 0" }}><strong>{copy.discoveryNote}:</strong> {source.note}</p> : null}
                {source.url ? <p style={{ margin: "8px 0 0" }}><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a></p> : null}
              </article>
            ))}
          </div>

          <label>{copy.sourceType}<input name="selected_source_type" defaultValue={candidate.selected_source_type ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.sourceReference}<input name="selected_source_reference" defaultValue={candidate.selected_source_reference ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.sourceUrl}<input name="selected_source_url" type="url" defaultValue={candidate.selected_source_url ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
        </section>

        <section className="artales-member-panel" style={{ padding: 22, display: "grid", gap: 16 }}>
          <h2 style={{ margin: 0 }}>{copy.rightsSection}</h2>
          <aside style={{ padding: 14, border: triageBlockers.length ? "1px solid #d6b26b" : "1px solid #9c9", background: triageBlockers.length ? "#fff8e8" : "#f6fff6" }}>
            <strong>{copy.triageTitle}</strong>
            <p style={{ margin: "6px 0 0" }}>{triageBlockers.length ? copy.triageBlocked : copy.triageClear}</p>
            {triageBlockers.length ? (
              <ul style={{ marginBottom: 0 }}>
                {triageBlockers.map((blocker) => <li key={blocker}>{copy.triageBlockers[blocker]}</li>)}
              </ul>
            ) : null}
          </aside>
          <label>{copy.rights}<select name="rights_status" defaultValue={candidate.rights_status} style={{ display:"block",width:"100%",padding:12 }}>{Object.entries(copy.rightsStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label>{copy.jurisdiction}<input name="jurisdiction" defaultValue={candidate.jurisdiction} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.rightsReason}<textarea name="rights_reason" rows={4} defaultValue={candidate.rights_reason ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.notBefore}<input name="not_before" type="date" defaultValue={candidate.not_before ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
          {candidate.review_required ? <p style={{ margin:0, padding:12, border:"1px solid #e0c39a", background:"#fff8ed" }}>{copy.reviewRequired}</p> : null}

          <div style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0 }}>{copy.componentRightsTitle}</h3>
            {componentRights.length === 0 ? <p style={{ margin: 0 }}>{copy.componentRightsEmpty}</p> : (
              <>
                <aside style={{ padding: 14, border: "1px solid #d8d0c5", background: componentRightsSummary.sourceBlocked ? "#fff1f1" : componentRightsSummary.requiresReview ? "#fff8e8" : "#f6fff6" }}>
                  <strong>{copy.componentRightsSummary}</strong>
                  <p style={{ margin: "6px 0 0" }}>
                    {componentRightsSummary.sourceBlocked
                      ? copy.componentRightsBlocked
                      : componentRightsSummary.requiresReview
                        ? copy.componentRightsReview
                        : componentRightsSummary.excludedCount > 0
                          ? copy.componentRightsExcluded
                          : copy.componentRightsUsable}
                  </p>
                </aside>
                <div style={{ display: "grid", gap: 10 }}>
                  {componentRights.map((right) => (
                    <article key={right.id} style={{ padding: 14, border: "1px solid #d8d0c5", borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <strong>{copy.componentTypes[right.component]}</strong>
                          <div style={{ fontSize: 14, opacity: .8 }}>{right.label}</div>
                        </div>
                        <div style={{ fontSize: 14 }}>
                          <strong>{copy.componentDecision}:</strong> {copy.componentDecisions[right.decision]} · <strong>{copy.publicationEffect}:</strong> {copy.publicationEffects[right.publication_effect]}
                        </div>
                      </div>
                      <p style={{ margin: "8px 0 0" }}>{right.reason}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <button className="artales-button-primary" type="submit">{copy.save}</button>
      </form>
    </main>
  )
}
