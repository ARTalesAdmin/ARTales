import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getWorkBySlug } from "@/lib/dbWorks";
import { canOpenFullReader, getWelcomeUnlockStatus } from "@/lib/entitlements";
import { normalizeRole } from "@/lib/permissions";
import { useWelcomeUnlock } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WelcomeUnlockPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const profile = await requireCompletedAccountProfile(`/account/unlock/${slug}`);
  const work = await getWorkBySlug(slug);

  if (!work) notFound();

  const role = normalizeRole(profile.role);
  const canReadFull = await canOpenFullReader(profile, work.id);

  if (canReadFull) {
    redirect(`/reader/${work.slug}?mode=full`);
  }

  const welcomeUnlock = await getWelcomeUnlockStatus(profile.id);
  const error = firstParam(resolvedSearchParams.error);

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">Welcome unlock</p>
      <h1>Use your welcome unlock?</h1>
      <p className="artales-account-lede">
        Your Free Reader account includes one welcome unlock. It permanently adds one title to your ARTales library for online reading.
      </p>

      {error ? (
        <div className="artales-account-notice artales-account-notice--error">
          The welcome unlock could not be used. It may already have been used, or your session expired.
        </div>
      ) : null}

      <section className="artales-account-panel">
        <p className="artales-account-card__label">Selected title</p>
        <h2>{work.title}</h2>
        <p>{work.author?.name ?? "Unknown author"}</p>
        {work.summary ? <p>{work.summary}</p> : null}
      </section>

      {role !== "reader" ? (
        <section className="artales-account-panel">
          <h2>Internal account</h2>
          <p>
            Internal roles have working access to full readers. Welcome unlocks are reserved for reader accounts.
          </p>
          <Link className="artales-button" href={`/reader/${work.slug}?mode=full`}>
            Open full reader
          </Link>
        </section>
      ) : welcomeUnlock.available ? (
        <section className="artales-account-panel artales-account-panel--decision">
          <h2>This is a one-time action</h2>
          <p>
            After confirmation, this title will be added to your online library and your welcome unlock will be marked as used. Going back will not change anything.
          </p>
          <form action={useWelcomeUnlock} className="artales-account-actions">
            <input type="hidden" name="slug" value={work.slug} />
            <input type="hidden" name="work_id" value={work.id} />
            <button className="artales-button" type="submit">
              Use unlock
            </button>
            <Link className="artales-button-secondary" href={`/work/${work.slug}`}>
              Go back
            </Link>
          </form>
        </section>
      ) : (
        <section className="artales-account-panel">
          <h2>Welcome unlock already used</h2>
          <p>
            This account has already used its one-time welcome unlock. Future access will come from membership, purchases, AT Credits or admin grants.
          </p>
          <div className="artales-account-actions">
            <Link className="artales-button" href="/account/library">
              Open my library
            </Link>
            <Link className="artales-button-secondary" href="/account/membership">
              View membership
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}
