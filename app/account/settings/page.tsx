import { requireCompletedAccountProfile } from "@/lib/account";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { updateReaderPreferences } from "./actions";
import ThemeToggle from "@/components/theme/ThemeToggle";
import ReaderPreferencesForm from "@/components/account/ReaderPreferencesForm";

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

      <ReaderPreferencesForm
        action={updateReaderPreferences}
        copy={dictionary}
        defaults={{
          preferredLocale: profile.preferred_locale === "cs" ? "cs" : "en",
          theme: profile.reader_theme === "script" || profile.reader_theme === "dark" ? profile.reader_theme : "light",
          width: profile.reader_width === "narrow" || profile.reader_width === "wide" ? profile.reader_width : "normal",
          density: profile.reader_density === "compact" ? "compact" : "comfortable",
          fontScale: Number(profile.reader_font_scale ?? 1),
        }}
      />
    </section>
  );
}
