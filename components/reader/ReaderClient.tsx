"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import WorkContentRenderer from "@/components/work/WorkContentRenderer";
import type { WorkBlock } from "@/lib/blocks";
import {
  loadReaderNotes,
  loadReaderProgress,
  loadReaderSettings,
  saveReaderNotes,
  saveReaderProgress,
  saveReaderSettings,
  type ReaderNote,
  type ReaderNoteColor,
} from "@/lib/reader/readerStorage";
import {
  clampReaderFontScale,
  type ReaderDensityId,
  type ReaderLayoutModeId,
  type ReaderSettings,
  type ReaderThemeId,
  type ReaderWidthId,
} from "@/lib/reader/readerSettings";
import { paginateReaderBlocks, type ReaderPage } from "@/lib/reader/paginateBlocks";
import { getPublicDictionary } from "@/lib/i18n/public";
import type { SupportedLocale } from "@/lib/i18n/config";
import ReaderToolbar from "./ReaderToolbar";
import "./reader.css";

type ReaderClientProps = {
  slug: string;
  title: string;
  authorName?: string | null;
  mode: "preview" | "full";
  blocks: WorkBlock[];
  fallbackContent?: string | null;
  locale: SupportedLocale;
};

function getPageProgress(pageIndex: number, pageCount: number) {
  if (pageCount <= 1) return 100;
  return Math.max(0, Math.min(100, (pageIndex / (pageCount - 1)) * 100));
}

function getSpreadStartPage(pageIndex: number) {
  return Math.max(0, pageIndex - (pageIndex % 2));
}


