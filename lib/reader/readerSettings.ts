export const readerThemeIds = ["light", "script", "dark"] as const;
export type ReaderThemeId = (typeof readerThemeIds)[number];

export const readerWidthIds = ["narrow", "normal", "wide"] as const;
export type ReaderWidthId = (typeof readerWidthIds)[number];

export const readerDensityIds = ["comfortable", "compact"] as const;
export type ReaderDensityId = (typeof readerDensityIds)[number];

export const readerLayoutModeIds = ["scroll", "page", "spread"] as const;
export type ReaderLayoutModeId = (typeof readerLayoutModeIds)[number];

export const readerPageFitIds = ["screen", "paper"] as const;
export type ReaderPageFitId = (typeof readerPageFitIds)[number];

export type ReaderSettings = {
  fontScale: number;
  width: ReaderWidthId;
  theme: ReaderThemeId;
  density: ReaderDensityId;
  /**
   * Display mode for online reading. Scroll stays the stable default/fallback;
   * page mode is a viewport-based reading layer and a foundation for later
   * dual-page/book-spread work. Spread mode renders two adjacent page sheets on wider screens and falls back to the same sliced page data.
   */
  layoutMode: ReaderLayoutModeId;
  /**
   * Page/spread visual sizing. Screen keeps the page responsive between the
   * toolbar and the viewport; paper keeps a more stable A-series sheet feel,
   * even if the reader surface needs more vertical room.
   */
  pageFit: ReaderPageFitId;
  /**
   * Local reader preference. Later this can move to user profile preferences.
   * When true, the persistent reader top bar stays visible, but detailed
   * controls and bookmark actions are collapsed.
   */
  controlsCollapsed: boolean;
};

export const defaultReaderSettings: ReaderSettings = {
  fontScale: 1,
  width: "normal",
  theme: "light",
  density: "comfortable",
  layoutMode: "scroll",
  pageFit: "paper",
  controlsCollapsed: false,
};

function normalizeLegacyTheme(value: unknown): ReaderThemeId {
  if (value === "paper") return "light";
  if (value === "sepia") return "script";
  if (readerThemeIds.includes(value as ReaderThemeId)) {
    return value as ReaderThemeId;
  }
  return defaultReaderSettings.theme;
}

export function clampReaderFontScale(value: number) {
  if (!Number.isFinite(value)) return defaultReaderSettings.fontScale;
  return Math.min(1.3, Math.max(0.85, Number(value.toFixed(2))));
}

export function normalizeReaderSettings(value: unknown): ReaderSettings {
  if (!value || typeof value !== "object") return defaultReaderSettings;

  const raw = value as Partial<ReaderSettings> & { theme?: unknown };
  const width = readerWidthIds.includes(raw.width as ReaderWidthId)
    ? (raw.width as ReaderWidthId)
    : defaultReaderSettings.width;
  const theme = normalizeLegacyTheme(raw.theme);
  const density = readerDensityIds.includes(raw.density as ReaderDensityId)
    ? (raw.density as ReaderDensityId)
    : defaultReaderSettings.density;
  const layoutMode = readerLayoutModeIds.includes(
    raw.layoutMode as ReaderLayoutModeId,
  )
    ? (raw.layoutMode as ReaderLayoutModeId)
    : defaultReaderSettings.layoutMode;
  // v0.10.3b: keep the stored field for backward compatibility, but normalize
  // legacy/screen values to the stable paper layout. The public Page size
  // control was removed because the screen-fit mode was confusing in real use.
  const pageFit: ReaderPageFitId = "paper";

  return {
    fontScale: clampReaderFontScale(
      Number(raw.fontScale ?? defaultReaderSettings.fontScale),
    ),
    width,
    theme,
    density,
    layoutMode,
    pageFit,
    controlsCollapsed: Boolean(raw.controlsCollapsed),
  };
}
