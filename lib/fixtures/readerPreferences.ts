import {
  clampReaderFontScale,
  readerThemeIds,
  type ReaderThemeId,
} from "@/lib/reader/readerSettings";

export const fixtureFormatModes = ["continuous", "a4"] as const;
export type FixtureFormatMode = (typeof fixtureFormatModes)[number];

export type FixtureReadingPreferences = {
  formatMode: FixtureFormatMode;
  theme: ReaderThemeId;
  fontScale: number;
};

export const DEFAULT_FIXTURE_READING_PREFERENCES: FixtureReadingPreferences = {
  formatMode: "continuous",
  theme: "light",
  fontScale: 1,
};

export function normalizeFixtureReadingPreferences(value: unknown): FixtureReadingPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_FIXTURE_READING_PREFERENCES };
  const input = value as Partial<FixtureReadingPreferences>;
  return {
    formatMode: fixtureFormatModes.includes(input.formatMode as FixtureFormatMode)
      ? (input.formatMode as FixtureFormatMode)
      : DEFAULT_FIXTURE_READING_PREFERENCES.formatMode,
    theme: readerThemeIds.includes(input.theme as ReaderThemeId)
      ? (input.theme as ReaderThemeId)
      : DEFAULT_FIXTURE_READING_PREFERENCES.theme,
    fontScale: clampReaderFontScale(
      typeof input.fontScale === "number" ? input.fontScale : DEFAULT_FIXTURE_READING_PREFERENCES.fontScale,
    ),
  };
}
