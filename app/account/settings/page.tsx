import { requireCompletedAccountProfile } from "@/lib/account";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { updateReaderPreferences } from "./actions";
import ThemeToggle from "@/components/theme/ThemeToggle";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AccountSettingsPage({ searchParams }: PageProps) {
  const profile = await requireCompletedAccountProfile("/account/settings");
  const { error, success } = await searchParams;
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.settings;

  return (
    <section className="artales-account-page artales-account-page--narrow">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      {error === "save" ? <p className="artales-account-alert">{dictionary.saveError}</p> : null}
      {success === "settings" ? <p className="artales-account-success">{dictionary.saveSuccess}</p> : null}

      <section className="artales-account-theme-card" aria-label={dictionary.siteTheme}>
        <div>
          <p className="artales-account-card__label">{dictionary.siteTheme}</p>
          <h2>{dictionary.siteTheme}</h2>
          <p>{dictionary.siteThemeHelp}</p>
        </div>
        <ThemeToggle
          labels={{
            light: dictionary.siteThemeLight,
            dark: dictionary.siteThemeDark,
            aria: dictionary.siteTheme,
          }}
        />
      </section>

      <form action={updateReaderPreferences} className="artales-account-form">
        <label>
          <span>{dictionary.interfaceLanguage}</span>
          <select name="preferred_locale" defaultValue={profile.preferred_locale ?? "en"}>
            <option value="en">English</option>
            <option value="cs">Čeština</option>
          </select>
          <small>{dictionary.interfaceLanguageHelp}</small>
        </label>

        <label>
          <span>{dictionary.readerTheme}</span>
          <select name="reader_theme" defaultValue={profile.reader_theme ?? "light"}>
            <option value="light">{dictionary.themeLight}</option>
            <option value="script">{dictionary.themeScript}</option>
            <option value="dark">{dictionary.themeDark}</option>
          </select>
        </label>

        <label>
          <span>{dictionary.readingWidth}</span>
          <select name="reader_width" defaultValue={profile.reader_width ?? "normal"}>
            <option value="narrow">{dictionary.widthNarrow}</option>
            <option value="normal">{dictionary.widthNormal}</option>
            <option value="wide">{dictionary.widthWide}</option>
          </select>
        </label>

        <label>
          <span>{dictionary.textDensity}</span>
          <select name="reader_density" defaultValue={profile.reader_density ?? "comfortable"}>
            <option value="comfortable">{dictionary.densityComfortable}</option>
            <option value="compact">{dictionary.densityCompact}</option>
          </select>
        </label>

        <label>
          <span>{dictionary.fontScale}</span>
          <input
            name="reader_font_scale"
            type="number"
            min="0.85"
            max="1.3"
            step="0.05"
            defaultValue={String(profile.reader_font_scale ?? 1)}
          />
        </label>

        <label className="artales-account-checkbox">
          <input
            name="reader_controls_collapsed"
            type="checkbox"
            defaultChecked={Boolean(profile.reader_controls_collapsed)}
          />
          <span>{dictionary.collapseControls}</span>
        </label>

        <button type="submit" className="artales-account-submit">{dictionary.save}</button>
      </form>
    </section>
  );
}
