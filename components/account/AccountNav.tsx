import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { canAccessMemberZone, type PermissionProfile } from "@/lib/permissions";

const accountLinks = [
  { href: "/account", label: "Overview" },
  { href: "/account/library", label: "My library" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/security", label: "Security" },
  { href: "/account/settings", label: "Reader settings" },
  { href: "/account/membership", label: "Membership" },
];

export default function AccountNav({
  profile,
}: {
  profile: PermissionProfile;
}) {
  const showMemberZone = canAccessMemberZone(profile);

  return (
    <aside className="artales-account-sidebar">
      <div className="artales-account-brand">
        <ArtalesBrand href="/account" variant="light" size="md" showMark />
      </div>
      <p className="artales-account-eyebrow">Personal account</p>
      <p className="artales-account-sidebar__hint">
        Identity, security, reader preferences and future purchases live here.
      </p>
      <nav
        className="artales-account-nav"
        aria-label="Reader account navigation"
      >
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
              Member zone
            </Link>
          ) : null}
          <Link href="/gallery" className="artales-account-nav__link">
            Gallery
          </Link>
        </div>
      </nav>
    </aside>
  );
}
