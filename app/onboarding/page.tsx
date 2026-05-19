import Link from "next/link";
import ArtalesBrand from "@/components/brand/ArtalesBrand";
import { getCurrentProfile } from "@/lib/auth";
import { completeOnboarding } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Fill in your display name and handle.";
    case "handle":
      return "Handle must have 3–30 characters and can contain only a-z, 0-9, dot, underscore or hyphen.";
    case "handle_taken":
      return "This handle is already taken. Choose another one.";
    case "profile_upsert_failed":
    case "profile_missing_after_upsert":
      return "ARTales could not prepare your profile record. Try signing out and back in. If it repeats, contact an admin.";
    case "handle_check_failed":
      return "ARTales could not check handle availability. Try again.";
    case "profile_update_failed":
    case "profile_incomplete_after_update":
      return "Profile details could not be saved. Try again.";
    case "save":
      return "Profile could not be saved. Try again.";
    default:
      return null;
  }
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const { error, next } = await searchParams;
  const profile = await getCurrentProfile();
  const errorMessage = getErrorMessage(error);

  return (
    <main className="artales-auth-shell">
      <section className="artales-auth-card">
        <div className="artales-auth-card__brand">
          <ArtalesBrand href="/gallery" variant="light" size="md" showMark />
        </div>

        <p className="artales-auth-eyebrow">ARTales onboarding</p>
        <h1 className="artales-auth-title">Complete your profile</h1>
        <p className="artales-auth-lede">
          Your account is ready. Add the public name and handle that ARTales will
          use for your profile, library and future contribution records.
        </p>

        {errorMessage ? <p className="artales-auth-alert">{errorMessage}</p> : null}

        <form action={completeOnboarding} className="artales-auth-form">
          <input type="hidden" name="next" value={next ?? ""} />

          <label>
            <span>Display name</span>
            <input
              name="display_name"
              type="text"
              required
              defaultValue={profile?.display_name ?? ""}
              placeholder="Hana Žížlavská"
              autoComplete="name"
            />
            <small>
              Your visible name in ARTales. Spaces and diacritics are allowed.
            </small>
          </label>

          <label>
            <span>Handle</span>
            <input
              name="handle"
              type="text"
              required
              defaultValue={profile?.handle ?? ""}
              placeholder="hana-zizlavska"
              autoComplete="username"
            />
            <small>
              Unique short identifier for links and system records. Use 3–30
              characters: a-z, 0-9, dot, underscore or hyphen. No spaces or
              diacritics.
            </small>
          </label>

          <button type="submit" className="artales-auth-submit">
            Save profile
          </button>
        </form>

        <p className="artales-auth-note">
          Need to switch account? <Link href="/login">Sign in again</Link>.
        </p>
      </section>
    </main>
  );
}
