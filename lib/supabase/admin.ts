import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseConnection } from "@/lib/supabase/connectionIsolation";

export function createAdminClient() {
  const target = getServerSupabaseConnection();
  if (!target.enabled) throw new Error("Supabase administrative operations disabled for this environment.");
  // Never reuse a production service key on a disposable branch.
  if (target.reason === "ephemeral") throw new Error("An isolated ephemeral service key is required for admin operations.");
  const supabaseUrl = target.url;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Server-side profile/invite sync requires it.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
