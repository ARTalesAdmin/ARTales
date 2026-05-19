import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { login } from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string; next?: string; success?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid":
      return "Invalid e-mail or password.";
    case "missing":
      return "Fill in both e-mail and password.";
    case "inactive":
      return "This account is currently inactive.";
    case "member_required":
      return "This area is available only to ARTales members, editors and admins.";
    case "register_required":
      return "Create a free ARTales account to continue.";
    case "confirm_email":
      return "Your e-mail address must be confirmed before signing in. Open the confirmation e-mail from ARTales/Supabase, confirm the account, then return here and sign in.";
    default:
      return null;
  }
}

function getSuccessMessage(success?: string) {
  switch (success) {
    case "registered":
      return "Account created. Check your e-mail inbox for the confirmation link. After confirming the account, return here and sign in.";
    case "invite_created":
      return "Account created from invitation. Sign in to finish onboarding.";
    case "check_email_invite":
      return "Account created from invitation. Check your e-mail inbox, confirm the account, then sign in here to finish onboarding.";
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error, next, success } = await searchParams;
  const errorMessage = getErrorMessage(error);
  const successMessage = getSuccessMessage(success);

  return (
    <main className="artales-auth-shell">
      <section className="artales-auth-card">
        <div className="artales-auth-card__brand">
          <ArtalesBrand href="/gallery" variant="light" size="md" showMark />
        </div>

        <p className="artales-auth-eyebrow">ARTales access</p>
        <h1 className="artales-auth-title">Sign in</h1>
        <p className="artales-auth-lede">
          Enter your reader account, member workspace or editorial layer.
        </p>

        {errorMessage ? (
          <p className="artales-auth-alert">{errorMessage}</p>
        ) : null}

        {successMessage ? (
          <p className="artales-auth-success">{successMessage}</p>
        ) : null}

        <form action={login} className="artales-auth-form">
          <input type="hidden" name="next" value={next ?? ""} />

          <label>
            <span>E-mail</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>

          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="artales-auth-submit">
            Sign in
          </button>
        </form>

        <p className="artales-auth-note">
          New reader? <Link href="/register">Create a free account</Link>.
        </p>

        <p className="artales-auth-note artales-auth-note--muted">
          Member and editor access may require an invitation.
        </p>
      </section>
    </main>
  );
}
