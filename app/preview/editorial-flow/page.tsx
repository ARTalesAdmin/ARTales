import { notFound } from "next/navigation";
import PublicHeader from "@/components/public/PublicHeader";
import EditorialFlowDemo from "@/components/editor/EditorialFlowDemo";
import { getEditorialFlowBook } from "./book";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function Page() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound();
  const book = getEditorialFlowBook();
  return <div className="artales-workspace-shell"><PublicHeader /><EditorialFlowDemo view="candidates" book={book} /></div>;
}
