import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { registerReader } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Fill in your e-mail and password.";
    case "password_short":
      return "Password must have at least 8 characters.";
    case "signup":
      return "Registration failed. The e-mail may already be used.";
    default:
      return null;
  }
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { error, next } = await searchParams;
  const errorMessage = getErrorMessage(error);

  return (
    <main className="artales-auth-shell">
      <section className="artales-auth-card">
        <div className="artales-auth-card__brand">
          <ArtalesBrand href="/gallery" variant="light" size="md" showMark />
        </div>

        <p className="artales-auth-eyebrow">Free reader account</p>
        <h1 className="artales-auth-title">Create your ARTales account</h1>
        <p className="artales-auth-lede">
          Create the account first. Your display name, handle and reader
          preferences are completed during onboarding after your first sign-in.
        </p>

        {errorMessage ? <p className="artales-auth-alert">{errorMessage}</p> : null}

        <form action={registerReader} className="artales-auth-form">
          <input type="hidden" name="next" value={next ?? ""} />

          <label>
            <span>E-mail</span>
            <input name="email" type="email" required autoComplete="email" />
            <small>Use the e-mail address you want to use for ARTales login.</small>
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
            Create free account
          </button>
        </form>

        <p className="artales-auth-note">
          Already have an account? <Link href="/login">Sign in</Link>.
        </p>
      </section>
    </main>
  );
}
