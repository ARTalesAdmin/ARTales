/**
 * Fixture-ready catalog-production planner.
 *
 * Planning ONLY: this function neither calls a scanner nor approves publication,
 * creates work records, assigns real users or spends any money. All rights
 * results are supplied inputs and must later come from a trusted, signed dossier.
 */
export type CatalogGenre = "prose" | "poetry" | "drama" | "fairy_tale" | "essay" | "other"
export type RightsKind = "WORK_CONTENT" | "EDITION_CONTENT" | "TRANSLATION" | "ASSET" | "SOURCE_WRAPPER"
export type Clearance = "usable" | "excluded" | "blocked" | "unresolved" | "not_applicable"

export type ComponentClearance = {
  kind: RightsKind
  clearance: Clearance
  commercialUseVerified: boolean
}

export type CandidateScreen = {
  outcome: "provisionally_clear" | "escalate" | "reject"
  snapshotSetId: string | null
  dossierRef: string | null
  evidenceCurrentThrough: string | null // ISO YYYY-MM-DD, verified externally
  components: ComponentClearance[]
  recommendedEdition: string
  recommendationReason: string
}

export type CatalogCandidate = {
  id: string
  title: string
  authorId: string
  author: string
  genre: CatalogGenre
  priority: number // 0..100
  prescreen: "promising" | "needs_research" | "skip"
  prescreenCostUsd: number
  fullScanCostUsd: number
  estimatedEditorialCostUsd: number
  screen: CandidateScreen | null // outcome fixture, NEVER inferred from title/provider
}

export type CatalogPolicy = {
  targetTitles: number
  prescreenBudgetUsd: number
  fullScanBudgetUsd: number
  editorialBudgetUsd: number
  maxFullScans: number
  maxPerAuthor: number
  genreTargets: Partial<Record<CatalogGenre, number>>
  assignment: "shared_inbox" | "round_robin"
  editorIds: string[]
  asOf: string // YYYY-MM-DD, supplied from trusted server in production
}

export type CatalogDecision = {
  candidateId: string
  title: string
  action: "skip" | "escalate" | "reviewed" | "accepted_for_editorial" | "deferred"
  reason: string
  prescreenCostUsd: number
  fullScanCostUsd: number
  editorialReservationUsd: number
}

export type QualifiedTitle = {
  candidateId: string
  title: string
  author: string
  genre: CatalogGenre
  dossierRef: string
  sourceSnapshotSetId: string
  recommendedEdition: string
  recommendationReason: string
  componentClearance: ComponentClearance[]
  assignment: string // "shared_inbox" or editor identifier, not persisted
  estimatedEditorialCostUsd: number
}

export type CatalogRunPlan = {
  requested: number
  qualified: QualifiedTitle[]
  decisions: CatalogDecision[] // ordered chronology of this planning pass
  needsHumanReview: string[]
  prescreenSpentUsd: number
  fullScanSpentUsd: number
  editorialReservedUsd: number
  refillRequested: boolean
  refillTarget: number
  replenishmentGenres: CatalogGenre[]
  stopReason: "target_reached" | "pool_exhausted" | "screening_budget" | "editorial_budget"
  actualPublished: 0 // this is planning, never publish or claim title delivered
}

const allowedGenres: CatalogGenre[] = ["prose","poetry","drama","fairy_tale","essay","other"]
const dollars = (value:number) => Math.round(value * 100) / 100
const nonnegative = (value:number) => Number.isFinite(value) && value >= 0
const cents = (value:number) => Math.round(value * 100)
const supported = (scan:CandidateScreen, asOf:string): boolean => {
  if (scan.outcome !== "provisionally_clear" ||
      !scan.snapshotSetId || !scan.dossierRef ||
      !scan.evidenceCurrentThrough || scan.evidenceCurrentThrough < asOf ||
      scan.components.length === 0) return false

  const text = scan.components.find(x=>x.kind==="WORK_CONTENT")
  const edition = scan.components.find(x=>x.kind==="EDITION_CONTENT")
  if (!text || text.clearance!=="usable" || !text.commercialUseVerified ||
      !edition || !["usable","excluded","not_applicable"].includes(edition.clearance))
    return false

  return scan.components.every(x=>
    x.clearance === "excluded" || x.clearance === "not_applicable" ||
    (x.clearance === "usable" && x.commercialUseVerified)
  )
}
const countGenre=(items:QualifiedTitle[], genre:CatalogGenre) =>
  items.filter(x=>x.genre===genre).length
const countAuthor=(items:QualifiedTitle[], authorId:string, catalog:CatalogCandidate[]) =>
  items.filter(x=>catalog.some(c=>c.id===x.candidateId && c.authorId===authorId)).length

/**
 * Deterministic greedy candidate prioritization, considering genre deficits
 * before spending the detailed scan budget. No hidden AI-generated scoring.
 */
