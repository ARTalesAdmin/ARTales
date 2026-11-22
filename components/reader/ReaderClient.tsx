"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import WorkContentRenderer from "@/components/work/WorkContentRenderer";
import type { WorkBlock } from "@/lib/blocks";
import type {LegacyBlockStyleMap} from "@/lib/rendering/legacyBlockStyles";
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
import {
  paginateReaderBlocksWithDiagnostics,
  prepareLegacyReaderFragments,
  type ReaderPage,
  type TableBlockMeasurement,
  type TableBlockMeasurements,
} from "@/lib/reader/paginateBlocks";
import {
  legacyPageInkOverflowPx, measureLegacyReaderDom, syncLegacyMeasuringPaper,
  type LegacyReaderDomGeometry,
} from "@/lib/reader/domPageGeometry";
import {applyLegacyPaperLastRowJustification} from "@/lib/reader/legacyLastRow";
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
  legacyStyles: LegacyBlockStyleMap;
  fallbackContent?: string | null;
  locale: SupportedLocale;
  editorPreview?: boolean;
  editorReturnHref?: string;
};

function getPageProgress(pageIndex: number, pageCount: number) {
  if (pageCount <= 1) return 100;
  return Math.max(0, Math.min(100, (pageIndex / (pageCount - 1)) * 100));
}

function getSpreadStartPage(pageIndex: number) {
  return Math.max(0, pageIndex - (pageIndex % 2));
}

function getOriginalTableBlockId(blockId: string) {
  return blockId.replace(/-table-page-\d+$/, "");
}

function getOuterHeight(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(style.marginTop) || 0;
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;
  return rect.height + marginTop + marginBottom;
}

function roundMeasurement(value: number) {
  return Math.round(value * 2) / 2;
}

function collectTableMeasurements(root: HTMLElement): TableBlockMeasurements {
  const fragments = Array.from(
    root.querySelectorAll<HTMLElement>("[data-table-block-id]"),
  );
  const grouped = new Map<
    string,
    {
      availableHeight: number;
      fragments: Array<{
        chromeHeight: number;
        rowHeights: number[];
      }>;
    }
  >();

  for (const fragment of fragments) {
    const blockId = fragment.dataset.tableBlockId;
    if (!blockId) continue;

    const originId = getOriginalTableBlockId(blockId);
    const pageContent = fragment.closest<HTMLElement>(
      ".artales-reader__page-content",
    );
    if (!pageContent) continue;

    const rowHeights = Array.from(
      fragment.querySelectorAll<HTMLElement>("tbody tr"),
    ).map((row) => roundMeasurement(row.getBoundingClientRect().height));
    const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    const chromeHeight = Math.max(
      0,
      roundMeasurement(getOuterHeight(fragment) - rowsHeight),
    );
    const availableHeight = roundMeasurement(
      pageContent.getBoundingClientRect().height,
    );

    const current = grouped.get(originId) ?? {
      availableHeight,
      fragments: [],
    };
    current.availableHeight = Math.min(
      current.availableHeight,
      availableHeight,
    );
    current.fragments.push({ chromeHeight, rowHeights });
    grouped.set(originId, current);
  }

  const measurements: TableBlockMeasurements = {};

  for (const [blockId, group] of grouped) {
    const first = group.fragments[0];
    if (!first) continue;
    const continuation = group.fragments[1] ?? first;

    measurements[blockId] = {
      availableHeight: group.availableHeight,
      firstChromeHeight: first.chromeHeight,
      continuationChromeHeight: continuation.chromeHeight,
      rowHeights: group.fragments.flatMap((fragment) => fragment.rowHeights),
    } satisfies TableBlockMeasurement;
  }

  return measurements;
}

