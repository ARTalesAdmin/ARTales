"use client";

import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent,
} from "react";
import WorkContentRenderer from "@/components/work/WorkContentRenderer";
import {
  INGEST_FIXTURE, composeFixtureSection, inspectSourceIntegrity,
  recomposeFixtureRegion, type AnchoredBlock,
} from "@/lib/fixtures/ingestComposer";
import {
  createFixtureReviewRecord, type FixtureReviewRecord,
} from "@/lib/fixtures/ingestReview";
import {
  createFixtureIssueReport, type FixtureIssueReport, type FixtureIssueAnchor,
} from "@/lib/fixtures/ingestIssue";
import { EDITORIAL_PRESETS, getEditorialPreset, routeFixtureIssue } from "@/lib/fixtures/editorialPresets";
import { alignedScrollTop } from "@/lib/fixtures/pairedScroll";
import "./ingest-fixture-lab.css";

const artifact = composeFixtureSection(INGEST_FIXTURE);
const initialId = artifact.blocks[0]?.block.id ?? "";
const REVIEW_KEY = "artales:ingest-fixture:editorial-reviews:v1";
const ISSUE_KEY = "artales:ingest-fixture:editorial-issues:v1";
const SESSION_KEY = "artales:ingest-fixture:session-summary:v1";
type FormatMode = "a4" | "continuous";
type Pane = "source" | "artales";
type PendingRevision = { before: AnchoredBlock[]; blockId: string; note: string };

function safeReview(value: unknown): value is FixtureReviewRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<FixtureReviewRecord>;
  return item.schema === "artales.fixture.editorial-feedback.v1" &&
    item.sourceId === INGEST_FIXTURE.sourceId && item.fixtureOnly === true &&
    item.deliveredToNexus === false && item.decision === "accepted";
}
function safeIssue(value: unknown): value is FixtureIssueReport {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<FixtureIssueReport>;
  return item.schema === "artales.fixture.editorial-issue.v1" &&
    item.sourceId === INGEST_FIXTURE.sourceId &&
    item.fixtureOnly === true && item.deliveredToNexus === false;
}

function SourceBlock({ item }: { item: AnchoredBlock }) {
  const component = INGEST_FIXTURE.components.find((part) => part.id === item.componentId);
  const content = component?.raw.slice(item.start, item.end) ?? "";
  if (item.block.type === "chapter") return <h3 className="ingest-lab__source-chapter">{content}</h3>;
  if (item.block.type === "poem") return <p className="ingest-lab__source-poem">{content}</p>;
  return <p className="ingest-lab__source-prose">{content}</p>;
}

function scrollPaneToRegion(pane: HTMLElement | null, index: number, behavior: ScrollBehavior = "auto") {
  if (!pane || pane.clientWidth === 0) return;
  const region = pane.querySelector<HTMLElement>('[data-region-index="' + index + '"]');
  if (!region) return;
  const paneRect = pane.getBoundingClientRect();
  const rect = region.getBoundingClientRect();
  const top = pane.scrollTop + rect.top - paneRect.top - Math.min(120, pane.clientHeight * 0.24);
  pane.scrollTo({ top: Math.max(0, top), behavior });
}

