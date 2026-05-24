import { requireCompletedAccountProfile } from "@/lib/account";
import { updateAccountProfile } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Fill in your display name and handle.";
    case "handle":
      return "Handle must have 3–30 characters and can contain only a-z, 0-9, dot, underscore or hyphen.";
    case "handle_taken":
      return "This handle is already taken. Choose another one.";
    case "handle_check":
      return "ARTales could not check handle availability. Try again.";
    case "save":
      return "Profile could not be saved. Try again.";
    default:
      return null;
  }
}

export default async function AccountProfilePage({ searchParams }: PageProps) {
  const profile = await requireCompletedAccountProfile("/account/profile");
  const { error, success } = await searchParams;
  const errorMessage = getErrorMessage(error);

  return (
    <section className="artales-account-page artales-account-page--narrow">
      <p className="artales-account-kicker">Profile</p>
      <h1>Your ARTales identity</h1>
      <p className="artales-account-lede">
        Edit the visible name and handle used by your reader account and future ARTales records.
      </p>

      {errorMessage ? <p className="artales-account-alert">{errorMessage}</p> : null}
      {success === "profile" ? <p className="artales-account-success">Profile saved.</p> : null}

      <form action={updateAccountProfile} className="artales-account-form">
        <label>
          <span>Display name</span>
          <input name="display_name" type="text" required defaultValue={profile.display_name ?? ""} />
          <small>Visible name. Spaces and diacritics are allowed.</small>
        </label>

        <label>
          <span>Handle</span>
          <input
            name="handle"
            type="text"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9._-]{3,30}"
            defaultValue={profile.handle ?? ""}
          />
          <small>Unique identifier. Use a-z, 0-9, dot, underscore or hyphen. No spaces or diacritics.</small>
        </label>

        <button type="submit" className="artales-account-submit">Save profile</button>
      </form>
    </section>
  );
}
