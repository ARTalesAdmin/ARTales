import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getServerSupabaseConnection } from "@/lib/supabase/connectionIsolation"

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  const target = getServerSupabaseConnection()
  if (!target.enabled) return response
  const supabase = createServerClient(
    target.url,
    target.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}