import type { ReactNode } from "react"
import MemberZoneNav from "@/components/member/MemberZoneNav"

export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="artales-member-shell">
      <div className="artales-member-layout">
        <MemberZoneNav />
        <div className="artales-member-content">{children}</div>
      </div>
    </div>
  )
}
