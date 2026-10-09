"use client"

import { useState } from "react"
import { getCandidateDraftReadiness } from "@/lib/candidateDraftReadiness"
import type { WorkCandidate } from "@/lib/dbCandidates"
import type { CandidateSourceOption } from "@/lib/candidateSources"
import type { CandidateComponentRight } from "@/lib/candidateComponentRights"

type ScenarioId = "eligible" | "author" | "translation" | "edition" | "source"

const scenarios: { id: ScenarioId; label: string; description: string }[] = [
  { id: "eligible", label: "Ověřený zdroj", description: "Literární text povolen, nepřebírané části vyloučeny." },
  { id: "author", label: "Chybí autor", description: "Dílo nelze vytvořit bez ověřené vazby na existujícího autora." },
  { id: "translation", label: "Nejasný překlad", description: "Původní dílo může být volné, ale vybraná překladová edice nikoli." },
  { id: "edition", label: "Neověřená edice", description: "Samotná volnost původního textu nestačí." },
  { id: "source", label: "Zamítnutý zdroj", description: "Zdroj nelze využít ani při jinak vyřešených právech." },
]

const baseCandidate: WorkCandidate = {
  id: "00000000-0000-4000-8000-000000000201",
  proposed_title: "Pilotní kniha – syntetická ukázka",
  proposed_author_name: "Ukázkový autor",
  origin: "manual",
  origin_reference: null,
  status: "ready",
  priority: 50,
  matched_author_id: "00000000-0000-4000-8000-000000000301",
  matched_work_id: null,
  discovery_status: "complete",
  rights_status: "clear",
  rights_reason: "Pouze testovací data",
  jurisdiction: "EU_CZ",
  not_before: null,
  review_required: false,
  selected_source_type: "ebook",
  selected_source_reference: "synthetic-edition",
  selected_source_url: null,
  preferred_source_id: "00000000-0000-4000-8000-000000000401",
  normalized_title: "Pilotní kniha",
  normalized_author_name: "Ukázkový autor",
  identity_status: "matched",
  created_at: "2026-10-09T00:00:00Z",
  updated_at: "2026-10-09T00:00:00Z",
}

const baseSource: CandidateSourceOption = {
  id: "00000000-0000-4000-8000-000000000401",
  candidate_id: baseCandidate.id,
  provider: "Syntetický testovací zdroj",
  source_type: "ebook",
  reference: "synthetic-edition",
  url: null,
  language: "en",
  publication_facts: "Modelové údaje; nejde o ověření skutečných práv.",
  identity_match: "strong",
  status: "preferred",
  note: null,
}

const baseRights: CandidateComponentRight[] = [
  { id: "work", candidate_id: baseCandidate.id, source_id: baseSource.id, component: "WORK_CONTENT",
    label: "Původní literární text", decision: "usable", publication_effect: "allow", reason: "Modelově prověřeno" },
  { id: "edition", candidate_id: baseCandidate.id, source_id: baseSource.id, component: "EDITION_CONTENT",
    label: "Edice / přepis", decision: "exclude", publication_effect: "exclude_component", reason: "Odstranit oddělené ediční dodatky" },
  { id: "wrapper", candidate_id: baseCandidate.id, source_id: baseSource.id, component: "SOURCE_WRAPPER",
    label: "Gutenberg hlavička a patička", decision: "exclude", publication_effect: "exclude_component", reason: "Nejde o text díla" },
  { id: "images", candidate_id: baseCandidate.id, source_id: baseSource.id, component: "ASSET",
    label: "Ilustrace", decision: "exclude", publication_effect: "exclude_component", reason: "Bez samostatné licence se nepřebírají" },
  { id: "translation", candidate_id: baseCandidate.id, source_id: baseSource.id, component: "TRANSLATION",
    label: "Překlad", decision: "not_applicable", publication_effect: "allow", reason: "Modelová ukázka originálního znění" },
]

const labels: Record<string, string> = {
  already_promoted: "Kandidát už byl převeden.",
  candidate_not_ready: "Kandidát zatím není připraven.",
  triage_blocked: "Ověření díla nebo práv vyžaduje kontrolu.",
  preferred_source_missing: "Není potvrzen konkrétní zdroj.",
  preferred_source_identity_weak: "Identita vybraného zdroje není dost silná.",
  component_rights_review: "Některá právní komponenta není vyřešena.",
  component_rights_blocked: "Vybraný zdroj obsahuje nepoužitelnou komponentu.",
  author_match_required: "Chybí ověřený autor v ARTales.",
  author_identity_unverified: "Identita autora ještě není potvrzena.",
  source_language_required: "Není ověřen jazyk konkrétní edice.",
}

