import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { classifyPageView } from "@/lib/analytics";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const path = String(body.path ?? "").slice(0, 500);
    const sessionId = body.sessionId ? String(body.sessionId).slice(0, 120) : null;
    const referrer = body.referrer ? String(body.referrer).slice(0, 500) : null;

    if (!path || path.startsWith("/api/")) {
      return NextResponse.json({ ok: true });
    }

    const classification = classifyPageView(path);
    if (classification.eventType === "api_ignored") {
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const admin = createAdminClient();

    await admin.from("page_views").insert({
      session_id: sessionId,
      user_id: authData.user?.id ?? null,
      path,
      referrer,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      environment: classification.environment,
      event_type: classification.eventType,
      entity_type: classification.entityType,
      entity_slug: classification.entitySlug,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Page view tracking failed:", error);
    return NextResponse.json({ ok: true });
  }
}
