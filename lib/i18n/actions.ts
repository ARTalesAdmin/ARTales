"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";

export async function setInterfaceLocale(formData: FormData): Promise<void> {
  const locale = normalizeLocale(String(formData.get("locale") ?? "")) ?? "en";
  const cookieStore = await cookies();

  cookieStore.set("artales_locale", locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/")) {
    redirect(next);
  }

  const headerStore = await headers();
  const referer = headerStore.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      redirect(`${url.pathname}${url.search}` || "/");
    } catch {
      // fall through
    }
  }

  redirect("/");
}

export function getLocaleLabel(locale: SupportedLocale) {
  return locale === "cs" ? "Čeština" : "English";
}
