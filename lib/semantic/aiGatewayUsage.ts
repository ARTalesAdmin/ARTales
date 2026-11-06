/**
 * ARTales-only AI Gateway usage ledger contract.
 * Numeric token usage is reported by the gateway response; a missing cost
 * must stay null until reconciled against the gateway generation endpoint.
 * No server credentials belong in this module.
 */
export type ArtalesAiUsage = {
  generationId: string;
  candidateId: string;
  requestedBy: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  status: "reported" | "pending_reconciliation" | "reconciled";
};

function nonnegative(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value : null;
}

export function parseArtalesGatewayUsage(
  response: unknown,
  identity: Pick<ArtalesAiUsage, "candidateId" | "requestedBy" | "model">
): ArtalesAiUsage | null {
  if (!response || typeof response !== "object") return null;
  const body = response as Record<string, unknown>;
  if (typeof body.id !== "string" || !body.id.trim()) return null;
  const raw = body.usage && typeof body.usage === "object"
    ? body.usage as Record<string, unknown> : {};
  const inputTokens = nonnegative(raw.input_tokens);
  const outputTokens = nonnegative(raw.output_tokens);
  const totalTokens = nonnegative(raw.total_tokens);
  return {
    ...identity,
    generationId: body.id,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd: null,
    status: "pending_reconciliation"
  };
}

export function aggregateArtalesAiUsage(rows: readonly ArtalesAiUsage[]) {
  return {
    generations: rows.length,
    inputTokens: rows.reduce((n, r) => n + (r.inputTokens ?? 0), 0),
    outputTokens: rows.reduce((n, r) => n + (r.outputTokens ?? 0), 0),
    unknownTokenGenerations: rows.filter(r =>
      r.inputTokens === null || r.outputTokens === null).length,
    knownCostUsd: rows.reduce((n, r) => n + (r.costUsd ?? 0), 0),
    unpricedGenerations: rows.filter(r => r.costUsd === null).length
  };
}
