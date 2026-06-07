"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function followAuthorAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const authorId = String(formData.get("author_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  if (!user) redirect(`/login?next=/author/${slug}`);
  if (!authorId || !slug) redirect("/authors");

  const admin = createAdminClient();
  const { error } = await admin.from("author_follows").upsert(
    {
      user_id: user.id,
      author_id: authorId,
      notification_level: "new_releases",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,author_id" },
  );

  if (error) {
    console.error("Follow author failed:", error);
    redirect(`/author/${slug}?follow=error`);
  }

  await admin.from("activity_log").insert({
    actor_user_id: user.id,
    target_type: "author",
    target_id: authorId,
    action: "author_followed",
    metadata: { source: "community_v097" },
  });

  redirect(`/author/${slug}?follow=ok`);
}

export async function unfollowAuthorAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const authorId = String(formData.get("author_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  if (!user) redirect(`/login?next=/author/${slug}`);
  if (!authorId || !slug) redirect("/authors");

  const admin = createAdminClient();
  const { error } = await admin
    .from("author_follows")
    .delete()
    .eq("user_id", user.id)
    .eq("author_id", authorId);

  if (error) {
    console.error("Unfollow author failed:", error);
    redirect(`/author/${slug}?follow=error`);
  }

  await admin.from("activity_log").insert({
    actor_user_id: user.id,
    target_type: "author",
    target_id: authorId,
    action: "author_unfollowed",
    metadata: { source: "community_v097" },
  });

  redirect(`/author/${slug}?follow=removed`);
}
