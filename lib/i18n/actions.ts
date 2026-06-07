"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { normalizeLocale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const user = await getCurrentUser();

  if (user) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ preferred_locale: locale })
      .eq("id", user.id);

    if (error) {
      console.error("Interface locale profile update failed:", error);
    }
  }

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
