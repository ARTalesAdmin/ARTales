import { createClient } from "@/lib/supabase/server";

type ActivityInput = {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordActivity({
  actorUserId,
  action,
  targetType,
  targetId = null,
  metadata = {},
}: ActivityInput) {
  const supabase = await createClient();

  const { error } = await supabase.from("activity_log").insert({
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });

  if (error) {
    console.error("Activity log insert failed:", error);
  }
}
