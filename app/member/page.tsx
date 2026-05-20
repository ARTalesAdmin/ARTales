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
        ARTales workspace
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
        Welcome, {name}
      </h1>
      <p style={{ color: "#4d4238", fontSize: "1.08rem", lineHeight: 1.65 }}>
        This is the internal ARTales workspace. Personal identity, password,
        reader settings, purchases and future membership tools are managed in
        My account.
      </p>

      <section
        className="artales-member-panel"
        style={{ marginTop: 28, padding: 24 }}
      >
        <h2 style={{ marginTop: 0 }}>Personal account</h2>
        <p>
          Signed in as <strong>{profile?.display_name ?? name}</strong>
          {profile?.handle ? <> / @{profile.handle}</> : null}. Change your
          profile, password and reader settings in the account area.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="artales-button-primary" href="/account">
            Open My account
          </Link>
          <Link className="artales-button-secondary" href="/account/security">
            Security settings
          </Link>
        </div>
      </section>

      <section
        className="artales-member-panel"
        style={{ marginTop: 22, padding: 24 }}
      >
        <h2 style={{ marginTop: 0 }}>Workspace tools</h2>
        <p>
          Review incoming work, manage invitations and continue editorial tasks
          according to your role.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="artales-button-secondary" href="/member/submissions">
            Submissions
          </Link>
          <Link className="artales-button-secondary" href="/member/invites">
            Invites
          </Link>
          {canEditContent ? (
            <>
              <Link className="artales-button-secondary" href="/member/works">
                Works
              </Link>
              <Link className="artales-button-secondary" href="/member/authors">
                Authors
              </Link>
              <Link
                className="artales-button-secondary"
                href="/member/collections"
              >
                Collections
              </Link>
            </>
          ) : null}
        </div>
      </section>

      <form action={logout} style={{ marginTop: 28 }}>
        <button type="submit" className="artales-button-secondary">
          Sign out
        </button>
      </form>
    </main>
  );
}
