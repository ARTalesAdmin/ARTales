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
  clearReaderBookmark,
  loadReaderBookmark,
  loadReaderProgress,
  loadReaderSettings,
  saveReaderBookmark,
  saveReaderProgress,
  saveReaderSettings,
  type ReaderBookmark,
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
  const [bookmark, setBookmark] = useState<ReaderBookmark | null>(null);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);
  const restoredPagePosition = useRef(false);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const turnTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    setBookmark(loadReaderBookmark(slug));
  }, [slug]);

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
    if (!saved) return;
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
  }, [isSpreadMode, mode, pageCount, slug]);

  useEffect(() => {
    const nextProgress = getPageProgress(normalizedPageIndex, pageCount);
    setProgressPercent(nextProgress);
    if (mode === "full") {
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
  }, [mode, normalizedPageIndex, pageCount, settings.layoutMode, slug]);

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


  function handleBookmark() {
    const nextProgress = getPageProgress(normalizedPageIndex, pageCount);
    const nextBookmark: ReaderBookmark = {
      slug,
      mode,
      scrollY: normalizedPageIndex,
      progressPercent: nextProgress,
      pageIndex: normalizedPageIndex,
      pageCount,
      layoutMode: settings.layoutMode,
      createdAt: new Date().toISOString(),
    };
    saveReaderBookmark(nextBookmark);
    setBookmark(nextBookmark);
  }

  function handleGoToBookmark() {
    if (!bookmark) return;
    if (typeof bookmark.pageIndex === "number") {
      const nextIndex = Math.max(0, Math.min(pageCount - 1, bookmark.pageIndex));
      setPageIndex(isSpreadMode ? getSpreadStartPage(nextIndex) : nextIndex);
      if (!isSpreadMode) {
        flowRef.current
          ?.querySelector<HTMLElement>(`[data-page-index="${nextIndex}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    window.scrollTo({ top: bookmark.scrollY, behavior: "smooth" });
  }

  function handleClearBookmark() {
    clearReaderBookmark(slug);
    setBookmark(null);
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
        bookmark={bookmark}
        onFontDelta={handleFontDelta}
        onThemeChange={(theme: ReaderThemeId) => updateSettings({ theme })}
        onWidthChange={(width: ReaderWidthId) => updateSettings({ width })}
        onDensityChange={(density: ReaderDensityId) =>
          updateSettings({ density })
        }
        onLayoutModeChange={handleLayoutModeChange}
        onToggleControls={handleToggleControls}
        onBookmark={handleBookmark}
        onGoToBookmark={handleGoToBookmark}
        onClearBookmark={handleClearBookmark}
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
