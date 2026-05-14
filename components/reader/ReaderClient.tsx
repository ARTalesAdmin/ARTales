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
  type ReaderSettings,
  type ReaderThemeId,
  type ReaderWidthId,
} from "@/lib/reader/readerSettings";
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
  const [bookmark, setBookmark] = useState<ReaderBookmark | null>(null);
  const restoredInitialPosition = useRef(false);

  const detailHref = `/dilo/${slug}`;
  const fullHref = `/reader/${slug}?mode=full`;
  const previewHref = `/reader/${slug}?mode=preview`;

  useEffect(() => {
    saveReaderSettings(settings);
  }, [settings]);

  useEffect(() => {
    setBookmark(loadReaderBookmark(slug));
  }, [slug]);

  useEffect(() => {
    if (restoredInitialPosition.current) return;
    restoredInitialPosition.current = true;
    if (mode !== "full") return;

    const saved = loadReaderProgress(slug);
    if (!saved || saved.scrollY <= 0) return;

    const timeout = window.setTimeout(() => {
      window.scrollTo({ top: saved.scrollY, behavior: "smooth" });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [mode, slug]);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;

    const persist = () => {
      const progress = getScrollProgress();
      setProgressPercent(progress.progressPercent);
      if (mode === "full") {
        saveReaderProgress({
          slug,
          mode,
          scrollY: progress.scrollY,
          progressPercent: progress.progressPercent,
          updatedAt: new Date().toISOString(),
        });
      }
    };

    const onScroll = () => {
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
  }, [mode, slug]);

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

  function handleFontDelta(delta: number) {
    setSettings((current) => ({
      ...current,
      fontScale: clampReaderFontScale(current.fontScale + delta),
    }));
  }

  function handleBookmark() {
    const progress = getScrollProgress();
    const nextBookmark: ReaderBookmark = {
      slug,
      mode,
      scrollY: progress.scrollY,
      progressPercent: progress.progressPercent,
      createdAt: new Date().toISOString(),
    };
    saveReaderBookmark(nextBookmark);
    setBookmark(nextBookmark);
  }

  function handleGoToBookmark() {
    if (!bookmark) return;
    window.scrollTo({ top: bookmark.scrollY, behavior: "smooth" });
  }

  function handleClearBookmark() {
    clearReaderBookmark(slug);
    setBookmark(null);
  }

  return (
    <main
      className={`artales-reader artales-reader--theme-${settings.theme} artales-reader--width-${settings.width} artales-reader--density-${settings.density}`}
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
        settings={settings}
        bookmark={bookmark}
        onFontDelta={handleFontDelta}
        onThemeChange={(theme: ReaderThemeId) => updateSettings({ theme })}
        onWidthChange={(width: ReaderWidthId) => updateSettings({ width })}
        onDensityChange={(density: ReaderDensityId) =>
          updateSettings({ density })
        }
        onBookmark={handleBookmark}
        onGoToBookmark={handleGoToBookmark}
        onClearBookmark={handleClearBookmark}
      />

      <section className="artales-reader__stage">
        <article className="artales-reader__paper">
          {bookmark ? (
            <button
              type="button"
              className="artales-reader__bookmark-ribbon"
              onClick={handleGoToBookmark}
              aria-label="Go to saved bookmark"
              title="Go to bookmark"
            >
              <span>Bookmark</span>
            </button>
          ) : null}
          {mode === "preview" ? (
            <p className="artales-reader__preview-note">
              This is a short preview. Continue to the full online reader when
              you are ready.
            </p>
          ) : null}

          <WorkContentRenderer
            blocks={blocks}
            fallbackContent={fallbackContent}
            formatPreset={
              settings.density === "compact" ? "readerCompact" : "readerComfort"
            }
          />

          {mode === "preview" ? (
            <div className="artales-reader__preview-cta">
              <p>This preview is intentionally short.</p>
              <a className="artales-button" href={fullHref}>
                Continue reading
              </a>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
