import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";

const links = [
  { href: "/account", label: "Overview" },
  { href: "/account/library", label: "My library" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/settings", label: "Reader settings" },
  { href: "/account/membership", label: "Membership" },
  { href: "/gallery", label: "Gallery" },
];

export default function AccountNav() {
  return (
    <aside className="artales-account-sidebar">
      <div className="artales-account-brand">
        <ArtalesBrand href="/account" variant="light" size="md" showMark />
      </div>
      <p className="artales-account-eyebrow">Reader account</p>
      <nav className="artales-account-nav" aria-label="Reader account navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="artales-account-nav__link">
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
