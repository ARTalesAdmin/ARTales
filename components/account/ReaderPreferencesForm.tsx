"use client";

import { useEffect, useState } from "react";
import {
  clampReaderFontScale,
  type ReaderDensityId,
  type ReaderLayoutModeId,
  type ReaderSettings,
  type ReaderThemeId,
  type ReaderWidthId,
} from "@/lib/reader/readerSettings";
import { loadReaderSettings, saveReaderSettings } from "@/lib/reader/readerStorage";

type Copy = {
  interfaceLanguage: string;
  interfaceLanguageHelp: string;
  simpleSettings: string;
  simpleSettingsHelp: string;
  advancedSettings: string;
  advancedSettingsHelp: string;
  localStorageNote: string;
  readerTheme: string;
  themeLight: string;
  themeScript: string;
  themeDark: string;
  defaultLayout: string;
  layoutPagedFlow: string;
  layoutSpread: string;
  readingWidth: string;
  widthNarrow: string;
  widthNormal: string;
  widthWide: string;
  textDensity: string;
  densityComfortable: string;
  densityCompact: string;
  fontScale: string;
  showAdvancedControls: string;
  showAdvancedControlsHelp: string;
  save: string;
};

type ProfileDefaults = {
  preferredLocale: "cs" | "en";
  theme: ReaderThemeId;
  width: ReaderWidthId;
  density: ReaderDensityId;
  fontScale: number;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  copy: Copy;
  defaults: ProfileDefaults;
};

export default function ReaderPreferencesForm({ action, copy, defaults }: Props) {
  const [layoutMode, setLayoutMode] = useState<ReaderLayoutModeId>("pagedFlow");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const local = loadReaderSettings();
      setLayoutMode(local.layoutMode);
      setShowAdvanced(local.showAdvancedReaderControls);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function saveLocalPreferences(formData: FormData) {
    const current = loadReaderSettings();
    const next: ReaderSettings = {
      ...current,
      theme: formData.get("reader_theme") as ReaderThemeId,
      layoutMode: formData.get("reader_layout_mode") as ReaderLayoutModeId,
      width: formData.get("reader_width") as ReaderWidthId,
      density: formData.get("reader_density") as ReaderDensityId,
      fontScale: clampReaderFontScale(Number(formData.get("reader_font_scale"))),
      showAdvancedReaderControls:
        formData.get("show_advanced_reader_controls") === "on",
    };
    saveReaderSettings(next);
  }

  return (
    <form
      action={action}
      className="artales-account-form"
      onSubmit={(event) => saveLocalPreferences(new FormData(event.currentTarget))}
    >
      <label>
        <span>{copy.interfaceLanguage}</span>
        <select name="preferred_locale" defaultValue={defaults.preferredLocale}>
          <option value="en">English</option>
          <option value="cs">Čeština</option>
        </select>
        <small>{copy.interfaceLanguageHelp}</small>
      </label>

      <section aria-labelledby="reader-simple-settings">
        <h2 id="reader-simple-settings">{copy.simpleSettings}</h2>
        <p>{copy.simpleSettingsHelp}</p>
        <label>
          <span>{copy.readerTheme}</span>
          <select name="reader_theme" defaultValue={defaults.theme}>
            <option value="light">{copy.themeLight}</option>
            <option value="script">{copy.themeScript}</option>
            <option value="dark">{copy.themeDark}</option>
          </select>
        </label>
        <label>
          <span>{copy.defaultLayout}</span>
          <select
            name="reader_layout_mode"
            value={layoutMode}
            onChange={(event) => setLayoutMode(event.target.value as ReaderLayoutModeId)}
          >
            <option value="pagedFlow">{copy.layoutPagedFlow}</option>
            <option value="spread">{copy.layoutSpread}</option>
          </select>
        </label>
      </section>

      <details>
        <summary><strong>{copy.advancedSettings}</strong></summary>
        <p>{copy.advancedSettingsHelp}</p>
        <label>
          <span>{copy.fontScale}</span>
          <input name="reader_font_scale" type="number" min="0.85" max="1.3" step="0.05" defaultValue={String(defaults.fontScale)} />
        </label>
        <label>
          <span>{copy.readingWidth}</span>
          <select name="reader_width" defaultValue={defaults.width}>
            <option value="narrow">{copy.widthNarrow}</option>
            <option value="normal">{copy.widthNormal}</option>
            <option value="wide">{copy.widthWide}</option>
          </select>
        </label>
        <label>
          <span>{copy.textDensity}</span>
          <select name="reader_density" defaultValue={defaults.density}>
            <option value="comfortable">{copy.densityComfortable}</option>
            <option value="compact">{copy.densityCompact}</option>
          </select>
        </label>
        <label className="artales-account-checkbox">
          <input name="show_advanced_reader_controls" type="checkbox" checked={showAdvanced} onChange={(event) => setShowAdvanced(event.target.checked)} />
          <span>{copy.showAdvancedControls}</span>
        </label>
        <small>{copy.showAdvancedControlsHelp}</small>
      </details>

      <small>{copy.localStorageNote}</small>
      <button type="submit" className="artales-account-submit">{copy.save}</button>
    </form>
  );
}
