import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/** Call only after an editor-initiated save has completed successfully. */
export async function recordWorkEditorialActivity(
  supabase: SupabaseClient,
  workId: string,
) {
  const { error } = await supabase.rpc("record_work_editorial_activity", {
    p_work_id: workId,
  })

  if (error) throw new Error(error.message)
}
