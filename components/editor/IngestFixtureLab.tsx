"use client";

import { useEffect, useState, type CSSProperties } from "react";
import WorkContentRenderer from "@/components/work/WorkContentRenderer";
import {
  INGEST_FIXTURE,
  composeFixtureSection,
  inspectSourceIntegrity,
  recomposeFixtureRegion,
  type AnchoredBlock,
} from "@/lib/fixtures/ingestComposer";
import {
  createFixtureReviewRecord,
  type FixtureReviewRecord,
} from "@/lib/fixtures/ingestReview";
import {
  createFixtureIssueReport,
  getFixtureCorrectionLane,
  type FixtureIssueAnchor,
  type FixtureIssueCategory,
  type FixtureIssueReport,
} from "@/lib/fixtures/ingestIssue";
import { createPairedFixturePages } from "@/lib/fixtures/pairedPages";
import "./ingest-fixture-lab.css";

const artifact = composeFixtureSection(INGEST_FIXTURE);
const initialId = artifact.blocks[0]?.block.id ?? "";
const STORAGE_KEY = "artales:ingest-fixture:editorial-reviews:v1";
const ISSUE_STORAGE_KEY = "artales:ingest-fixture:editorial-issues:v1";
const extendedIssues: { value: FixtureIssueCategory; label: string }[] = [
  { value: "unsure", label: "Nevím / neumím zařadit" },
  { value: "pagination", label: "Stránkování / konec stránky" },
  { value: "line_break", label: "Zalomení řádku nebo odstavce" },
  { value: "typography", label: "Sazba a typografie" },
  { value: "structure", label: "Členění a struktura" },
  { value: "readability", label: "Čitelnost" },
  { value: "other", label: "Jiné" },
];

type ReviewStage = "select" | "returned" | "recomposed" | "accepted" | "saved";

function isSavedFixtureReview(value: unknown): value is FixtureReviewRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<FixtureReviewRecord>;
  return record.schema === "artales.fixture.editorial-feedback.v1" &&
    record.sourceId === INGEST_FIXTURE.sourceId && record.fixtureOnly === true &&
    record.deliveredToNexus === false && record.decision === "accepted" &&
    typeof record.editorNote === "string" && typeof record.blockId === "string" &&
    typeof record.acceptedAt === "string";
}

function SourceBlock({ item }: { item: AnchoredBlock }) {
  const part = INGEST_FIXTURE.components.find((component) => component.id === item.componentId);
  const text = part?.raw.slice(item.start, item.end) ?? "";
  if (item.block.type === "chapter") return <h3 className="ingest-lab__source-chapter">{text}</h3>;
  if (item.block.type === "poem") return <p className="ingest-lab__source-poem">{text}</p>;
  return <p className="ingest-lab__source-prose">{text}</p>;
}

