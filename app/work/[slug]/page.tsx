import Link from "next/link";
import { getWorkBySlug } from "@/lib/dbWorks";
import WorkDetailClient from "@/components/work/WorkDetailClient";
import PublicHeader from "@/components/public/PublicHeader";
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

function getSourceLabel(sourceLabel: string, labels: ReturnType<typeof getPublicDictionary>["public"]) {
  switch (sourceLabel) {
    case "gutenberg":
      return "Project Gutenberg";
    case "web":
      return labels.sourceWeb;
    case "manual":
      return labels.sourceManual;
    case "original":
      return labels.sourceOriginal;
    default:
      return sourceLabel;
  }
}

export default async function WorkDetail({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { feedback } = searchParams ? await searchParams : {};
  const [work, profile, cookieLocale] = await Promise.all([
    getWorkBySlug(slug),
    getCurrentProfile(),
    getCookieLocale(),
  ]);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const { public: publicLabels } = getPublicDictionary(locale);

  if (!work) {
    return (
      <div className="artales-public-shell">
        <PublicHeader active="work" />
        <main className="artales-public-main">
          <h1>{publicLabels.workNotFoundTitle}</h1>
          <p>{publicLabels.workNotFoundText}</p>
          <p>
            <Link href="/gallery">{publicLabels.backToGallery}</Link>
          </p>
        </main>
      </div>
    );
  }

  const languageLabel =
    getLanguageLabel(work.canonical_language, "public") ??
    work.canonical_language;
  const statusLabel = getStatusLabel(work.status, "public") ?? work.status;
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
      sourceLabel={getSourceLabel(work.source_label, publicLabels)}
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
