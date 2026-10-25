/**
 * Deterministic, advisory-only edition choice policy.
 *
 * Input 'confirmed' and the rights fields MUST come from a separate evidence
 * review, never be inferred merely from the existence of a catalog record.
 * This code never writes a decision, imports content, or grants usage rights.
 */
export type IdentityMatch = "confirmed" | "uncertain" | "mismatch";
export type LanguageMatch = "matches" | "uncertain" | "mismatch";
export type TextFormat = "plain_text" | "html" | "epub" | "ocr_pdf" | "scan" | "catalog_only" | "unknown";
export type TextQuality = "verified" | "needs_cleanup" | "unknown";
export type Completeness = "complete" | "partial" | "unknown";
export type OriginalRights = "public_domain" | "licensed" | "unknown" | "restricted";
export type TranslationRights = "not_applicable" | "public_domain" | "licensed" | "unknown" | "restricted";

export type EditionEvidence = {
  editionId: string;
  editionYear: number | null;
  identityMatch: IdentityMatch;
  languageMatch: LanguageMatch;
  textFormat: TextFormat;
  completeness: Completeness;
  textQuality: TextQuality;
  originalRights: OriginalRights;
  translationRights: TranslationRights;
  illustrationUse: "excluded" | "unknown" | "public_domain" | "licensed" | "restricted";
  sourceTerms: "cleared" | "unknown" | "restricted";
  evidenceUrl: string | null;
  notes: string;
};

export type EditionRecommendation = {
  outcome: "suggested" | "manual_review" | "no_editions";
  editionId: string | null;
  /** The approval remains a separate admin action even if an edition is suggested. */
  legalApprovalRequired: true;
  reason:
    | "one_eligible"
    | "better_usability"
    | "newer_equal_usability"
    | "insufficient_evidence"
    | "ambiguous_tie"
    | "edition_year_unknown"
    | "no_editions";
  eligibleEditionIds: string[];
};

function legallyDocumented(e: EditionEvidence): boolean {
  return (
    (e.originalRights === "public_domain" || e.originalRights === "licensed") &&
    (e.translationRights === "not_applicable" || e.translationRights === "public_domain" || e.translationRights === "licensed") &&
    e.illustrationUse === "excluded" &&
    e.sourceTerms === "cleared" &&
    Boolean(e.evidenceUrl?.startsWith("https://")) &&
    e.notes.trim().length >= 20
  );
}

/** Higher means genuinely easier to use, *not* a better copyright status. */
function usability(e: EditionEvidence): number {
  if (e.completeness !== "complete" || e.textQuality !== "verified") return 0;
  if (e.textFormat === "plain_text" || e.textFormat === "html") return 3;
  if (e.textFormat === "epub") return 2;
  // Scans, OCR of unknown quality, catalog-only records need a human review.
  return 0;
}

function eligible(e: EditionEvidence): boolean {
  return e.identityMatch === "confirmed" &&
    e.languageMatch === "matches" &&
    legallyDocumented(e) &&
    usability(e) > 0;
}

export function recommendEdition(input: readonly EditionEvidence[]): EditionRecommendation {
  const base = { editionId: null, legalApprovalRequired: true as const, eligibleEditionIds: [] as string[] };
  if (input.length === 0) {
    return { ...base, outcome: "no_editions", reason: "no_editions" };
  }
  // A duplicated identifier means the underlying provenance is ambiguous.
  if (new Set(input.map(i => i.editionId)).size !== input.length || input.some(i => !i.editionId)) {
    return { ...base, outcome: "manual_review", reason: "insufficient_evidence" };
  }
  const candidates = input.filter(eligible).sort((a, b) =>
    usability(b) - usability(a) || (b.editionYear ?? -1) - (a.editionYear ?? -1) || a.editionId.localeCompare(b.editionId)
  );
  if (candidates.length === 0) {
    return { ...base, outcome: "manual_review", reason: "insufficient_evidence" };
  }
  const ranked = candidates.map(c => c.editionId);
  if (candidates.length === 1) {
    return { ...base, outcome: "suggested", editionId: candidates[0].editionId,
      eligibleEditionIds: ranked, reason: "one_eligible" };
  }
  const first = candidates[0], second = candidates[1];
  if (usability(first) > usability(second)) {
    return { ...base, outcome: "suggested", editionId: first.editionId,
      eligibleEditionIds: ranked, reason: "better_usability" };
  }
  // Newer edition is a tie-breaker, not an automatic copyright clearance.
  if (first.editionYear === null || second.editionYear === null) {
    return { ...base, outcome: "manual_review", eligibleEditionIds: ranked, reason: "edition_year_unknown" };
  }
  if (first.editionYear === second.editionYear) {
    return { ...base, outcome: "manual_review", eligibleEditionIds: ranked, reason: "ambiguous_tie" };
  }
  return { ...base, outcome: "suggested", editionId: first.editionId,
    eligibleEditionIds: ranked, reason: "newer_equal_usability" };
}
