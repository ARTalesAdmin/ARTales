import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type WorkFeedbackType = "general" | "correction" | "translation" | "formatting" | "rights" | "comment";

export type FollowedAuthorItem = {
  id: string;
  authorId: string;
  name: string;
  slug: string;
  notificationLevel: string;
  createdAt: string;
};

export type FeedbackItem = {
  id: string;
  workId: string;
  workTitle: string;
  workSlug: string;
  feedbackType: string;
  body: string;
  status: string;
  createdAt: string;
};

export type CommunityInboxItem = FeedbackItem & {
  userId: string | null;
  userEmail: string | null;
  userHandle: string | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function isAuthorFollowedByUser(userId: string | null | undefined, authorId: string) {
  if (!userId) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("author_follows")
    .select("id")
    .eq("user_id", userId)
    .eq("author_id", authorId)
    .maybeSingle();

  if (error) {
    console.error("Author follow state failed:", error);
    return false;
  }

  return Boolean(data?.id);
}

export async function getReaderCommunitySummary(userId: string) {
  const admin = createAdminClient();

  const [follows, feedback] = await Promise.all([
    admin
      .from("author_follows")
      .select(`
        id,
        notification_level,
        created_at,
        authors:author_id (
          id,
          name,
          slug
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("work_feedback")
      .select(`
        id,
        work_id,
        feedback_type,
        body,
        status,
        created_at,
        works:work_id (
          id,
          title,
          slug
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (follows.error) console.error("Community follows load failed:", follows.error);
  if (feedback.error) console.error("Community feedback load failed:", feedback.error);

  const followedAuthors: FollowedAuthorItem[] = (follows.data ?? []).map((row: any) => {
    const author = normalizeRelation(row.authors);
    return {
      id: String(row.id),
      authorId: String(author?.id ?? ""),
      name: String(author?.name ?? "Unknown author"),
      slug: String(author?.slug ?? ""),
      notificationLevel: String(row.notification_level ?? "new_releases"),
      createdAt: String(row.created_at),
    };
  }).filter((item: FollowedAuthorItem) => item.slug);

  const feedbackItems: FeedbackItem[] = (feedback.data ?? []).map((row: any) => {
    const work = normalizeRelation(row.works);
    return {
      id: String(row.id),
      workId: String(row.work_id),
      workTitle: String(work?.title ?? "Unknown work"),
      workSlug: String(work?.slug ?? ""),
      feedbackType: String(row.feedback_type ?? "general"),
      body: String(row.body ?? ""),
      status: String(row.status ?? "new"),
      createdAt: String(row.created_at),
    };
  });

  return {
    followedAuthors,
    feedbackItems,
    followedAuthorCount: followedAuthors.length,
    feedbackCount: feedbackItems.length,
  };
}

export async function getCommunityInbox(limit = 50): Promise<CommunityInboxItem[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("work_feedback")
    .select(`
      id,
      user_id,
      work_id,
      feedback_type,
      body,
      status,
      created_at,
      works:work_id (
        id,
        title,
        slug
      ),
      profiles:user_id (
        id,
        email,
        handle
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Community inbox load failed:", error);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const work = normalizeRelation(row.works);
    const profile = normalizeRelation(row.profiles);
    return {
      id: String(row.id),
      userId: row.user_id == null ? null : String(row.user_id),
      userEmail: profile?.email == null ? null : String(profile.email),
      userHandle: profile?.handle == null ? null : String(profile.handle),
      workId: String(row.work_id),
      workTitle: String(work?.title ?? "Unknown work"),
      workSlug: String(work?.slug ?? ""),
      feedbackType: String(row.feedback_type ?? "general"),
      body: String(row.body ?? ""),
      status: String(row.status ?? "new"),
      createdAt: String(row.created_at),
    };
  });
}

export function getFeedbackTypeLabel(type: string) {
  switch (type) {
    case "correction":
      return "Oprava / chyba";
    case "translation":
      return "Překlad";
    case "formatting":
      return "Formátování";
    case "rights":
      return "Práva / zdroj";
    case "comment":
      return "Komentář";
    default:
      return "Obecná zpětná vazba";
  }
}
