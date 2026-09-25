import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const layouts = new Set(["pagedFlow", "spread", "scroll", "page"]);

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ signedIn: false, progress: null });
  const { data, error } = await supabase.from("reader_progress").select("*")
    .eq("user_id", user.id).eq("work_slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: "progress_unavailable" }, { status: 503 });
  return NextResponse.json({ signedIn: true, progress: data });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const value = await request.json().catch(() => null) as Record<string, unknown> | null;
  const slug = typeof value?.slug === "string" ? value.slug.trim().slice(0, 240) : "";
  const progressPercent = Number(value?.progressPercent);
  const scrollY = Number(value?.scrollY);
  const updatedAt = typeof value?.updatedAt === "string" ? value.updatedAt : "";
  const updatedTime = Date.parse(updatedAt);
  if (!slug || !Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100 ||
    !Number.isFinite(scrollY) || !Number.isFinite(updatedTime)) {
    return NextResponse.json({ error: "invalid_progress" }, { status: 400 });
  }
  const layoutMode = typeof value?.layoutMode === "string" && layouts.has(value.layoutMode)
    ? value.layoutMode : null;
  const mode = value?.mode === "preview" || value?.mode === "full" ? value.mode : null;
  const row = {
    user_id: user.id,
    work_slug: slug,
    mode,
    progress_percent: progressPercent,
    scroll_y: scrollY,
    page_index: Number.isInteger(value?.pageIndex) && Number(value?.pageIndex) >= 0 ? value?.pageIndex : null,
    page_count: Number.isInteger(value?.pageCount) && Number(value?.pageCount) >= 0 ? value?.pageCount : null,
    layout_mode: layoutMode,
    updated_at: new Date(updatedTime).toISOString(),
  };

  // Reject a stale client write. RLS independently enforces ownership, and the
  // authenticated user id always comes from Supabase rather than the request.
  const { data: current, error: readError } = await supabase.from("reader_progress")
    .select("updated_at").eq("user_id", user.id).eq("work_slug", slug).maybeSingle();
  if (readError) return NextResponse.json({ error: "save_failed" }, { status: 503 });
  if (current && Date.parse(current.updated_at) > updatedTime) {
    return NextResponse.json({ saved: false, stale: true });
  }
  const { data, error } = await supabase.from("reader_progress").upsert(row, {
    onConflict: "user_id,work_slug",
  }).select("*").single();
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 503 });
  return NextResponse.json({ saved: true, progress: data });
}
