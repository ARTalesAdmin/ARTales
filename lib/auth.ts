import { createClient } from "@/lib/supabase/server"

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error("Auth getUser error:", error)
    return null
  }

  return user
}

export async function getCurrentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    if (userError) console.error("Auth getUser error:", userError)
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, handle, display_name, role, is_active, invited_by_user_id, invite_id, preferred_locale, reader_theme, reader_width, reader_density, reader_font_scale, reader_controls_collapsed")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("Profile load error:", profileError)
    return null
  }

  return profile
}