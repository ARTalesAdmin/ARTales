import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { isProfileComplete } from "@/lib/profileValidation";

export async function requireAccountProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?error=register_required&next=/account");
  }

  if (profile.is_active === false) {
    redirect("/login?error=inactive");
  }

  return profile;
}

export async function requireCompletedAccountProfile(next = "/account") {
  const profile = await requireAccountProfile();

  if (!isProfileComplete(profile)) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  return profile;
}
