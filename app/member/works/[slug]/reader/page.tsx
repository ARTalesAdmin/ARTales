import { notFound } from "next/navigation";
import ReaderClient from "@/components/reader/ReaderClient";
import { requireEditorOrAdmin } from "@/lib/guards";
import { getWorkForEditBySlug } from "@/lib/dbWorks";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function InternalWorkReaderPage({ params }: PageProps) {
  const profile = await requireEditorOrAdmin();
  const { slug } = await params;
  const work = await getWorkForEditBySlug(slug);

  if (!work) {
    notFound();
  }

  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);

  return (
    <>
      <div
        role="status"
        style={{
          position: "fixed",
          top: "10px",
          left: "50%",
          zIndex: 100,
          transform: "translateX(-50%)",
          padding: "7px 12px",
          borderRadius: "999px",
          background: "rgba(18, 16, 14, 0.9)",
          color: "#fff",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          pointerEvents: "none",
        }}
      >
        Interní náhled · {work.status}
      </div>
      <ReaderClient
        slug={work.slug}
        title={work.title_cs || work.title_en || work.title}
        mode="full"
        blocks={work.content_blocks}
        fallbackContent={work.content}
        locale={locale}
        editorPreview
        editorReturnHref={`/member/works/${work.slug}/edit`}
      />
    </>
  );
}
