import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GalleryWorkItem } from "@/lib/dbWorks";

export type ReaderEntitlementType =
  | "online_read"
  | "pdf_download"
  | "epub_download"
  | "print_discount"
  | "membership_access";

export type ReaderEntitlementSource =
  | "welcome_unlock"
  | "manual_grant"
  | "subscription_monthly"
  | "credit_spend"
  | "purchase"
  | "admin_adjustment"
  | "promo";

export type ReaderLibrarySummary = {
  onlineEntitlements: number;
  pdfDownloads: number;
  epubDownloads: number;
  savedItems: number;
  recentItems: number;
  atCreditBalance: number;
  welcomeUnlockAvailable: boolean;
  welcomeUnlockUsed: boolean;
};

export type ReaderUnlockedWork = GalleryWorkItem & {
  entitlementSource: string;
  entitlementCreatedAt: string;
  entitlementExpiresAt: string | null;
};

export type EntitlementRequestStatus =
  "pending" | "approved" | "rejected" | "cancelled";

export type EntitlementRequestItem = {
  id: string;
  status: EntitlementRequestStatus;
  note: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  requested_by: {
    id: string;
    email: string;
    display_name: string | null;
    handle: string | null;
  } | null;
  target_user: {
    id: string;
    email: string;
    display_name: string | null;
    handle: string | null;
  } | null;
  work: {
    id: string;
    title: string;
    slug: string;
  } | null;
};

type EntitlementWorkRelation = {
  id: unknown;
  title: unknown;
  title_cs: unknown;
  title_en: unknown;
  slug: unknown;
  subtitle: unknown;
  subtitle_cs: unknown;
  subtitle_en: unknown;
  summary: unknown;
  summary_cs: unknown;
  summary_en: unknown;
  canonical_language: unknown;
  origin_type: unknown;
  status: unknown;
  cover_image_request: unknown;
  cover_image_path: unknown;
  cover_image_alt: unknown;
  cover_image_caption: unknown;
  authors?:
    | {
        id: unknown;
        name: unknown;
        name_cs?: unknown;
        name_en?: unknown;
        slug: unknown;
      }
    | null
    | Array<{
        id: unknown;
        name: unknown;
        name_cs?: unknown;
        name_en?: unknown;
        slug: unknown;
      }>;
  collections?:
    | {
        id: unknown;
        title: unknown;
        title_cs?: unknown;
        title_en?: unknown;
        slug: unknown;
        description?: unknown;
        description_cs?: unknown;
        description_en?: unknown;
      }
    | null
    | Array<{
        id: unknown;
        title: unknown;
        title_cs?: unknown;
        title_en?: unknown;
        slug: unknown;
        description?: unknown;
        description_cs?: unknown;
        description_en?: unknown;
      }>;
};

type EntitlementWorkRow = {
  id: unknown;
  entitlement_type: unknown;
  source: unknown;
  created_at: unknown;
  expires_at: unknown;
  works?: EntitlementWorkRelation | EntitlementWorkRelation[] | null;
};

type LibraryItemWorkRow = {
  id: unknown;
  item_type: unknown;
  source: unknown;
  created_at: unknown;
  updated_at: unknown;
  works?: EntitlementWorkRelation | EntitlementWorkRelation[] | null;
};

type EntitlementRequestRawRow = {
  id: unknown;
  status: unknown;
  note: unknown;
  admin_note: unknown;
  created_at: unknown;
  reviewed_at: unknown;
  requested_by?:
    | {
        id: unknown;
        email: unknown;
        display_name: unknown;
        handle: unknown;
      }
    | null
    | Array<{
        id: unknown;
        email: unknown;
        display_name: unknown;
        handle: unknown;
      }>;
  target_user?:
    | {
        id: unknown;
        email: unknown;
        display_name: unknown;
        handle: unknown;
      }
    | null
    | Array<{
        id: unknown;
        email: unknown;
        display_name: unknown;
        handle: unknown;
      }>;
  works?:
    | {
        id: unknown;
        title: unknown;
        slug: unknown;
      }
    | null
    | Array<{
        id: unknown;
        title: unknown;
        slug: unknown;
      }>;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isKnownRequestStatus(
  value: string,
): value is EntitlementRequestStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "cancelled"
  );
}

