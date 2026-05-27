"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantOnlineReadEntitlement } from "@/lib/entitlements";
import { normalizeRole } from "@/lib/permissions";

function normalizeLookup(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function requireInternalProfile() {
  const profile = await getCurrentProfile();
  const role = normalizeRole(profile?.role);

  if (!profile || profile.is_active === false) {
    redirect("/login?next=/member/entitlements");
  }

  if (role !== "admin" && role !== "editor" && role !== "member") {
    redirect("/account?error=member_required");
  }

  return { profile, role };
}

async function resolveReader(admin: ReturnType<typeof createAdminClient>, lookup: string) {
  const normalized = lookup.trim().toLowerCase().replace(/^@/, "");
  if (!normalized) throw new Error("Missing reader lookup.");

  const { data, error } = await admin
    .from("profiles")
    .select("id, email, handle, display_name, role, is_active")
    .or(`email.ilike.${normalized},handle.ilike.${normalized}`)
    .limit(2);

  if (error) throw new Error(`Reader lookup failed: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Reader was not found.");
  if (data.length > 1) throw new Error("Reader lookup is ambiguous. Use exact e-mail or handle.");
  if (data[0].is_active === false) throw new Error("Reader profile is inactive.");

  return data[0];
}

async function resolveWork(admin: ReturnType<typeof createAdminClient>, lookup: string) {
  const normalized = lookup.trim().toLowerCase();
  if (!normalized) throw new Error("Missing work lookup.");

  const { data, error } = await admin
    .from("works")
    .select("id, title, slug, status")
    .or(`slug.ilike.${normalized},title.ilike.${normalized}`)
    .limit(2);

  if (error) throw new Error(`Work lookup failed: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Work was not found.");
  if (data.length > 1) throw new Error("Work lookup is ambiguous. Use exact slug.");

  return data[0];
}

export async function requestOnlineReadGrant(formData: FormData): Promise<void> {
  const { profile, role } = await requireInternalProfile();

  if (role !== "editor" && role !== "admin") {
    redirect("/member/entitlements?error=not_allowed");
  }

  const readerLookup = normalizeLookup(formData.get("reader_lookup"));
  const workLookup = normalizeLookup(formData.get("work_lookup"));
  const note = normalizeLookup(formData.get("note"));

  if (!readerLookup || !workLookup) {
    redirect("/member/entitlements?error=missing_request_fields");
  }

  const admin = createAdminClient();

  try {
    const [reader, work] = await Promise.all([
      resolveReader(admin, readerLookup),
      resolveWork(admin, workLookup),
    ]);

    const { error } = await admin.from("reader_entitlement_requests").insert({
      requested_by_user_id: profile.id,
      target_user_id: reader.id,
      work_id: work.id,
      request_type: "online_read_manual_grant",
      status: "pending",
      note: note || null,
    });

    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("Entitlement recommendation failed:", error);
    redirect("/member/entitlements?error=request_failed");
  }

  redirect("/member/entitlements?success=request_created");
}

export async function grantOnlineReadAsAdmin(formData: FormData): Promise<void> {
  const { profile, role } = await requireInternalProfile();

  if (role !== "admin") {
    redirect("/member/entitlements?error=admin_required");
  }

  const readerLookup = normalizeLookup(formData.get("reader_lookup"));
  const workLookup = normalizeLookup(formData.get("work_lookup"));
  const note = normalizeLookup(formData.get("note"));

  if (!readerLookup || !workLookup) {
    redirect("/member/entitlements?error=missing_grant_fields");
  }

  const admin = createAdminClient();

  try {
    const [reader, work] = await Promise.all([
      resolveReader(admin, readerLookup),
      resolveWork(admin, workLookup),
    ]);

    await grantOnlineReadEntitlement({
      userId: String(reader.id),
      workId: String(work.id),
      source: "manual_grant",
      grantedByUserId: profile.id,
      note: note || "Admin manual online read grant.",
    });
  } catch (error) {
    console.error("Admin entitlement grant failed:", error);
    redirect("/member/entitlements?error=grant_failed");
  }

  redirect("/member/entitlements?success=grant_created");
}

export async function approveEntitlementRequest(formData: FormData): Promise<void> {
  const { profile, role } = await requireInternalProfile();

  if (role !== "admin") {
    redirect("/member/entitlements?error=admin_required");
  }

  const requestId = normalizeLookup(formData.get("request_id"));
  const adminNote = normalizeLookup(formData.get("admin_note"));

  if (!requestId) {
    redirect("/member/entitlements?error=missing_request");
  }

  const admin = createAdminClient();

  try {
    const { data: request, error: loadError } = await admin
      .from("reader_entitlement_requests")
      .select("id, target_user_id, work_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);
    if (!request) throw new Error("Request was not found.");
    if (request.status !== "pending") throw new Error("Only pending requests can be approved.");

    await grantOnlineReadEntitlement({
      userId: String(request.target_user_id),
      workId: String(request.work_id),
      source: "manual_grant",
      grantedByUserId: profile.id,
      note: adminNote || "Approved editor recommendation.",
    });

    const { error: updateError } = await admin
      .from("reader_entitlement_requests")
      .update({
        status: "approved",
        reviewed_by_user_id: profile.id,
        reviewed_at: new Date().toISOString(),
        admin_note: adminNote || null,
      })
      .eq("id", requestId);

    if (updateError) throw new Error(updateError.message);
  } catch (error) {
    console.error("Approve entitlement request failed:", error);
    redirect("/member/entitlements?error=approve_failed");
  }

  redirect("/member/entitlements?success=request_approved");
}

export async function rejectEntitlementRequest(formData: FormData): Promise<void> {
  const { profile, role } = await requireInternalProfile();

  if (role !== "admin") {
    redirect("/member/entitlements?error=admin_required");
  }

  const requestId = normalizeLookup(formData.get("request_id"));
  const adminNote = normalizeLookup(formData.get("admin_note"));

  if (!requestId) {
    redirect("/member/entitlements?error=missing_request");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("reader_entitlement_requests")
    .update({
      status: "rejected",
      reviewed_by_user_id: profile.id,
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote || null,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    console.error("Reject entitlement request failed:", error);
    redirect("/member/entitlements?error=reject_failed");
  }

  redirect("/member/entitlements?success=request_rejected");
}
