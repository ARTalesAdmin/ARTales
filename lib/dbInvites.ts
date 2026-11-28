import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupPendingInviteByToken } from "@/lib/inviteTokenLookup";
import { createClient } from "@/lib/supabase/server";

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type InviteItem = {
  id: string;
  email: string;
  invited_role: string;
  status: InviteStatus;
  invited_by_user_id: string | null;
  accepted_by_user_id: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
  note: string | null;
};

export { generateInviteToken, hashInviteToken } from "@/lib/inviteTokenLookup";

export async function listRecentInvites() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .select(
      "id, email, invited_role, status, invited_by_user_id, accepted_by_user_id, expires_at, accepted_at, created_at, note",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("Invites load error:", error);
    return [];
  }

  return (data ?? []) as InviteItem[];
}

// The bearer token is resolved on the server only. Manager listing retains
// its existing session-scoped client and RLS.
export async function getInviteByToken(token: string) {
  return lookupPendingInviteByToken(createAdminClient(), token);
}