export async function hasOnlineReadEntitlement(userId: string, workId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("reader_entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("work_id", workId)
    .eq("entitlement_type", "online_read")
    .eq("is_active", true)
    .lte("starts_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  if (error) {
    console.error("Entitlement check failed:", error);
    return false;
  }

  return Boolean(data);
}

export async function hasActiveLibraryMembership(userId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("reader_entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("entitlement_type", "membership_access")
    .eq("is_active", true)
    .lte("starts_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .contains("metadata", { plan: "library" })
    .maybeSingle();

  if (error) {
    console.error("Library membership check failed:", error);
    return false;
  }

  return Boolean(data);
}

export async function hasUsedWelcomeUnlock(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reader_entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "welcome_unlock")
    .eq("is_active", true)
    .limit(1);

  if (error) {
    console.error("Welcome unlock status check failed:", error);
    return false;
  }

  return Boolean(data && data.length > 0);
}

export async function getWelcomeUnlockStatus(userId: string) {
  const used = await hasUsedWelcomeUnlock(userId);

  return {
    available: !used,
    used,
  };
}

export const ONLINE_READ_CREDIT_COST = 1;

export type CreditUnlockResult =
  | { status: "unlocked"; entitlementId: string }
  | { status: "already_unlocked" }
  | { status: "insufficient_credit"; balance: number; required: number }
  | { status: "error"; message: string };

export async function getAtCreditBalance(userId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reader_credit_ledger")
    .select("amount")
    .eq("user_id", userId)
    .eq("credit_type", "at_credit");

  if (error) {
    console.error("AT credit balance check failed:", error);
    return 0;
  }

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export async function unlockOnlineReadWithCredit(params: {
  userId: string;
  workId: string;
  slug?: string | null;
  cost?: number;
}): Promise<CreditUnlockResult> {
  const cost = Math.max(1, Math.floor(params.cost ?? ONLINE_READ_CREDIT_COST));

  try {
    const alreadyUnlocked = await hasOnlineReadEntitlement(params.userId, params.workId);
    if (alreadyUnlocked) return { status: "already_unlocked" };

    const balance = await getAtCreditBalance(params.userId);
    if (balance < cost) {
      return { status: "insufficient_credit", balance, required: cost };
    }

    const entitlementId = await grantOnlineReadEntitlement({
      userId: params.userId,
      workId: params.workId,
      source: "credit_spend",
      grantedByUserId: null,
      note: "Online reading unlocked with AT Credit.",
    });

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { error: ledgerError } = await admin.from("reader_credit_ledger").insert({
      user_id: params.userId,
      credit_type: "at_credit",
      amount: -cost,
      source: "credit_spend",
      related_work_id: params.workId,
      note: "Online reading unlocked with AT Credit.",
      metadata: {
        action: "online_read_unlock",
        entitlement_id: entitlementId,
        entitlement_type: "online_read",
        cost,
        slug: params.slug ?? null,
        created_at: now,
      },
    });

    if (ledgerError) {
      console.error("Credit spend ledger insert failed after entitlement grant:", ledgerError);
      return { status: "error", message: ledgerError.message };
    }

    return { status: "unlocked", entitlementId };
  } catch (error) {
    console.error("Credit unlock failed:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown credit unlock error.",
    };
  }
}

export async function canReadWorkOnline(
  userId: string | null | undefined,
  workId: string,
) {
  if (!userId) return false;

  const [hasDirectEntitlement, hasLibraryMembership] = await Promise.all([
    hasOnlineReadEntitlement(userId, workId),
    hasActiveLibraryMembership(userId),
  ]);

  return hasDirectEntitlement || hasLibraryMembership;
}

export async function isWorkSavedForUser(userId: string, workId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reader_library_items")
    .select("id")
    .eq("user_id", userId)
    .eq("work_id", workId)
    .eq("item_type", "saved")
    .maybeSingle();

  if (error) {
    console.error("Saved work status check failed:", error);
    return false;
  }

  return Boolean(data);
}

export async function setSavedWorkForUser(params: {
  userId: string;
  workId: string;
  saved: boolean;
}) {
  const admin = createAdminClient();

  if (!params.saved) {
    const { error } = await admin
      .from("reader_library_items")
      .delete()
      .eq("user_id", params.userId)
      .eq("work_id", params.workId)
      .eq("item_type", "saved");

    if (error) throw new Error(`Failed to remove saved work: ${error.message}`);
    return;
  }

  const { error } = await admin.from("reader_library_items").upsert(
    {
      user_id: params.userId,
      work_id: params.workId,
      item_type: "saved",
      source: "account",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,work_id,item_type" },
  );

  if (error) throw new Error(`Failed to save work: ${error.message}`);
}

export async function getReaderLibrarySummary(
  userId: string,
): Promise<ReaderLibrarySummary> {
  const supabase = await createClient();

  const [entitlements, libraryItems, credits, welcome] = await Promise.all([
    supabase
      .from("reader_entitlements")
      .select("entitlement_type", { count: "exact", head: false })
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("reader_library_items")
      .select("item_type", { count: "exact", head: false })
      .eq("user_id", userId),
    supabase
      .from("reader_credit_ledger")
      .select("amount")
      .eq("user_id", userId),
    getWelcomeUnlockStatus(userId),
  ]);

  if (entitlements.error)
    console.error("Library entitlement summary failed:", entitlements.error);
  if (libraryItems.error)
    console.error("Library item summary failed:", libraryItems.error);
  if (credits.error) console.error("Credit summary failed:", credits.error);

  const entitlementRows = entitlements.data ?? [];
  const itemRows = libraryItems.data ?? [];
  const creditRows = credits.data ?? [];

  return {
    onlineEntitlements: entitlementRows.filter(
      (row) => row.entitlement_type === "online_read",
    ).length,
    pdfDownloads: entitlementRows.filter(
      (row) => row.entitlement_type === "pdf_download",
    ).length,
    epubDownloads: entitlementRows.filter(
      (row) => row.entitlement_type === "epub_download",
    ).length,
    savedItems: itemRows.filter((row) => row.item_type === "saved").length,
    recentItems: itemRows.filter((row) => row.item_type === "recent").length,
    atCreditBalance: creditRows.reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    ),
    welcomeUnlockAvailable: welcome.available,
    welcomeUnlockUsed: welcome.used,
  };
}

function mapWorkRelationToUnlockedWork({
  work,
  source,
  createdAt,
  expiresAt = null,
}: {
  work: EntitlementWorkRelation;
  source: string;
  createdAt: string;
  expiresAt?: string | null;
}): ReaderUnlockedWork {
  const author = firstRelation(work.authors);
  const collection = firstRelation(work.collections);

  return {
    id: String(work.id),
    title: String(work.title),
    title_cs: work.title_cs == null ? null : String(work.title_cs),
    title_en: work.title_en == null ? null : String(work.title_en),
    slug: String(work.slug),
    subtitle: work.subtitle == null ? null : String(work.subtitle),
    subtitle_cs: work.subtitle_cs == null ? null : String(work.subtitle_cs),
    subtitle_en: work.subtitle_en == null ? null : String(work.subtitle_en),
    summary: String(work.summary ?? ""),
    summary_cs: work.summary_cs == null ? null : String(work.summary_cs),
    summary_en: work.summary_en == null ? null : String(work.summary_en),
    canonical_language: String(work.canonical_language),
    origin_type: String(work.origin_type) as GalleryWorkItem["origin_type"],
    status: String(work.status) as GalleryWorkItem["status"],
    cover_image_request:
      work.cover_image_request == null
        ? null
        : String(work.cover_image_request),
    cover_image_path:
      work.cover_image_path == null ? null : String(work.cover_image_path),
    cover_image_alt:
      work.cover_image_alt == null ? null : String(work.cover_image_alt),
    cover_image_caption:
      work.cover_image_caption == null
        ? null
        : String(work.cover_image_caption),
    author: author
      ? {
          id: String(author.id),
          name: String(author.name),
          name_cs: author.name_cs == null ? null : String(author.name_cs),
          name_en: author.name_en == null ? null : String(author.name_en),
          slug: String(author.slug),
        }
      : null,
    collection: collection
      ? {
          id: String(collection.id),
          title: String(collection.title),
          title_cs:
            collection.title_cs == null ? null : String(collection.title_cs),
          title_en:
            collection.title_en == null ? null : String(collection.title_en),
          slug: String(collection.slug),
          description:
            collection.description == null
              ? null
              : String(collection.description),
          description_cs:
            collection.description_cs == null
              ? null
              : String(collection.description_cs),
          description_en:
            collection.description_en == null
              ? null
              : String(collection.description_en),
        }
      : null,
    collections: collection
      ? [
          {
            id: String(collection.id),
            title: String(collection.title),
            title_cs:
              collection.title_cs == null ? null : String(collection.title_cs),
            title_en:
              collection.title_en == null ? null : String(collection.title_en),
            slug: String(collection.slug),
            description:
              collection.description == null
                ? null
                : String(collection.description),
            description_cs:
              collection.description_cs == null
                ? null
                : String(collection.description_cs),
            description_en:
              collection.description_en == null
                ? null
                : String(collection.description_en),
          },
        ]
      : [],
    entitlementSource: source,
    entitlementCreatedAt: createdAt,
    entitlementExpiresAt: expiresAt,
  } satisfies ReaderUnlockedWork;
}

export async function getReaderUnlockedWorks(
  userId: string,
): Promise<ReaderUnlockedWork[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reader_entitlements")
    .select(
      `
      id,
      entitlement_type,
      source,
      created_at,
      expires_at,
      works:work_id (
        id,
        title,
        title_cs,
        title_en,
        slug,
        subtitle,
        subtitle_cs,
        subtitle_en,
        summary,
        summary_cs,
        summary_en,
        canonical_language,
        origin_type,
        status,
        cover_image_request,
        cover_image_path,
        cover_image_alt,
        cover_image_caption,
        authors:primary_author_id (
          id,
          name,
          name_cs,
          name_en,
          slug
        ),
        collections:collection_id (
          id,
          title,
          title_cs,
          title_en,
          slug,
          description,
          description_cs,
          description_en
        )
      )
    `,
    )
    .eq("user_id", userId)
    .eq("entitlement_type", "online_read")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unlocked works load failed:", error);
    return [];
  }

  const rows: Array<ReaderUnlockedWork | null> = (data ?? []).map((row) => {
    const rawRow = row as EntitlementWorkRow;
    const work = firstRelation(rawRow.works);

    if (!work) return null;

    return mapWorkRelationToUnlockedWork({
      work,
      source: String(rawRow.source ?? "unknown"),
      createdAt: String(rawRow.created_at),
      expiresAt: rawRow.expires_at == null ? null : String(rawRow.expires_at),
    });
  });

  return rows.filter((row): row is ReaderUnlockedWork => row !== null);
}

export async function getReaderSavedWorks(
  userId: string,
): Promise<ReaderUnlockedWork[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reader_library_items")
    .select(
      `
      id,
      item_type,
      source,
      created_at,
      updated_at,
      works:work_id (
        id,
        title,
        title_cs,
        title_en,
        slug,
        subtitle,
        subtitle_cs,
        subtitle_en,
        summary,
        summary_cs,
        summary_en,
        canonical_language,
        origin_type,
        status,
        cover_image_request,
        cover_image_path,
        cover_image_alt,
        cover_image_caption,
        authors:primary_author_id (
          id,
          name,
          name_cs,
          name_en,
          slug
        ),
        collections:collection_id (
          id,
          title,
          title_cs,
          title_en,
          slug,
          description,
          description_cs,
          description_en
        )
      )
    `,
    )
    .eq("user_id", userId)
    .eq("item_type", "saved")
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Saved works load failed:", error);
    return [];
  }

  const rows: Array<ReaderUnlockedWork | null> = (data ?? []).map((row) => {
    const rawRow = row as LibraryItemWorkRow;
    const work = firstRelation(rawRow.works);

    if (!work) return null;

    return mapWorkRelationToUnlockedWork({
      work,
      source: String(rawRow.source ?? "saved"),
      createdAt: String(rawRow.updated_at ?? rawRow.created_at),
    });
  });

  return rows.filter((row): row is ReaderUnlockedWork => row !== null);
}

export async function grantOnlineReadEntitlement(params: {
  userId: string;
  workId: string;
  source?: ReaderEntitlementSource;
  grantedByUserId?: string | null;
  note?: string | null;
}) {
  const admin = createAdminClient();

  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await admin
    .from("reader_entitlements")
    .select("id")
    .eq("user_id", params.userId)
    .eq("work_id", params.workId)
    .eq("entitlement_type", "online_read")
    .maybeSingle();

  if (loadError) {
    throw new Error(
      `Failed to inspect online read entitlement: ${loadError.message}`,
    );
  }

  if (existing?.id) {
    const { error } = await admin
      .from("reader_entitlements")
      .update({
        source: params.source ?? "manual_grant",
        granted_by_user_id: params.grantedByUserId ?? null,
        note: params.note ?? null,
        is_active: true,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(
        `Failed to update online read entitlement: ${error.message}`,
      );
    }

    return existing.id as string;
  }

  const { data, error } = await admin
    .from("reader_entitlements")
    .insert({
      user_id: params.userId,
      work_id: params.workId,
      entitlement_type: "online_read",
      source: params.source ?? "manual_grant",
      granted_by_user_id: params.grantedByUserId ?? null,
      note: params.note ?? null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Failed to grant online read entitlement: ${error.message}`,
    );
  }

  return String(data.id);
}

export async function grantWelcomeUnlock(params: {
  userId: string;
  workId: string;
}) {
  const used = await hasUsedWelcomeUnlock(params.userId);
  if (used) {
    throw new Error("Welcome unlock has already been used.");
  }

  return grantOnlineReadEntitlement({
    userId: params.userId,
    workId: params.workId,
    source: "welcome_unlock",
    grantedByUserId: null,
    note: "Free Reader welcome unlock.",
  });
}

export async function listEntitlementRequests(
  status: EntitlementRequestStatus | "all" = "pending",
) {
  const admin = createAdminClient();

  let query = admin
    .from("reader_entitlement_requests")
    .select(
      `
      id,
      status,
      note,
      admin_note,
      created_at,
      reviewed_at,
      requested_by:requested_by_user_id (
        id,
        email,
        display_name,
        handle
      ),
      target_user:target_user_id (
        id,
        email,
        display_name,
        handle
      ),
      works:work_id (
        id,
        title,
        slug
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Entitlement requests load failed:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const raw = row as EntitlementRequestRawRow;
    const requestedBy = firstRelation(raw.requested_by);
    const targetUser = firstRelation(raw.target_user);
    const work = firstRelation(raw.works);
    const statusValue = String(raw.status ?? "pending");

    return {
      id: String(raw.id),
      status: isKnownRequestStatus(statusValue) ? statusValue : "pending",
      note: raw.note == null ? null : String(raw.note),
      admin_note: raw.admin_note == null ? null : String(raw.admin_note),
      created_at: String(raw.created_at),
      reviewed_at: raw.reviewed_at == null ? null : String(raw.reviewed_at),
      requested_by: requestedBy
        ? {
            id: String(requestedBy.id),
            email: String(requestedBy.email),
            display_name:
              requestedBy.display_name == null
                ? null
                : String(requestedBy.display_name),
            handle:
              requestedBy.handle == null ? null : String(requestedBy.handle),
          }
        : null,
      target_user: targetUser
        ? {
            id: String(targetUser.id),
            email: String(targetUser.email),
            display_name:
              targetUser.display_name == null
                ? null
                : String(targetUser.display_name),
            handle:
              targetUser.handle == null ? null : String(targetUser.handle),
          }
        : null,
      work: work
        ? {
            id: String(work.id),
            title: String(work.title),
            slug: String(work.slug),
          }
        : null,
    } satisfies EntitlementRequestItem;
  });
}

export async function canOpenFullReader(
  profile:
    | { id: string; role?: string | null; is_active?: boolean | null }
    | null
    | undefined,
  workId: string,
) {
  if (!profile || profile.is_active === false) return false;

  if (
    profile.role === "admin" ||
    profile.role === "editor" ||
    profile.role === "member"
  ) {
    return true;
  }

  return canReadWorkOnline(profile.id, workId);
}
