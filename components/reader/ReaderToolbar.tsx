"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { readerNoteColors, type ReaderNote, type ReaderNoteColor } from "@/lib/reader/readerStorage";
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
  notes: ReaderNote[];
  notesSyncState: "local" | "syncing" | "synced";
  onFontDelta: (delta: number) => void;
  onThemeChange: (theme: ReaderThemeId) => void;
  onWidthChange: (width: ReaderWidthId) => void;
  onDensityChange: (density: ReaderDensityId) => void;
  onLayoutModeChange: (layoutMode: ReaderLayoutModeId) => void;
  onToggleControls: () => void;
  onAddNote: (input: { title: string; body: string; color: ReaderNoteColor }) => void;
  onGoToNote: (note: ReaderNote) => void;
  onDeleteNote: (note: ReaderNote) => void;
  onGoToPage: (page: number) => void;
};

export default function ReaderToolbar(props: ReaderToolbarProps) {
  const { settings, labels, chromeLabels } = props;
  const { onToggleControls } = props;
  const progress = Math.max(0, Math.min(100, Math.round(props.progressPercent)));
  const currentPage = Math.min(props.pageIndex + 1, props.pageCount);
  const controlsId = "artales-reader-compact-menu";
  const inputId = "artales-reader-page-input";
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreNextPageBlurRef = useRef(false);
  const [isPageEntryOpen, setIsPageEntryOpen] = useState(false);
  const [pageValue, setPageValue] = useState(String(currentPage));
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteColor, setNoteColor] = useState<ReaderNoteColor>("gold");
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);

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
      if (event.key === "Escape") {
        onToggleControls();
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onToggleControls, settings.controlsCollapsed]);

  const submitPage = (onlyIfChanged = false) => {
    const requestedPage = Number(pageValue);
    if (!Number.isFinite(requestedPage) || pageValue.trim() === "") {
      setPageValue(String(currentPage));
      return;
    }
    const safePage = Math.max(
      1,
      Math.min(props.pageCount, Math.trunc(requestedPage)),
    );
    if (!onlyIfChanged || safePage !== currentPage) props.onGoToPage(safePage);
    setPageValue(String(safePage));
    ignoreNextPageBlurRef.current = true;
    setIsPageEntryOpen(false);
  };
  const onPageBlur = () => {
    if (ignoreNextPageBlurRef.current) {
      ignoreNextPageBlurRef.current = false;
      return;
    }
    const requestedPage = Number(pageValue);
    if (!Number.isFinite(requestedPage) || pageValue.trim() === "") {
      setPageValue(String(currentPage));
      setIsPageEntryOpen(false);
      return;
    }
    submitPage(true);
  };
  const onPageKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") submitPage();
    if (event.key === "Escape") {
      // Cancel only page entry; do not let the menu's document-level Escape
      // handler close an independently open compact menu at the same time.
      event.stopPropagation();
      ignoreNextPageBlurRef.current = true;
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
                onChange={(event) => setPageValue(event.target.value)} onKeyDown={onPageKeyDown} onBlur={onPageBlur} />
              <span>/ {props.pageCount}</span>
            </label>
          ) : (
            <button type="button" className="artales-reader-page-jump__trigger" onClick={() => { ignoreNextPageBlurRef.current = false; setPageValue(String(currentPage)); setIsPageEntryOpen(true); }}
              aria-label={chromeLabels.readerGoToPage}>
              {labels.page} {currentPage} / {props.pageCount}
            </button>
          )}
        </div>
        <div className="artales-reader-menu" ref={menuRef}>
          <button
            ref={menuTriggerRef}
            type="button"
            className="artales-reader-menu__trigger"
            onClick={props.onToggleControls}
            aria-expanded={!settings.controlsCollapsed}
            aria-controls={controlsId}
          >
            <span aria-hidden="true">•••</span><span className="artales-reader-sr-only">{chromeLabels.readerMenu}</span>
          </button>
          {!settings.controlsCollapsed ? (
            <div id={controlsId} className="artales-reader-menu__panel">
              <section className="artales-reader-notes"><h2>{labels.notes}</h2>
                <div className="artales-reader-notes__heading">
                  <button type="button" onClick={() => setIsNoteFormOpen((open) => !open)} aria-expanded={isNoteFormOpen}>{labels.addNote}</button>
                  <span>{props.notesSyncState === "synced" ? labels.synced : props.notesSyncState === "syncing" ? labels.syncing : labels.localOnly}</span>
                </div>
                {isNoteFormOpen ? <form className="artales-reader-note-form" onSubmit={(event) => {
                  event.preventDefault(); props.onAddNote({ title: noteTitle, body: noteBody, color: noteColor });
                  setNoteTitle(""); setNoteBody(""); setIsNoteFormOpen(false);
                }}>
                  <label>{labels.noteTitle}<input value={noteTitle} maxLength={160} onChange={(event) => setNoteTitle(event.target.value)} /></label>
                  <label>{labels.noteBody}<textarea value={noteBody} maxLength={4000} rows={3} onChange={(event) => setNoteBody(event.target.value)} /></label>
                  <label>{labels.noteColor}<select value={noteColor} onChange={(event) => setNoteColor(event.target.value as ReaderNoteColor)}>{readerNoteColors.map((color) => <option value={color} key={color}>{labels.noteColors[color]}</option>)}</select></label>
                  <button type="submit">{labels.saveNote}</button>
                </form> : null}
                <h3>{labels.myNotes}</h3>
                {props.notes.length ? <ul className="artales-reader-notes__list">{props.notes.map((note) => {
                  const noteName = note.title || `${labels.page} ${(note.pageIndex ?? 0) + 1}`;
                  return <li key={note.id}>
                    <span className={`artales-reader-note-color artales-reader-note-color--${note.color}`} aria-hidden="true" />
                    <div><strong>{noteName}</strong>{note.body ? <p>{note.body}</p> : null}<small>{labels.page} {(note.pageIndex ?? 0) + 1}</small></div>
                    <div className="artales-reader-notes__actions"><button type="button" onClick={() => props.onGoToNote(note)}>{labels.goToNote}</button><button type="button" onClick={() => props.onDeleteNote(note)} aria-label={`${labels.deleteNote}: ${noteName}`}>{labels.deleteNote}</button></div>
                  </li>;
                })}</ul> : <p className="artales-reader-notes__empty">{labels.noNotes}</p>}
              </section>
              <section><h2>{chromeLabels.readerAppearanceSection}</h2>
                <label>{labels.mode}<select value={settings.layoutMode} onChange={(e) => props.onLayoutModeChange(e.target.value as ReaderLayoutModeId)}><option value="pagedFlow">{chromeLabels.readerPagedFlow}</option><option value="spread">{chromeLabels.readerSpread}</option></select></label>
                <label>{labels.theme}<select value={settings.theme} onChange={(e) => props.onThemeChange(e.target.value as ReaderThemeId)}><option value="light">{labels.themeLight}</option><option value="script">{labels.themeScript}</option><option value="dark">{labels.themeDark}</option></select></label>
                {settings.showAdvancedReaderControls ? <>
                  <label>{labels.width}<select value={settings.width} onChange={(e) => props.onWidthChange(e.target.value as ReaderWidthId)}><option value="narrow">{labels.widthNarrow}</option><option value="normal">{labels.widthNormal}</option><option value="wide">{labels.widthWide}</option></select></label>
                  <label>{labels.density}<select value={settings.density} onChange={(e) => props.onDensityChange(e.target.value as ReaderDensityId)}><option value="comfortable">{labels.densityComfort}</option><option value="compact">{labels.densityCompact}</option></select></label>
                  <div className="artales-reader-menu__font"><span>{labels.textSize}</span><button type="button" onClick={() => props.onFontDelta(-0.05)} aria-label={labels.decreaseFontSize}>A−</button><span>{Math.round(settings.fontScale * 100)}%</span><button type="button" onClick={() => props.onFontDelta(0.05)} aria-label={labels.increaseFontSize}>A+</button></div>
                </> : null}
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
