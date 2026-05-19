import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { registerReader } from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Fill in your e-mail, handle, display name and password.";
    case "password_short":
      return "Password must have at least 8 characters.";
    case "handle":
      return "Handle must have 3–32 characters and can contain a-z, 0-9, _ or -.";
    case "signup":
      return "Registration failed. The e-mail or handle may already be used.";
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
          Register to keep reading beyond previews, save titles and prepare your
          personal living-books library.
        </p>

        {errorMessage ? (
          <p className="artales-auth-alert">{errorMessage}</p>
        ) : null}

        <form action={registerReader} className="artales-auth-form">
          <input type="hidden" name="next" value={next ?? ""} />

          <label>
            <span>E-mail</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>

          <label>
            <span>Handle</span>
            <input
              name="handle"
              type="text"
              required
              placeholder="reader-name"
            />
          </label>

          <label>
            <span>Display name</span>
            <input name="display_name" type="text" required />
          </label>

          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="new-password"
            />
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
