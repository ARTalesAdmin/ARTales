import Link from "next/link"
import { notFound } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getWorkCandidateById } from "@/lib/dbCandidates"
import { updateWorkCandidate } from "@/lib/actions/workCandidates"
import { csMember } from "@/lib/i18n/dictionaries/cs/member"
import { isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates"

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
          <label>{copy.sourceType}<input name="selected_source_type" defaultValue={candidate.selected_source_type ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.sourceReference}<input name="selected_source_reference" defaultValue={candidate.selected_source_reference ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.sourceUrl}<input name="selected_source_url" type="url" defaultValue={candidate.selected_source_url ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
        </section>

        <section className="artales-member-panel" style={{ padding: 22, display: "grid", gap: 16 }}>
          <h2 style={{ margin: 0 }}>{copy.rightsSection}</h2>
          <label>{copy.rights}<select name="rights_status" defaultValue={candidate.rights_status} style={{ display:"block",width:"100%",padding:12 }}>{Object.entries(copy.rightsStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label>{copy.jurisdiction}<input name="jurisdiction" defaultValue={candidate.jurisdiction} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.rightsReason}<textarea name="rights_reason" rows={4} defaultValue={candidate.rights_reason ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
          <label>{copy.notBefore}<input name="not_before" type="date" defaultValue={candidate.not_before ?? ""} style={{ display:"block",width:"100%",padding:12 }} /></label>
          {candidate.review_required ? <p style={{ margin:0, padding:12, border:"1px solid #e0c39a", background:"#fff8ed" }}>{copy.reviewRequired}</p> : null}
        </section>

        <button className="artales-button-primary" type="submit">{copy.save}</button>
      </form>
    </main>
  )
}
