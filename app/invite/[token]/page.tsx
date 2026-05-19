import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { getInviteByToken } from "@/lib/dbInvites";
import { registerFromInvite } from "@/lib/actions/invites";

export const dynamic = "force-dynamic";

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
      return "Use the invited e-mail address and enter a password.";
    case "password_short":
      return "Password must have at least 8 characters.";
    case "signup":
      return "Account creation failed. The e-mail may already be registered. If the account exists, use Sign in instead.";
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

        {errorMessage ? <p className="artales-auth-alert">{errorMessage}</p> : null}

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
              You were invited as <strong>{invite.invited_role}</strong>. Create
              the account first; profile details such as display name and handle
              are completed during onboarding after sign-in.
            </p>

            <form
              action={registerFromInvite.bind(null, token)}
              className="artales-auth-form"
            >
              <label>
                <span>Invited e-mail</span>
                <input
                  name="email"
                  type="email"
                  required
                  readOnly
                  defaultValue={invite.email}
                  autoComplete="email"
                />
                <small>
                  This invite is bound to this e-mail address. Use it when
                  signing in later.
                </small>
              </label>

              <label>
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <small>Use at least 8 characters.</small>
              </label>

              <button type="submit" className="artales-auth-submit">
                Create account from invitation
              </button>
            </form>

            <p className="artales-auth-note">
              Already created the account or confirmed the e-mail? <Link href="/login">Sign in</Link>.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
