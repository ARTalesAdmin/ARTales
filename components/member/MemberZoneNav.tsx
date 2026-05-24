"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { getInternalDictionary } from "@/lib/i18n/internal";

function isActivePath(pathname: string, href: string) {
  if (href === "/member") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MemberZoneNav() {
  const pathname = usePathname();
  const { member } = getInternalDictionary();

  const primaryLinks = [
    { href: "/member", label: member.overview },
    { href: "/member/works", label: member.works },
    { href: "/member/authors", label: member.authors },
    { href: "/member/collections", label: member.collections },
    { href: "/member/submissions", label: "Příspěvky" },
    { href: "/member/invites", label: "Pozvánky" },
  ];

  const creationLinks = [
    { href: "/member/works/new", label: member.newWork },
    { href: "/member/authors/new", label: member.newAuthor },
    { href: "/member/collections/new", label: member.newCollection },
  ];

  return (
    <aside className="artales-member-sidebar">
      <ArtalesBrand href="/member" variant="light" size="sm" showMark />
      <p className="artales-member-sidebar__title">{member.zoneTitle}</p>
      <p className="artales-member-sidebar__subtitle">{member.zoneSubtitle}</p>

      <nav className="artales-member-nav" aria-label="Navigace interní zóny">
        {primaryLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "artales-member-nav__link",
              isActivePath(pathname, item.href)
                ? "artales-member-nav__link--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.label}
          </Link>
        ))}

        <div className="artales-member-nav__group">
          {creationLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "artales-member-nav__link",
                pathname === item.href
                  ? "artales-member-nav__link--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="artales-member-nav__group">
          <Link className="artales-member-nav__link" href="/account">
            Můj účet
          </Link>
          <Link className="artales-member-nav__link" href="/gallery">
            {member.publicGallery}
          </Link>
        </div>
      </nav>
    </aside>
  );
}
