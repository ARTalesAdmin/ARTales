export type MembershipTierCode = "free_reader" | "basic" | "plus" | "library";

export type MembershipTier = {
  code: MembershipTierCode;
  name: string;
  introPrice: number;
  futurePrice: number;
  monthlyOnlineUnlocks: number | "unlimited_while_active";
  monthlyAtCredits: number;
  description: string;
  badge?: string;
};

export const INTRO_PROMO_COPY =
  "Launch offer for the first 3 months or first 100 readers.";

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    code: "free_reader",
    name: "Free Reader",
    introPrice: 0,
    futurePrice: 0,
    monthlyOnlineUnlocks: 0,
    monthlyAtCredits: 0,
    description:
      "Registered reader account with profile, reader settings and one future welcome online unlock.",
  },
  {
    code: "basic",
    name: "Basic",
    introPrice: 1,
    futurePrice: 2,
    monthlyOnlineUnlocks: 2,
    monthlyAtCredits: 0,
    description: "Two permanent online unlocks each month and member prices.",
  },
  {
    code: "plus",
    name: "Plus",
    introPrice: 2,
    futurePrice: 4,
    monthlyOnlineUnlocks: 5,
    monthlyAtCredits: 1,
    description:
      "Five permanent online unlocks each month, one AT Credit and better member prices.",
    badge: "Best value",
  },
  {
    code: "library",
    name: "Library",
    introPrice: 4,
    futurePrice: 7,
    monthlyOnlineUnlocks: "unlimited_while_active",
    monthlyAtCredits: 2,
    description:
      "Unlimited online reading while the membership is active, two AT Credits and best prices.",
    badge: "Full online access",
  },
];

export function formatEuro(value: number) {
  return `€${value}`;
}

export function getUnlockLabel(value: MembershipTier["monthlyOnlineUnlocks"]) {
  if (value === "unlimited_while_active") {
    return "Unlimited online reading while active";
  }

  if (value === 0) {
    return "Welcome unlock coming later";
  }

  return `${value} permanent online unlocks / month`;
}
