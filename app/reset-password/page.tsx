import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { resetPassword } from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Fill in the new password and its confirmation.";
    case "mismatch":
      return "The passwords do not match.";
    case "short":
      return "Password must have at least 8 characters.";
    case "session":
      return "The reset session is missing or expired. Request a new password reset e-mail.";
    case "save":
      return "Password could not be changed. Request a new reset link and try again.";
    default:
      return null;
  }
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const errorMessage = getErrorMessage(error);

  return (
    <main className="artales-auth-shell">
      <section className="artales-auth-card">
        <div className="artales-auth-card__brand">
          <ArtalesBrand href="/gallery" variant="light" size="md" showMark />
        </div>

        <p className="artales-auth-eyebrow">Account recovery</p>
        <h1 className="artales-auth-title">Reset password</h1>
        <p className="artales-auth-lede">
          Choose a new password for your ARTales account.
        </p>

        {errorMessage ? (
          <p className="artales-auth-alert">{errorMessage}</p>
        ) : null}

        <form action={resetPassword} className="artales-auth-form">
          <label>
            <span>New password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>

          <label>
            <span>Confirm new password</span>
            <input
              name="password_confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>

          <button type="submit" className="artales-auth-submit">
            Save new password
          </button>
        </form>

        <p className="artales-auth-note">
          Need a new link? <Link href="/forgot-password">Request password reset</Link>.
        </p>
      </section>
    </main>
  );
}