export default function ReaderClient({
  slug,
  title,
  mode,
  blocks,
  legacyStyles,
  fallbackContent,
  locale,
  editorPreview = false,
  editorReturnHref,
}: ReaderClientProps) {
  const [settings, setSettings] = useState<ReaderSettings>(() => ({
    ...loadReaderSettings(),
    controlsCollapsed: true,
  }));
  const [progressPercent, setProgressPercent] = useState(0);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [notes, setNotes] = useState<ReaderNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isNotesListExpanded, setIsNotesListExpanded] = useState<boolean | null>(null);
  const [notesSyncState, setNotesSyncState] = useState<"local" | "syncing" | "synced">("local");
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);
  const [progressRestoreReady, setProgressRestoreReady] = useState(
    mode !== "full",
  );
  const restoredPagePosition = useRef(false);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const spreadMeasurementRef = useRef<HTMLDivElement | null>(null);
  const readerRootRef = useRef<HTMLElement | null>(null);
  const domMeasurementRef = useRef<HTMLDivElement | null>(null);
  const [inkOverflowPages, setInkOverflowPages] = useState<number[]>([]);
  const tableMeasurementSignatureRef = useRef("");
  const [tableMeasurements, setTableMeasurements] =
    useState<TableBlockMeasurements>({});
  const turnTimerRef = useRef<number | null>(null);
  const notesSyncRunRef = useRef(0);
  const dictionary = getPublicDictionary(locale);
  const labels = dictionary.reader;

  const isSpreadMode = settings.layoutMode === "spread";
  const pageStep = isSpreadMode ? 2 : 1;
  const detailHref = editorReturnHref ?? `/work/${slug}`;
  const fullHref = editorPreview
    ? editorReturnHref ?? `/member/works/${slug}/edit`
    : `/reader/${slug}?mode=full`;
  // This slice changes page PACKING only. Existing sentence/word/poem/table
  // fragments remain under the current legacy splitter.
  // The offscreen sampler must measure the EXACT fragments passed to the
  // measured paginator. Plain prose is not pre-split by the old estimates.
  // Footnotes currently render both in their source block and in an appended
  // summary. Preserve the established output until that summary is measured.
  const measureEligible = mode === "full" && blocks.length > 0 &&
    !blocks.some(block => block.type === "footnote");
  const fragments = useMemo(
    () => prepareLegacyReaderFragments(
      blocks, settings, tableMeasurements, legacyStyles, measureEligible),
    [blocks, settings, tableMeasurements, legacyStyles, measureEligible],
  );
  const measureKey = useMemo(() => ({}), [
    fragments, settings.layoutMode, settings.pageFit, settings.width,
    settings.fontScale, settings.density,
  ]);
  const [domMeasurements, setDomMeasurements] = useState<{
    key: object; geometry: LegacyReaderDomGeometry | null;
  } | null>(null);
  const measurementReady = !measureEligible || domMeasurements?.key === measureKey;
  const measuredGeometry = measureEligible && domMeasurements?.key === measureKey
    ? domMeasurements.geometry : null;
  const pagination = useMemo(
    () => paginateReaderBlocksWithDiagnostics(
      blocks,settings,tableMeasurements,legacyStyles,measuredGeometry),
    [blocks,settings,tableMeasurements,legacyStyles,measuredGeometry],
  );
  const readerPages = pagination.pages;
  const pageCount = readerPages.length;
  const normalizedPageIndex = isSpreadMode ? getSpreadStartPage(pageIndex) : pageIndex;
  const sortedNotes = useMemo(() => [...notes].sort((a, b) => {
    const pageDifference = (a.pageIndex ?? Number.MAX_SAFE_INTEGER) - (b.pageIndex ?? Number.MAX_SAFE_INTEGER);
    if (pageDifference) return pageDifference;
    const progressDifference = a.progressPercent - b.progressPercent;
    if (progressDifference) return progressDifference;
    return a.createdAt.localeCompare(b.createdAt);
  }), [notes]);
  const selectedNoteIndex = sortedNotes.findIndex((note) => note.id === selectedNoteId);

  // Reuse the semantic Reader's width-parity principle: the hidden paper
  // matches the visible paper's physical dimensions before we read any rows.
  // React remains the sole renderer; the sampler never edits visible content.
  useLayoutEffect(() => {
    if (!measureEligible) return;
    let active = true;
    let frame = 0;
    const stage = domMeasurementRef.current;
    const root = readerRootRef.current;
    if (!stage || !root) return;
    const measure = () => {
      if (!active) return;
      const visible = root.querySelector<HTMLElement>(
        ".artales-reader__paged-flow > .artales-reader__paper--paged, " +
        ".artales-reader__spread:not(.artales-reader__spread--measurement) > .artales-reader__paper--paged",
      );
      const geometry = visible && syncLegacyMeasuringPaper(stage,visible)
        ? measureLegacyReaderDom(stage,fragments.length,fragments) : null;
      setDomMeasurements(previous => {
        if (previous?.key === measureKey &&
          JSON.stringify(previous.geometry) === JSON.stringify(geometry)) return previous;
        return {key:measureKey,geometry};
      });
    };
    const queue = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(queue) : null;
    const visible = root.querySelector<HTMLElement>(
      ".artales-reader__paged-flow > .artales-reader__paper--paged, " +
      ".artales-reader__spread:not(.artales-reader__spread--measurement) > .artales-reader__paper--paged",
    );
    if (visible) observer?.observe(visible);
    window.addEventListener("resize",queue);
    // An image or webfont can change physical line wrapping after first paint.
    stage.addEventListener("load",queue,true);
    document.fonts?.ready.then(() => {if (active) queue();}).catch(() => {});
    queue();
    return () => {
      active=false;cancelAnimationFrame(frame);observer?.disconnect();
      window.removeEventListener("resize",queue);
      stage.removeEventListener("load",queue,true);
    };
  }, [measureEligible,measureKey,fragments.length]);

  useEffect(() => {
    setInkOverflowPages(previous => previous.length ? [] : previous);
  }, [measureKey]);

  // After pagination has settled, apply the semantic Reader's proven
  // measured rule to the ACTUAL visible legacy paragraphs. Hidden measuring
  // clones and unrelated block types are deliberately excluded.
  useLayoutEffect(() => {
    if (!measurementReady) return;
    const root = readerRootRef.current;
    if (!root) return;
    const papers = Array.from(root.querySelectorAll<HTMLElement>(
      ".artales-reader__paged-flow > .artales-reader__paper--paged, " +
      ".artales-reader__spread:not(.artales-reader__spread--measurement) > .artales-reader__paper--paged",
    ));
    let active = true;
    let frame = 0;
    const applyIfVisible = (paper: HTMLElement) => {
      if (!active || paper.classList.contains("artales-reader__paper--blank")) return;
      const box = paper.getBoundingClientRect();
      if (box.width < 1 || box.height < 1 ||
          box.bottom <= 0 || box.top >= window.innerHeight) return;
      applyLegacyPaperLastRowJustification(paper);
    };
    const refresh = () => {
      if (!active) return;
      for (const paper of papers) applyIfVisible(paper);
    };
    const schedule = () => {
      if (!active) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    };
    const observer = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) applyIfVisible(entry.target as HTMLElement);
          }
        }, {threshold: 0.01})
      : null;
    for (const paper of papers) observer?.observe(paper);
    // Older browsers without IntersectionObserver retain the scroll path.
    if (!observer) {
      window.addEventListener("scroll", schedule, {passive: true});
      root.addEventListener("scroll", schedule, {passive: true});
    }
    window.addEventListener("resize", schedule);
    document.addEventListener("fullscreenchange", schedule);
    void document.fonts?.ready.then(() => { if (active) schedule(); }).catch(() => {});
    schedule();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      root.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("fullscreenchange", schedule);
    };
  }, [readerPages, measurementReady, normalizedPageIndex, isSpreadMode,
      settings.fontScale, settings.density, settings.width, settings.pageFit,
      nativeFullscreen]);

  // The measured page decision is still subject to last-pixel browser
  // rounding and unusual indivisible media. Never silently hide its ink.
  useEffect(() => {
    if (!measurementReady || !readerRootRef.current) return;
    let frame = 0;
    const checkVisible = () => {
      const root = readerRootRef.current;
      if (!root) return;
      const papers = root.querySelectorAll<HTMLElement>(
        ".artales-reader__paged-flow > .artales-reader__paper--paged, " +
        ".artales-reader__spread:not(.artales-reader__spread--measurement) > .artales-reader__paper--paged",
      );
      const affected: number[] = [];
      for (const paper of Array.from(papers)) {
        const screen = paper.getBoundingClientRect();
        if (screen.bottom < 0 || screen.top > window.innerHeight) continue;
        const area = paper.querySelector<HTMLElement>(".artales-reader__page-content");
        if (!area) continue;
        const overflow = legacyPageInkOverflowPx(area);
        if (overflow !== null) paper.dataset.legacyInkOverflowPx = overflow.toFixed(2);
        if (overflow !== null && overflow > 2) {
          const index = Number(paper.dataset.pageIndex);
          if (Number.isInteger(index) && index >= 0) affected.push(index);
        }
      }
      if (affected.length) setInkOverflowPages(previous => {
        const next = [...new Set([...previous,...affected])];
        return next.length === previous.length ? previous : next;
      });
    };
    const queue = () => {cancelAnimationFrame(frame);frame=requestAnimationFrame(checkVisible);};
    queue();
    window.addEventListener("scroll",queue,{passive:true});
    window.addEventListener("resize",queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll",queue);
      window.removeEventListener("resize",queue);
    };
  }, [readerPages,measurementReady,normalizedPageIndex,isSpreadMode]);

  useEffect(() => {
    tableMeasurementSignatureRef.current = "";
    setTableMeasurements({});
  }, [
    settings.density,
    settings.fontScale,
    settings.layoutMode,
    settings.width,
  ]);

  useEffect(() => {
    let frame = 0;
    const resetMeasurements = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        tableMeasurementSignatureRef.current = "";
        setTableMeasurements({});
      });
    };

    window.addEventListener("resize", resetMeasurements);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resetMeasurements);
    };
  }, []);

  useLayoutEffect(() => {
    const root = isSpreadMode
      ? spreadMeasurementRef.current
      : flowRef.current;
    if (!root) return;

    const nextMeasurements = collectTableMeasurements(root);
    if (Object.keys(nextMeasurements).length === 0) return;

    const signature = JSON.stringify(nextMeasurements);
    if (signature === tableMeasurementSignatureRef.current) return;

    tableMeasurementSignatureRef.current = signature;
    setTableMeasurements(nextMeasurements);
  }, [
    isSpreadMode,
    readerPages,
    settings.density,
    settings.fontScale,
    settings.width,
  ]);

  useEffect(() => {
    if (!sortedNotes.length) {
      setSelectedNoteId(null);
      return;
    }
    if (!sortedNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(sortedNotes[0].id);
    }
  }, [selectedNoteId, sortedNotes]);

  useEffect(() => {
    saveReaderSettings(settings);
  }, [settings]);

  const syncNotes = useCallback(async () => {
    if (editorPreview) {
      setNotes([]);
      setNotesSyncState("local");
      return;
    }

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
  }, [editorPreview, labels.importedNote, slug]);

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
    if (editorPreview || mode !== "full" || pageCount < 1 || !measurementReady) return;
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
  }, [editorPreview, isSpreadMode, mode, pageCount, slug, measurementReady]);

  useEffect(() => {
    const nextProgress = getPageProgress(normalizedPageIndex, pageCount);
    setProgressPercent(nextProgress);
    // Do not replace a saved position with page one during the initial render.
    // The restore effect above first reads and applies the existing record.
    if (!editorPreview && mode === "full" && progressRestoreReady) {
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
    editorPreview,
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
    // In native fullscreen the Reader root, not window, owns the scrolling.
    const root=readerRootRef.current;
    root?.addEventListener("scroll",updateActivePage,{passive:true});
    window.addEventListener("scroll", updateActivePage, { passive: true });
    window.addEventListener("resize", updateActivePage);
    return () => {
      window.cancelAnimationFrame(frame);
      root?.removeEventListener("scroll",updateActivePage);
      window.removeEventListener("scroll", updateActivePage);
      window.removeEventListener("resize", updateActivePage);
    };
  }, [isSpreadMode, pageCount, nativeFullscreen]);


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

  // Shared native Fullscreen API used by the semantic Reader. Fullscreen does
  // not change the reader's saved spread/single-page preference.
  useEffect(() => {
    const onChange = () => setNativeFullscreen(
      document.fullscreenElement === readerRootRef.current);
    document.addEventListener("fullscreenchange",onChange);
    return () => document.removeEventListener("fullscreenchange",onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    void readerRootRef.current?.requestFullscreen?.().catch(() => {});
  };

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
    setSelectedNoteId(note.id);
    saveReaderNotes(slug, next);
    if (navigator.onLine) void syncNotes();
  }

  function handleGoToNote(note: ReaderNote) {
    setSelectedNoteId(note.id);
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

  function handleMarkerClick(note: ReaderNote) {
    handleGoToNote(note);
    setSettings((current) => ({ ...current, controlsCollapsed: false }));
    setIsNotesListExpanded(true);
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
          legacyStyles={legacyStyles}
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
    const pageNotes = page
      ? sortedNotes.filter((note) => note.pageIndex === pageNumber)
      : [];
    const selectedPageNote = pageNotes.find((note) => note.id === selectedNoteId);
    const markerNote = pageNotes[0];
    return (
      <article
        data-page-index={pageNumber}
        className={`artales-reader__paper artales-reader__paper--paged ${page?.overflow === "scroll_unit" || inkOverflowPages.includes(pageNumber) ? "artales-reader__paper--scroll-unit" : ""} ${extraClassName}`.trim()}
      >
        {markerNote ? (
          <button
            type="button"
            className={`artales-reader-note-marker artales-reader-note-marker--${markerNote.color}${selectedPageNote ? " artales-reader-note-marker--selected" : ""}`}
            onClick={() => handleMarkerClick(markerNote)}
            aria-label={`${labels.goToNoteOnPage} ${safePageNumber}`}
            aria-pressed={Boolean(selectedPageNote)}
            title={pageNotes.length > 1 ? `${labels.notesOnThisPage}: ${pageNotes.length}` : labels.noteOnThisPage}
          >
            {pageNotes.length > 1 ? <span aria-hidden="true">{pageNotes.length}</span> : null}
          </button>
        ) : null}
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
      ref={readerRootRef}
      data-legacy-page-measurement={measureEligible
        ? (!measurementReady ? "pending"
          : pagination.diagnostics.mode === "dom"
            ? (pagination.diagnostics.localFallbackBlocks > 0
              ? "dom-local-fallback" : "dom")
            : "fallback")
        : "legacy"}
      data-legacy-page-measurement-reason={measurementReady
        ? pagination.diagnostics.reason : "pending"}
      data-legacy-local-fallback-count={pagination.diagnostics.localFallbackBlocks}
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
        notes={sortedNotes}
        notesEnabled={!editorPreview}
        selectedNoteId={selectedNoteId}
        selectedNoteIndex={selectedNoteIndex}
        isNotesListExpanded={isNotesListExpanded ?? sortedNotes.length <= 3}
        onNotesListExpandedChange={setIsNotesListExpanded}
        notesSyncState={notesSyncState}
        onFontDelta={handleFontDelta}
        onThemeChange={(theme: ReaderThemeId) => updateSettings({ theme })}
        onWidthChange={(width: ReaderWidthId) => updateSettings({ width })}
        onDensityChange={(density: ReaderDensityId) =>
          updateSettings({ density })
        }
        onLayoutModeChange={handleLayoutModeChange}
        fullscreenActive={nativeFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onToggleControls={handleToggleControls}
        onAddNote={handleAddNote}
        onGoToNote={handleGoToNote}
        onGoToPreviousNote={() => {
          // Use the same select-and-jump path as list and marker actions.
          if (selectedNoteIndex > 0) handleGoToNote(sortedNotes[selectedNoteIndex - 1]);
        }}
        onGoToNextNote={() => {
          // Use the same select-and-jump path as list and marker actions.
          if (selectedNoteIndex >= 0 && selectedNoteIndex < sortedNotes.length - 1) {
            handleGoToNote(sortedNotes[selectedNoteIndex + 1]);
          }
        }}
        onDeleteNote={handleDeleteNote}
        onGoToPage={handleGoToPage}
      />

      <section className="artales-reader__stage">
        {measureEligible ? (
          <div className="artales-reader__measurement-stage" ref={domMeasurementRef} aria-hidden="true">
            <article className="artales-reader__paper artales-reader__paper--paged">
              <header className="artales-reader__page-header"><span>{title}</span><span>1</span></header>
              <div className="artales-reader__page-content">
                <WorkContentRenderer
                  blocks={fragments}
                  legacyStyles={legacyStyles}
                  formatPreset={settings.density === "compact" ? "readerCompact" : "readerComfort"}
                  footnotesLabel={labels.footnotes}
                />
              </div>
              <footer className="artales-reader__page-footer"><span>1</span></footer>
            </article>
          </div>
        ) : null}
        {settings.layoutMode === "pagedFlow" ? (
          <div className="artales-reader__paged-flow" ref={flowRef}>
            {readerPages.map((page, index) => renderPagedPaper(index, page))}
          </div>
        ) : null}

        {isSpreadMode ? (
          <div
            ref={spreadMeasurementRef}
            className="artales-reader__spread artales-reader__spread--measurement"
            aria-hidden="true"
          >
            {readerPages.map((page, index) =>
              page.blocks.some((block) => block.type === "table")
                ? renderPagedPaper(index, page)
                : null,
            )}
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
