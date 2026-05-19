import crypto from "node:crypto";
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

export function generateInviteToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

export async function getInviteByToken(token: string) {
  const supabase = await createClient();
  const tokenHash = hashInviteToken(token);

  const { data, error } = await supabase
    .from("invites")
    .select(
      "id, email, invited_role, status, invited_by_user_id, accepted_by_user_id, expires_at, accepted_at, created_at, note",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("Invite token load error:", error);
    return null;
  }

  return data as InviteItem | null;
}
