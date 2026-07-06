import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { canAccessMemberZone, type PermissionProfile } from "@/lib/permissions";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";

export default async function AccountNav({
  profile,
}: {
  profile: PermissionProfile & { preferred_locale?: string | null };
}) {
  const showMemberZone = canAccessMemberZone(profile);
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.nav;

  const accountLinks = [
    { href: "/account", label: dictionary.overview },
    { href: "/account/library", label: dictionary.library },
    { href: "/account/credits", label: dictionary.credits },
    { href: "/account/profile", label: dictionary.profile },
    { href: "/account/security", label: dictionary.security },
    { href: "/account/settings", label: dictionary.settings },
    { href: "/account/community", label: dictionary.community },
    { href: "/account/membership", label: dictionary.membership },
  ];

  return (
    <aside className="artales-account-sidebar">
      <div className="artales-account-brand">
        <ArtalesBrand href="/account" variant="light" size="md" showMark />
      </div>
      <p className="artales-account-eyebrow">{dictionary.eyebrow}</p>
      <p className="artales-account-sidebar__hint">{dictionary.hint}</p>
      <nav className="artales-account-nav" aria-label={dictionary.ariaLabel}>
        {accountLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="artales-account-nav__link"
          >
            {link.label}
          </Link>
        ))}

        <div className="artales-account-nav__group">
          {showMemberZone ? (
            <Link
              href="/member"
              className="artales-account-nav__link artales-account-nav__link--emphasis"
            >
              {dictionary.memberZone}
            </Link>
          ) : null}
          <Link href="/gallery" className="artales-account-nav__link">
            {dictionary.gallery}
          </Link>
        </div>
      </nav>
    </aside>
  );
}
