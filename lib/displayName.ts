import {
  isEmailLocalPartDisplayName,
  isPlaceholderHandle,
} from "@/lib/profileValidation";

export type DisplayNameProfile = {
  email?: string | null;
  handle?: string | null;
  display_name?: string | null;
};

function titleCaseHandle(handle: string) {
  return handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getShortDisplayName(
  profile: DisplayNameProfile | null | undefined,
) {
  if (!profile) return "Reader";

  const displayName = String(profile.display_name ?? "").trim();
  const handle = String(profile.handle ?? "").trim();

  if (displayName && !isEmailLocalPartDisplayName(displayName, profile.email)) {
    const first = displayName.split(/\s+/)[0]?.trim();
    if (first) return first;
  }

  if (handle && !isPlaceholderHandle(handle)) {
    return titleCaseHandle(handle);
  }

  return "Reader";
}
