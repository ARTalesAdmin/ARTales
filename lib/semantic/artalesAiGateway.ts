import "server-only";
import {parseArtalesGatewayUsage, type ArtalesAiUsage} from "./aiGatewayUsage";

export type GatewayRequestResult = {
  body: Record<string, unknown>;
  usage: ArtalesAiUsage | null;
};

/**
 * ARTales-owned gateway adapter. No Nexus dependency, no provider API key.
 * Vercel OIDC authenticates the project to AI Gateway. A model is configured
 * server-side using an exact provider/model ID from the live Gateway catalog.
 */
export async function requestArtalesAiResponse(input: {
  candidateId: string;
  editorId: string;
  oidcToken: string;
  instructions: string;
  payload: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: 2200 | 4800;
}): Promise<GatewayRequestResult> {
  const model = process.env.ARTALES_EDITORIAL_AI_MODEL;
  // Runtime token is injected in the Vercel Function request, never stored in env.
  const oidc = input.oidcToken;
  if (!model || !/^[a-z0-9-]+\/[a-z0-9._-]+$/i.test(model) || !oidc) {
    throw new Error("gateway_not_configured");
  }
  const response = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + oidc
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: input.maxOutputTokens??2200,
      instructions: input.instructions,
      input: JSON.stringify(input.payload),
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          strict: true,
          schema: input.schema
        }
      }
    }),
    signal: AbortSignal.timeout(30000),
    cache: "no-store"
  });
  if (!response.ok) {
    // Never place the provider response or secret in an editor-visible error.
    throw new Error("gateway_request_failed_" + response.status);
  }
  const body = await response.json() as Record<string, unknown>;
  if (body.status !== "completed") throw new Error("gateway_output_incomplete");
  return {
    body,
    usage: parseArtalesGatewayUsage(body, {
      candidateId: input.candidateId, requestedBy: input.editorId, model
    })
  };
}
