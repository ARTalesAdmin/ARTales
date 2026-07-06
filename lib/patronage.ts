import { MEMBERSHIP_PRICEBOOK } from "@/lib/memberPricebook";

export type PatronageLevel = "supporter" | "patron" | "mecenat";

export type PatronageProgress = {
  totalAt: number;
  level: PatronageLevel;
  nextLevel: "patron" | "mecenat" | null;
  nextThresholdAt: number | null;
  remainingAt: number;
  progressPercent: number;
};

export function getPatronageProgress(totalAt: number): PatronageProgress {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalAt) ? totalAt : 0));
  const patronAt = MEMBERSHIP_PRICEBOOK.patronage.patronAt;
  const mecenatAt = MEMBERSHIP_PRICEBOOK.patronage.mecenatAt;

  if (safeTotal >= mecenatAt) {
    return {
      totalAt: safeTotal,
      level: "mecenat",
      nextLevel: null,
      nextThresholdAt: null,
      remainingAt: 0,
      progressPercent: 100,
    };
  }

  if (safeTotal >= patronAt) {
    return {
      totalAt: safeTotal,
      level: "patron",
      nextLevel: "mecenat",
      nextThresholdAt: mecenatAt,
      remainingAt: Math.max(0, mecenatAt - safeTotal),
      progressPercent: Math.min(100, Math.round((safeTotal / mecenatAt) * 100)),
    };
  }

  return {
    totalAt: safeTotal,
    level: "supporter",
    nextLevel: "patron",
    nextThresholdAt: patronAt,
    remainingAt: Math.max(0, patronAt - safeTotal),
    progressPercent: Math.min(100, Math.round((safeTotal / patronAt) * 100)),
  };
}

export function formatPatronageLevel(level: PatronageLevel, locale: "cs" | "en" = "cs") {
  if (level === "mecenat") return locale === "cs" ? "Mecenáš ARTales" : "ARTales Benefactor";
  if (level === "patron") return locale === "cs" ? "Patron ARTales" : "ARTales Patron";
  return locale === "cs" ? "Podporovatel ARTales" : "ARTales Supporter";
}
