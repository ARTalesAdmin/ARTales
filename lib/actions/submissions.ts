"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordActivity } from "@/lib/activityLog";
import {
  requireMemberZoneAccess,
  requireSubmissionReviewer,
} from "@/lib/guards";

const ALLOWED_TYPES = new Set([
  "correction",
  "image_asset",
  "source_note",
  "transcription",
  "translation_note",
  "metadata_suggestion",
  "other",
]);

const REVIEW_STATUSES = new Set([
  "in_review",
  "accepted",
  "rejected",
  "needs_changes",
  "archived",
]);

export async function createSubmission(formData: FormData): Promise<void> {
  const profile = await requireMemberZoneAccess();
  const supabase = await createClient();

  const type = String(formData.get("type") ?? "other");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const fileNote = String(formData.get("file_note") ?? "").trim() || null;
  const workId = String(formData.get("work_id") ?? "").trim() || null;
  const collectionId =
    String(formData.get("collection_id") ?? "").trim() || null;

  if (!ALLOWED_TYPES.has(type) || !title || !description) {
    redirect("/member/submissions/new?error=missing");
  }

  const { data, error } = await supabase
    .from("member_submissions")
    .insert({
      submitted_by_user_id: profile.id,
      type,
      title,
      description,
      file_note: fileNote,
      work_id: workId,
      collection_id: collectionId,
      status: "submitted",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Submission create error:", error);
    redirect("/member/submissions/new?error=save");
  }

  await recordActivity({
    actorUserId: profile.id,
    action: "submission_created",
    targetType: "member_submission",
    targetId: data.id,
    metadata: { type, title },
  });

  redirect("/member/submissions?success=created");
}

export async function reviewSubmission(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const profile = await requireSubmissionReviewer();
  const supabase = await createClient();

  const status = String(formData.get("status") ?? "in_review");
  const reviewNote = String(formData.get("review_note") ?? "").trim() || null;

  if (!REVIEW_STATUSES.has(status)) {
    redirect("/member/submissions?error=status");
  }

  const { error } = await supabase
    .from("member_submissions")
    .update({
      status,
      review_note: reviewNote,
      reviewed_by_user_id: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) {
    console.error("Submission review error:", error);
    redirect("/member/submissions?error=review");
  }

  await recordActivity({
    actorUserId: profile.id,
    action: `submission_${status}`,
    targetType: "member_submission",
    targetId: submissionId,
    metadata: { reviewNote },
  });

  redirect("/member/submissions?success=reviewed");
}
