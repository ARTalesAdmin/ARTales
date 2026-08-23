import { createClient } from "@/lib/supabase/server";
import {
  canReviewSubmissions,
  type PermissionProfile,
} from "@/lib/permissions";

export type MemberSubmission = {
  id: string;
  submitted_by_user_id: string;
  work_id: string | null;
  work_title: string | null;
  target_editor_user_id: string | null;
  target_editor_name: string | null;
  collection_id: string | null;
  type: string;
  title: string;
  description: string;
  file_note: string | null;
  status: string;
  review_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listMemberSubmissions(profile: PermissionProfile) {
  const supabase = await createClient();
  let query = supabase
    .from("member_submissions")
    .select(
      "id, submitted_by_user_id, work_id, target_editor_user_id, collection_id, type, title, description, file_note, status, review_note, reviewed_by_user_id, reviewed_at, created_at, updated_at, works:work_id(title)",
    )
    .order("created_at", { ascending: false })
    .limit(120);

  if (!canReviewSubmissions(profile)) {
    query = query.eq("submitted_by_user_id", profile.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Submissions load error:", error);
    return [];
  }

  const rows = data ?? [];
  const { data: recipients, error: recipientsError } = await supabase.rpc(
    "list_submission_recipient_options",
  );
  if (recipientsError) console.error("Submission recipient labels load error:", recipientsError);
  const recipientNames = new Map(
    ((recipients ?? []) as { id: string; display_name: string }[]).map((item) => [item.id, item.display_name]),
  );

  return rows.map((row) => {
    const work = Array.isArray(row.works) ? row.works[0] : row.works;
    return {
      ...row,
      work_title: work?.title == null ? null : String(work.title),
      target_editor_name: row.target_editor_user_id
        ? recipientNames.get(String(row.target_editor_user_id)) ?? "Určený editor"
        : null,
    } as MemberSubmission;
  });
}
