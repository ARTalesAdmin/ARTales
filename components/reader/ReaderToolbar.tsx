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
  onBookmark,
  onGoToBookmark,
  onClearBookmark,
}: ReaderToolbarProps) {
  const progress = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <header className="artales-reader-toolbar">
      <div className="artales-reader-toolbar__brand">
        <ArtalesBrand variant="light" size="sm" showMark />
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

      <div
        className="artales-reader-toolbar__controls"
        aria-label="Reader controls"
      >
        <div
          className="artales-reader-progress"
          aria-label={`Reading progress ${progress}%`}
        >
          <span>{progress}%</span>
          <div className="artales-reader-progress__track">
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>

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
            <option value="paper">Paper</option>
            <option value="sepia">Sepia</option>
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

        <button
          type="button"
          className="artales-reader-ghost-button"
          onClick={onBookmark}
        >
          Bookmark
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
              Clear
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
    </header>
  );
}
