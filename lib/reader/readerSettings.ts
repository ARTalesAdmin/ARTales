export const readerThemeIds = ["light", "script", "dark"] as const;
export type ReaderThemeId = (typeof readerThemeIds)[number];

export const readerWidthIds = ["narrow", "normal", "wide"] as const;
export type ReaderWidthId = (typeof readerWidthIds)[number];

export const readerDensityIds = ["comfortable", "compact"] as const;
export type ReaderDensityId = (typeof readerDensityIds)[number];

export const readerLayoutModeIds = ["scroll", "page"] as const;
export type ReaderLayoutModeId = (typeof readerLayoutModeIds)[number];

export type ReaderSettings = {
  fontScale: number;
  width: ReaderWidthId;
  theme: ReaderThemeId;
  density: ReaderDensityId;
  /**
   * Display mode for online reading. Scroll stays the stable default/fallback;
   * page mode is a viewport-based reading layer and a foundation for later
   * dual-page/book-spread work.
   */
  layoutMode: ReaderLayoutModeId;
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

  return {
    fontScale: clampReaderFontScale(
      Number(raw.fontScale ?? defaultReaderSettings.fontScale),
    ),
    width,
    theme,
    density,
    layoutMode,
    controlsCollapsed: Boolean(raw.controlsCollapsed),
  };
}
