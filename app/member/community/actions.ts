"use server";

import { redirect } from "next/navigation";
import { requireMemberZoneAccess } from "@/lib/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function acknowledgeWorkFeedbackAction(formData: FormData): Promise<void> {
  const profile = await requireMemberZoneAccess();
  const feedbackId = String(formData.get("feedback_id") ?? "");

  if (!feedbackId) {
    redirect("/member/community?feedback=invalid");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("work_feedback")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_user_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) {
    console.error("Work feedback acknowledge failed:", error);
    redirect("/member/community?feedback=error");
  }

  await admin.from("activity_log").insert({
    actor_user_id: profile.id,
    target_type: "work_feedback",
    target_id: feedbackId,
    action: "work_feedback_acknowledged",
    metadata: { source: "member_community_v097d" },
  });

  redirect("/member/community?feedback=acknowledged");
}
