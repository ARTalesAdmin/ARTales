import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InviteTokenMatch = {
  id: string;
  email: string;
  invited_role: string;
  invited_by_user_id: string | null;
  status: "pending";
  expires_at: string | null;
};

export function generateInviteToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Only call with a trusted server client. Never return the stored hash,
// internal notes, or unrelated rows. Bound the raw input before hashing.
export async function lookupPendingInviteByToken(
  admin: SupabaseClient,
  token: string,
  now = new Date(),
): Promise<InviteTokenMatch | null> {
  if (!token || token.length > 256 || !Number.isFinite(now.getTime())) return null;
  const { data, error } = await admin
    .from("invites")
    .select("id,email,invited_role,invited_by_user_id,status,expires_at")
    .eq("token_hash", hashInviteToken(token))
    .eq("status", "pending")
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
    .maybeSingle();

  if (error) {
    console.error("Invite lookup failed:", error.code);
    return null;
  }
  if (!data || data.status !== "pending") return null;
  if (data.expires_at !== null && (
    typeof data.expires_at !== "string" ||
    !(Date.parse(data.expires_at) > now.getTime())
  )) return null;

  return {
    id: data.id,
    email: data.email,
    invited_role: data.invited_role,
    invited_by_user_id: data.invited_by_user_id,
    status: "pending",
    expires_at: data.expires_at,
  };
}
