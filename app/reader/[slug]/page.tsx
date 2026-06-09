import { notFound, redirect } from "next/navigation";
import ReaderClient from "@/components/reader/ReaderClient";
import { getWorkBySlug } from "@/lib/dbWorks";
import { getPreviewBlocks, getPreviewFallbackContent } from "@/lib/workPreview";
import { getCurrentProfile } from "@/lib/auth";
import { canOpenFullReader } from "@/lib/entitlements";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";

type ReaderPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  params,
  searchParams,
}: ReaderPageProps) {
  const { slug } = await params;
  const { mode } = await searchParams;
  const work = await getWorkBySlug(slug);

  if (!work) {
    notFound();
  }

  const readerMode = mode === "full" ? "full" : "preview";
  const profile = await getCurrentProfile();
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);

  const canOpenFull = await canOpenFullReader(profile, work.id);

  if (readerMode === "full" && !canOpenFull) {
    const target = profile
      ? `/work/${work.slug}?access=membership_required`
      : `/login?error=register_required&next=${encodeURIComponent(`/reader/${work.slug}?mode=full`)}`;
    redirect(target);
  }

  const isPreview = readerMode === "preview";
  const blocks = isPreview
    ? getPreviewBlocks(work.content_blocks)
    : work.content_blocks;
  const fallbackContent = isPreview
    ? getPreviewFallbackContent(work.content)
    : work.content;

  return (
    <ReaderClient
      slug={work.slug}
      title={work.title}
      authorName={work.author?.name ?? null}
      mode={readerMode}
      blocks={blocks}
      fallbackContent={fallbackContent}
      locale={locale}
    />
  );
}
