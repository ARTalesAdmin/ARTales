export const readerThemeIds = ["paper", "sepia", "dark"] as const;
export type ReaderThemeId = (typeof readerThemeIds)[number];

export const readerWidthIds = ["narrow", "normal", "wide"] as const;
export type ReaderWidthId = (typeof readerWidthIds)[number];

export const readerDensityIds = ["comfortable", "compact"] as const;
export type ReaderDensityId = (typeof readerDensityIds)[number];

export type ReaderSettings = {
  fontScale: number;
  width: ReaderWidthId;
  theme: ReaderThemeId;
  density: ReaderDensityId;
};

export const defaultReaderSettings: ReaderSettings = {
  fontScale: 1,
  width: "normal",
  theme: "paper",
  density: "comfortable",
};

export function clampReaderFontScale(value: number) {
  if (!Number.isFinite(value)) return defaultReaderSettings.fontScale;
  return Math.min(1.3, Math.max(0.85, Number(value.toFixed(2))));
}

export function normalizeReaderSettings(value: unknown): ReaderSettings {
  if (!value || typeof value !== "object") return defaultReaderSettings;

  const raw = value as Partial<ReaderSettings>;
  const width = readerWidthIds.includes(raw.width as ReaderWidthId)
    ? (raw.width as ReaderWidthId)
    : defaultReaderSettings.width;
  const theme = readerThemeIds.includes(raw.theme as ReaderThemeId)
    ? (raw.theme as ReaderThemeId)
    : defaultReaderSettings.theme;
  const density = readerDensityIds.includes(raw.density as ReaderDensityId)
    ? (raw.density as ReaderDensityId)
    : defaultReaderSettings.density;

  return {
    fontScale: clampReaderFontScale(
      Number(raw.fontScale ?? defaultReaderSettings.fontScale),
    ),
    width,
    theme,
    density,
  };
}
