import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { getInviteByToken } from "@/lib/dbInvites";
import { registerFromInvite } from "@/lib/actions/invites";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid":
      return "This invitation is not valid anymore.";
    case "expired":
      return "This invitation has expired.";
    case "missing":
      return "Fill in all required fields.";
    case "password_short":
      return "Password must have at least 8 characters.";
    case "handle":
      return "Handle must have 3–32 characters and can contain a-z, 0-9, _ or -.";
    case "signup":
      return "Account creation failed.";
    default:
      return null;
  }
}

export default async function InvitePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await getInviteByToken(token);
  const errorMessage = getErrorMessage(error);
  const inviteInvalid = !invite || invite.status !== "pending";

  return (
    <main className="artales-auth-shell">
      <section className="artales-auth-card">
        <div className="artales-auth-card__brand">
          <ArtalesBrand href="/gallery" variant="light" size="md" showMark />
        </div>

        <p className="artales-auth-eyebrow">ARTales invitation</p>
        <h1 className="artales-auth-title">Accept invitation</h1>

        {errorMessage ? (
          <p className="artales-auth-alert">{errorMessage}</p>
        ) : null}

        {inviteInvalid ? (
          <>
            <p className="artales-auth-lede">
              This invitation is no longer available.
            </p>
            <p className="artales-auth-note">
              <Link href="/gallery">Back to Gallery</Link>
            </p>
          </>
        ) : (
          <>
            <p className="artales-auth-lede">
              You were invited as <strong>{invite.invited_role}</strong>. Use
              the e-mail address below and create your ARTales account.
            </p>

            <form
              action={registerFromInvite.bind(null, token)}
              className="artales-auth-form"
            >
              <label>
                <span>E-mail</span>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={invite.email}
                />
              </label>
              <label>
                <span>Handle</span>
                <input
                  name="handle"
                  type="text"
                  required
                  placeholder="name-surname"
                />
              </label>
              <label>
                <span>Display name</span>
                <input name="display_name" type="text" required />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" required />
              </label>
              <button type="submit" className="artales-auth-submit">
                Create account
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
