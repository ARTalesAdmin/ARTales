export const HANDLE_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function normalizeHandle(value: string) {
  return value.trim().toLowerCase();
}

export function validateHandle(handle: string) {
  return HANDLE_PATTERN.test(handle);
}

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}


export function isPlaceholderHandle(value: string | null | undefined) {
  return /^user-[a-f0-9]{8}$/i.test(String(value ?? ""));
}

export function isEmailLocalPartDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined,
) {
  const display = String(displayName ?? "").trim().toLowerCase();
  const local = String(email ?? "").split("@")[0]?.trim().toLowerCase();

  return Boolean(display && local && display === local);
}

export type ProfileCompletionInput = {
  email?: string | null;
  handle?: string | null;
  display_name?: string | null;
  profile_completed_at?: string | null;
};

export function isProfileComplete(profile: ProfileCompletionInput | null | undefined) {
  if (!profile) return false;
  if (!profile.profile_completed_at) return false;
  if (!profile.handle || isPlaceholderHandle(profile.handle)) return false;
  if (!profile.display_name) return false;
  if (isEmailLocalPartDisplayName(profile.display_name, profile.email)) return false;

  return true;
}

export function onboardingDisplayNameDefault(
  displayName: string | null | undefined,
  email: string | null | undefined,
) {
  if (isEmailLocalPartDisplayName(displayName, email)) return "";
  return displayName ?? "";
}

export function onboardingHandleDefault(handle: string | null | undefined) {
  if (isPlaceholderHandle(handle)) return "";
  return handle ?? "";
}
