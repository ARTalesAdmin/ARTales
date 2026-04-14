import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/auth"

export async function requireAuthenticatedProfile() {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect("/login")
  }

  return profile
}

export async function requireEditorOrAdmin() {
  const profile = await requireAuthenticatedProfile()

  if (profile.role !== "editor" && profile.role !== "admin") {
    redirect("/member")
  }

  return profile
}