import { notFound, redirect } from "next/navigation";
import ReaderClient from "@/components/reader/ReaderClient";
import { getWorkBySlug } from "@/lib/dbWorks";
import { getPreviewBlocks, getPreviewFallbackContent } from "@/lib/workPreview";
import { getCurrentProfile } from "@/lib/auth";
import { canOpenFullReader } from "@/lib/entitlements";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import {createClient} from "@/lib/supabase/server";
import SemanticPublicReader from "@/components/reader/SemanticPublicReader";
import {verifySemanticRevision} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";

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
  if (SEMANTIC_PIPELINE_ENABLED) {
  const db=await createClient();
  const {data:semanticRelease,error:semanticError}=await db.from("artales_semantic_publications")
    .select("candidate_id,semantic_revision,visual_manifest").eq("work_id",work.id).maybeSingle();
  if(semanticError)throw new Error("semantic_publication_registry_unavailable");
  if(semanticRelease?.semantic_revision){
    const revision=semanticRelease.semantic_revision as SemanticRevision;
    try {
      verifySemanticRevision(revision);
    } catch {
      // Never silently substitute legacy blocks for a corrupted semantic release.
      throw new Error("published_semantic_revision_invalid");
    }
    const {data:rules}=await db.from("artales_work_typography_rules")
      .select("term").eq("candidate_id",semanticRelease.candidate_id);
    return <SemanticPublicReader revision={revision} title={work.title} isPreview={isPreview}
      protectedTerms={(rules??[]).map(x=>x.term)}
      visuals={semanticRelease.visual_manifest??[]} locale={locale}/>;
  }
  }
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
