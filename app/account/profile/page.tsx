import { requireCompletedAccountProfile } from "@/lib/account";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { updateAccountProfile } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

type ProfileErrors = ReturnType<typeof getPublicDictionary>["account"]["profile"]["errors"];

function getErrorMessage(error: string | undefined, messages: ProfileErrors) {
  switch (error) {
    case "missing":
      return messages.missing;
    case "handle":
      return messages.handle;
    case "handle_taken":
      return messages.handleTaken;
    case "handle_check":
      return messages.handleCheck;
    case "save":
      return messages.save;
    default:
      return null;
  }
}

export default async function AccountProfilePage({ searchParams }: PageProps) {
  const profile = await requireCompletedAccountProfile("/account/profile");
  const { error, success } = await searchParams;
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.profile;
  const errorMessage = getErrorMessage(error, dictionary.errors);

  return (
    <section className="artales-account-page artales-account-page--narrow">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      {errorMessage ? <p className="artales-account-alert">{errorMessage}</p> : null}
      {success === "profile" ? <p className="artales-account-success">{dictionary.saveSuccess}</p> : null}

      <form action={updateAccountProfile} className="artales-account-form">
        <label>
          <span>{dictionary.displayName}</span>
          <input name="display_name" type="text" required defaultValue={profile.display_name ?? ""} />
          <small>{dictionary.displayNameHelp}</small>
        </label>

        <label>
          <span>{dictionary.handle}</span>
          <input
            name="handle"
            type="text"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9._-]{3,30}"
            defaultValue={profile.handle ?? ""}
          />
          <small>{dictionary.handleHelp}</small>
        </label>

        <button type="submit" className="artales-account-submit">{dictionary.save}</button>
      </form>
    </section>
  );
}
