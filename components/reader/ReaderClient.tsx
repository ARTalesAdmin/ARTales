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

function getScrollProgress() {
  if (typeof window === "undefined") return { scrollY: 0, progressPercent: 0 };
  const scrollY =
    window.scrollY || window.document.documentElement.scrollTop || 0;
  const maxScroll = Math.max(
    1,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  const progressPercent = Math.max(
    0,
    Math.min(100, (scrollY / maxScroll) * 100),
  );
  return { scrollY, progressPercent };
}

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
  authorName,
  mode,
  blocks,
  fallbackContent,
  locale,
}: ReaderClientProps) {
  const [settings, setSettings] = useState<ReaderSettings>(() =>
    loadReaderSettings(),
  );
  const [progressPercent, setProgressPercent] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [bookmark, setBookmark] = useState<ReaderBookmark | null>(null);
  const [bookmarkMarkerTop, setBookmarkMarkerTop] = useState<number | null>(
    null,
  );
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const restoredInitialPosition = useRef(false);
  const restoredPagePosition = useRef(false);
  const paperRef = useRef<HTMLElement | null>(null);
  const turnTimerRef = useRef<number | null>(null);
  const labels = getPublicDictionary(locale).reader;

  const isPagedMode = settings.layoutMode === "page" || settings.layoutMode === "spread";
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
  const activePage =
    readerPages[Math.min(normalizedPageIndex, pageCount - 1)] ?? readerPages[0];

  useEffect(() => {
    saveReaderSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFocusMode(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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

  const recalculateBookmarkMarker = useCallback(
    (nextBookmark: ReaderBookmark | null) => {
      if (
        !nextBookmark ||
        typeof window === "undefined" ||
        !paperRef.current ||
        isPagedMode
      ) {
        setBookmarkMarkerTop(null);
        return;
      }

      const paperTop =
        paperRef.current.getBoundingClientRect().top + window.scrollY;
      const readingOffset = Math.min(
        180,
        Math.max(86, window.innerHeight * 0.16),
      );
      const approximateDocumentY = nextBookmark.scrollY + readingOffset;
      const maxTop = Math.max(0, paperRef.current.scrollHeight - 24);
      const nextTop = Math.max(
        0,
        Math.min(maxTop, approximateDocumentY - paperTop),
      );

      setBookmarkMarkerTop(nextTop);
    },
    [isPagedMode],
  );

  useEffect(() => {
    recalculateBookmarkMarker(bookmark);
  }, [
    bookmark,
    recalculateBookmarkMarker,
    settings.fontScale,
    settings.width,
    settings.density,
  ]);

  useEffect(() => {
    const onResize = () => recalculateBookmarkMarker(bookmark);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bookmark, recalculateBookmarkMarker]);

  useEffect(() => {
    if (restoredInitialPosition.current) return;
    restoredInitialPosition.current = true;
    if (mode !== "full" || isPagedMode) return;

    const saved = loadReaderProgress(slug);
    if (!saved || saved.scrollY <= 0 || saved.layoutMode === "page" || saved.layoutMode === "spread") return;

    const timeout = window.setTimeout(() => {
      window.scrollTo({ top: saved.scrollY, behavior: "smooth" });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [isPagedMode, mode, slug]);

  useEffect(() => {
    if (restoredPagePosition.current) return;
    if (mode !== "full" || !isPagedMode || pageCount <= 1) return;
    restoredPagePosition.current = true;

    const saved = loadReaderProgress(slug);
    if (
      (saved?.layoutMode !== "page" && saved?.layoutMode !== "spread") ||
      typeof saved.pageIndex !== "number"
    ) {
      return;
    }

    const restoredIndex = Math.max(0, Math.min(pageCount - 1, saved.pageIndex));
    setPageIndex(isSpreadMode ? getSpreadStartPage(restoredIndex) : restoredIndex);
  }, [isPagedMode, isSpreadMode, mode, pageCount, slug]);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;

    const persist = () => {
      if (isPagedMode) return;
      const progress = getScrollProgress();
      setProgressPercent(progress.progressPercent);
      if (mode === "full") {
        saveReaderProgress({
          slug,
          mode,
          scrollY: progress.scrollY,
          progressPercent: progress.progressPercent,
          layoutMode: "scroll",
          updatedAt: new Date().toISOString(),
        });
      }
    };

    const onScroll = () => {
      if (isPagedMode) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const progress = getScrollProgress();
        setProgressPercent(progress.progressPercent);
        window.clearTimeout(timeout);
        timeout = window.setTimeout(persist, 250);
      });
    };

    persist();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isPagedMode, mode, slug]);

  useEffect(() => {
    if (!isPagedMode) return;
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
  }, [isPagedMode, mode, normalizedPageIndex, pageCount, settings.layoutMode, slug]);


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
    if (!isPagedMode) return;

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
  }, [goToNextPage, goToPreviousPage, isPagedMode]);

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
    if (layoutMode === "page" || layoutMode === "spread") {
      setPageIndex((current) =>
        layoutMode === "spread"
          ? getSpreadStartPage(Math.min(current, pageCount - 1))
          : Math.min(current, pageCount - 1),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }


  async function handleToggleFocusMode() {
    const nextFocusMode = !isFocusMode;
    setIsFocusMode(nextFocusMode);
    if (nextFocusMode) {
      setSettings((current) => ({ ...current, controlsCollapsed: true }));
    }

    if (typeof document === "undefined") return;

    try {
      if (nextFocusMode && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else if (!nextFocusMode && document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch {
      // Browser fullscreen can be blocked; the CSS focus mode still applies.
    }
  }

  function handleBookmark() {
    if (isPagedMode) {
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
      setBookmarkMarkerTop(null);
      return;
    }

    const progress = getScrollProgress();
    const nextBookmark: ReaderBookmark = {
      slug,
      mode,
      scrollY: progress.scrollY,
      progressPercent: progress.progressPercent,
      layoutMode: "scroll",
      createdAt: new Date().toISOString(),
    };
    saveReaderBookmark(nextBookmark);
    setBookmark(nextBookmark);
    recalculateBookmarkMarker(nextBookmark);
  }

  function handleGoToBookmark() {
    if (!bookmark) return;
    if (isPagedMode && typeof bookmark.pageIndex === "number") {
      const nextIndex = Math.max(0, Math.min(pageCount - 1, bookmark.pageIndex));
      setPageIndex(isSpreadMode ? getSpreadStartPage(nextIndex) : nextIndex);
      return;
    }
    window.scrollTo({ top: bookmark.scrollY, behavior: "smooth" });
  }

  function handleClearBookmark() {
    clearReaderBookmark(slug);
    setBookmark(null);
    setBookmarkMarkerTop(null);
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
          fallbackContent={null}
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

  function renderScrollPaper() {
    return (
      <article className="artales-reader__paper" ref={paperRef}>
        {bookmark && bookmarkMarkerTop != null ? (
          <button
            type="button"
            className="artales-reader__bookmark-marker"
            style={{ top: `${bookmarkMarkerTop}px` }}
            onClick={handleGoToBookmark}
            aria-label={labels.goToSavedBookmark}
            title={labels.goToBookmark}
          >
            <span>{labels.artalesBookmark}</span>
          </button>
        ) : null}

        <div className="artales-reader__page-content">
          {mode === "preview" ? (
            <p className="artales-reader__preview-note">
              {labels.previewNote}
            </p>
          ) : null}

          <WorkContentRenderer
            blocks={blocks}
            fallbackContent={fallbackContent}
            formatPreset={
              settings.density === "compact"
                ? "readerCompact"
                : "readerComfort"
            }
            footnotesLabel={labels.footnotes}
          />

          {mode === "preview" ? (
            <div className="artales-reader__preview-cta">
              <p>{labels.previewShort}</p>
              <a className="artales-button" href={fullHref}>
                {labels.continueReading}
              </a>
            </div>
          ) : null}
        </div>
      </article>
    );
  }


  return (
    <main
      className={`artales-reader artales-reader--theme-${settings.theme} artales-reader--width-${settings.width} artales-reader--density-${settings.density} artales-reader--layout-${settings.layoutMode} artales-reader--pagefit-${settings.pageFit}${isFocusMode ? " artales-reader--focus" : ""}${turnDirection ? ` artales-reader--turn-${turnDirection}` : ""}`}
      style={readerStyle}
    >
      <ReaderToolbar
        title={title}
        authorName={authorName}
        detailHref={detailHref}
        mode={mode}
        fullHref={fullHref}
        progressPercent={progressPercent}
        pageIndex={normalizedPageIndex}
        pageCount={pageCount}
        settings={settings}
        labels={labels}
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
        isFocusMode={isFocusMode}
        onToggleFocusMode={handleToggleFocusMode}
      />

      <section className="artales-reader__stage">
        {!isPagedMode ? renderScrollPaper() : null}

        {settings.layoutMode === "page"
          ? renderPagedPaper(normalizedPageIndex, activePage)
          : null}

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

        {isPagedMode ? (
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
