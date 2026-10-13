import { notFound } from "next/navigation";
import EditorialFlowDemo from "@/components/editor/EditorialFlowDemo";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
/** Synthetic, preview-only, never a real editorial task or rights release. */
export default function Page() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound();
  return <EditorialFlowDemo view="review" />;
}
