import { cookies } from "next/headers";
import { defaultPublicLocale, normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";

export async function getCookieLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get("artales_locale")?.value) ?? defaultPublicLocale;
}

export function resolveProfileLocale(profile: { preferred_locale?: string | null } | null | undefined, cookieLocale: SupportedLocale): SupportedLocale {
  return normalizeLocale(profile?.preferred_locale) ?? cookieLocale;
}
