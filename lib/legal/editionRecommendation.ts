/**
 * Choose a specific, evidenced source FILE for a later, separately approved
 * snapshot. This pure policy never fetches text or grants legal permission.
 * If the translator of this particular version is protected, try another file.
 * Illustration status is independent: a lawful text-only source remains usable.
 */
export type Rights = "public_domain" | "licensed" | "unknown" | "restricted";
export type EditionEvidence = {
  editionId: string;
  sourceKind: "gutenberg" | "open_library" | "library" | "other";
  sourceUrl: string;
  downloadUrl: string | null;
  editionYear: number | null;
  identityMatch: "confirmed" | "uncertain" | "mismatch";
  languageMatch: "matches" | "uncertain" | "mismatch";
  translationStatus: "original" | "translated" | "unknown";
  translator: string;
  originalRights: Rights;
  translationRights: Rights | "not_applicable";
  sourceTerms: "cleared" | "unknown" | "restricted";
  evidenceUrl: string | null;
  notes: string;
  textFormat: "plain_text" | "html" | "epub" | "ocr_pdf" | "scan" | "catalog_only" | "unknown";
  completeness: "complete" | "partial" | "unknown";
  textQuality: "verified" | "needs_cleanup" | "unknown";
  /** Derived from separately inventoried illustrations and their proven rights. */
  images: "publishable" | "archive_only" | "reference_only" | "none" | "unknown";
};
export type EditionRecommendation = {
  outcome: "suggested" | "manual_review" | "no_usable_source" | "no_editions";
  editionId: string | null;
  legalApprovalRequired: true;
  snapshotAdminApprovalRequired: true;
  reason: "one_eligible" | "better_usability" | "gutenberg_preferred" |
    "usable_illustrations" | "newer_equal_usability" | "insufficient_evidence" |
    "ambiguous_tie" | "edition_year_unknown" | "all_sources_blocked" | "no_editions";
  eligibleEditionIds: string[];
  excludedEditionIds: string[];
};
function validHttps(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch { return false; }
}
function translatorCleared(e: EditionEvidence): boolean {
  if (e.translationStatus === "original") {
    return !e.translator.trim() && e.translationRights === "not_applicable";
  }
  if (e.translationStatus === "translated") {
    return Boolean(e.translator.trim()) &&
      (e.translationRights === "public_domain" || e.translationRights === "licensed");
  }
  return false;
}
function documented(e: EditionEvidence): boolean {
  return e.identityMatch === "confirmed" &&
    e.languageMatch === "matches" &&
    validHttps(e.sourceUrl) &&
    validHttps(e.downloadUrl) &&
    validHttps(e.evidenceUrl) &&
    (e.originalRights === "public_domain" || e.originalRights === "licensed") &&
    translatorCleared(e) &&
    e.sourceTerms === "cleared" &&
    e.notes.trim().length >= 20;
}
function usability(e: EditionEvidence): number {
  if (e.completeness !== "complete" || e.textQuality !== "verified") return 0;
  if (e.textFormat === "plain_text" || e.textFormat === "html") return 3;
  if (e.textFormat === "epub") return 2;
  return 0;
}
function imageBenefit(e: EditionEvidence): number {
  if (e.images === "publishable") return 2;
  if (e.images === "archive_only") return 1;
  return 0;
}
/** A known block eliminates this file, not the entire candidate/work. */
function blocked(e: EditionEvidence): boolean {
  return e.identityMatch === "mismatch" ||
    e.languageMatch === "mismatch" ||
    e.originalRights === "restricted" ||
    e.translationRights === "restricted" ||
    e.sourceTerms === "restricted";
}
export function recommendEdition(input: readonly EditionEvidence[]): EditionRecommendation {
  const base = {
    editionId: null, legalApprovalRequired: true as const,
    snapshotAdminApprovalRequired: true as const,
    eligibleEditionIds: [] as string[], excludedEditionIds: [] as string[],
  };
  if (!input.length) return { ...base, outcome: "no_editions", reason: "no_editions" };
  if (new Set(input.map(e => e.editionId)).size !== input.length ||
    input.some(e => !e.editionId)) {
    return { ...base, outcome: "manual_review", reason: "insufficient_evidence" };
  }
  const excludedEditionIds = input.filter(blocked).map(e => e.editionId);
  const eligible = input.filter(e => !blocked(e) && documented(e) && usability(e) > 0);
  if (eligible.length === 0) {
    return { ...base, excludedEditionIds,
      outcome: excludedEditionIds.length === input.length ? "no_usable_source" : "manual_review",
      reason: excludedEditionIds.length === input.length ? "all_sources_blocked" : "insufficient_evidence" };
  }
  // Format and completeness dominate. If equally usable, prefer Gutenberg
  // and capture-ready illustrations, then a newer year when it is known.
  const ranked = [...eligible].sort((a,b) =>
    usability(b) - usability(a) ||
    Number(b.sourceKind === "gutenberg") - Number(a.sourceKind === "gutenberg") ||
    imageBenefit(b) - imageBenefit(a) ||
    (b.editionYear ?? -1) - (a.editionYear ?? -1) ||
    a.editionId.localeCompare(b.editionId)
  );
  const top = ranked[0], second = ranked[1];
  const common = { ...base, eligibleEditionIds: ranked.map(e => e.editionId), excludedEditionIds };
  if (!second) return { ...common, outcome: "suggested", editionId: top.editionId, reason: "one_eligible" };
  if (usability(top) > usability(second)) return { ...common, outcome: "suggested", editionId: top.editionId, reason: "better_usability" };
  if (top.sourceKind === "gutenberg" && second.sourceKind !== "gutenberg") {
    return { ...common, outcome: "suggested", editionId: top.editionId, reason: "gutenberg_preferred" };
  }
  if (imageBenefit(top) > imageBenefit(second)) return { ...common, outcome: "suggested", editionId: top.editionId, reason: "usable_illustrations" };
  if (top.editionYear === null || second.editionYear === null) {
    return { ...common, outcome: "manual_review", reason: "edition_year_unknown" };
  }
  if (top.editionYear === second.editionYear) return { ...common, outcome: "manual_review", reason: "ambiguous_tie" };
  return { ...common, outcome: "suggested", editionId: top.editionId, reason: "newer_equal_usability" };
}
