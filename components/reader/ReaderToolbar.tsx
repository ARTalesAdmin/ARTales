"use client";

import Link from "next/link";
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

type ReaderLabels = ReturnType<typeof getPublicDictionary>["reader"];

type ReaderToolbarProps = {
  title: string;
  authorName?: string | null;
  detailHref: string;
  mode: "preview" | "full";
  fullHref: string;
  progressPercent: number;
  pageIndex: number;
  pageCount: number;
  settings: ReaderSettings;
  labels: ReaderLabels;
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
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
};

function formatPageRange(
  pageIndex: number,
  pageCount: number,
  isSpreadMode: boolean,
  labels: ReaderLabels,
) {
  const currentPage = Math.min(pageIndex + 1, pageCount);
  if (!isSpreadMode) return `${labels.page} ${currentPage} / ${pageCount}`;

  const spreadEndPage = Math.min(pageIndex + 2, pageCount);
  return `${labels.pages} ${currentPage}${spreadEndPage > currentPage ? `–${spreadEndPage}` : ""} / ${pageCount}`;
}

export default function ReaderToolbar({
  title,
  authorName,
  detailHref,
  mode,
  fullHref,
  progressPercent,
  pageIndex,
  pageCount,
  settings,
  labels,
  bookmark,
  onFontDelta,
  onThemeChange,
  onWidthChange,
  onDensityChange,
  onLayoutModeChange,
  onToggleControls,
  onBookmark,
  onGoToBookmark,
  onClearBookmark,
  isFocusMode,
  onToggleFocusMode,
}: ReaderToolbarProps) {
  const progress = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const brandVariant = settings.theme === "dark" ? "light" : "dark";
  const controlsId = "artales-reader-settings-panel";
  const isPagedMode = settings.layoutMode === "page" || settings.layoutMode === "spread";
  const isSpreadMode = settings.layoutMode === "spread";
  const pageLabel = formatPageRange(pageIndex, pageCount, isSpreadMode, labels);

  return (
    <header className="artales-reader-toolbar">
      <div className="artales-reader-toolbar__top-row">
        <div className="artales-reader-toolbar__brand">
          <ArtalesBrand variant={brandVariant} size="sm" showMark />
          <div className="artales-reader-toolbar__title-wrap">
            <p className="artales-reader-toolbar__mode">
              {mode === "preview" ? labels.preview : labels.onlineReader}
            </p>
            <h1 className="artales-reader-toolbar__title">{title}</h1>
            {authorName ? (
              <p className="artales-reader-toolbar__author">{authorName}</p>
            ) : null}
          </div>
        </div>

        <div className="artales-reader-toolbar__top-actions">
          <div
            className="artales-reader-progress artales-reader-progress--top"
            aria-label={
              isPagedMode
                ? `${pageLabel}, ${labels.readingProgress} ${progress}%`
                : `${labels.readingProgress} ${progress}%`
            }
          >
            <span>{isPagedMode ? pageLabel : `${progress}%`}</span>
            <div className="artales-reader-progress__track">
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button
            type="button"
            className="artales-reader-top-button"
            onClick={onBookmark}
          >
            {bookmark ? labels.updateBookmark : labels.bookmark}
          </button>
          <button
            type="button"
            className="artales-reader-top-button artales-reader-top-button--focus"
            onClick={onToggleFocusMode}
            aria-pressed={isFocusMode}
          >
            {isFocusMode ? labels.exitFocusMode : labels.enterFocusMode}
          </button>
          <button
            type="button"
            className="artales-reader-settings-toggle"
            onClick={onToggleControls}
            aria-expanded={!settings.controlsCollapsed}
            aria-controls={controlsId}
          >
            <span aria-hidden="true">
              {settings.controlsCollapsed ? "▾" : "▴"}
            </span>
            {settings.controlsCollapsed ? labels.showSettings : labels.hideSettings}
          </button>
        </div>
      </div>

      {!settings.controlsCollapsed ? (
        <div id={controlsId} className="artales-reader-toolbar__settings-panel">
          <div
            className="artales-reader-toolbar__controls"
            aria-label={labels.readerControls}
          >
            <div className="artales-reader-control-group" aria-label={labels.textSize}>
              <button
                type="button"
                onClick={() => onFontDelta(-0.05)}
                aria-label={labels.decreaseFontSize}
              >
                A-
              </button>
              <span>{Math.round(settings.fontScale * 100)}%</span>
              <button
                type="button"
                onClick={() => onFontDelta(0.05)}
                aria-label={labels.increaseFontSize}
              >
                A+
              </button>
            </div>

            <label className="artales-reader-select-label">
              {labels.mode}
              <select
                value={settings.layoutMode}
                onChange={(event) =>
                  onLayoutModeChange(event.target.value as ReaderLayoutModeId)
                }
              >
                <option value="scroll">{labels.modeScroll}</option>
                <option value="page">{labels.modePage}</option>
                <option value="spread">{labels.modeSpread}</option>
              </select>
            </label>

            <label className="artales-reader-select-label">
              {labels.theme}
              <select
                value={settings.theme}
                onChange={(event) =>
                  onThemeChange(event.target.value as ReaderThemeId)
                }
              >
                <option value="light">{labels.themeLight}</option>
                <option value="script">{labels.themeScript}</option>
                <option value="dark">{labels.themeDark}</option>
              </select>
            </label>

            <label className="artales-reader-select-label">
              {labels.width}
              <select
                value={settings.width}
                onChange={(event) =>
                  onWidthChange(event.target.value as ReaderWidthId)
                }
              >
                <option value="narrow">{labels.widthNarrow}</option>
                <option value="normal">{labels.widthNormal}</option>
                <option value="wide">{labels.widthWide}</option>
              </select>
            </label>

            <label className="artales-reader-select-label">
              {labels.density}
              <select
                value={settings.density}
                onChange={(event) =>
                  onDensityChange(event.target.value as ReaderDensityId)
                }
              >
                <option value="comfortable">{labels.densityComfort}</option>
                <option value="compact">{labels.densityCompact}</option>
              </select>
            </label>
          </div>

          <div
            className="artales-reader-toolbar__action-row"
            aria-label={labels.readerActions}
          >
            {bookmark ? (
              <>
                <button
                  type="button"
                  className="artales-reader-ghost-button"
                  onClick={onGoToBookmark}
                >
                  {labels.goToBookmark}
                </button>
                <button
                  type="button"
                  className="artales-reader-ghost-button"
                  onClick={onClearBookmark}
                >
                  {labels.clearBookmark}
                </button>
              </>
            ) : null}

            {mode === "preview" ? (
              <Link className="artales-reader-primary-link" href={fullHref}>
                {labels.continueReading}
              </Link>
            ) : null}
            <Link className="artales-reader-exit-link" href={detailHref}>
              × {labels.exitReader}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
