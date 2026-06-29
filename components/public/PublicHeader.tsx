import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { getCurrentProfile } from "@/lib/auth";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import LocaleSwitcher from "@/components/i18n/LocaleSwitcher";
import { canAccessMemberZone } from "@/lib/permissions";
import PageViewTracker from "@/components/analytics/PageViewTracker";

export const dynamic = "force-dynamic";

type PublicHeaderProps = {
  active?:
    | "home"
    | "gallery"
    | "authors"
    | "author"
    | "collection"
    | "work"
    | "reader"
    | "legal";
};

export default async function PublicHeader({ active }: PublicHeaderProps) {
  const cookieLocale = await getCookieLocale();
  const profile = await getCurrentProfile();
  const currentLocale = resolveProfileLocale(profile, cookieLocale);
  const { public: t } = getPublicDictionary(currentLocale);
  const hasInternalAccess = canAccessMemberZone(profile);
  const isSignedIn = Boolean(profile);

  return (
    <>
    <PageViewTracker />
    <header className="artales-public-header">
      <ArtalesBrand href="/" variant="dark" size="md" showMark />
      <nav
        className="artales-public-header__nav"
        aria-label="Public navigation"
      >
        <Link
          className="artales-public-link"
          href="/gallery"
          aria-current={active === "gallery" ? "page" : undefined}
        >
          {t.gallery}
        </Link>
        <Link
          className="artales-public-link"
          href="/collections"
          aria-current={active === "collection" ? "page" : undefined}
        >
          {t.collections}
        </Link>
        <Link
          className="artales-public-link"
          href="/authors"
          aria-current={
            active === "authors" || active === "author" ? "page" : undefined
          }
        >
          {t.authors}
        </Link>

        <Link
          className="artales-public-link"
          href="/legal"
          aria-current={active === "legal" ? "page" : undefined}
        >
          {currentLocale === "cs" ? "Info" : "Info"}
        </Link>

        <LocaleSwitcher currentLocale={currentLocale} compact />

        {hasInternalAccess ? (
          <>
            <Link className="artales-public-link" href="/account">
              {t.myAccount}
            </Link>
            <Link
              className="artales-public-link artales-public-link--primary"
              href="/member"
            >
              {t.memberZone}
            </Link>
          </>
        ) : isSignedIn ? (
          <Link
            className="artales-public-link artales-public-link--primary"
            href="/account"
          >
            {t.myAccount}
          </Link>
        ) : (
          <Link
            className="artales-public-link artales-public-link--primary"
            href="/login"
          >
            {t.signIn}
          </Link>
        )}
      </nav>
    </header>
    </>
  );
}
