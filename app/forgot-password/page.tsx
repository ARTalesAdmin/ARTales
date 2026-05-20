import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { sendForgotPasswordEmail } from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Enter your e-mail address.";
    case "send":
      return "Password reset e-mail could not be sent. Try again later.";
    default:
      return null;
  }
}

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const { error, success } = await searchParams;
  const errorMessage = getErrorMessage(error);

  return (
    <main className="artales-auth-shell">
      <section className="artales-auth-card">
        <div className="artales-auth-card__brand">
          <ArtalesBrand href="/gallery" variant="light" size="md" showMark />
        </div>

        <p className="artales-auth-eyebrow">Account recovery</p>
        <h1 className="artales-auth-title">Forgot password</h1>
        <p className="artales-auth-lede">
          Enter your account e-mail and we will send password reset instructions.
        </p>

        {errorMessage ? (
          <p className="artales-auth-alert">{errorMessage}</p>
        ) : null}

        {success === "sent" ? (
          <p className="artales-auth-success">
            If an ARTales account exists for this e-mail, password reset
            instructions have been sent.
          </p>
        ) : null}

        <form action={sendForgotPasswordEmail} className="artales-auth-form">
          <label>
            <span>E-mail</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>

          <button type="submit" className="artales-auth-submit">
            Send reset link
          </button>
        </form>

        <p className="artales-auth-note">
          Remembered it? <Link href="/login">Sign in</Link>.
        </p>
      </section>
    </main>
  );
}
