import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { getShortDisplayName } from "@/lib/displayName";
import { logout } from "./actions";

export default async function MemberPage() {
  const profile = await getCurrentProfile();
  const name = getShortDisplayName(profile);
  const role = String(profile?.role ?? "member");
  const canEditContent = role === "editor" || role === "admin";

  return (
    <main
      style={{
        padding: "clamp(24px, 5vw, 56px)",
        maxWidth: "1120px",
        margin: "0 auto",
      }}
    >
      <p
        style={{
          color: "#8a641f",
          fontSize: "0.78rem",
          fontWeight: 900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        ARTales · interní zóna
      </p>
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(2.4rem, 6vw, 4.6rem)",
          letterSpacing: "-0.055em",
          lineHeight: 0.98,
          margin: "0 0 16px",
        }}
      >
        Vítej, {name}
      </h1>
      <p style={{ color: "#4d4238", fontSize: "1.08rem", lineHeight: 1.65 }}>
        Tohle je pracovní prostředí ARTales. Osobní identita, heslo, čtenářská
        nastavení, budoucí nákupy a členství se spravují v osobním účtu.
      </p>

      <section
        className="artales-member-panel"
        style={{ marginTop: 28, padding: 24 }}
      >
        <h2 style={{ marginTop: 0 }}>Osobní účet</h2>
        <p>
          Přihlášený účet: <strong>{profile?.display_name ?? name}</strong>
          {profile?.handle ? <> / @{profile.handle}</> : null}. Profil, heslo a
          čtenářská nastavení upravuj v osobním účtu.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="artales-button-primary" href="/account">
            Otevřít můj účet
          </Link>
          <Link className="artales-button-secondary" href="/account/security">
            Zabezpečení účtu
          </Link>
        </div>
      </section>

      <section
        className="artales-member-panel"
        style={{ marginTop: 22, padding: 24 }}
      >
        <h2 style={{ marginTop: 0 }}>Pracovní nástroje</h2>
        <p>
          Zpracuj příspěvky, spravuj pozvánky a pokračuj v editorských úkolech
          podle své role.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="artales-button-secondary" href="/member/submissions">
            Příspěvky
          </Link>
          <Link className="artales-button-secondary" href="/member/invites">
            Pozvánky
          </Link>
          <Link className="artales-button-secondary" href="/member/entitlements">
            Nároky čtenářů
          </Link>
          {role === "admin" ? (
            <Link className="artales-button-secondary" href="/member/admin/dashboard">
              Admin přehled
            </Link>
          ) : null}
          {canEditContent ? (
            <>
              <Link className="artales-button-secondary" href="/member/works">
                Díla
              </Link>
              <Link className="artales-button-secondary" href="/member/authors">
                Autoři
              </Link>
              <Link
                className="artales-button-secondary"
                href="/member/collections"
              >
                Kolekce
              </Link>
            </>
          ) : null}
        </div>
      </section>

      <form action={logout} style={{ marginTop: 28 }}>
        <button type="submit" className="artales-button-secondary">
          Odhlásit se
        </button>
      </form>
    </main>
  );
}
