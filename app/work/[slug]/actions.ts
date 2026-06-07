"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkFeedbackType } from "@/lib/community";

const allowedFeedbackTypes: WorkFeedbackType[] = ["general", "correction", "translation", "formatting", "rights", "comment"];

export async function submitWorkFeedback(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const workId = String(formData.get("work_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const rawType = String(formData.get("feedback_type") ?? "general") as WorkFeedbackType;
  const feedbackType = allowedFeedbackTypes.includes(rawType) ? rawType : "general";
  const body = String(formData.get("body") ?? "").trim();

  if (!user) redirect(`/login?next=/work/${slug}`);
  if (!workId || !slug) redirect("/gallery");

  if (body.length < 3 || body.length > 4000) {
    redirect(`/work/${slug}?feedback=invalid`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("work_feedback").insert({
    user_id: user.id,
    work_id: workId,
    feedback_type: feedbackType,
    body,
    status: "new",
    visibility: "editorial",
    source_path: `/work/${slug}`,
  });

  if (error) {
    console.error("Submit work feedback failed:", error);
    redirect(`/work/${slug}?feedback=error`);
  }

  await admin.from("activity_log").insert({
    actor_user_id: user.id,
    target_type: "work",
    target_id: workId,
    action: "work_feedback_submitted",
    metadata: { feedback_type: feedbackType, source: "community_v097" },
  });

  redirect(`/work/${slug}?feedback=sent`);
}
