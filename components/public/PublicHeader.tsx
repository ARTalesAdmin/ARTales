import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { getCurrentProfile } from "@/lib/auth";
import { getPublicDictionary } from "@/lib/i18n/public";
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
    | "reader";
};

export default async function PublicHeader({ active }: PublicHeaderProps) {
  const { public: t } = getPublicDictionary();
  const profile = await getCurrentProfile();
  const hasInternalAccess = canAccessMemberZone(profile);
  const isSignedIn = Boolean(profile);

  return (
    <>
    <PageViewTracker />
    <header className="artales-public-header">
      <ArtalesBrand variant="dark" size="md" showMark />
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

        {hasInternalAccess ? (
          <>
            <Link className="artales-public-link" href="/account">
              My account
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
            My account
          </Link>
        ) : (
          <Link
            className="artales-public-link artales-public-link--primary"
            href="/login"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
    </>
  );
}
