"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import type { ReaderBookmark } from "@/lib/reader/readerStorage";
import type {
  ReaderDensityId,
  ReaderLayoutModeId,
  ReaderSettings,
  ReaderThemeId,
  ReaderWidthId,
} from "@/lib/reader/readerSettings";
import type { getPublicDictionary } from "@/lib/i18n/public";

type Dictionary = ReturnType<typeof getPublicDictionary>;

type ReaderToolbarProps = {
  title: string;
  detailHref: string;
  mode: "preview" | "full";
  fullHref: string;
  progressPercent: number;
  pageIndex: number;
  pageCount: number;
  settings: ReaderSettings;
  labels: Dictionary["reader"];
  chromeLabels: Dictionary["public"];
  bookmark: ReaderBookmark | null;
  onFontDelta: (delta: number) => void;
  onThemeChange: (theme: ReaderThemeId) => void;
  onWidthChange: (width: ReaderWidthId) => void;
  onDensityChange: (density: ReaderDensityId) => void;
  onLayoutModeChange: (layoutMode: ReaderLayoutModeId) => void;
  onToggleControls: () => void;
  onBookmark: () => void;
  onGoToBookmark: () => void;
  onClearBookmark: () => void;
  onGoToPage: (page: number) => void;
};

export default function ReaderToolbar(props: ReaderToolbarProps) {
  const { settings, labels, chromeLabels, bookmark } = props;
  const { onToggleControls } = props;
  const progress = Math.max(0, Math.min(100, Math.round(props.progressPercent)));
  const currentPage = Math.min(props.pageIndex + 1, props.pageCount);
  const controlsId = "artales-reader-compact-menu";
  const inputId = "artales-reader-page-input";
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPageEntryOpen, setIsPageEntryOpen] = useState(false);
  const [pageValue, setPageValue] = useState(String(currentPage));

  useEffect(() => {
    if (isPageEntryOpen) inputRef.current?.select();
  }, [isPageEntryOpen]);
  useEffect(() => {
    if (settings.controlsCollapsed) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onToggleControls();
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onToggleControls();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onToggleControls, settings.controlsCollapsed]);

  const submitPage = () => {
    const requestedPage = Number.parseInt(pageValue, 10);
    if (!Number.isFinite(requestedPage)) {
      setPageValue(String(currentPage));
      return;
    }
    const safePage = Math.max(1, Math.min(props.pageCount, requestedPage));
    props.onGoToPage(safePage);
    setPageValue(String(safePage));
    setIsPageEntryOpen(false);
  };
  const onPageKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") submitPage();
    if (event.key === "Escape") {
      setPageValue(String(currentPage));
      setIsPageEntryOpen(false);
    }
  };

  return (
    <header className="artales-reader-toolbar">
      <div className="artales-reader-toolbar__identity">
        <ArtalesBrand variant={settings.theme === "dark" ? "light" : "dark"} size="sm" mode="lockup" />
        <h1 className="artales-reader-toolbar__title">{props.title}</h1>
      </div>
      <div className="artales-reader-toolbar__reading-row">
        <div className="artales-reader-progress" aria-label={`${labels.readingProgress} ${progress}%`}>
          <div className="artales-reader-progress__track"><div style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="artales-reader-page-jump">
          {isPageEntryOpen ? (
            <label htmlFor={inputId} className="artales-reader-page-jump__form">
              <span className="artales-reader-sr-only">{chromeLabels.readerPageInputLabel}</span>
              <input ref={inputRef} id={inputId} type="number" min={1} max={props.pageCount} value={pageValue}
                onChange={(event) => setPageValue(event.target.value)} onKeyDown={onPageKeyDown} />
              <span>/ {props.pageCount}</span>
            </label>
          ) : (
            <button type="button" className="artales-reader-page-jump__trigger" onClick={() => { setPageValue(String(currentPage)); setIsPageEntryOpen(true); }}
              aria-label={chromeLabels.readerGoToPage}>
              {labels.page} {currentPage} / {props.pageCount}
            </button>
          )}
        </div>
        <div className="artales-reader-menu" ref={menuRef}>
          <button type="button" className="artales-reader-menu__trigger" onClick={props.onToggleControls}
            aria-expanded={!settings.controlsCollapsed} aria-controls={controlsId}>
            <span aria-hidden="true">•••</span><span className="artales-reader-sr-only">{chromeLabels.readerMenu}</span>
          </button>
          {!settings.controlsCollapsed ? (
            <div id={controlsId} className="artales-reader-menu__panel">
              <section><h2>{chromeLabels.readerBookmarkSection}</h2>
                <button type="button" onClick={props.onBookmark}>{bookmark ? labels.updateBookmark : labels.bookmark}</button>
                {bookmark ? <><button type="button" onClick={props.onGoToBookmark}>{labels.goToBookmark}</button><button type="button" onClick={props.onClearBookmark}>{labels.clearBookmark}</button></> : null}
              </section>
              <section><h2>{chromeLabels.readerAppearanceSection}</h2>
                <label>{labels.mode}<select value={settings.layoutMode} onChange={(e) => props.onLayoutModeChange(e.target.value as ReaderLayoutModeId)}><option value="pagedFlow">{chromeLabels.readerPagedFlow}</option><option value="spread">{chromeLabels.readerSpread}</option></select></label>
                <label>{labels.theme}<select value={settings.theme} onChange={(e) => props.onThemeChange(e.target.value as ReaderThemeId)}><option value="light">{labels.themeLight}</option><option value="script">{labels.themeScript}</option><option value="dark">{labels.themeDark}</option></select></label>
                <label>{labels.width}<select value={settings.width} onChange={(e) => props.onWidthChange(e.target.value as ReaderWidthId)}><option value="narrow">{labels.widthNarrow}</option><option value="normal">{labels.widthNormal}</option><option value="wide">{labels.widthWide}</option></select></label>
                <label>{labels.density}<select value={settings.density} onChange={(e) => props.onDensityChange(e.target.value as ReaderDensityId)}><option value="comfortable">{labels.densityComfort}</option><option value="compact">{labels.densityCompact}</option></select></label>
                <div className="artales-reader-menu__font"><span>{labels.textSize}</span><button type="button" onClick={() => props.onFontDelta(-0.05)} aria-label={labels.decreaseFontSize}>A−</button><span>{Math.round(settings.fontScale * 100)}%</span><button type="button" onClick={() => props.onFontDelta(0.05)} aria-label={labels.increaseFontSize}>A+</button></div>
              </section>
              <nav aria-label={labels.readerActions}>
                {props.mode === "preview" ? <Link href={props.fullHref}>{labels.continueReading}</Link> : null}
                <Link href={props.detailHref}>{chromeLabels.readerLeave}</Link>
              </nav>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
