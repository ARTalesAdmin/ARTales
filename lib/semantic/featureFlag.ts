/** Independent rollout gate: off by default in all environments.
 * NEXT_PUBLIC is used only because the navigation is a client component;
 * this boolean is not an authorization mechanism. All writes still enforce
 * server-side profile/RLS and approval checks. Requires fresh deployment. */
export const SEMANTIC_PIPELINE_ENABLED =
  process.env.NEXT_PUBLIC_ARTALES_SEMANTIC_PIPELINE_V1 === "enabled";
