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
