"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import { paginateReaderBlocks } from "@/lib/reader/paginateBlocks";
import ReaderToolbar from "./ReaderToolbar";
import "./reader.css";

type ReaderClientProps = {
  slug: string;
  title: string;
  authorName?: string | null;
  mode: "preview" | "full";
  blocks: WorkBlock[];
  fallbackContent?: string | null;
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

export default function ReaderClient({
  slug,
  title,
  authorName,
  mode,
  blocks,
  fallbackContent,
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
  const restoredInitialPosition = useRef(false);
  const restoredPagePosition = useRef(false);
  const paperRef = useRef<HTMLElement | null>(null);
  const pageContentRef = useRef<HTMLDivElement | null>(null);

  const isPageMode = settings.layoutMode === "page";
  const detailHref = `/work/${slug}`;
  const fullHref = `/reader/${slug}?mode=full`;
  const previewHref = `/reader/${slug}?mode=preview`;
  const readerPages = useMemo(
    () => paginateReaderBlocks(blocks, settings),
    [blocks, settings],
  );
  const pageCount = readerPages.length;
  const activePage =
    readerPages[Math.min(pageIndex, pageCount - 1)] ?? readerPages[0];

  useEffect(() => {
    saveReaderSettings(settings);
  }, [settings]);

  useEffect(() => {
    setBookmark(loadReaderBookmark(slug));
  }, [slug]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const recalculateBookmarkMarker = useCallback(
    (nextBookmark: ReaderBookmark | null) => {
      if (
        !nextBookmark ||
        typeof window === "undefined" ||
        !paperRef.current ||
        isPageMode
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
    [isPageMode],
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
    if (mode !== "full" || isPageMode) return;

    const saved = loadReaderProgress(slug);
    if (!saved || saved.scrollY <= 0 || saved.layoutMode === "page") return;

    const timeout = window.setTimeout(() => {
      window.scrollTo({ top: saved.scrollY, behavior: "smooth" });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [isPageMode, mode, slug]);

  useEffect(() => {
    if (restoredPagePosition.current) return;
    if (mode !== "full" || !isPageMode || pageCount <= 1) return;
    restoredPagePosition.current = true;

    const saved = loadReaderProgress(slug);
    if (saved?.layoutMode !== "page" || typeof saved.pageIndex !== "number") {
      return;
    }

    setPageIndex(Math.max(0, Math.min(pageCount - 1, saved.pageIndex)));
  }, [isPageMode, mode, pageCount, slug]);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;

    const persist = () => {
      if (isPageMode) return;
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
      if (isPageMode) return;
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
  }, [isPageMode, mode, slug]);

  useEffect(() => {
    if (!isPageMode) return;
    const nextProgress = getPageProgress(pageIndex, pageCount);
    setProgressPercent(nextProgress);
    if (mode === "full") {
      saveReaderProgress({
        slug,
        mode,
        scrollY: pageIndex,
        pageIndex,
        pageCount,
        progressPercent: nextProgress,
        layoutMode: "page",
        updatedAt: new Date().toISOString(),
      });
    }
  }, [isPageMode, mode, pageCount, pageIndex, slug]);

  useEffect(() => {
    if (!isPageMode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a")) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setPageIndex((current) => Math.min(pageCount - 1, current + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setPageIndex((current) => Math.max(0, current - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPageMode, pageCount]);

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
    if (layoutMode === "page") {
      setPageIndex((current) => Math.min(current, pageCount - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBookmark() {
    if (isPageMode) {
      const nextProgress = getPageProgress(pageIndex, pageCount);
      const nextBookmark: ReaderBookmark = {
        slug,
        mode,
        scrollY: pageIndex,
        progressPercent: nextProgress,
        pageIndex,
        pageCount,
        layoutMode: "page",
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
    if (isPageMode && typeof bookmark.pageIndex === "number") {
      setPageIndex(Math.max(0, Math.min(pageCount - 1, bookmark.pageIndex)));
      return;
    }
    window.scrollTo({ top: bookmark.scrollY, behavior: "smooth" });
  }

  function handleClearBookmark() {
    clearReaderBookmark(slug);
    setBookmark(null);
    setBookmarkMarkerTop(null);
  }

  function goToPreviousPage() {
    setPageIndex((current) => Math.max(0, current - 1));
  }

  function goToNextPage() {
    setPageIndex((current) => Math.min(pageCount - 1, current + 1));
  }

  return (
    <main
      className={`artales-reader artales-reader--theme-${settings.theme} artales-reader--width-${settings.width} artales-reader--density-${settings.density} artales-reader--layout-${settings.layoutMode}`}
      style={readerStyle}
    >
      <ReaderToolbar
        title={title}
        authorName={authorName}
        detailHref={detailHref}
        mode={mode}
        fullHref={fullHref}
        previewHref={previewHref}
        progressPercent={progressPercent}
        pageIndex={pageIndex}
        pageCount={pageCount}
        settings={settings}
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
      />

      <section className="artales-reader__stage">
        <article
          className={`artales-reader__paper${isPageMode ? " artales-reader__paper--paged" : ""}`}
          ref={paperRef}
        >
          {!isPageMode && bookmark && bookmarkMarkerTop != null ? (
            <button
              type="button"
              className="artales-reader__bookmark-marker"
              style={{ top: `${bookmarkMarkerTop}px` }}
              onClick={handleGoToBookmark}
              aria-label="Go to saved bookmark"
              title="Go to bookmark"
            >
              <span>ARTales bookmark</span>
            </button>
          ) : null}

          {isPageMode ? (
            <header className="artales-reader__page-header" aria-hidden="true">
              <span>{title}</span>
              <span>{Math.min(pageIndex + 1, pageCount)}</span>
            </header>
          ) : null}

          <div ref={pageContentRef} className="artales-reader__page-content">
            {mode === "preview" && (!isPageMode || pageIndex === 0) ? (
              <p className="artales-reader__preview-note">
                This is a short preview. Continue to the full online reader when
                you are ready.
              </p>
            ) : null}

            <WorkContentRenderer
              blocks={isPageMode ? activePage.blocks : blocks}
              fallbackContent={isPageMode ? null : fallbackContent}
              formatPreset={
                settings.density === "compact"
                  ? "readerCompact"
                  : "readerComfort"
              }
            />

            {mode === "preview" &&
            (!isPageMode || pageIndex >= pageCount - 1) ? (
              <div className="artales-reader__preview-cta">
                <p>This preview is intentionally short.</p>
                <a className="artales-button" href={fullHref}>
                  Continue reading
                </a>
              </div>
            ) : null}
          </div>

          {isPageMode ? (
            <footer
              className="artales-reader__page-footer"
              aria-label="Reader page number"
            >
              <span>{Math.min(pageIndex + 1, pageCount)}</span>
            </footer>
          ) : null}
        </article>

        {isPageMode ? (
          <nav
            className="artales-reader-page-nav"
            aria-label="Page mode navigation"
          >
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={pageIndex <= 0}
            >
              ← Previous
            </button>
            <span>
              Page {Math.min(pageIndex + 1, pageCount)} / {pageCount}
            </span>
            <button
              type="button"
              onClick={goToNextPage}
              disabled={pageIndex >= pageCount - 1}
            >
              Next →
            </button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
