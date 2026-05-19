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
      return "Account creation failed. The account was not created. Try again, or contact an admin if this repeats.";
    case "already_registered":
      return "This e-mail already has an ARTales account. Sign in with that account to accept or finish the invitation.";
    case "profile_sync":
      return "The account was created, but ARTales could not finish the invitation link. Sign in once, then try onboarding again. If this repeats, contact an admin.";
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
              the account first, then sign in to complete your display name and
              handle during onboarding.
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
              Already created this account? <Link href={`/login?next=${encodeURIComponent("/onboarding")}`}>Sign in to finish onboarding</Link>.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
