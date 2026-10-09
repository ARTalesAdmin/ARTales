import { requireEditorOrAdmin } from "@/lib/guards";
import IngestFixtureLab from "@/components/editor/IngestFixtureLab";

export const dynamic = "force-dynamic";

export default async function IngestFixtureLabPage() {
  await requireEditorOrAdmin();
  return <IngestFixtureLab />;
}
