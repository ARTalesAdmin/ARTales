"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CANDIDATES_AB_ENABLED } from "@/lib/candidates/featureFlag";
import { getInternalDictionary } from "@/lib/i18n/internal";
import styles from "./MemberZoneNav.module.css";

type NavItem = { href: string; label: string };
type NavGroup = { id: string; title: string; hint: string; links: NavItem[] };

function isActivePath(pathname: string, href: string) {
  if (href === "/member") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MemberZoneNav({ role }: { role: string | null }) {
  const pathname = usePathname();
  const { member } = getInternalDictionary();
  const editor = role === "admin" || role === "editor";
  const admin = role === "admin";

  // The sidebar shows only navigable destinations for the current role.
  // Route guards and RLS remain authoritative for access control.
  const groups: NavGroup[] = [
    {
      id: "discovery",
      title: "VÝBĚR TITULŮ",
      hint: "Náměty a posouzení",
      links: [
        ...(admin ? [{ href: "/member/admin/prescreen/shadow", label: "Prescreen" }] : []),
        ...(editor && CANDIDATES_AB_ENABLED
          ? [{ href: "/member/candidates", label: "Kandidáti" }]
          : []),
      ],
    },
    {
      id: "editorial",
      title: "REDAKCE A KATALOG",
      hint: "Obsah a jeho uspořádání",
      links: editor
        ? [
            { href: "/member/works", label: member.works },
            { href: "/member/authors", label: member.authors },
            { href: "/member/collections", label: member.collections },
            { href: "/member/tags", label: "Tagy" },
            { href: "/member/resources", label: "Materiály a nástroje" },
          ]
        : [],
    },
    {
      id: "community",
      title: "KOMUNITA A ČTENÁŘI",
      hint: "Podněty a přístupy",
      links: [
        { href: "/member/submissions", label: "Příspěvky" },
        { href: "/member/community", label: "Komunitní procesor" },
        { href: "/member/entitlements", label: "Nároky čtenářů" },
        ...(editor ? [{ href: "/member/invites", label: "Pozvánky" }] : []),
      ],
    },
    {
      id: "administration",
      title: "SPRÁVA ARTales",
      hint: "Analytika a provoz",
      links: admin
        ? [
            { href: "/member/admin/dashboard", label: "Admin přehled" },
            { href: "/member/admin/payments", label: "QR platby" },
          ]
        : [],
    },
  ];

  function navLink(item: NavItem) {
    const active = isActivePath(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={[
          "artales-member-nav__link",
          active ? "artales-member-nav__link--active" : "",
        ].filter(Boolean).join(" ")}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <aside className="artales-member-sidebar">
      <p className="artales-member-sidebar__title">{member.zoneTitle}</p>
      <p className="artales-member-sidebar__subtitle">{member.zoneSubtitle}</p>

      <nav className="artales-member-nav" aria-label="Navigace interní zóny">
        {navLink({ href: "/member", label: member.overview })}

        {groups.filter((group) => group.links.length > 0).map((group) => (
          <section
            key={group.id}
            className={"artales-member-nav__group " + styles.section}
            aria-labelledby={"member-nav-" + group.id}
          >
            <div className={styles.sectionHeading}>
              <h2 id={"member-nav-" + group.id} className={styles.sectionTitle}>{group.title}</h2>
              <p className={styles.sectionHint}>{group.hint}</p>
            </div>
            {group.links.map(navLink)}
          </section>
        ))}

        <div className={"artales-member-nav__group " + styles.footer}>
          {navLink({ href: "/account", label: "Můj účet" })}
          {navLink({ href: "/gallery", label: member.publicGallery })}
        </div>
      </nav>
    </aside>
  );
}
