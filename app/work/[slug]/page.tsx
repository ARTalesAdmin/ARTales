import Link from "next/link";
import { getWorkBySlug } from "@/lib/dbWorks";
import WorkDetailClient from "@/components/work/WorkDetailClient";
import { getLanguageLabel } from "@/lib/dictionaries/language";
import { getStatusLabel } from "@/lib/dictionaries/status";
import { getCurrentProfile } from "@/lib/auth";
import { canOpenFullReader, getWelcomeUnlockStatus, isWorkSavedForUser } from "@/lib/entitlements";
import { getWorkProductOffers } from "@/lib/products";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function getOriginLabel(originType: string) {
  switch (originType) {
    case "public_domain":
      return "Public domain edition";
    case "original":
      return "Original work";
    case "translation":
      return "Translation";
    case "other":
      return "Literary edition";
    default:
      return "Literary work";
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

export default async function WorkDetail({ params }: PageProps) {
  const { slug } = await params;
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
      originLabel={getOriginLabel(work.origin_type)}
      sourceLabel={getSourceLabel(work.source_label)}
      canReadFull={canOpenFull}
      workId={work.id}
      isSignedIn={Boolean(profile)}
      isSaved={isSaved}
      welcomeUnlockAvailable={!canOpenFull && welcomeUnlock.available}
      products={products}
    />
  );
}