export default function IngestFixtureLab() {
  const [blocks, setBlocks] = useState<AnchoredBlock[]>(() => artifact.blocks);
  const [selectedId, setSelectedId] = useState(initialId);
  const [pageIndex, setPageIndex] = useState(0);
  const [formatMode, setFormatMode] = useState<FormatMode>("continuous");
  const [panelOnSide, setPanelOnSide] = useState(false);
  const [revealTick, setRevealTick] = useState(0);
  const [readerOnly, setReaderOnly] = useState(false);
  const [mobilePane, setMobilePane] = useState<Pane>("artales");
  const [fontScale, setFontScale] = useState(1);
  const [presetId, setPresetId] = useState("unknown");
  const [editorNote, setEditorNote] = useState("");
  const [pendingRevision, setPendingRevision] = useState<PendingRevision | null>(null);
  const [savedReviews, setSavedReviews] = useState<FixtureReviewRecord[]>([]);
  const [savedIssues, setSavedIssues] = useState<FixtureIssueReport[]>([]);
  const [reviewFinished, setReviewFinished] = useState(false);
  const [notice, setNotice] = useState("");
  const sourceRef = useRef<HTMLElement | null>(null);
  const artalesRef = useRef<HTMLElement | null>(null);
  const pendingRevealRef = useRef<string | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const ignoreScrollUntilRef = useRef({ source: 0, artales: 0 });

  const qa = useMemo(() => inspectSourceIntegrity(INGEST_FIXTURE, blocks), [blocks]);
  // Deliberately smaller origin typography: one source page may pair with 2-3 ARTales pages.
  // Character budgets are fixture approximations, NOT measured Reader pagination.
  const paired = { sourcePages: [blocks], composedPages: [{ page: 1, sourcePage: 1, blocks }] };
  const activeIndex = Math.min(pageIndex, Math.max(0, paired.composedPages.length - 1));
  const activePage = paired.composedPages[activeIndex];
  const sourceFolio = activePage?.sourcePage ?? 1;
  const composedFolio = activePage?.page ?? 1;
  const shownSource = formatMode === "a4" ? (paired.sourcePages[sourceFolio - 1] ?? []) : blocks;
  const shownArtales = formatMode === "a4" ? (activePage?.blocks ?? []) : blocks;
  const selected = blocks.find((item) => item.block.id === selectedId);
  const selectedIndex = blocks.findIndex((item) => item.block.id === selectedId);
  const preset = getEditorialPreset(presetId);
  const note = editorNote.trim() || (preset.needsNote ? "" : preset.label);
  const canSubmit = Boolean(selected) && qa.ok && note.length >= 3 && !pendingRevision && !reviewFinished;
  const locked = Boolean(pendingRevision) || reviewFinished;
  const fontStyle = { "--fixture-font-scale": fontScale } as CSSProperties;

  useEffect(() => {
    try {
      const reviews = JSON.parse(window.localStorage.getItem(REVIEW_KEY) ?? "[]") as unknown;
      const issues = JSON.parse(window.localStorage.getItem(ISSUE_KEY) ?? "[]") as unknown;
      if (Array.isArray(reviews)) setSavedReviews(reviews.filter(safeReview).slice(-25));
      if (Array.isArray(issues)) setSavedIssues(issues.filter(safeIssue).slice(-25));
    } catch {
      setNotice("Lokální historie není přístupná; nové rozhodnutí lze stále zkontrolovat.");
    }
  }, []);

  useLayoutEffect(() => {
    const id = pendingRevealRef.current;
    if (!id) return;
    const index = blocks.findIndex((item) => item.block.id === id);
    if (index < 0) return;

    const frame = window.requestAnimationFrame(() => {
      ignoreScrollUntilRef.current = { source: performance.now() + 220, artales: performance.now() + 220 };
      scrollPaneToRegion(sourceRef.current, index);
      scrollPaneToRegion(artalesRef.current, index);
      pendingRevealRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, pageIndex, formatMode, readerOnly, mobilePane, blocks, shownArtales, revealTick]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  function selectRegion(id: string, side: Pane) {
    if (locked) return;
    pendingRevealRef.current = id;
    setSelectedId(id);
    setRevealTick((value) => value + 1);

    if (window.matchMedia("(max-width: 850px)").matches && !readerOnly) {
      setMobilePane(side === "source" ? "artales" : "source");
    }
    setNotice("");
  }

  function onRegionKey(event: KeyboardEvent<HTMLDivElement>, id: string, side: Pane) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectRegion(id, side);
    }
  }

  function handleContinuousScroll(side: Pane) {
    if (locked || readerOnly) return;
    if (performance.now() < ignoreScrollUntilRef.current[side]) return;
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const pane = side === "source" ? sourceRef.current : artalesRef.current;
      const otherSide: Pane = side === "source" ? "artales" : "source";
      const other = otherSide === "source" ? sourceRef.current : artalesRef.current;
      if (!pane || !other || !other.clientWidth) return;
      const offsets = (element: HTMLElement) => {
        const top = element.getBoundingClientRect().top;
        return Array.from(element.querySelectorAll<HTMLElement>("[data-region-index]"),
          (node) => node.getBoundingClientRect().top - top + element.scrollTop);
      };
      try {
        const target = alignedScrollTop({
          sourceStarts: offsets(pane), targetStarts: offsets(other),
          sourceScrollTop: pane.scrollTop, sourceClientHeight: pane.clientHeight,
          sourceScrollHeight: pane.scrollHeight, targetClientHeight: other.clientHeight,
          targetScrollHeight: other.scrollHeight,
        });
        ignoreScrollUntilRef.current[otherSide] = performance.now() + 100;
        other.scrollTop = target;
      } catch {
        // Responsive remount: wait for the next scroll frame.
      }
    });
  }

  function changeFormat(next: FormatMode) {
    pendingRevealRef.current = selectedId;
    setFormatMode(next);
  }

  function flagCurrentPageBreak() {
    if (locked) return;
    setPresetId("page.bad_break");
    setNotice("Vyberte nežádoucí předěl v textu. Přesné stránky bude určovat měřený Reader.");
  }

  function saveIssueLocally() {
    if (!selected || !canSubmit) return;
    const next = blocks[selectedIndex + 1];
    const anchor: FixtureIssueAnchor = preset.boundary && next
      ? { kind: "boundary_after", blockId: selected.block.id, nextBlockId: next.block.id }
      : { kind: "block", blockId: selected.block.id };
    try {
      const issue = createFixtureIssueReport({
        capture: INGEST_FIXTURE, blocks, anchor,
        category: preset.category, editorNote: note,
        presetCode: preset.id,
        viewContext: {
          renderer: formatMode === "a4" ? "fixture-paired-a4-v2" : "fixture-continuous-v2",
          readerMode: readerOnly ? "reader_only" : "comparison",
          fontScale, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
          formatMode, originalPage: formatMode === "a4" ? sourceFolio : undefined,
          artalesPage: formatMode === "a4" ? composedFolio : undefined,
        },
        recordedAt: new Date().toISOString(),
      });
      const nextIssues = [...savedIssues, issue].slice(-25);
      window.localStorage.setItem(ISSUE_KEY, JSON.stringify(nextIssues));
      setSavedIssues(nextIssues);
      setEditorNote("");
      setPresetId("unknown");
      setNotice("Připomínka uložena v tomto prohlížeči. V produkci by šla do fronty; zde se žádná úloha nespouští.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Připomínku se nepodařilo uložit.");
    }
  }

  function submitIssue() {
    if (!selected || !canSubmit) return;
    const lane = routeFixtureIssue(preset.id, selected.block.type);
    if (lane === "deferred_fixture") {
      saveIssueLocally();
      return;
    }
    try {
      const next = recomposeFixtureRegion(INGEST_FIXTURE, blocks, selected.block.id);
      setPendingRevision({ before: blocks, blockId: selected.block.id, note });
      setBlocks(next);
      pendingRevealRef.current = selected.block.id;
      setNotice("Nová sazba je zobrazena přímo v knize. Text nebyl změněn.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Návrh opravy nelze vytvořit.");
    }
  }

  function acceptRevision() {
    if (!pendingRevision || !qa.ok) return;
    try {
      const record = createFixtureReviewRecord({
        capture: INGEST_FIXTURE, before: pendingRevision.before, after: blocks,
        blockId: pendingRevision.blockId, issue: "typography",
        editorNote: pendingRevision.note, acceptedAt: new Date().toISOString(),
      });
      const nextReviews = [...savedReviews, record].slice(-25);
      window.localStorage.setItem(REVIEW_KEY, JSON.stringify(nextReviews));
      setSavedReviews(nextReviews);
      setPendingRevision(null);
      setPresetId("unknown");
      setEditorNote("");
      setNotice("Oprava přijata a uložena lokálně. Můžete pokračovat v kontrole.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Přijetí se nepodařilo uložit.");
    }
  }

  function rejectRevision() {
    if (!pendingRevision) return;
    setBlocks(pendingRevision.before);
    pendingRevealRef.current = pendingRevision.blockId;
    setPendingRevision(null);
    setNotice("Návrh opravy byl vrácen, předchozí sazba obnovena.");
  }

  function finishReview() {
    if (!qa.ok || pendingRevision) return;
    try {
      const summary = {
        schema: "artales.fixture.review-session.v1",
        sourceId: INGEST_FIXTURE.sourceId,
        editionId: "fixture:river-edition:cs:v1",
        editionVersion: "fixture-1",
        actor: "fixture-editor",
        completedAt: new Date().toISOString(),
        acceptedCorrections: savedReviews.length,
        deferredIssues: savedIssues.length,
        integrity: "verified",
        fixtureOnly: true,
        deliveredToInbox: false,
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(summary));
      setReviewFinished(true);
      setNotice("Kontrola uzavřena a souhrn uložen lokálně. Skutečný inbox a audit v databázi ještě nejsou napojené.");
    } catch {
      setNotice("Nelze bezpečně uložit souhrn kontroly. Dokončení neproběhlo.");
    }
  }

  function exportFixtureNotes() {
    const content = JSON.stringify({
      schema: "artales.fixture.editorial-feedback-export.v1",
      sourceId: INGEST_FIXTURE.sourceId, accepted: savedReviews, unresolved: savedIssues,
    }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "artales-editorial-fixture.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const regionIndex = new Map(blocks.map((item, index) => [item.block.id, index]));
  function regions(items: AnchoredBlock[], pane: Pane) {
    return items.map((item) => {
      const active = selectedId === item.block.id;
      const flagged = savedIssues.some((entry) => entry.anchor.blockId === item.block.id);
      const variant = item.layoutVariant ?? (item.block.type === "poem" ? "dense_verse" : "default");
      return (
        <div key={item.block.id} role="button" tabIndex={locked ? -1 : 0}
          aria-pressed={active} aria-label={"Označit související úsek " + item.block.type}
          data-region-index={regionIndex.get(item.block.id)}
          className={"ingest-lab__region ingest-lab__composition--" + variant +
            (active ? " ingest-lab__region--selected" : "") +
            (flagged ? " ingest-lab__region--flagged" : "")}
          onClick={() => selectRegion(item.block.id, pane)}
          onKeyDown={(event) => onRegionKey(event, item.block.id, pane)}>
          <span className="ingest-lab__mark" aria-hidden="true">{flagged ? "⚑" : active ? "✎" : "＋"}</span>
          {pane === "source" ? <SourceBlock item={item} /> : <WorkContentRenderer blocks={[item.block]} />}
        </div>
      );
    });
  }

  const groups = Array.from(new Set(EDITORIAL_PRESETS.map((item) => item.group)));
  return (
    <main className={"ingest-lab ingest-lab--docked " +
      (panelOnSide ? "ingest-lab--side" : "ingest-lab--bottom")} style={fontStyle}>
      <header className="ingest-lab__toolbar">
        <div className="ingest-lab__brand">
          <strong>ARTales</strong>
          <span>Cesta za řekou · redakční kontrola · testovací edice</span>
        </div>
        <div className="ingest-lab__toolbar-actions">
          <button type="button" className="ingest-lab__panel-toggle"
            title="Přepnout polohu poznámek" onClick={() => setPanelOnSide((value) => !value)}>
            {panelOnSide ? "Panel dole" : "Panel vpravo"}
          </button>
          <div className="ingest-lab__format-switch" role="group" aria-label="Režim čtení">
            <button type="button" aria-pressed={formatMode === "a4"}
              onClick={() => changeFormat("a4")}>A4</button>
            <button type="button" aria-pressed={formatMode === "continuous"}
              onClick={() => changeFormat("continuous")}>Kontinuální</button>
          </div>
          <button type="button" className="ingest-lab__minor" onClick={() => {
            pendingRevealRef.current = selectedId;
            setReaderOnly((previous) => !previous);
          }}>{readerOnly ? "Srovnat" : "Jen ARTales"}</button>
          <button type="button" aria-label="Zmenšit písmo" className="ingest-lab__minor" disabled={fontScale <= 0.9}
            onClick={() => setFontScale((value) => Math.max(0.9, Math.round((value - 0.1) * 10) / 10))}>A−</button>
          <button type="button" aria-label="Zvětšit písmo" className="ingest-lab__minor" disabled={fontScale >= 1.2}
            onClick={() => setFontScale((value) => Math.min(1.2, Math.round((value + 0.1) * 10) / 10))}>A+</button>
        </div>
      </header>

      <div className="ingest-lab__subbar">
        <span>{qa.ok ? "✓ Originál ověřen" : "⚠ Neshoda se zdrojem"}</span>
        <span>{formatMode === "a4" ? "A4 · průběžný vizuální náhled bez falešných folií" : "Synchronizované kontinuální čtení"}</span>
        <span className="ingest-lab__subbar-count">{savedReviews.length} oprav · {savedIssues.length} připomínek</span>
      </div>

      {!readerOnly && <div className="ingest-lab__mobile-tabs" role="group" aria-label="Zobrazená verze">
        <button type="button" aria-pressed={mobilePane === "source"} onClick={() => {
          pendingRevealRef.current = selectedId; setMobilePane("source");
        }}>Originál</button>
        <button type="button" aria-pressed={mobilePane === "artales"} onClick={() => {
          pendingRevealRef.current = selectedId; setMobilePane("artales");
        }}>ARTales</button>
      </div>}

      <div className={"ingest-lab__spread ingest-lab__spread--workspace" +
        (readerOnly ? " ingest-lab__spread--reader-only" : "") +
        (formatMode === "continuous" ? " ingest-lab__spread--continuous" : "")}>
        {!readerOnly && (
          <section className={"ingest-lab__page ingest-lab__page--source" +
            (mobilePane !== "source" ? " ingest-lab__page--mobile-hidden" : "")}
            ref={sourceRef} aria-label="Originál, samostatně posuvná čtecí oblast"
            onScroll={() => handleContinuousScroll("source")}>
            <div className="ingest-lab__sheet">
              <div className="ingest-lab__page-top"><span>ORIGINÁL</span><span>{formatMode === "a4" ? "Strana " + sourceFolio : "Souvislý text"}</span></div>
              <div className="ingest-lab__page-heading"><h2>Zdrojový rukopis</h2><p>Fiktivní literární text</p></div>
              <div className="ingest-lab__page-content">{regions(shownSource, "source")}</div>
              <footer className="ingest-lab__folio"><span>Zdrojová edice</span><span>{formatMode === "a4" ? sourceFolio : "—"}</span></footer>
            </div>
          </section>
        )}
        <section className={"ingest-lab__page ingest-lab__page--composed" +
          (!readerOnly && mobilePane !== "artales" ? " ingest-lab__page--mobile-hidden" : "")}
          ref={artalesRef} aria-label="ARTales, samostatně posuvná čtecí oblast"
          onScroll={() => handleContinuousScroll("artales")}>
          <div className="ingest-lab__sheet">
            <div className="ingest-lab__page-top"><span>ARTales Reader</span><span>{formatMode === "a4" ? "Strana " + composedFolio : "Souvislý text"}</span></div>
            <div className="ingest-lab__page-heading"><h2>Cesta za řekou</h2><p>Pracovní sestavená edice</p></div>
            <div className="ingest-lab__page-content">{regions(shownArtales, "artales")}</div>
            <footer className="ingest-lab__folio"><span>ARTales · pracovní sazba</span><span>{formatMode === "a4" ? composedFolio : "—"}</span></footer>
          </div>
        </section>
      </div>

      <section className="ingest-lab__review ingest-lab__review--docked" aria-label="Panel redakčních připomínek">
        <div className="ingest-lab__review-heading">
          <button type="button" className="ingest-lab__review-collapse" aria-label="Rozbalit nebo sbalit panel připomínek"
            onClick={() => setPanelOnSide((old) => !old)}>{panelOnSide ? "Sbalit" : "✎ Připomínka / rozbalit"}</button>
          <div className="ingest-lab__review-title">
            <strong>✎ {reviewFinished ? "Kontrola uzavřena" : pendingRevision ? "Zkontrolovat novou sazbu" : "Připomínka k textu"}</strong>
            <span>{selected ? "Vybraný úsek: " + selected.block.type + " · " + selected.start + "–" + selected.end : "Klikněte na problémový úsek"}</span>
          </div>
          <span className="ingest-lab__review-status">{reviewFinished ? "Dokončeno lokálně" : pendingRevision ? "Nový návrh" : "Pracovní kontrola"}</span>
        </div>
        {!reviewFinished && !pendingRevision && <>
          <p className="ingest-lab__review-hint">Klikněte na úsek v jedné z knih – zvýrazní se i protějšek. Pak vyberte problém a odešlete.</p>
          <div className="ingest-lab__review-inline">
            <label className="ingest-lab__select-label">Problém
              <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                {groups.map((group) => (
                  <optgroup label={group} key={group}>
                    {EDITORIAL_PRESETS.filter((item) => item.group === group).map((item) =>
                      <option key={item.id} value={item.id}>{item.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="ingest-lab__note-label">Poznámka {preset.needsNote ? "(nutná)" : "(volitelná)"}
              <input type="text" maxLength={1000} value={editorNote}
                onChange={(event) => setEditorNote(event.target.value)}
                placeholder={preset.needsNote ? "Co přesně vám zde nesedí?" : "Případné upřesnění…"}
                onKeyDown={(event) => { if (event.key === "Enter" && canSubmit) submitIssue(); }} />
            </label>
            <button type="button" className="ingest-lab__primary" disabled={!canSubmit} onClick={submitIssue}>Odeslat připomínku</button>
          </div>
        </>}
        {!reviewFinished && pendingRevision && (
          <div className="ingest-lab__review-inline ingest-lab__review-inline--decision">
            <p>Upravená sazba je zvýrazněna v ARTales. Text je beze změny. Přijmout tuto lokální opravu?</p>
            <button type="button" className="ingest-lab__primary" disabled={!qa.ok} onClick={acceptRevision}>Přijmout a uložit</button>
            <button type="button" className="ingest-lab__secondary" onClick={rejectRevision}>Vrátit</button>
          </div>
        )}
        <div className="ingest-lab__review-bottom">
          <span className="ingest-lab__notice" role="status">{notice || (formatMode === "a4" ? "A4 náhled používá přibližné stránkové členění; ostrý Reader bude měřený." : "Související bloky se při posuvu párují podle textu.")}</span>
          <div className="ingest-lab__review-actions">
            {(savedReviews.length > 0 || savedIssues.length > 0) &&
              <details className="ingest-lab__technical"><summary>Historie fixture</summary>
                <p>{savedReviews.length} lokálních přijetí, {savedIssues.length} dosud nevyřešených připomínek.</p>
                <button type="button" onClick={exportFixtureNotes}>Export JSON</button>
              </details>}
            <button type="button" className="ingest-lab__secondary" disabled={!qa.ok || Boolean(pendingRevision) || reviewFinished} onClick={finishReview}>Dokončit kontrolu</button>
            <a href="/member/candidates">Odejít</a>
          </div>
        </div>
      </section>
    </main>
  );
}
