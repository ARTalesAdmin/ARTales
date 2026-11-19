import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

// Only memoize within one React server render. Never cache identity across requests.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    // Guests have no session by design. Other auth failures remain visible.
    if (error.name !== "AuthSessionMissingError") {
      console.error("Auth getUser error:", error)
    }
    return null
  }

  return user
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, handle, display_name, role, is_active, invited_by_user_id, invite_id, preferred_locale, reader_theme, reader_width, reader_density, reader_font_scale, reader_controls_collapsed, profile_completed_at")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("Profile load error:", profileError)
    return null
  }

  return profile
})
