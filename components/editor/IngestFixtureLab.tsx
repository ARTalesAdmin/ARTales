"use client";
import { useState } from "react";
import WorkContentRenderer from "@/components/work/WorkContentRenderer";
import { INGEST_FIXTURE, composeFixtureSection } from "@/lib/fixtures/ingestComposer";
import "./ingest-fixture-lab.css";

const artifact = composeFixtureSection(INGEST_FIXTURE);
const firstVerseId = artifact.blocks.find((item) => item.block.type === "poem")?.block.id ?? "";
type Stage = "draft" | "returned" | "recomposed" | "accepted";
const stageLabels: Record<Stage, string> = {
  draft: "Návrh – zkontrolujte sazbu veršů",
  returned: "Vráceno – cílová oblast vybrána",
  recomposed: "Přeskládáno – čeká na přijetí editorem",
  accepted: "Přijato lokálně – bez zápisu do díla",
};
const rightsLabels = {
  usable: "Povoleno", exclude: "Vyřazeno", blocked: "Blokováno",
  review_required: "Vyžaduje posouzení", missing: "Chybí práva",
} as const;

export default function IngestFixtureLab() {
  const [selectedId, setSelectedId] = useState(firstVerseId);
  const [stage, setStage] = useState<Stage>("draft");
  const selected = artifact.blocks.find((item) => item.block.id === selectedId);
  const adjusted = stage === "recomposed" || stage === "accepted";
  const component = INGEST_FIXTURE.components.find((item) => item.id === selected?.componentId);

  return <main className="ingest-lab">
    <a href="/member/candidates">← Kandidáti</a>
    <header className="ingest-lab__intro">
      <p className="ingest-lab__kicker">ARTales · Ingest / Adaptive Composer / Reader QA</p>
      <h1>První složená kapitola</h1>
      <p>Izolovaný prototyp z <strong>fiktivního rukopisu</strong>. Vlevo je doslovný zdroj, vpravo reálné bloky ARTales vykreslené existující komponentou WorkContentRenderer. Žádná data se neukládají.</p>
      <div className="ingest-lab__status"><strong>{artifact.qa.ok ? "Textová integrita: OK" : "Textová integrita: CHYBA"}</strong>
        <span>{artifact.qa.verifiedBlocks}/{artifact.blocks.length} shodných bloků</span>
        <span>{artifact.excluded.length} oddělených komponent</span>
        <span>Publikování zamčeno</span>
      </div>
    </header>

    <section className="ingest-lab__panel">
      <p className="ingest-lab__kicker">01 · Capture / rights</p>
      <h2>Komponenty zdroje a rozhodnutí o použití</h2>
      <p>Výslovně povolen je pouze původní fiktivní text. Edice, překlad, obal, poznámky i ilustrace zůstávají mimo obsah knihy.</p>
      <div className="ingest-lab__rights">
        {INGEST_FIXTURE.components.map((part) => <div className="ingest-lab__right" key={part.id}>
          <strong>{part.kind}</strong><span>{part.label}</span>
          <b>{rightsLabels[part.rights?.decision ?? "missing"]}</b>
          <small>{part.rights?.reason ?? "Chybí rozhodnutí"}</small>
        </div>)}
      </div>
    </section>

    <div className="ingest-lab__columns">
      <section className="ingest-lab__panel">
        <p className="ingest-lab__kicker">02 · Immutable source</p>
        <h2>Originál</h2>
        <p className="ingest-lab__muted">{INGEST_FIXTURE.title}</p>
        {artifact.blocks.map((item) => <article key={item.block.id} className={"ingest-lab__segment" + (selectedId === item.block.id ? " is-selected" : "")}>
          <button aria-pressed={selectedId === item.block.id} onClick={() => setSelectedId(item.block.id)} type="button">
            Originál · znaky {item.start}–{item.end}
          </button>
          <pre>{INGEST_FIXTURE.components.find((part) => part.id === item.componentId)?.raw.slice(item.start, item.end)}</pre>
        </article>)}
      </section>
      <section className="ingest-lab__panel">
        <p className="ingest-lab__kicker">03 · ARTales WorkBlock composition</p>
        <h2>Sestavená kapitola</h2>
        <div className="ingest-lab__paper">
          <p className="ingest-lab__muted">Kapitola I · ukázková sazba</p>
          {artifact.blocks.map((item) => <article key={item.block.id} className={"ingest-lab__segment" + (selectedId === item.block.id ? " is-selected" : "")}>
            <button aria-pressed={selectedId === item.block.id} onClick={() => setSelectedId(item.block.id)} type="button">
              {item.block.type} · {item.recipe} · {item.block.id}
            </button>
            <div className={item.block.type === "poem" && !adjusted ? "ingest-lab__tight-verse" : ""}>
              <WorkContentRenderer blocks={[item.block]} />
            </div>
          </article>)}
        </div>
        <p className="ingest-lab__muted">Jde o náhled skutečného vykreslovače bloků, nikoli ještě o ověřenou stránkovanou Reader relaci.</p>
      </section>
    </div>

    <section className="ingest-lab__panel">
      <p className="ingest-lab__kicker">04 · Reader QA / editor return</p>
      <h2>Lokální redakční kontrola</h2>
      <p>Výběr oblasti je propojený stabilním ID a offsety zdroje. Ukázka opravuje záměrně sevřenou sazbu veršů, nikoli jejich slova.</p>
      {selected ? <div className="ingest-lab__inspection">
        <strong>Vybraný blok:</strong> {selected.block.type} · {selected.start}–{selected.end}<br />
        <strong>Zdroj:</strong> {selected.sourceId} / {selected.componentId}<br />
        <strong>Doslovná shoda:</strong> {component?.raw.slice(selected.start, selected.end) === selected.block.content ? "ano" : "NE"}
      </div> : null}
      <div className="ingest-lab__actions">
        <strong role="status">{stageLabels[stage]}</strong>
        {stage === "draft" && <button disabled={selected?.block.type !== "poem"} onClick={() => setStage("returned")} type="button">Vrátit vybrané verše</button>}
        {stage === "returned" && <button onClick={() => setStage("recomposed")} type="button">Znovu vysázet oblast</button>}
        {stage === "recomposed" && <button onClick={() => setStage("accepted")} type="button">Přijmout lokálně</button>}
        {stage === "accepted" && <button onClick={() => { setSelectedId(firstVerseId); setStage("draft"); }} type="button">Obnovit ukázku</button>}
      </div>
      {artifact.qa.issues.length ? <ul>{artifact.qa.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
      <p className="ingest-lab__muted">Bez AI modelu, DB zápisu, autorizace publikace a Nexus workerů. Fiktivní text nepředstavuje právní clearance díla The House of the Wolfings.</p>
    </section>
  </main>;
}
