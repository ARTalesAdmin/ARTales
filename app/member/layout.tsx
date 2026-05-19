import type { ReactNode } from "react";
import MemberZoneNav from "@/components/member/MemberZoneNav";
import { requireMemberZoneAccess } from "@/lib/guards";

export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireMemberZoneAccess();

  return (
    <div className="artales-member-shell">
      <div className="artales-member-layout">
        <MemberZoneNav />
        <div className="artales-member-content">{children}</div>
      </div>
    </div>
  );
}
