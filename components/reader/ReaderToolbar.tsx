"use client";

import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import type { ReaderBookmark } from "@/lib/reader/readerStorage";
import type {
  ReaderDensityId,
  ReaderSettings,
  ReaderThemeId,
  ReaderWidthId,
} from "@/lib/reader/readerSettings";

type ReaderToolbarProps = {
  title: string;
  authorName?: string | null;
  detailHref: string;
  mode: "preview" | "full";
  fullHref: string;
  previewHref: string;
  progressPercent: number;
  settings: ReaderSettings;
  bookmark: ReaderBookmark | null;
  onFontDelta: (delta: number) => void;
  onThemeChange: (theme: ReaderThemeId) => void;
  onWidthChange: (width: ReaderWidthId) => void;
  onDensityChange: (density: ReaderDensityId) => void;
  onToggleControls: () => void;
  onBookmark: () => void;
  onGoToBookmark: () => void;
  onClearBookmark: () => void;
};

export default function ReaderToolbar({
  title,
  authorName,
  detailHref,
  mode,
  fullHref,
  previewHref,
  progressPercent,
  settings,
  bookmark,
  onFontDelta,
  onThemeChange,
  onWidthChange,
  onDensityChange,
  onToggleControls,
  onBookmark,
  onGoToBookmark,
  onClearBookmark,
}: ReaderToolbarProps) {
  const progress = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const brandVariant = settings.theme === "dark" ? "light" : "dark";
  const controlsId = "artales-reader-settings-panel";

  return (
    <header className="artales-reader-toolbar">
      <div className="artales-reader-toolbar__top-row">
        <div className="artales-reader-toolbar__brand">
          <ArtalesBrand variant={brandVariant} size="sm" showMark />
          <div className="artales-reader-toolbar__title-wrap">
            <p className="artales-reader-toolbar__mode">
              {mode === "preview" ? "Preview" : "Online reader"}
            </p>
            <h1 className="artales-reader-toolbar__title">{title}</h1>
            {authorName ? (
              <p className="artales-reader-toolbar__author">by {authorName}</p>
            ) : null}
          </div>
        </div>

        <div className="artales-reader-toolbar__top-actions">
          <div
            className="artales-reader-progress artales-reader-progress--top"
            aria-label={`Reading progress ${progress}%`}
          >
            <span>{progress}%</span>
            <div className="artales-reader-progress__track">
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>
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
            Reader settings
          </button>
        </div>
      </div>

      {!settings.controlsCollapsed ? (
        <div id={controlsId} className="artales-reader-toolbar__settings-panel">
          <div
            className="artales-reader-toolbar__controls"
            aria-label="Reader controls"
          >
            <div className="artales-reader-control-group" aria-label="Text size">
              <button
                type="button"
                onClick={() => onFontDelta(-0.05)}
                aria-label="Decrease font size"
              >
                A-
              </button>
              <span>{Math.round(settings.fontScale * 100)}%</span>
              <button
                type="button"
                onClick={() => onFontDelta(0.05)}
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            <label className="artales-reader-select-label">
              Theme
              <select
                value={settings.theme}
                onChange={(event) =>
                  onThemeChange(event.target.value as ReaderThemeId)
                }
              >
                <option value="light">Light</option>
                <option value="script">Script</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <label className="artales-reader-select-label">
              Width
              <select
                value={settings.width}
                onChange={(event) =>
                  onWidthChange(event.target.value as ReaderWidthId)
                }
              >
                <option value="narrow">Narrow</option>
                <option value="normal">Normal</option>
                <option value="wide">Wide</option>
              </select>
            </label>

            <label className="artales-reader-select-label">
              Density
              <select
                value={settings.density}
                onChange={(event) =>
                  onDensityChange(event.target.value as ReaderDensityId)
                }
              >
                <option value="comfortable">Comfort</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          </div>

          <div
            className="artales-reader-toolbar__action-row"
            aria-label="Reader actions"
          >
            <button
              type="button"
              className="artales-reader-ghost-button"
              onClick={onBookmark}
            >
              {bookmark ? "Update bookmark" : "Bookmark"}
            </button>
            {bookmark ? (
              <>
                <button
                  type="button"
                  className="artales-reader-ghost-button"
                  onClick={onGoToBookmark}
                >
                  Go to bookmark
                </button>
                <button
                  type="button"
                  className="artales-reader-ghost-button"
                  onClick={onClearBookmark}
                >
                  Clear bookmark
                </button>
              </>
            ) : null}

            {mode === "preview" ? (
              <Link className="artales-reader-primary-link" href={fullHref}>
                Continue reading
              </Link>
            ) : (
              <Link className="artales-reader-ghost-link" href={previewHref}>
                Preview
              </Link>
            )}
            <Link className="artales-reader-exit-link" href={detailHref}>
              × Exit
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
