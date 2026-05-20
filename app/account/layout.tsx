import type { ReactNode } from "react";
import AccountNav from "@/components/account/AccountNav";
import { requireAccountProfile } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireAccountProfile();

  return (
    <div className="artales-account-shell">
      <AccountNav />
      <main className="artales-account-content">{children}</main>
    </div>
  );
}
