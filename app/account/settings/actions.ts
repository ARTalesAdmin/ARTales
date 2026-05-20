"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clampReaderFontScale,
  readerDensityIds,
  readerThemeIds,
  readerWidthIds,
  type ReaderDensityId,
  type ReaderThemeId,
  type ReaderWidthId,
} from "@/lib/reader/readerSettings";

function normalizeChoice<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

export async function updateReaderPreferences(formData: FormData): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/account/settings");
  }

  const theme = normalizeChoice(
    String(formData.get("reader_theme") ?? "light"),
    readerThemeIds,
    "light" satisfies ReaderThemeId,
  );
  const width = normalizeChoice(
    String(formData.get("reader_width") ?? "normal"),
    readerWidthIds,
    "normal" satisfies ReaderWidthId,
  );
  const density = normalizeChoice(
    String(formData.get("reader_density") ?? "comfortable"),
    readerDensityIds,
    "comfortable" satisfies ReaderDensityId,
  );
  const fontScale = clampReaderFontScale(Number(formData.get("reader_font_scale") ?? 1));
  const controlsCollapsed = formData.get("reader_controls_collapsed") === "on";
  const preferredLocale = normalizeChoice(
    String(formData.get("preferred_locale") ?? "en"),
    ["en", "cs"] as const,
    "en",
  );

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      preferred_locale: preferredLocale,
      reader_theme: theme,
      reader_width: width,
      reader_density: density,
      reader_font_scale: fontScale,
      reader_controls_collapsed: controlsCollapsed,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Reader preferences update failed:", error);
    redirect("/account/settings?error=save");
  }

  await admin.from("activity_log").insert({
    actor_user_id: user.id,
    target_type: "profile",
    target_id: user.id,
    action: "reader_preferences_updated",
    metadata: { source: "account_settings_v086" },
  });

  redirect("/account/settings?success=settings");
}
