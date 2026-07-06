export type MembershipTierCode = "free_reader" | "basic" | "plus" | "library";

export type ProductPriceCode =
  | "online_unlock"
  | "pdf_download"
  | "epub_download"
  | "pdf_epub_bundle";

export type MemberPrice = {
  standardAt: number;
  ownedOnlineAt?: number;
  noteCs: string;
  noteEn: string;
};

export const MEMBERSHIP_PRICEBOOK = {
  foundingWindow: {
    cs: "Zvýhodněné podmínky pro první vlnu čtenářů ARTales.",
    en: "Preferential terms for the first wave of ARTales readers.",
  },
  tiers: {
    free_reader: {
      code: "free_reader",
      foundingAt: 0,
      standardAt: 0,
      monthlyUnlocks: 1,
      bonusAt: 0,
      libraryAccess: false,
    },
    basic: {
      code: "basic",
      foundingAt: 2,
      standardAt: 4,
      monthlyUnlocks: 2,
      bonusAt: 1,
      libraryAccess: false,
    },
    plus: {
      code: "plus",
      foundingAt: 4,
      standardAt: 7,
      monthlyUnlocks: 5,
      bonusAt: 1,
      libraryAccess: false,
    },
    library: {
      code: "library",
      foundingAt: 7,
      standardAt: 10,
      monthlyUnlocks: null,
      bonusAt: 2,
      libraryAccess: true,
    },
  } satisfies Record<MembershipTierCode, {
    code: MembershipTierCode;
    foundingAt: number;
    standardAt: number;
    monthlyUnlocks: number | null;
    bonusAt: number;
    libraryAccess: boolean;
  }>,
  products: {
    online_unlock: {
      standardAt: 1,
      noteCs: "Trvalé online odemčení titulu.",
      noteEn: "Permanent online unlock for the title.",
    },
    pdf_download: {
      standardAt: 2,
      ownedOnlineAt: 1,
      noteCs: "Po trvalém online odemčení stojí PDF edice 1 AT.",
      noteEn: "After a permanent online unlock, the PDF edition costs 1 AT.",
    },
    epub_download: {
      standardAt: 2,
      ownedOnlineAt: 1,
      noteCs: "Po trvalém online odemčení stojí EPUB edice 1 AT.",
      noteEn: "After a permanent online unlock, the EPUB edition costs 1 AT.",
    },
    pdf_epub_bundle: {
      standardAt: 3,
      ownedOnlineAt: 2,
      noteCs: "Po trvalém online odemčení stojí PDF + EPUB balíček 2 AT.",
      noteEn: "After a permanent online unlock, the PDF + EPUB bundle costs 2 AT.",
    },
  } satisfies Record<ProductPriceCode, MemberPrice>,
  patronage: {
    patronAt: 25,
    patronPublicHall: true,
    patronVisibilityDefault: "private",
    mecenatAt: 100,
    mecenatPublicHall: true,
    mecenatVisibilityDefault: "private",
  },
} as const;

export function formatAt(value: number, locale: "cs" | "en" = "cs") {
  if (value === 0) return locale === "cs" ? "zdarma" : "free";
  return `${value} AT`;
}

export function getProductAtPriceLabel(
  type: ProductPriceCode,
  opts: { hasPermanentOnlineUnlock?: boolean; locale?: "cs" | "en" } = {}
) {
  const price: MemberPrice = MEMBERSHIP_PRICEBOOK.products[type];
  const locale = opts.locale ?? "cs";
  if (opts.hasPermanentOnlineUnlock && price.ownedOnlineAt !== undefined) {
    return locale === "cs"
      ? `${price.ownedOnlineAt} AT po online odemčení`
      : `${price.ownedOnlineAt} AT after online unlock`;
  }
  return locale === "cs" ? `${price.standardAt} AT` : `${price.standardAt} AT`;
}
