"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setInterfaceLocale } from "@/lib/i18n/actions";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n/config";

export default function LocaleSwitcher({
  currentLocale,
  compact = false,
}: {
  currentLocale: SupportedLocale;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const nextPath = `${pathname || "/"}${queryString ? `?${queryString}` : ""}`;

  return (
    <form action={setInterfaceLocale} className={compact ? "artales-locale-switcher artales-locale-switcher--compact" : "artales-locale-switcher"}>
      <input type="hidden" name="next" value={nextPath} />
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
