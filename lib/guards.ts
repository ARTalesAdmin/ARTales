import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  canAccessMemberZone,
  canEditContent,
  canManageInvites,
  canReviewSubmissions,
} from "@/lib/permissions";

export async function requireAuthenticatedProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.is_active === false) {
    redirect("/login?error=inactive");
  }

  return profile;
}

export async function requireMemberZoneAccess() {
  const profile = await requireAuthenticatedProfile();

  if (!canAccessMemberZone(profile)) {
    redirect("/login?error=member_required");
  }

  return profile;
}

export async function requireEditorOrAdmin() {
  const profile = await requireAuthenticatedProfile();

  if (!canEditContent(profile)) {
    redirect("/member");
  }

  return profile;
}

export async function requireInviteManager() {
  const profile = await requireMemberZoneAccess();

  if (!canManageInvites(profile)) {
    redirect("/member");
  }

  return profile;
}

export async function requireSubmissionReviewer() {
  const profile = await requireMemberZoneAccess();

  if (!canReviewSubmissions(profile)) {
    redirect("/member/submissions");
  }

  return profile;
}

export async function requireAdmin() {
  const profile = await requireAuthenticatedProfile();

  if (profile.role !== "admin") {
    redirect("/member?error=admin_required");
  }

  return profile;
}
