import {
  clampReaderFontScale,
  defaultReaderSettings,
  normalizeReaderSettings,
  readerDensityIds,
  readerThemeIds,
  readerWidthIds,
  type ReaderSettings,
  type ReaderThemeId,
} from "@/lib/reader/readerSettings";

export const fixtureFormatModes = ["continuous", "a4"] as const;
export type FixtureFormatMode = (typeof fixtureFormatModes)[number];

export type FixtureReadingPreferences = {
  formatMode: FixtureFormatMode;
  theme: ReaderThemeId;
  fontScale: number;
};

/** Already stored by /account/settings; this fixture never mutates profiles. */
export type FixtureProfileReaderDefaults = {
  reader_theme?: string | null;
  reader_width?: string | null;
  reader_density?: string | null;
  reader_font_scale?: number | string | null;
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

/** Only confirmed profile fields count as a configured Reader preference base. */
export function getProfileReaderSettings(
  profile: FixtureProfileReaderDefaults | null | undefined,
): ReaderSettings | null {
  if (!profile) return null;
  const themeValid = readerThemeIds.includes(profile.reader_theme as ReaderThemeId);
  const widthValid = readerWidthIds.includes(profile.reader_width as ReaderSettings["width"]);
  const densityValid = readerDensityIds.includes(profile.reader_density as ReaderSettings["density"]);
  const scale = profile.reader_font_scale == null ? NaN : Number(profile.reader_font_scale);
  const scaleValid = Number.isFinite(scale);
  if (!themeValid && !widthValid && !densityValid && !scaleValid) return null;
  return normalizeReaderSettings({
    ...defaultReaderSettings,
    theme: themeValid ? profile.reader_theme : defaultReaderSettings.theme,
    width: widthValid ? profile.reader_width : defaultReaderSettings.width,
    density: densityValid ? profile.reader_density : defaultReaderSettings.density,
    fontScale: scaleValid ? scale : defaultReaderSettings.fontScale,
  });
}

export type FixtureReadingResolution = {
  preferences: FixtureReadingPreferences;
  /** No onboarding prompt once Reader/profile/confirmed legacy preferences exist. */
  needsFirstRunSetup: boolean;
  /** Shared Reader preference base. Never interpreted as physical A4 pagination. */
  sharedReaderSettings: ReaderSettings;
};

/**
 * Precedence: existing Reader device settings > confirmed old fixture selection
 * > authenticated profile defaults > safe default. Format is fixture-local:
 * the real Reader's spread/pagedFlow is not the same as A4/continuous.
 */
export function resolveFixtureReadingPreferences(input: {
  sharedReaderSettings?: ReaderSettings | null;
  profileDefaults?: FixtureProfileReaderDefaults | null;
  previousFixtureSettings?: unknown;
  savedFixtureFormat?: unknown;
}): FixtureReadingResolution {
  const profile = getProfileReaderSettings(input.profileDefaults);
  const legacy = input.previousFixtureSettings && typeof input.previousFixtureSettings === "object"
    ? (input.previousFixtureSettings as Partial<FixtureReadingPreferences> & { confirmed?: unknown })
    : null;
  const legacyConfirmed = legacy?.confirmed === true;
  const legacyPreference = legacy ? normalizeFixtureReadingPreferences(legacy) : null;
  const shared = input.sharedReaderSettings ? normalizeReaderSettings(input.sharedReaderSettings) : null;

  const base = shared ?? (legacyConfirmed && legacyPreference
    ? normalizeReaderSettings({ ...profile ?? defaultReaderSettings,
        theme: legacyPreference.theme, fontScale: legacyPreference.fontScale })
    : profile) ?? defaultReaderSettings;

  const savedFormat = fixtureFormatModes.includes(input.savedFixtureFormat as FixtureFormatMode)
    ? (input.savedFixtureFormat as FixtureFormatMode)
    : null;
  return {
    preferences: {
      theme: base.theme,
      fontScale: base.fontScale,
      formatMode: savedFormat ?? legacyPreference?.formatMode ?? DEFAULT_FIXTURE_READING_PREFERENCES.formatMode,
    },
    needsFirstRunSetup: !shared && !profile && !legacyConfirmed,
    sharedReaderSettings: base,
  };
}
