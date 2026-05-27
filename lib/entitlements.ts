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
};

export type ReaderUnlockedWork = GalleryWorkItem & {
  entitlementSource: string;
  entitlementCreatedAt: string;
  entitlementExpiresAt: string | null;
};

type EntitlementWorkRelation = {
  id: unknown;
  title: unknown;
  slug: unknown;
  subtitle: unknown;
  summary: unknown;
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
        slug: unknown;
      }
    | null
    | Array<{
        id: unknown;
        name: unknown;
        slug: unknown;
      }>;
  collections?:
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

type EntitlementWorkRow = {
  id: unknown;
  entitlement_type: unknown;
  source: unknown;
  created_at: unknown;
  expires_at: unknown;
  works?: EntitlementWorkRelation | EntitlementWorkRelation[] | null;
};

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

export async function canReadWorkOnline(userId: string | null | undefined, workId: string) {
  if (!userId) return false;

  const [hasDirectEntitlement, hasLibraryMembership] = await Promise.all([
    hasOnlineReadEntitlement(userId, workId),
    hasActiveLibraryMembership(userId),
  ]);

  return hasDirectEntitlement || hasLibraryMembership;
}

export async function getReaderLibrarySummary(userId: string): Promise<ReaderLibrarySummary> {
  const supabase = await createClient();

  const [entitlements, libraryItems, credits] = await Promise.all([
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
  ]);

  if (entitlements.error) console.error("Library entitlement summary failed:", entitlements.error);
  if (libraryItems.error) console.error("Library item summary failed:", libraryItems.error);
  if (credits.error) console.error("Credit summary failed:", credits.error);

  const entitlementRows = entitlements.data ?? [];
  const itemRows = libraryItems.data ?? [];
  const creditRows = credits.data ?? [];

  return {
    onlineEntitlements: entitlementRows.filter((row) => row.entitlement_type === "online_read").length,
    pdfDownloads: entitlementRows.filter((row) => row.entitlement_type === "pdf_download").length,
    epubDownloads: entitlementRows.filter((row) => row.entitlement_type === "epub_download").length,
    savedItems: itemRows.filter((row) => row.item_type === "saved").length,
    recentItems: itemRows.filter((row) => row.item_type === "recent").length,
    atCreditBalance: creditRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
  };
}

export async function getReaderUnlockedWorks(userId: string): Promise<ReaderUnlockedWork[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reader_entitlements")
    .select(`
      id,
      entitlement_type,
      source,
      created_at,
      expires_at,
      works:work_id (
        id,
        title,
        slug,
        subtitle,
        summary,
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
          slug
        ),
        collections:collection_id (
          id,
          title,
          slug
        )
      )
    `)
    .eq("user_id", userId)
    .eq("entitlement_type", "online_read")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unlocked works load failed:", error);
    return [];
  }

  const rows = (data ?? []).map((row) => {
    const rawRow = row as EntitlementWorkRow;
    const work = Array.isArray(rawRow.works) ? rawRow.works[0] : rawRow.works;

    if (!work) return null;

    const author = Array.isArray(work.authors) ? work.authors[0] : work.authors;
    const collection = Array.isArray(work.collections) ? work.collections[0] : work.collections;

    return {
      id: String(work.id),
      title: String(work.title),
      slug: String(work.slug),
      subtitle: work.subtitle == null ? null : String(work.subtitle),
      summary: String(work.summary ?? ""),
      canonical_language: String(work.canonical_language),
      origin_type: String(work.origin_type) as GalleryWorkItem["origin_type"],
      status: String(work.status) as GalleryWorkItem["status"],
      cover_image_request: work.cover_image_request == null ? null : String(work.cover_image_request),
      cover_image_path: work.cover_image_path == null ? null : String(work.cover_image_path),
      cover_image_alt: work.cover_image_alt == null ? null : String(work.cover_image_alt),
      cover_image_caption: work.cover_image_caption == null ? null : String(work.cover_image_caption),
      author: author
        ? {
            id: String(author.id),
            name: String(author.name),
            slug: String(author.slug),
          }
        : null,
      collection: collection
        ? {
            id: String(collection.id),
            title: String(collection.title),
            slug: String(collection.slug),
          }
        : null,
      entitlementSource: String(rawRow.source ?? "unknown"),
      entitlementCreatedAt: String(rawRow.created_at),
      entitlementExpiresAt: rawRow.expires_at == null ? null : String(rawRow.expires_at),
    } satisfies ReaderUnlockedWork;
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
    throw new Error(`Failed to inspect online read entitlement: ${loadError.message}`);
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
      throw new Error(`Failed to update online read entitlement: ${error.message}`);
    }

    return;
  }

  const { error } = await admin.from("reader_entitlements").insert({
    user_id: params.userId,
    work_id: params.workId,
    entitlement_type: "online_read",
    source: params.source ?? "manual_grant",
    granted_by_user_id: params.grantedByUserId ?? null,
    note: params.note ?? null,
    is_active: true,
  });

  if (error) {
    throw new Error(`Failed to grant online read entitlement: ${error.message}`);
  }
}

export async function canOpenFullReader(profile: { id: string; role?: string | null; is_active?: boolean | null } | null | undefined, workId: string) {
  if (!profile || profile.is_active === false) return false;

  if (profile.role === "admin" || profile.role === "editor" || profile.role === "member") {
    return true;
  }

  return canReadWorkOnline(profile.id, workId);
}