export function planCatalogProduction(
  candidates: CatalogCandidate[], policy: CatalogPolicy
): CatalogRunPlan {
  if (!Number.isInteger(policy.targetTitles) || policy.targetTitles < 1 ||
      !Number.isInteger(policy.maxFullScans) || policy.maxFullScans < 0 ||
      !Number.isInteger(policy.maxPerAuthor) || policy.maxPerAuthor < 1 ||
      [policy.prescreenBudgetUsd,policy.fullScanBudgetUsd,policy.editorialBudgetUsd].some(x=>!nonnegative(x)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(policy.asOf)) {
    throw new Error("invalid_catalog_policy")
  }
  const unique = new Set<string>()
  for (const c of candidates) {
    if (!c.id || unique.has(c.id) || !c.authorId ||
        !allowedGenres.includes(c.genre) || !Number.isFinite(c.priority) ||
        c.priority<0 || c.priority>100 ||
        [c.prescreenCostUsd,c.fullScanCostUsd,c.estimatedEditorialCostUsd].some(x=>!nonnegative(x)))
      throw new Error("invalid_catalog_candidate")
    unique.add(c.id)
  }

  const qualified:QualifiedTitle[] = []
  const decisions:CatalogDecision[] = []
  const needsHumanReview:string[] = []
  let preSpent = 0, scanSpent = 0, editReserved = 0, scans = 0
  let budgetHit = false, editorialBudgetHit = false
  const pool:CatalogCandidate[] = []

  const record=(c:CatalogCandidate,action:CatalogDecision["action"],reason:string,
    p=0,s=0,e=0)=>decisions.push({
    candidateId:c.id,title:c.title,action,reason,
    prescreenCostUsd:dollars(p),fullScanCostUsd:dollars(s),
    editorialReservationUsd:dollars(e)
  })

  // Cheap prescreen of a bounded list, in supplied order (a future AI extends it).
  for (const c of candidates) {
    if (cents(preSpent+c.prescreenCostUsd)>cents(policy.prescreenBudgetUsd)) {
      budgetHit=true
      record(c,"deferred","prescreen_budget_limit")
      continue
    }
    preSpent+=c.prescreenCostUsd
    if(c.prescreen==="skip") {
      record(c,"skip","not_viable_in_prescreen",c.prescreenCostUsd)
    } else if(c.prescreen==="needs_research") {
      needsHumanReview.push(c.id)
      record(c,"escalate","prescreen_inconclusive",c.prescreenCostUsd)
    } else {
      pool.push(c)
      record(c,"reviewed","passed_prescreen",c.prescreenCostUsd)
    }
  }

  while(pool.length>0 && qualified.length<policy.targetTitles) {
    pool.sort((a,b)=>{
      const da=Math.max(0,(policy.genreTargets[a.genre]??0)-countGenre(qualified,a.genre))
      const db=Math.max(0,(policy.genreTargets[b.genre]??0)-countGenre(qualified,b.genre))
      const scoreA=a.priority+Math.min(2,da)*30
      const scoreB=b.priority+Math.min(2,db)*30
      return scoreB-scoreA || a.id.localeCompare(b.id)
    })
    const c=pool.shift()!
    if (countAuthor(qualified,c.authorId,candidates)>=policy.maxPerAuthor) {
      record(c,"deferred","author_diversity_limit")
      continue
    }
    if (scans>=policy.maxFullScans || cents(scanSpent+c.fullScanCostUsd)>cents(policy.fullScanBudgetUsd)) {
      budgetHit=true
      record(c,"deferred","full_scan_budget_limit")
      continue
    }
    scans++
    scanSpent+=c.fullScanCostUsd
    if (!c.screen) {
      record(c,"reviewed","full_scan_requested_result_pending",0,c.fullScanCostUsd)
      continue
    }
    if (c.screen.outcome==="reject") {
      record(c,"skip","rights_or_commercial_use_blocked",0,c.fullScanCostUsd)
      continue
    }
    if (!supported(c.screen,policy.asOf)) {
      needsHumanReview.push(c.id)
      record(c,"escalate","commercial_clearance_unproven_or_outdated",0,c.fullScanCostUsd)
      continue
    }
    if(cents(editReserved+c.estimatedEditorialCostUsd)>cents(policy.editorialBudgetUsd)) {
      editorialBudgetHit=true
      record(c,"deferred","editorial_budget_limit",0,c.fullScanCostUsd)
      continue
    }
    editReserved+=c.estimatedEditorialCostUsd
    const assignment=policy.assignment==="round_robin"&&policy.editorIds.length
      ? policy.editorIds[qualified.length%policy.editorIds.length]
      : "shared_inbox"
    qualified.push({
      candidateId:c.id,title:c.title,author:c.author,genre:c.genre,
      dossierRef:c.screen.dossierRef!,sourceSnapshotSetId:c.screen.snapshotSetId!,
      recommendedEdition:c.screen.recommendedEdition,
      recommendationReason:c.screen.recommendationReason,
      componentClearance:c.screen.components,
      assignment,estimatedEditorialCostUsd:c.estimatedEditorialCostUsd
    })
    record(c,"accepted_for_editorial","commercially_plausible_draft_no_publication",0,c.fullScanCostUsd,c.estimatedEditorialCostUsd)
  }

  const missing=Math.max(0,policy.targetTitles-qualified.length)
  const depleted=pool.length===0
  const canAffordMore=!budgetHit && scans<policy.maxFullScans &&
    cents(scanSpent)<cents(policy.fullScanBudgetUsd)
  const refillRequested=missing>0 && depleted && canAffordMore && !editorialBudgetHit
  const replenishmentGenres=allowedGenres
    .filter(g=>(policy.genreTargets[g]??0)>countGenre(qualified,g))
    .sort((a,b)=>((policy.genreTargets[b]??0)-countGenre(qualified,b))-
                  ((policy.genreTargets[a]??0)-countGenre(qualified,a)))
  return {
    requested:policy.targetTitles,qualified,decisions,needsHumanReview,
    prescreenSpentUsd:dollars(preSpent),fullScanSpentUsd:dollars(scanSpent),
    editorialReservedUsd:dollars(editReserved),refillRequested,
    refillTarget:refillRequested?missing:0,replenishmentGenres,
    stopReason:qualified.length>=policy.targetTitles?"target_reached":
      editorialBudgetHit?"editorial_budget":budgetHit||scans>=policy.maxFullScans?
      "screening_budget":"pool_exhausted",
    actualPublished:0
  }
}
