"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

function normalizeHandle(value: string) {
  return value.trim().toLowerCase()
}

export async function completeProfile(formData: FormData): Promise<void> {
  const handle = normalizeHandle(String(formData.get("handle") ?? ""))
  const displayName = String(formData.get("display_name") ?? "").trim()

  if (!handle || !displayName) {
    redirect("/member?error=missing")
  }

  const handleIsValid = /^[a-z0-9_-]{3,32}$/.test(handle)

  if (!handleIsValid) {
    redirect("/member?error=handle")
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      handle,
      display_name: displayName,
    })
    .eq("id", user.id)

  if (error) {
    const isConflict =
      error.message?.toLowerCase().includes("duplicate") ||
      error.message?.toLowerCase().includes("unique")

    if (isConflict) {
      redirect("/member?error=handle_taken")
    }

    redirect("/member?error=save")
  }

  redirect("/member")
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}