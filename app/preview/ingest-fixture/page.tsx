import { notFound } from "next/navigation";
import IngestFixtureLab from "@/components/editor/IngestFixtureLab";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Public only in nonproduction preview, and only for synthetic fixture data. */
export default function IngestFixturePreviewPage() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <IngestFixtureLab />;
}
