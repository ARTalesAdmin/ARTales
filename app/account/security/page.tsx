import {
  changeAccountPassword,
  sendAccountPasswordReset,
} from "./actions";

const errorMessages: Record<string, string> = {
  missing: "Fill in the new password and its confirmation.",
  mismatch: "The passwords do not match.",
  short: "Password must have at least 8 characters.",
  save: "Password could not be changed. Try again.",
  reset_send: "Password reset e-mail could not be sent. Try again later.",
};

const successMessages: Record<string, string> = {
  password: "Password was changed.",
  reset_sent: "Password reset e-mail was sent. Check your inbox.",
};

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AccountSecurityPage({ searchParams }: PageProps) {
  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] : null;
  const successMessage = success ? successMessages[success] : null;

  return (
    <section className="artales-account-page artales-account-page--narrow">
      <p className="artales-account-kicker">Account security</p>
      <h1>Security</h1>
      <p className="artales-account-lede">
        Change your password or request a reset e-mail. This is the single
        security area for reader, member, editor and admin accounts.
      </p>

      {errorMessage ? <p className="artales-account-alert">{errorMessage}</p> : null}
      {successMessage ? (
        <p className="artales-account-success">{successMessage}</p>
      ) : null}

      <form action={changeAccountPassword} className="artales-account-form">
        <div>
          <h2>Change password</h2>
          <p>
            You are already signed in, so you can set a new password directly.
          </p>
        </div>

        <label>
          <span>New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <small>Password must have at least 8 characters.</small>
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

        <button type="submit" className="artales-account-submit">
          Change password
        </button>
      </form>

      <section className="artales-account-panel artales-account-panel--spaced">
        <h2>Password reset e-mail</h2>
        <p>
          Use this if you want a standard reset link sent to your account e-mail
          address. The link will bring you back to ARTales to set a new password.
        </p>
        <form action={sendAccountPasswordReset}>
          <button type="submit" className="artales-account-submit">
            Send reset e-mail
          </button>
        </form>
      </section>
    </section>
  );
}
