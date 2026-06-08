import Link from "next/link";
import { getWorkBySlug } from "@/lib/dbWorks";
import WorkDetailClient from "@/components/work/WorkDetailClient";
import { getLanguageLabel } from "@/lib/dictionaries/language";
import { getStatusLabel } from "@/lib/dictionaries/status";
import { getCurrentProfile } from "@/lib/auth";
import { canOpenFullReader, getWelcomeUnlockStatus, isWorkSavedForUser } from "@/lib/entitlements";
import { getWorkProductOffers } from "@/lib/products";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { getPublicDictionary } from "@/lib/i18n/public";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ feedback?: string }>;
};

function getOriginLabel(originType: string, labels: ReturnType<typeof getPublicDictionary>["public"]) {
  switch (originType) {
    case "public_domain":
      return labels.publicDomain;
    case "original":
      return labels.original;
    case "translation":
      return labels.translation;
    case "other":
      return labels.otherLayer;
    default:
      return labels.literaryWork;
  }
}

function getSourceLabel(sourceLabel: string) {
  switch (sourceLabel) {
    case "gutenberg":
      return "Project Gutenberg";
    case "web":
      return "Web source";
    case "manual":
      return "Manual editorial input";
    case "original":
      return "Original source";
    default:
      return sourceLabel;
  }
}

export default async function WorkDetail({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { feedback } = searchParams ? await searchParams : {};
  const work = await getWorkBySlug(slug);

  if (!work) {
    return (
      <main style={{ padding: "40px", fontFamily: "serif" }}>
        <h1>Work not found</h1>
        <p>
          The requested ARTales work does not exist or is not publicly available
          yet.
        </p>
        <p>
          <Link href="/gallery">Back to Gallery</Link>
        </p>
      </main>
    );
  }

  const languageLabel =
    getLanguageLabel(work.canonical_language, "public") ??
    work.canonical_language;
  const statusLabel = getStatusLabel(work.status, "public") ?? work.status;
  const profile = await getCurrentProfile();
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);
  const publicLabels = getPublicDictionary(locale).public;
  const canOpenFull = await canOpenFullReader(profile, work.id);
  const welcomeUnlock = profile && profile.role === "reader" ? await getWelcomeUnlockStatus(profile.id) : { available: false, used: false };
  const [isSaved, products] = await Promise.all([
    profile ? isWorkSavedForUser(profile.id, work.id) : Promise.resolve(false),
    getWorkProductOffers(work.id),
  ]);

  return (
    <WorkDetailClient
      work={work}
      languageLabel={languageLabel}
      statusLabel={statusLabel}
      originLabel={getOriginLabel(work.origin_type, publicLabels)}
      sourceLabel={getSourceLabel(work.source_label)}
      canReadFull={canOpenFull}
      workId={work.id}
      isSignedIn={Boolean(profile)}
      isSaved={isSaved}
      welcomeUnlockAvailable={!canOpenFull && welcomeUnlock.available}
      products={products}
      viewerRole={profile?.role ?? null}
      feedbackStatus={feedback ?? null}
      locale={locale}
    />
  );
}