export default function IngestFixtureLab() {
  const [blocks, setBlocks] = useState<AnchoredBlock[]>(() => artifact.blocks);
  const [selectedId, setSelectedId] = useState(initialId);
  const [stage, setStage] = useState<ReviewStage>("select");
  const [issue, setIssue] = useState<FixtureIssueCategory>("unsure");
  const [boundaryAfter, setBoundaryAfter] = useState(false);
  const [savedIssues, setSavedIssues] = useState<FixtureIssueReport[]>([]);
  const [editorNote, setEditorNote] = useState("");
  const [returnedId, setReturnedId] = useState<string | null>(null);
  const [previousBlocks, setPreviousBlocks] = useState<AnchoredBlock[] | null>(null);
  const [acceptedRecord, setAcceptedRecord] = useState<FixtureReviewRecord | null>(null);
  const [savedRecords, setSavedRecords] = useState<FixtureReviewRecord[]>([]);
  const [notice, setNotice] = useState("");
  const [fontScale, setFontScale] = useState(1);
  const [readerOnly, setReaderOnly] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [reviewFinished, setReviewFinished] = useState(false);
  const qa = inspectSourceIntegrity(INGEST_FIXTURE, blocks);
  const selected = blocks.find((item) => item.block.id === selectedId);
  const paired = createPairedFixturePages(blocks, 3000, 430);
  const activePage = paired.composedPages[Math.min(pageIndex, paired.composedPages.length - 1)];
  const sourcePage = paired.sourcePages[(activePage?.sourcePage ?? 1) - 1] ?? [];
  const visibleBlocks = activePage?.blocks ?? [];
  const activeComposedPageNumber = activePage?.page ?? 1;
  const activeSourcePageNumber = activePage?.sourcePage ?? 1;
  const selectedIndex = blocks.findIndex((item) => item.block.id === selectedId);
  const canMarkBoundary = selectedIndex >= 0 && selectedIndex < blocks.length - 1;
  const canLocalRecompose = !boundaryAfter && getFixtureCorrectionLane(issue, {kind: "block", blockId: selectedId}) === "local_recipe";
  const locked = stage === "returned" || stage === "recomposed" || stage === "accepted";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedRecords(parsed.filter(isSavedFixtureReview).slice(-25));
      }
      const issueRaw = window.localStorage.getItem(ISSUE_STORAGE_KEY);
      if (issueRaw) {
        const issues: unknown = JSON.parse(issueRaw);
        if (Array.isArray(issues)) {
          setSavedIssues(issues.filter((entry): entry is FixtureIssueReport =>
            Boolean(entry && typeof entry === "object" &&
              entry.schema === "artales.fixture.editorial-issue.v1" &&
              entry.sourceId === INGEST_FIXTURE.sourceId &&
              entry.fixtureOnly === true && entry.deliveredToNexus === false)
          ).slice(-25));
        }
      }
    } catch {
      // Private browsing may disable storage. The editor still works in memory.
    }
  }, []);

  function chooseBlock(id: string) {
    if (!locked) { setSelectedId(id); setNotice(""); }
  }

  function submitEditorialIssue() {
    if (canLocalRecompose) return returnForCorrection();
    return saveUnresolvedIssue();
  }

  function saveUnresolvedIssue() {
    if (!selected || editorNote.trim().length < 3 || !qa.ok) return;
    const index = blocks.findIndex((item) => item.block.id === selected.block.id);
    const next = blocks[index + 1];
    const anchor: FixtureIssueAnchor = boundaryAfter && next
      ? { kind: "boundary_after", blockId: selected.block.id, nextBlockId: next.block.id }
      : { kind: "block", blockId: selected.block.id };
    try {
      const record = createFixtureIssueReport({
        capture: INGEST_FIXTURE, blocks, anchor, category: issue, editorNote,
        viewContext: {
          renderer: "fixture-static-spread-v1",
          readerMode: readerOnly ? "reader_only" : "comparison",
          fontScale,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
        recordedAt: new Date().toISOString(),
      });
      const nextIssues = [...savedIssues, record].slice(-25);
      window.localStorage.setItem(ISSUE_STORAGE_KEY, JSON.stringify(nextIssues));
      setSavedIssues(nextIssues);
      setEditorNote("");
      setNotice("Připomínka uložena lokálně. AI oprava zatím neprobíhá; až bude k dispozici, lze ji navázat na tento záznam.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Záznam připomínky selhal.");
    }
  }

  function returnForCorrection() {
    if (!selected || editorNote.trim().length < 3 || !qa.ok ||
        boundaryAfter || getFixtureCorrectionLane(issue, { kind: "block", blockId: selected.block.id }) !== "local_recipe") return;
    setReturnedId(selected.block.id);
    setPreviousBlocks(blocks);
    setStage("returned");
    setNotice("");
  }

  function recompose() {
    if (!returnedId) return;
    try {
      const revised = recomposeFixtureRegion(INGEST_FIXTURE, blocks, returnedId);
      setBlocks(revised);
      setSelectedId(returnedId);
      setStage("recomposed");
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Přepracování nebylo možné.");
    }
  }

  function acceptRevision() {
    if (!returnedId || !previousBlocks || !qa.ok) return;
    try {
      const record = createFixtureReviewRecord({
        capture: INGEST_FIXTURE,
        before: previousBlocks,
        after: blocks,
        blockId: returnedId,
        issue: "typography",
        editorNote,
        acceptedAt: new Date().toISOString(),
      });
      setAcceptedRecord(record);
      setStage("accepted");
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Revize neprošla kontrolou.");
    }
  }

  function cancelCorrection() {
    if (previousBlocks) setBlocks(previousBlocks);
    setReturnedId(null);
    setPreviousBlocks(null);
    setAcceptedRecord(null);
    setStage("select");
    setNotice("Vrácení zrušeno; předchozí sazba obnovena.");
  }

  function saveLocalFeedback() {
    if (!acceptedRecord || !qa.ok) return;
    try {
      const next = [...savedRecords.filter((record) =>
        !(record.blockId === acceptedRecord.blockId && record.acceptedAt === acceptedRecord.acceptedAt)), acceptedRecord].slice(-25);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedRecords(next);
      setStage("saved");
      setNotice("Rozhodnutí je uložené pouze v tomto prohlížeči; Nexus/AT je nedostal.");
    } catch {
      setNotice("Prohlížeč lokální uložení odmítl. Rozhodnutí zůstává pouze v této relaci.");
    }
  }

  function exportFeedback() {
    if (!savedRecords.length) return;
    const file = new Blob([JSON.stringify({ fixtureOnly: true, schema: "artales.fixture.feedback-export.v1", records: savedRecords }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "artales-fixture-editorial-feedback.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function startNextReview() {
    setStage("select");
    setPreviousBlocks(null);
    setReturnedId(null);
    setAcceptedRecord(null);
    setEditorNote("");
    setNotice("");
  }

  const fontStyle = { "--fixture-font-scale": fontScale } as CSSProperties;
  return (
    <main className="ingest-lab" style={fontStyle}>
      <header className="ingest-lab__toolbar">
        <div className="ingest-lab__brand"><strong>ARTales</strong><span>Redakční čtečka · fixture</span></div>
        <div className="ingest-lab__toolbar-actions" aria-label="Nastavení náhledu">
          <button type="button" onClick={() => setReaderOnly((value) => !value)} aria-pressed={readerOnly}>
            {readerOnly ? "Ukázat srovnání" : "Jen sestavený Reader"}
          </button>
          <button type="button" aria-label="Zmenšit písmo" disabled={fontScale <= 0.9} onClick={() => setFontScale((value) => Math.max(0.9, Math.round((value - 0.1) * 10) / 10))}>A−</button>
          <button type="button" aria-label="Zvětšit písmo" disabled={fontScale >= 1.2} onClick={() => setFontScale((value) => Math.min(1.2, Math.round((value + 0.1) * 10) / 10))}>A+</button>
        </div>
      </header>

      <section className="ingest-lab__intro" aria-labelledby="ingest-fixture-title">
        <p className="ingest-lab__eyebrow">Interní náhled · fiktivní literární text · bez databáze</p>
        <h1 id="ingest-fixture-title">Cesta za řekou</h1>
        <p>Originál a sestavená kapitola vedle sebe. Označte místo, napište, co nevyhovuje, a porovnejte cílenou opravu před přijetím.</p>
        <div className="ingest-lab__indicators" aria-label="Stav textové kontroly">
          <span className={qa.ok ? "ingest-lab__verified" : "ingest-lab__error"}>{qa.ok ? "Text ověřen · " + qa.verifiedBlocks + "/" + blocks.length : "Neshoda se zdrojem"}</span>
          <span>{savedRecords.length} přijatých oprav · {savedIssues.length} připomínek</span>
          <span>Koncept · bez publikace</span>
        </div>
      </section>

      <nav className="ingest-lab__pagination" aria-label="Listování spárovanými stránkami">
        <button type="button" disabled={pageIndex === 0 || locked} onClick={() => { setPageIndex((value) => Math.max(0, value - 1)); setBoundaryAfter(false); }}>← Předchozí</button>
        <span>Originál {activeSourcePageNumber} / {paired.sourcePages.length} · ARTales {activeComposedPageNumber} / {paired.composedPages.length}</span>
        <button type="button" disabled={pageIndex >= paired.composedPages.length - 1 || locked} onClick={() => { setPageIndex((value) => Math.min(paired.composedPages.length - 1, value + 1)); setBoundaryAfter(false); }}>Další →</button>
      </nav>
      <div className={"ingest-lab__spread" + (readerOnly ? " ingest-lab__spread--reader-only" : "")} aria-label="Čtenářské porovnání originálu a složené kapitoly">
        {!readerOnly && <section className="ingest-lab__page" aria-labelledby="ingest-source-heading">
          <div className="ingest-lab__page-top"><span>ORIGINÁL</span><span>Neměnný zdroj</span></div>
          <div className="ingest-lab__page-heading"><h2 id="ingest-source-heading">Zdrojový rukopis</h2><p>{INGEST_FIXTURE.author}</p></div>
          <div className="ingest-lab__page-content">
            {sourcePage.map((item) => <article key={item.block.id} className={"ingest-lab__region" + (selectedId === item.block.id ? " ingest-lab__region--selected" : "")}>
              <button type="button" disabled={locked} aria-pressed={selectedId === item.block.id} aria-label={"Označit oblast originálu " + item.start + " až " + item.end} onClick={() => chooseBlock(item.block.id)} className="ingest-lab__mark">{selectedId === item.block.id ? "● Označeno" : "+ Označit"}</button>
              <SourceBlock item={item} />
            </article>)}
          </div>
          <footer className="ingest-lab__folio"><span>Fiktivní zdroj</span><span>{activeSourcePageNumber}</span></footer>
        </section>}

        <section className="ingest-lab__page ingest-lab__page--composed" aria-labelledby="ingest-reader-heading">
          <div className="ingest-lab__page-top"><span>ARTales READER</span><span>Náhled složených bloků</span></div>
          <div className="ingest-lab__page-heading"><h2 id="ingest-reader-heading">Cesta za řekou</h2><p>Ukázková kapitola · automaticky sestavená</p></div>
          <div className="ingest-lab__page-content">
            {visibleBlocks.map((item) => {
              const variant = item.layoutVariant ?? (item.block.type === "poem" ? "dense_verse" : "default");
              return <article key={item.block.id} className={"ingest-lab__region ingest-lab__composition--" + variant + (selectedId === item.block.id ? " ingest-lab__region--selected" : "")}>
                <button type="button" disabled={locked} aria-pressed={selectedId === item.block.id} aria-label={"Označit blok " + item.block.type} onClick={() => chooseBlock(item.block.id)} className="ingest-lab__mark">{selectedId === item.block.id ? "● Označeno" : "+ Označit"}</button>
                <WorkContentRenderer blocks={[item.block]} />
              </article>;
            })}
          </div>
          <footer className="ingest-lab__folio"><span>ARTales · pracovní sazba</span><span>{activeComposedPageNumber}</span></footer>
        </section>
      </div>

      <section className="ingest-lab__review" aria-labelledby="ingest-review-heading">
        <div className="ingest-lab__review-heading">
          <div><p className="ingest-lab__eyebrow">Redakční kontrola</p><h2 id="ingest-review-heading">Připomínka k vybrané oblasti</h2></div>
          <span className="ingest-lab__review-status" role="status">{{ select: "Výběr", returned: "Vráceno", recomposed: "Přepracováno", accepted: "Přijato", saved: "Uloženo lokálně" }[stage]}</span>
        </div>
        {selected && <p className="ingest-lab__anchor"><strong>{selected.block.type}</strong> · úsek {selected.start}–{selected.end} · vazba na zdroj <code>{selected.componentId}</code></p>}
        {stage === "select" && <div className="ingest-lab__review-grid">
          <label>Co je podle vás špatně?
            <select value={issue} onChange={(event) => setIssue(event.target.value as FixtureIssueCategory)}>
              {extendedIssues.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Co je potřeba opravit?
            <textarea value={editorNote} maxLength={1000} rows={3} onChange={(event) => setEditorNote(event.target.value)} placeholder="Např. verše jsou příliš sevřené; ponechat přesné znění a upravit pouze řádkování." />
          </label>
          <label className="ingest-lab__boundary-control"><input type="checkbox" checked={boundaryAfter} disabled={!canMarkBoundary} onChange={(event) => setBoundaryAfter(event.target.checked)}/> Označit problém na hranici mezi touto a následující oblastí (např. nevhodný konec stránky)</label>
          <div className="ingest-lab__form-actions"><button type="button" className="ingest-lab__primary" disabled={!selected || editorNote.trim().length < 3 || !qa.ok} onClick={submitEditorialIssue}>Odeslat připomínku</button></div>
          <p className="ingest-lab__route-note">ARTales vyhodnotí připomínku automaticky. Jednoduchou typografii přepočítá v náhledu; ostatní problémy bezpečně uloží k pozdějšímu řešení. Fixture zatím neodesílá úlohy do Nexu.</p>
        </div>}
        {stage === "returned" && <div className="ingest-lab__review-step">
          <p><strong>Připomínka zaznamenána:</strong> {editorNote}</p>
          <p>Vrácena je pouze oblast {selected?.start}–{selected?.end}. Text originálu je uzamčený.</p>
          <div className="ingest-lab__actions"><button type="button" className="ingest-lab__primary" onClick={recompose}>Přepracovat označený blok</button><button type="button" onClick={cancelCorrection}>Zrušit</button></div>
        </div>}
        {stage === "recomposed" && <div className="ingest-lab__review-step">
          <p><strong>Nová sazba je v pravé stránce.</strong> Ostatní bloky nebyly změněny. Kontrola zdrojového textu: {qa.ok ? "beze změny" : "CHYBA"}.</p>
          <div className="ingest-lab__actions"><button type="button" className="ingest-lab__primary" disabled={!qa.ok} onClick={acceptRevision}>Přijmout přepracování</button><button type="button" onClick={cancelCorrection}>Vrátit k předchozí sazbě</button></div>
        </div>}
        {stage === "accepted" && <div className="ingest-lab__review-step">
          <p>Revize přijata. Zatím je pouze v paměti stránky. Uložení níže vytváří metadata redakčního rozhodnutí, nikoli změnu vydávaného díla.</p>
          <div className="ingest-lab__actions"><button type="button" className="ingest-lab__primary" onClick={saveLocalFeedback}>Uložit rozhodnutí do prohlížeče</button><button type="button" onClick={cancelCorrection}>Zrušit přijetí</button></div>
        </div>}
        {stage === "saved" && <div className="ingest-lab__review-step">
          <p>Rozhodnutí uložené lokálně. Obsahuje ID zdroje a úseku, připomínku, původní a novou sazbu, ověření integrity a přijetí editorem.</p>
          <div className="ingest-lab__actions"><button type="button" className="ingest-lab__primary" onClick={startNextReview}>Označit další oblast</button></div>
        </div>}
        {notice && <p className="ingest-lab__notice" role="status">{notice}</p>}
        {qa.issues.length > 0 && <ul className="ingest-lab__errors">{qa.issues.map((item) => <li key={item}>{item}</li>)}</ul>}
        <div className="ingest-lab__finish">
          <button type="button" className="ingest-lab__primary" onClick={() => { setReviewFinished(true); setNotice("Kontrola kapitoly uzavřena v ukázkovém režimu. Trvalé odeslání a inbox zatím nejsou napojeny."); }}>Označit kontrolu jako hotovou</button>
          {reviewFinished && <strong role="status">✓ Kontrola dokončena · fixture · bez odeslání</strong>}
          <a href="/member/candidates">Opustit kontrolu</a>
        </div>
        <div className="ingest-lab__feedback-footer">
          <p><strong>Podklad pro učení Nexus/AT:</strong> pouze lokální záznam. Automatické odeslání ani trénování neprobíhá.</p>
          <button type="button" disabled={!savedRecords.length} onClick={exportFeedback}>Exportovat uložené připomínky (JSON)</button>
        </div>
      </section>
    </main>
  );
}
