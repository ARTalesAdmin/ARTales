import { notFound } from "next/navigation";
import type { Metadata } from "next";
import RealPrescreenConsole from "@/components/admin/RealPrescreenConsole";
import { isPrescreenFixture } from "@/lib/prescreen/access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Prescreen — izolovaná fixture ARTales",
  robots: { index: false, follow: false },
};

/**
 * Standalone preview-only page. Deliberately outside /member because
 * MemberLayout requires an authenticated profile even in fixture mode.
 * In production or with a live Supabase connection this route is 404.
 */
export default function StandalonePrescreenFixturePage() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    notFound();
  }
  if (!isPrescreenFixture()) {
    notFound();
  }
  return <RealPrescreenConsole fixture />;
}
