import { setInterfaceLocale } from "@/lib/i18n/actions";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n/config";

export default function LocaleSwitcher({
  currentLocale,
  compact = false,
}: {
  currentLocale: SupportedLocale;
  compact?: boolean;
}) {
  return (
    <form action={setInterfaceLocale} className={compact ? "artales-locale-switcher artales-locale-switcher--compact" : "artales-locale-switcher"}>
      {supportedLocales.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          className={locale === currentLocale ? "artales-locale-switcher__button artales-locale-switcher__button--active" : "artales-locale-switcher__button"}
          aria-pressed={locale === currentLocale}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </form>
  );
}
