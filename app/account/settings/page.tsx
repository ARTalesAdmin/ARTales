import { requireCompletedAccountProfile } from "@/lib/account";
import { updateReaderPreferences } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AccountSettingsPage({ searchParams }: PageProps) {
  const profile = await requireCompletedAccountProfile("/account/settings");
  const { error, success } = await searchParams;

  return (
    <section className="artales-account-page artales-account-page--narrow">
      <p className="artales-account-kicker">Reader settings</p>
      <h1>Your reading defaults</h1>
      <p className="artales-account-lede">
        These settings prepare the future profile-backed reader preferences. The reader still keeps a local fallback on each device.
      </p>

      {error === "save" ? <p className="artales-account-alert">Reader settings could not be saved. Try again.</p> : null}
      {success === "settings" ? <p className="artales-account-success">Reader settings saved.</p> : null}

      <form action={updateReaderPreferences} className="artales-account-form">
        <label>
          <span>Preferred language</span>
          <select name="preferred_locale" defaultValue={profile.preferred_locale ?? "en"}>
            <option value="en">English</option>
            <option value="cs">Czech</option>
          </select>
        </label>

        <label>
          <span>Reader theme</span>
          <select name="reader_theme" defaultValue={profile.reader_theme ?? "light"}>
            <option value="light">Light</option>
            <option value="script">Script / warm paper</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label>
          <span>Reading width</span>
          <select name="reader_width" defaultValue={profile.reader_width ?? "normal"}>
            <option value="narrow">Narrow</option>
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
          </select>
        </label>

        <label>
          <span>Text density</span>
          <select name="reader_density" defaultValue={profile.reader_density ?? "comfortable"}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>

        <label>
          <span>Font scale</span>
          <input
            name="reader_font_scale"
            type="number"
            min="0.85"
            max="1.3"
            step="0.05"
            defaultValue={String(profile.reader_font_scale ?? 1)}
          />
        </label>

        <label className="artales-account-checkbox">
          <input
            name="reader_controls_collapsed"
            type="checkbox"
            defaultChecked={Boolean(profile.reader_controls_collapsed)}
          />
          <span>Keep detailed reader controls collapsed by default</span>
        </label>

        <button type="submit" className="artales-account-submit">Save reader settings</button>
      </form>
    </section>
  );
}
