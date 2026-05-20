import type { ReactNode } from "react";
import PublicHeader from "@/components/public/PublicHeader";
import AccountNav from "@/components/account/AccountNav";
import { requireAccountProfile } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireAccountProfile();

  return (
    <div className="artales-app-shell">
      <PublicHeader />
      <div className="artales-account-shell artales-account-shell--embedded">
        <AccountNav profile={profile} />
        <main className="artales-account-content">{children}</main>
      </div>
    </div>
  );
}
