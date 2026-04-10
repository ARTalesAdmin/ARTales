import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function resetPasswordByEmail(email: string, newPassword: string) {
  const { data: usersData, error: listError } =
    await supabase.auth.admin.listUsers()

  if (listError) {
    throw new Error("Failed to list users: ${listError.message}")
  }

  const user = usersData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (!user) {
    throw new Error("User with email ${email} was not found.")
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      password: newPassword,
    }
  )

  if (updateError) {
    throw new Error("Failed to update password: ${updateError.message}")
  }

  console.log("Password updated for ${email}")
}

const email = process.argv[2]
const newPassword = process.argv[3]

if (!email || !newPassword) {
  console.error(
    "Usage: npx tsx scripts/resetPassword.ts user@example.com NewPassword123!"
  )
  process.exit(1)
}

resetPasswordByEmail(email, newPassword).catch((error) => {
  console.error(error)
  process.exit(1)
})