import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBERSHIP_PRICEBOOK, type MembershipTierCode } from "@/lib/memberPricebook";

export type ActivatableMembershipTierCode = Exclude<MembershipTierCode, "free_reader">;

export type ReaderMembershipStatus = {
  activeTier: ActivatableMembershipTierCode | null;
  activeTierName: string | null;
  activeStartsAt: string | null;
  activeExpiresAt: string | null;
  memberUnlockBalance: number;
  creditBalance: number;
};

type EntitlementRow = {
  starts_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
};

type LedgerAmountRow = {
  amount: number | null;
};

type ActivationRpcResult = {
  ok?: boolean;
  code?: string;
  plan?: string;
  starts_at?: string;
  expires_at?: string;
};

export function isActivatableMembershipTier(value: string): value is ActivatableMembershipTierCode {
  return value === "basic" || value === "plus" || value === "library";
}

export function getMembershipTierName(tier: ActivatableMembershipTierCode | null) {
  if (!tier) return null;
  if (tier === "basic") return "Basic";
  if (tier === "plus") return "Plus";
  return "Library";
}

function readPlanFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const plan = metadata?.plan;
  return typeof plan === "string" && isActivatableMembershipTier(plan) ? plan : null;
}

export async function getReaderMembershipStatus(userId: string): Promise<ReaderMembershipStatus> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [activeMembershipResult, creditResult, unlockResult] = await Promise.all([
    admin
      .from("reader_entitlements")
      .select("starts_at, expires_at, metadata")
      .eq("user_id", userId)
      .eq("entitlement_type", "membership_access")
      .eq("is_active", true)
      .lte("starts_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("expires_at", { ascending: false, nullsFirst: false })
      .limit(1),
    admin
      .from("reader_credit_ledger")
      .select("amount")
      .eq("user_id", userId),
    admin
      .from("reader_member_unlock_ledger")
      .select("amount")
      .eq("user_id", userId),
  ]);

  if (activeMembershipResult.error) console.error("Reader membership load failed:", activeMembershipResult.error);
  if (creditResult.error) console.error("Reader membership credit balance failed:", creditResult.error);
  if (unlockResult.error) console.error("Reader member unlock balance failed:", unlockResult.error);

  const active = ((activeMembershipResult.data ?? []) as EntitlementRow[])[0] ?? null;
  const activeTier = readPlanFromMetadata(active?.metadata);
  const creditRows = (creditResult.data ?? []) as LedgerAmountRow[];
  const unlockRows = (unlockResult.data ?? []) as LedgerAmountRow[];

  return {
    activeTier,
    activeTierName: getMembershipTierName(activeTier),
    activeStartsAt: active?.starts_at ?? null,
    activeExpiresAt: active?.expires_at ?? null,
    memberUnlockBalance: unlockRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    creditBalance: creditRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
  };
}

export async function activateMembershipWithCredits(params: {
  userId: string;
  tier: ActivatableMembershipTierCode;
}) {
  const admin = createAdminClient();
  const tier = MEMBERSHIP_PRICEBOOK.tiers[params.tier];

  const { data, error } = await admin.rpc("activate_reader_membership_with_credits", {
    p_user_id: params.userId,
    p_tier: params.tier,
    p_price_at: tier.foundingAt,
    p_member_unlocks: tier.monthlyUnlocks ?? 0,
    p_bonus_at: tier.bonusAt,
    p_library_access: tier.libraryAccess,
  });

  if (error) {
    console.error("Membership activation RPC failed:", error);
    return { ok: false, code: "rpc_failed" } as const;
  }

  const result = (data ?? {}) as ActivationRpcResult;
  if (result.ok) {
    return {
      ok: true,
      code: String(result.code ?? "activated"),
      plan: String(result.plan ?? params.tier),
      startsAt: result.starts_at ?? null,
      expiresAt: result.expires_at ?? null,
    } as const;
  }

  return {
    ok: false,
    code: String(result.code ?? "activation_failed"),
  } as const;
}

type UnlockSpendRpcResult = {
  ok?: boolean;
  code?: string;
  work_id?: string;
  balance_before?: number;
  balance_after?: number;
};

function normalizeUnlockSpendResult(data: unknown, fallbackCode: string) {
  const result = (data ?? {}) as UnlockSpendRpcResult;
  if (result.ok) {
    return {
      ok: true,
      code: String(result.code ?? "unlocked"),
      workId: result.work_id == null ? null : String(result.work_id),
      balanceBefore: Number(result.balance_before ?? 0),
      balanceAfter: Number(result.balance_after ?? 0),
    } as const;
  }

  return {
    ok: false,
    code: String(result.code ?? fallbackCode),
  } as const;
}

export async function spendMemberUnlockForOnlineReading(params: {
  userId: string;
  workId: string;
}) {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("use_member_online_unlock", {
    p_user_id: params.userId,
    p_work_id: params.workId,
  });

  if (error) {
    console.error("Member unlock spend RPC failed:", error);
    return { ok: false, code: "rpc_failed" } as const;
  }

  return normalizeUnlockSpendResult(data, "member_unlock_failed");
}

export async function spendAtCreditForOnlineUnlock(params: {
  userId: string;
  workId: string;
}) {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("use_at_credit_online_unlock", {
    p_user_id: params.userId,
    p_work_id: params.workId,
  });

  if (error) {
    console.error("AT credit online unlock RPC failed:", error);
    return { ok: false, code: "rpc_failed" } as const;
  }

  return normalizeUnlockSpendResult(data, "credit_unlock_failed");
}
