import { NextRequest, NextResponse } from "next/server"
import { requireEditorOrAdmin } from "@/lib/guards"
import { searchWorksForMember } from "@/lib/dbWorks"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  await requireEditorOrAdmin()

  const results = await searchWorksForMember(
    request.nextUrl.searchParams.get("q") ?? "",
  )

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
