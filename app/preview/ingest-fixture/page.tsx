import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import IngestFixtureLab from "@/components/editor/IngestFixtureLab";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Nonproduction-only synthetic fixture. Profile read is optional and read-only. */
export default async function IngestFixturePreviewPage() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    notFound();
  }
  const profile = await getCurrentProfile();
  return <IngestFixtureLab profileReaderDefaults={profile ? {
    reader_theme: profile.reader_theme,
    reader_width: profile.reader_width,
    reader_density: profile.reader_density,
    reader_font_scale: profile.reader_font_scale,
  } : null} />;
}
