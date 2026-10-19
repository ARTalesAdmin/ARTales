import type { CatalogGenre } from "../catalogProductionPlanner";

/**
 * ARTales prescreen: portfolio-aware bibliographic triage, NEVER a rights verdict.
 * Pure and deterministic. Metadata/enrichment and persistence are separate adapters.
 */
export const PRESCREEN_GENRES = ["prose", "poetry", "drama", "fairy_tale", "essay", "other"] as const;
export type PrescreenGenre = CatalogGenre;
export type PrescreenWeights = Record<PrescreenGenre, number>;

export const DEFAULT_PRESCREEN_WEIGHTS: PrescreenWeights = {
  prose: 25, poetry: 20, drama: 15, fairy_tale: 15, essay: 15, other: 10
};

export type BibliographicTitle = {
  workKey: string; title: string; author: string; authorKey: string;
  genre: PrescreenGenre; firstPublished: number | null;
  authorBorn: number | null; authorDied: number | null;
  sourceUrl: string; origin: "catalog" | "editor" | "reader";
};

export type PrescreenDecision = {
  item: BibliographicTitle;
  outcome: "candidate" | "duplicate" | "review" | "deferred";
  reason: string;
  identityKey: string;
  portfolioScore: number;
};

export type PortfolioInventory = {
  genreCounts: PrescreenWeights;
  unknownGenre: number;
  publishedTotal: number;
  existingIdentityKeys: string[];
  existingWorkKeys: string[];
  existingCandidateKeys: string[];
};

export const normalizeIdentity = (value: string): string =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

export const identityKey = (title: string, author: string): string =>
  normalizeIdentity(title) + "|" + normalizeIdentity(author);

export function yearFromDate(value: unknown): number | null {
  if(typeof value === "number") return Number.isInteger(value) && value >= 1000 && value <= 2100 ? value : null;
  if(typeof value !== "string") return null;
  const m = value.match(/(?:^|\D)(1[0-9]{3}|20[0-9]{2}|2100)(?!\d)/);
  return m ? Number(m[1]) : null;
}

export function validatePrescreenWeights(weights: PrescreenWeights): boolean {
  return PRESCREEN_GENRES.every(g => Number.isInteger(weights[g]) && weights[g] >= 0 && weights[g] <= 100)
    && PRESCREEN_GENRES.reduce((sum, g) => sum + weights[g], 0) === 100;
}

export function scoreGenre(
  genre: PrescreenGenre, weights: PrescreenWeights, inventory: PortfolioInventory,
  selected: Partial<Record<PrescreenGenre, number>>, target: number
): number {
  const known = PRESCREEN_GENRES.reduce((sum, g) => sum + inventory.genreCounts[g], 0);
  const current = inventory.genreCounts[genre] + (selected[genre] ?? 0);
  const expected = (known + target) * weights[genre] / 100;
  return Math.round((expected - current) * 1000) / 1000;
}

/** No apparent-public-domain check is legal clearance; ambiguous years stay in review. */
export function assessChronology(row: BibliographicTitle): string | null {
  if (!/^\/works\/OL[0-9]+W$/.test(row.workKey) || !/^OL[0-9]+A$/.test(row.authorKey))
    return "bibliographic_identity_missing";
  if (!row.firstPublished || !row.authorBorn || !row.authorDied)
    return "historical_dates_missing";
  if (row.authorDied < row.authorBorn || row.firstPublished < row.authorBorn)
    return "historical_dates_conflict";
  if (row.firstPublished > row.authorDied)
    return "posthumous_publication_review";
  if (row.firstPublished > new Date().getUTCFullYear())
    return "publication_in_future";
  return null;
}

export function planPrescreen(
  source: BibliographicTitle[], inventory: PortfolioInventory,
  target: number, weights: PrescreenWeights,
  maxPerAuthor = 1
): { decisions: PrescreenDecision[]; candidates: BibliographicTitle[]; missing: number; stopReason: string } {
  if(!Number.isInteger(target) || target < 1 || target > 12 || !validatePrescreenWeights(weights))
    throw new Error("invalid_prescreen_policy");
  const known = new Set(inventory.existingIdentityKeys);
  const knownSources = new Set([...inventory.existingWorkKeys, ...inventory.existingCandidateKeys]);
  const seen = new Set<string>();
  const authorCounts = new Map<string, number>();
  const selected: Partial<Record<PrescreenGenre,number>> = {};
  const candidates: BibliographicTitle[] = [];
  const decisions: PrescreenDecision[] = [];
  // Stable input order within matching deficit; no random selection.
  const pending = [...source];
  while(pending.length && candidates.length < target) {
    pending.sort((a,b) => scoreGenre(b.genre, weights, inventory, selected, target)
      - scoreGenre(a.genre, weights, inventory, selected, target)
      || a.workKey.localeCompare(b.workKey));
    const row = pending.shift()!;
    const key = identityKey(row.title,row.author);
    const score = scoreGenre(row.genre,weights,inventory,selected,target);
    let outcome: PrescreenDecision["outcome"] = "candidate";
    let reason = "bibliographic_prescreen_passed_rights_unknown";
    if(knownSources.has(row.workKey) || known.has(key)) {
      outcome="duplicate";reason="already_in_library_or_pipeline";
    } else if(seen.has(row.workKey) || seen.has(key)) {
      outcome="duplicate";reason="duplicate_in_run";
    } else {
      const chronology = assessChronology(row);
      if(chronology) { outcome="review";reason=chronology; }
      else if((authorCounts.get(row.authorKey)??0)>=maxPerAuthor) {
        outcome="deferred";reason="author_diversity_limit";
      }
    }
    decisions.push({item:row,outcome,reason,identityKey:key,portfolioScore:score});
    seen.add(row.workKey);seen.add(key);
    if(outcome === "candidate") {
      candidates.push(row);
      selected[row.genre]=(selected[row.genre]??0)+1;
      authorCounts.set(row.authorKey,(authorCounts.get(row.authorKey)??0)+1);
    }
  }
  return {
    decisions,candidates,missing:Math.max(0,target-candidates.length),
    stopReason:candidates.length>=target ? "target_reached" : "bounded_sources_exhausted"
  };
}
