"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function unfollowAuthorFromAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const followId = String(formData.get("follow_id") ?? "");
  const authorId = String(formData.get("author_id") ?? "");

  if (!user) {
    redirect("/login?next=/account/community");
  }

  if (!followId || !authorId) {
    redirect("/account/community?follow=invalid");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("author_follows")
    .delete()
    .eq("id", followId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Account author unfollow failed:", error);
    redirect("/account/community?follow=error");
  }

  await admin.from("activity_log").insert({
    actor_user_id: user.id,
    target_type: "author",
    target_id: authorId,
    action: "author_unfollowed",
    metadata: { source: "account_community_v097d" },
  });

  redirect("/account/community?follow=removed");
}
