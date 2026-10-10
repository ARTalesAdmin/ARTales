import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getServerSupabaseConnection } from "@/lib/supabase/connectionIsolation"

export async function createClient() {
  const cookieStore = await cookies()

  const target = getServerSupabaseConnection()
  return createServerClient(
    target.url,
    target.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // no-op in contexts where cookies can't be set
          }
        },
      },
    }
  )
}