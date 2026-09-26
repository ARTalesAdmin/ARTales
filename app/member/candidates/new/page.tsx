import Link from "next/link"
import { requireEditorOrAdmin } from "@/lib/guards"
import { createWorkCandidate } from "@/lib/actions/workCandidates"
import { csMember } from "@/lib/i18n/dictionaries/cs/member"

type Props = { searchParams: Promise<{ error?: string }> }

export default async function NewWorkCandidatePage({ searchParams }: Props) {
  await requireEditorOrAdmin()
  const { error } = await searchParams
  const copy = csMember.candidates

  return (
    <main style={{ padding: "48px 32px", maxWidth: 820, margin: "0 auto", lineHeight: 1.6 }}>
      <p><Link href="/member/candidates">{"<- Zpět na kandidáty"}</Link></p>
      <h1>{copy.newCandidate}</h1>
      {error ? <p style={{ padding: 12, border: "1px solid #d99", background: "#fff7f7" }}>{copy.errors[error as keyof typeof copy.errors] ?? copy.errors.save_failed}</p> : null}
      <form action={createWorkCandidate} style={{ display: "grid", gap: 18 }}>
        <label>{copy.proposedTitle}<input name="proposed_title" required style={{ display: "block", width: "100%", padding: 12 }} /></label>
        <label>{copy.proposedAuthor}<input name="proposed_author_name" required style={{ display: "block", width: "100%", padding: 12 }} /></label>
        <label>{copy.origin}
          <select name="origin" defaultValue="manual" style={{ display: "block", width: "100%", padding: 12 }}>
            {Object.entries(copy.origins).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>{copy.originReference}<input name="origin_reference" style={{ display: "block", width: "100%", padding: 12 }} /></label>
        <label>{copy.priority}<input name="priority" type="number" min="0" max="100" defaultValue="50" style={{ display: "block", width: "100%", padding: 12 }} /></label>
        <button className="artales-button-primary" type="submit">{copy.create}</button>
      </form>
    </main>
  )
}
