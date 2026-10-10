import { createBrowserClient } from "@supabase/ssr"
import { getBrowserSupabaseConnection } from "@/lib/supabase/connectionIsolation"

export function createClient() {
  const target = getBrowserSupabaseConnection()
  return createBrowserClient(
    target.url,
    target.anonKey
  )
}