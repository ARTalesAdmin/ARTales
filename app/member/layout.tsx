import type { ReactNode } from "react";
import PublicHeader from "@/components/public/PublicHeader";
import MemberZoneNav from "@/components/member/MemberZoneNav";
import { requireMemberZoneAccess } from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireMemberZoneAccess();
  const db=await createClient();
  const count=(profile.role==="admin"||profile.role==="editor")
    ?await db.from("artales_editorial_tasks")
      .select("id",{head:true,count:"exact"}).eq("assigned_to",profile.id)
      .in("status",["open","claimed","returned"])
    :null;
  const assignedOpenCount=count?.error?0:(count?.count??0);

  return (
    <div className="artales-workspace-shell">
      <PublicHeader />
      <div className="artales-member-shell artales-member-shell--embedded">
        <div className="artales-member-layout">
          <MemberZoneNav role={profile.role} assignedOpenCount={assignedOpenCount}/>
          <div className="artales-member-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