export default function ReaderClient({
  slug,
  title,
  mode,
  blocks,
  fallbackContent,
  locale,
}: ReaderClientProps) {
  const [settings, setSettings] = useState<ReaderSettings>(() => ({
    ...loadReaderSettings(),
    controlsCollapsed: true,
  }));
  const [progressPercent, setProgressPercent] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [notes, setNotes] = useState<ReaderNote[]>([]);
  const [notesSyncState, setNotesSyncState] = useState<"local" | "syncing" | "synced">("local");
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);
  const [progressRestoreReady, setProgressRestoreReady] = useState(
    mode !== "full",
  );
  const restoredPagePosition = useRef(false);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const turnTimerRef = useRef<number | null>(null);
  const notesSyncRunRef = useRef(0);
  const dictionary = getPublicDictionary(locale);
  const labels = dictionary.reader;

  const isSpreadMode = settings.layoutMode === "spread";
  const pageStep = isSpreadMode ? 2 : 1;
  const detailHref = `/work/${slug}`;
  const fullHref = `/reader/${slug}?mode=full`;
  const readerPages = useMemo(
    () => paginateReaderBlocks(blocks, settings),
    [blocks, settings],
  );
  const pageCount = readerPages.length;
  const normalizedPageIndex = isSpreadMode ? getSpreadStartPage(pageIndex) : pageIndex;

  useEffect(() => {
    saveReaderSettings(settings);
  }, [settings]);

  const syncNotes = useCallback(async () => {
    const run = ++notesSyncRunRef.current;
    const localNotes = loadReaderNotes(slug, labels.importedNote);
    setNotes(localNotes);
    setNotesSyncState("syncing");
    try {
      const response = await fetch(`/api/reader/notes?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error("notes unavailable");
      const payload = await response.json() as { signedIn: boolean };
      if (!payload.signedIn) {
        if (run === notesSyncRunRef.current) setNotesSyncState("local");
        return;
      }
      for (const note of localNotes.filter((item) => item.source !== "synced")) {
        const upload = await fetch("/api/reader/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(note) });
        if (!upload.ok) throw new Error("note upload failed");
      }
      const refreshed = await fetch(`/api/reader/notes?slug=${encodeURIComponent(slug)}`);
      if (!refreshed.ok) throw new Error("notes refresh failed");
      const refreshedPayload = await refreshed.json() as { notes: Array<Record<string, unknown>> };
      const remoteNotes: ReaderNote[] = refreshedPayload.notes.map((row) => ({
        id: String(row.id), slug: String(row.work_slug), userId: String(row.user_id),
        title: row.title as string | null, body: row.body as string | null,
        color: row.color as ReaderNoteColor, progressPercent: Number(row.progress_percent),
        scrollY: Number(row.scroll_y), pageIndex: row.page_index == null ? undefined : Number(row.page_index),
        pageCount: row.page_count == null ? undefined : Number(row.page_count),
        layoutMode: row.layout_mode as ReaderNote["layoutMode"], createdAt: String(row.created_at),
        updatedAt: String(row.updated_at), source: "synced",
      }));
      if (run !== notesSyncRunRef.current) return;
      // A note may be created while requests are in flight. Keep any such
      // local-only record instead of replacing it with the remote snapshot.
      const currentLocal = loadReaderNotes(slug, labels.importedNote);
      const merged = new Map(remoteNotes.map((note) => [note.id, note]));
      currentLocal.filter((note) => note.source !== "synced").forEach((note) => {
        if (!merged.has(note.id)) merged.set(note.id, note);
      });
      const nextNotes = [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setNotes(nextNotes);
      saveReaderNotes(slug, nextNotes);
      setNotesSyncState("synced");
    } catch {
      if (run === notesSyncRunRef.current) setNotesSyncState("local");
    }
  }, [labels.importedNote, slug]);

  useEffect(() => {
    void syncNotes();
    const onOnline = () => void syncNotes();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void syncNotes();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      notesSyncRunRef.current += 1;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [syncNotes]);

  useEffect(() => {
    return () => {
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  useEffect(() => {
    if (!isSpreadMode) return;
    setPageIndex((current) => getSpreadStartPage(current));
  }, [isSpreadMode]);

  useEffect(() => {
    if (restoredPagePosition.current) return;
    if (mode !== "full" || pageCount < 1) return;
    restoredPagePosition.current = true;

    const saved = loadReaderProgress(slug);
    if (!saved) {
      setProgressRestoreReady(true);
      return;
    }
    const legacyIndex = Math.round((saved.progressPercent / 100) * (pageCount - 1));
    const restoredIndex = Math.max(
      0,
      Math.min(pageCount - 1, saved.pageIndex ?? legacyIndex),
    );
    setPageIndex(isSpreadMode ? getSpreadStartPage(restoredIndex) : restoredIndex);
    if (!isSpreadMode) {
      window.setTimeout(() => {
        flowRef.current
          ?.querySelector<HTMLElement>(`[data-page-index="${restoredIndex}"]`)
          ?.scrollIntoView({ block: "start" });
      }, 220);
    }
    setProgressRestoreReady(true);
  }, [isSpreadMode, mode, pageCount, slug]);

  useEffect(() => {
    const nextProgress = getPageProgress(normalizedPageIndex, pageCount);
    setProgressPercent(nextProgress);
    // Do not replace a saved position with page one during the initial render.
    // The restore effect above first reads and applies the existing record.
    if (mode === "full" && progressRestoreReady) {
      saveReaderProgress({
        slug,
        mode,
        scrollY: normalizedPageIndex,
        pageIndex: normalizedPageIndex,
        pageCount,
        progressPercent: nextProgress,
        layoutMode: settings.layoutMode,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [
    mode,
    normalizedPageIndex,
    pageCount,
    progressRestoreReady,
    settings.layoutMode,
    slug,
  ]);

  useEffect(() => {
    if (isSpreadMode) return;
    let frame = 0;
    const updateActivePage = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const sheets = flowRef.current?.querySelectorAll<HTMLElement>("[data-page-index]");
        if (!sheets?.length) return;
        const readingLine = window.innerHeight * 0.35;
        let nextIndex = 0;
        sheets.forEach((sheet) => {
          if (sheet.getBoundingClientRect().top <= readingLine) {
            nextIndex = Number(sheet.dataset.pageIndex ?? 0);
          }
        });
        setPageIndex(nextIndex);
      });
    };
    updateActivePage();
    window.addEventListener("scroll", updateActivePage, { passive: true });
    window.addEventListener("resize", updateActivePage);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActivePage);
      window.removeEventListener("resize", updateActivePage);
    };
  }, [isSpreadMode, pageCount]);


  const triggerPageTurn = useCallback((direction: "next" | "previous") => {
    setTurnDirection(direction);
    if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
    turnTimerRef.current = window.setTimeout(() => {
      setTurnDirection(null);
      turnTimerRef.current = null;
    }, 240);
  }, []);

  const goToPreviousPage = useCallback(() => {
    setPageIndex((current) => {
      const nextIndex = Math.max(0, current - pageStep);
      if (nextIndex !== current) triggerPageTurn("previous");
      return nextIndex;
    });
  }, [pageStep, triggerPageTurn]);

  const goToNextPage = useCallback(() => {
    setPageIndex((current) => {
      const nextIndex = Math.min(pageCount - 1, current + pageStep);
      if (nextIndex !== current) triggerPageTurn("next");
      return nextIndex;
    });
  }, [pageCount, pageStep, triggerPageTurn]);

  useEffect(() => {
    if (!isSpreadMode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a")) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goToNextPage();
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goToPreviousPage();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToNextPage, goToPreviousPage, isSpreadMode]);

  const readerStyle = useMemo(
    () =>
      ({
        "--reader-font-scale": settings.fontScale.toString(),
      }) as CSSProperties,
    [settings.fontScale],
  );

  const updateSettings = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const handleToggleControls = useCallback(() => {
    setSettings((current) => ({
      ...current,
      controlsCollapsed: !current.controlsCollapsed,
    }));
  }, []);

  function handleFontDelta(delta: number) {
    setSettings((current) => ({
      ...current,
      fontScale: clampReaderFontScale(current.fontScale + delta),
    }));
  }

  function handleLayoutModeChange(layoutMode: ReaderLayoutModeId) {
    setSettings((current) => ({ ...current, layoutMode }));
    if (layoutMode === "pagedFlow" || layoutMode === "spread") {
      setPageIndex((current) =>
        layoutMode === "spread"
          ? getSpreadStartPage(Math.min(current, pageCount - 1))
          : Math.min(current, pageCount - 1),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }


  async function handleAddNote(input: { title: string; body: string; color: ReaderNoteColor }) {
    const nextProgress = getPageProgress(normalizedPageIndex, pageCount);
    const timestamp = new Date().toISOString();
    const note: ReaderNote = {
      id: crypto.randomUUID(), slug,
      title: input.title.trim() || null, body: input.body.trim() || null, color: input.color,
      scrollY: normalizedPageIndex,
      progressPercent: nextProgress,
      pageIndex: normalizedPageIndex,
      pageCount,
      layoutMode: settings.layoutMode,
      createdAt: timestamp, updatedAt: timestamp, source: "local",
    };
    const next = [note, ...notes];
    setNotes(next);
    saveReaderNotes(slug, next);
    if (navigator.onLine) void syncNotes();
  }

  function handleGoToNote(note: ReaderNote) {
    if (typeof note.pageIndex === "number") {
      const nextIndex = Math.max(0, Math.min(pageCount - 1, note.pageIndex));
      setPageIndex(isSpreadMode ? getSpreadStartPage(nextIndex) : nextIndex);
      if (!isSpreadMode) {
        flowRef.current
          ?.querySelector<HTMLElement>(`[data-page-index="${nextIndex}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    if (Number.isFinite(note.progressPercent)) {
      handleGoToPage(Math.round((note.progressPercent / 100) * Math.max(0, pageCount - 1)) + 1);
    } else window.scrollTo({ top: note.scrollY, behavior: "smooth" });
  }

  async function handleDeleteNote(note: ReaderNote) {
    if (note.source === "synced") {
      const response = await fetch(`/api/reader/notes?id=${encodeURIComponent(note.id)}`, { method: "DELETE" }).catch(() => null);
      if (!response?.ok) return;
    }
    const next = notes.filter((item) => item.id !== note.id);
    setNotes(next); saveReaderNotes(slug, next);
  }

  function handleGoToPage(page: number) {
    const requestedIndex = Math.max(0, Math.min(pageCount - 1, page - 1));
    const nextIndex = isSpreadMode ? getSpreadStartPage(requestedIndex) : requestedIndex;
    setPageIndex(nextIndex);
    if (!isSpreadMode) {
      flowRef.current
        ?.querySelector<HTMLElement>(`[data-page-index="${nextIndex}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }


  function renderPageContent(page: ReaderPage | undefined, pageNumber: number) {
    return (
      <>
        {mode === "preview" && pageNumber === 0 ? (
          <p className="artales-reader__preview-note">
            {labels.previewNote}
          </p>
        ) : null}

        <WorkContentRenderer
          blocks={page?.blocks ?? []}
          fallbackContent={page?.blocks.length ? null : fallbackContent}
          formatPreset={
            settings.density === "compact" ? "readerCompact" : "readerComfort"
          }
          footnotesLabel={labels.footnotes}
        />

        {mode === "preview" && pageNumber >= pageCount - 1 ? (
          <div className="artales-reader__preview-cta">
            <p>{labels.previewShort}</p>
            <a className="artales-button" href={fullHref}>
              {labels.continueReading}
            </a>
          </div>
        ) : null}
      </>
    );
  }

  function renderPagedPaper(
    pageNumber: number,
    page: ReaderPage | undefined,
    extraClassName = "",
    children?: ReactNode,
  ) {
    const safePageNumber = Math.min(pageNumber + 1, pageCount);
    return (
      <article
        data-page-index={pageNumber}
        className={`artales-reader__paper artales-reader__paper--paged ${extraClassName}`.trim()}
      >
        <header className="artales-reader__page-header" aria-hidden="true">
          <span>{title}</span>
          <span>{safePageNumber}</span>
        </header>
        <div className="artales-reader__page-content">
          {children ?? renderPageContent(page, pageNumber)}
        </div>
        <footer
          className="artales-reader__page-footer"
          aria-label={labels.pageNumber}
        >
          <span>{safePageNumber}</span>
        </footer>
      </article>
    );
  }

  return (
    <main
      className={`artales-reader artales-reader--theme-${settings.theme} artales-reader--width-${settings.width} artales-reader--density-${settings.density} artales-reader--layout-${settings.layoutMode} artales-reader--pagefit-${settings.pageFit}${turnDirection ? ` artales-reader--turn-${turnDirection}` : ""}`}
      style={readerStyle}
    >
      <ReaderToolbar
        title={title}
        detailHref={detailHref}
        mode={mode}
        fullHref={fullHref}
        progressPercent={progressPercent}
        pageIndex={normalizedPageIndex}
        pageCount={pageCount}
        settings={settings}
        labels={labels}
        chromeLabels={dictionary.public}
        notes={notes}
        notesSyncState={notesSyncState}
        onFontDelta={handleFontDelta}
        onThemeChange={(theme: ReaderThemeId) => updateSettings({ theme })}
        onWidthChange={(width: ReaderWidthId) => updateSettings({ width })}
        onDensityChange={(density: ReaderDensityId) =>
          updateSettings({ density })
        }
        onLayoutModeChange={handleLayoutModeChange}
        onToggleControls={handleToggleControls}
        onAddNote={handleAddNote}
        onGoToNote={handleGoToNote}
        onDeleteNote={handleDeleteNote}
        onGoToPage={handleGoToPage}
      />

      <section className="artales-reader__stage">
        {settings.layoutMode === "pagedFlow" ? (
          <div className="artales-reader__paged-flow" ref={flowRef}>
            {readerPages.map((page, index) => renderPagedPaper(index, page))}
          </div>
        ) : null}

        {isSpreadMode ? (
          <div className="artales-reader__spread">
            {renderPagedPaper(
              normalizedPageIndex,
              readerPages[normalizedPageIndex],
              "artales-reader__paper--spread-left",
            )}
            {normalizedPageIndex + 1 < pageCount
              ? renderPagedPaper(
                  normalizedPageIndex + 1,
                  readerPages[normalizedPageIndex + 1],
                  "artales-reader__paper--spread-right",
                )
              : renderPagedPaper(
                  normalizedPageIndex,
                  undefined,
                  "artales-reader__paper--spread-right artales-reader__paper--blank",
                  <div className="artales-reader__blank-page" aria-hidden="true" />,
                )}
          </div>
        ) : null}

        {isSpreadMode ? (
          <>
            <button
              type="button"
              className="artales-reader-side-nav artales-reader-side-nav--previous"
              onClick={goToPreviousPage}
              disabled={normalizedPageIndex <= 0}
              aria-label={labels.sidePrevious}
              title={labels.sidePrevious}
            >
              ‹
            </button>
            <button
              type="button"
              className="artales-reader-side-nav artales-reader-side-nav--next"
              onClick={goToNextPage}
              disabled={normalizedPageIndex >= pageCount - pageStep}
              aria-label={labels.sideNext}
              title={labels.sideNext}
            >
              ›
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}
