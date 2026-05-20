import type { ReactNode } from "react";
import PublicHeader from "@/components/public/PublicHeader";
import MemberZoneNav from "@/components/member/MemberZoneNav";
import { requireMemberZoneAccess } from "@/lib/guards";

export const dynamic = "force-dynamic";

export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireMemberZoneAccess();

  return (
    <div className="artales-workspace-shell">
      <PublicHeader />
      <div className="artales-member-shell artales-member-shell--embedded">
        <div className="artales-member-layout">
          <MemberZoneNav />
          <div className="artales-member-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
