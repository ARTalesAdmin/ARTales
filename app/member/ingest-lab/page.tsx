import { requireEditorOrAdmin } from "@/lib/guards";
import IngestFixtureLab from "@/components/editor/IngestFixtureLab";

export const dynamic = "force-dynamic";

export default async function IngestFixtureLabPage() {
  const profile = await requireEditorOrAdmin();
  return <IngestFixtureLab profileReaderDefaults={{
    reader_theme: profile.reader_theme,
    reader_width: profile.reader_width,
    reader_density: profile.reader_density,
    reader_font_scale: profile.reader_font_scale,
  }} />;
}
