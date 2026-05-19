export type ArtalesRole = "admin" | "editor" | "member" | "reader";

export type PermissionProfile = {
  id: string;
  role: string | null;
  is_active?: boolean | null;
};

export const INTERNAL_ROLES: ArtalesRole[] = ["admin", "editor", "member"];
export const INVITABLE_ROLES: ArtalesRole[] = ["editor", "member", "reader"];

export function normalizeRole(role: string | null | undefined): ArtalesRole {
  if (
    role === "admin" ||
    role === "editor" ||
    role === "member" ||
    role === "reader"
  ) {
    return role;
  }

  return "reader";
}

export function isActiveProfile(profile: PermissionProfile | null | undefined) {
  return Boolean(profile && profile.is_active !== false);
}

export function canAccessMemberZone(
  profile: PermissionProfile | null | undefined,
) {
  if (!isActiveProfile(profile)) return false;
  const role = normalizeRole(profile?.role);
  return role === "admin" || role === "editor" || role === "member";
}

export function canEditContent(profile: PermissionProfile | null | undefined) {
  if (!isActiveProfile(profile)) return false;
  const role = normalizeRole(profile?.role);
  return role === "admin" || role === "editor";
}

export function canManageInvites(
  profile: PermissionProfile | null | undefined,
) {
  if (!isActiveProfile(profile)) return false;
  const role = normalizeRole(profile?.role);
  return role === "admin" || role === "editor";
}

export function canReviewSubmissions(
  profile: PermissionProfile | null | undefined,
) {
  return canEditContent(profile);
}

export function getAllowedInviteRoles(
  profile: PermissionProfile | null | undefined,
): ArtalesRole[] {
  if (!canManageInvites(profile)) return [];
  const role = normalizeRole(profile?.role);

  if (role === "admin") {
    return ["editor", "member", "reader"];
  }

  if (role === "editor") {
    return ["member", "reader"];
  }

  return [];
}

export function canInviteRole(
  profile: PermissionProfile | null | undefined,
  invitedRole: string | null | undefined,
) {
  return getAllowedInviteRoles(profile).includes(normalizeRole(invitedRole));
}

export function canReadPreview() {
  return true;
}

export function canReadFull(profile: PermissionProfile | null | undefined) {
  // v0.8 foundation: guest is preview-only. Registered users can be routed into the
  // future entitlement/paywall layer. v0.9 will replace this with product/access logic.
  return isActiveProfile(profile);
}
