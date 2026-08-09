import { requireAccountProfile } from "@/lib/account";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import {
  changeAccountPassword,
  sendAccountPasswordReset,
} from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AccountSecurityPage({ searchParams }: PageProps) {
  const profile = await requireAccountProfile();
  const { error, success } = await searchParams;
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.security;
  const errorMessages: Record<string, string> = {
    missing: dictionary.errors.missing,
    mismatch: dictionary.errors.mismatch,
    short: dictionary.errors.short,
    save: dictionary.errors.save,
    reset_send: dictionary.errors.resetSend,
  };
  const successMessages: Record<string, string> = {
    password: dictionary.success.password,
    reset_sent: dictionary.success.resetSent,
  };
  const errorMessage = error ? errorMessages[error] : null;
  const successMessage = success ? successMessages[success] : null;

  return (
    <section className="artales-account-page artales-account-page--narrow">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      {errorMessage ? <p className="artales-account-alert">{errorMessage}</p> : null}
      {successMessage ? (
        <p className="artales-account-success">{successMessage}</p>
      ) : null}

      <form action={changeAccountPassword} className="artales-account-form">
        <div>
          <h2>{dictionary.changePassword}</h2>
          <p>{dictionary.signedInHelp}</p>
        </div>

        <label>
          <span>{dictionary.newPassword}</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <small>{dictionary.passwordHelp}</small>
        </label>

        <label>
          <span>{dictionary.confirmPassword}</span>
          <input
            name="password_confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        <button type="submit" className="artales-account-submit">
          {dictionary.changePassword}
        </button>
      </form>

      <section className="artales-account-panel artales-account-panel--spaced">
        <h2>{dictionary.resetTitle}</h2>
        <p>{dictionary.resetHelp}</p>
        <form action={sendAccountPasswordReset}>
          <button type="submit" className="artales-account-submit">
            {dictionary.sendReset}
          </button>
        </form>
      </section>
    </section>
  );
}