export default function CandidatePromotionLab() {
  const [selected, setSelected] = useState<ScenarioId>("eligible")
  const [simulated, setSimulated] = useState(false)
  const candidate = selected === "author" ? { ...baseCandidate, matched_author_id: null } : baseCandidate
  const source = selected === "source" ? { ...baseSource, status: "rejected" as const } : baseSource
  const rights = baseRights.map((right) => {
    if (selected === "translation" && right.component === "TRANSLATION") {
      return { ...right, decision: "review_required" as const, publication_effect: "review" as const, reason: "Práva překladatele nejsou doložena." }
    }
    if (selected === "edition" && right.component === "EDITION_CONTENT") {
      return { ...right, decision: "review_required" as const, publication_effect: "review" as const, reason: "Konkrétní edice nebyla právně prověřena." }
    }
    return right
  })
  const readiness = getCandidateDraftReadiness(candidate, [source], rights)
  const blockers: string[] = readiness.blockers
  const eligible = readiness.eligible
  const panelStyle: React.CSSProperties = { border: "1px solid var(--artales-line, #d6c9b8)", borderRadius: 12, padding: 20 }

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 20px 70px", lineHeight: 1.55 }}>
      <p style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", opacity: .65 }}>ARTales · Pilotní workflow · pouze preview</p>
      <h1 style={{ fontSize: "clamp(28px,4vw,42px)", lineHeight: 1.15, margin: "12px 0" }}>Z kandidáta do konceptu díla</h1>
      <p style={{ maxWidth: 820 }}>Simulace redakčního rozhodování nad několika scénáři. Používá skutečnou aplikační kontrolu kandidátových práv a samostatnou kontrolu vazby na autora. Všechny údaje jsou syntetické.</p>
      <aside style={{ ...panelStyle, background: "#fff8e8", marginBottom: 24, color: "#2f2924" }}>
        <strong>Bez zásahu do databáze.</strong> Tato stránka neposílá žádný požadavek na vytvoření díla, nenačítá skutečné kandidáty ani nepublikuje obsah.
      </aside>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginBottom: 24 }}>
        {scenarios.map((s) => (
          <button key={s.id} type="button" aria-pressed={selected === s.id}
            onClick={() => { setSelected(s.id); setSimulated(false) }}
            style={{ ...panelStyle, cursor: "pointer", textAlign: "left", background: selected === s.id ? "#f1e7d6" : "transparent", color: "inherit", borderColor: selected === s.id ? "#998156" : undefined }}>
            <strong style={{ display: "block", marginBottom: 8 }}>{s.label}</strong>
            <span style={{ fontSize: 13 }}>{s.description}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 22 }}>
        <section style={panelStyle}>
          <h2 style={{ fontSize: 22, marginTop: 0 }}>1. Zdroj a komponenty</h2>
          <p>Vybraná edice: <strong>{source.reference}</strong></p>
          <div style={{ display: "grid", gap: 8 }}>
            {rights.map((right) => (
              <div key={right.id} style={{ padding: 12, border: "1px solid #d7cdc1", borderRadius: 8 }}>
                <strong>{right.label}</strong>
                <p style={{ margin: "4px 0", fontSize: 13 }}>
                  {right.publication_effect === "allow" ? "Povolit / netýká se" : right.publication_effect === "exclude_component" ? "Vyřadit z importu" : right.publication_effect === "review" ? "Nutná kontrola" : "Zablokováno"}
                </p>
                <p style={{ margin: 0, fontSize: 12, opacity: .75 }}>{right.reason}</p>
              </div>
            ))}
          </div>
        </section>
        <section style={panelStyle}>
          <h2 style={{ fontSize: 22, marginTop: 0 }}>2. Kontrolní brána</h2>
          <p><strong>Autor:</strong> {candidate.matched_author_id ? "ověřená vazba (syntetická)" : "chybí vazba na autora"}</p>
          <p><strong>Zdroj:</strong> {source.status === "preferred" ? "preferovaný" : "zamítnutý"}</p>
          <p><strong>Výsledek:</strong> {eligible ? "Koncept lze modelově vytvořit" : "Převod je zablokován"}</p>
          {blockers.length > 0 ? (
            <ul>{blockers.map((b) => <li key={b}>{labels[b] ?? b}</li>)}</ul>
          ) : <p style={{ fontSize: 14 }}>Text je povolený, nepovolené součásti jsou vyloučeny, edice i autor prošli modelovou kontrolou.</p>}
          <button type="button" disabled={!eligible} onClick={() => setSimulated(true)}
            style={{ padding: "12px 18px", borderRadius: 8, background: "#392e24", color: "white", border: 0, opacity: eligible ? 1 : .45, cursor: eligible ? "pointer" : "not-allowed" }}>
            Simulovat vytvoření konceptu
          </button>
          {simulated && eligible ? (
            <div role="status" style={{ padding: 16, border: "1px solid #b4a27f", marginTop: 16, borderRadius: 8 }}>
              <strong>Modelový koncept vytvořen (jen na této stránce)</strong>
              <p style={{ margin: "8px 0 0" }}>Stav: koncept · bloky: 0 · zveřejnění: ne · Gutenberg wrapper a ilustrace: nezahrnuty.</p>
              <p style={{ marginBottom: 0, fontSize: 13 }}>Po obnovení stránky tato simulace zmizí.</p>
            </div>
          ) : null}
        </section>
      </div>
      <p style={{ fontSize: 13, marginTop: 24, opacity: .7 }}>
        Transakční vytvoření skutečného konceptu je samostatný další krok. Tento pilot slouží pouze ke kontrole srozumitelnosti a logiky před implementací zápisu.
      </p>
    </main>
  )
}
