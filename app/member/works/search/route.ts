import { NextRequest, NextResponse } from "next/server"
import { requireEditorOrAdmin } from "@/lib/guards"
import { searchWorksForMember } from "@/lib/dbWorks"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const profile = await requireEditorOrAdmin()
  const rawMode = request.nextUrl.searchParams.get("mode")
  const mode = rawMode === "mine" || rawMode === "review" ? rawMode : "all"

  const results = await searchWorksForMember(
    request.nextUrl.searchParams.get("q") ?? "",
    mode,
    profile.id,
  )

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
