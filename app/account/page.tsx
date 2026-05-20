import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getShortDisplayName } from "@/lib/displayName";
import { logoutFromAccount } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await requireCompletedAccountProfile("/account");
  const shortName = getShortDisplayName(profile);

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">ARTales reader account</p>
      <h1>Welcome, {shortName}</h1>
      <p className="artales-account-lede">
        Your personal ARTales space for reading, saved titles, reader settings
        and future membership tools.
      </p>

      <form action={logoutFromAccount} className="artales-account-logout">
        <button type="submit" className="artales-button-secondary">
          Sign out
        </button>
      </form>

      <div className="artales-account-grid">
        <article className="artales-account-card artales-account-card--featured">
          <p className="artales-account-card__label">Current role</p>
          <h2>{profile.role}</h2>
          <p>
            You are signed in as a registered ARTales reader. Full membership,
            credits and purchases will connect here in the commerce layer.
          </p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Library</p>
          <h2>My works</h2>
          <p>
            Saved works, unlocked titles and downloads will live in your
            library.
          </p>
          <Link href="/account/library">Open library</Link>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Profile</p>
          <h2>@{profile.handle}</h2>
          <p>
            Edit your display name and handle used by ARTales reader and future
            contribution records.
          </p>
          <Link href="/account/profile">Edit profile</Link>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Reader settings</p>
          <h2>Comfort first</h2>
          <p>
            Set your default theme, width, density and collapsed controls
            preference.
          </p>
          <Link href="/account/settings">Open settings</Link>
        </article>
      </div>
    </section>
  );
}
