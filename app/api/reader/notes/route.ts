import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readerNoteColors } from "@/lib/reader/readerStorage";

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
  if (!user) return NextResponse.json({ signedIn: false, notes: [] });
  const { data, error } = await supabase.from("reader_notes").select("*")
    .eq("user_id", user.id).eq("work_slug", slug).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "notes_unavailable" }, { status: 503 });
  return NextResponse.json({ signedIn: true, notes: data });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const value = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!value || typeof value.id !== "string" || typeof value.slug !== "string") {
    return NextResponse.json({ error: "invalid_note" }, { status: 400 });
  }
  const color = readerNoteColors.includes(value.color as (typeof readerNoteColors)[number]) ? value.color : "gold";
  const layoutMode = typeof value.layoutMode === "string" && layouts.has(value.layoutMode) ? value.layoutMode : null;
  const row = {
    id: value.id,
    user_id: user.id,
    work_slug: value.slug.slice(0, 240),
    title: typeof value.title === "string" ? value.title.slice(0, 160) || null : null,
    body: typeof value.body === "string" ? value.body.slice(0, 4000) || null : null,
    color,
    progress_percent: Number(value.progressPercent) || 0,
    scroll_y: Number(value.scrollY) || 0,
    page_index: Number.isInteger(value.pageIndex) ? value.pageIndex : null,
    page_count: Number.isInteger(value.pageCount) ? value.pageCount : null,
    layout_mode: layoutMode,
    created_at: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    updated_at: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
  const { data, error } = await supabase.from("reader_notes").upsert(row, { onConflict: "id" }).select("*").single();
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 503 });
  return NextResponse.json({ note: data });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await supabase.from("reader_notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 503 });
  return NextResponse.json({ deleted: true });
}
