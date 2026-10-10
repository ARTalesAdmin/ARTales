/**
 * ARTales preview isolation. Only a deliberately named ephemeral Supabase
 * branch may be used by preview builds. Production keeps its existing DB.
 *
 * The project ref is not a secret. Never store service-role credentials here.
 */
export const PRODUCTION_SUPABASE_REF = "nmhdwmszbwgrgfbmlguu";
export const DISABLED_PREVIEW_SUPABASE_URL = "https://artales-preview-db-disabled.invalid";
export const DISABLED_PREVIEW_ANON_KEY = "artales-preview-disabled";

export type IsolationInput = {
  deployment: string | undefined;
  url: string | undefined;
  anonKey?: string | undefined;
  ephemeralRef: string | undefined;
};

export type IsolationDecision = {
  enabled: boolean;
  reason: "production" | "local" | "ephemeral" | "preview_unconfigured" | "production_target_forbidden";
  url: string;
  anonKey: string;
};

function getRemoteProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname);
    if (!match || u.pathname !== "/" || u.search || u.hash) return null;
    return match[1].toLowerCase();
  } catch {
    return null;
  }
}

function isLoopbackUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1" || u.hostname === "[::1]") &&
      (u.protocol === "http:" || u.protocol === "https:")
    );
  } catch {
    return false;
  }
}

/**
 * Fail closed for ALL non-production Vercel builds by default.
 * The matching ref must be explicitly supplied only during a disposable test.
 * There is no "allow production in preview" switch.
 */
export function resolveSupabaseConnection(input: IsolationInput): IsolationDecision {
  const { deployment, url, anonKey, ephemeralRef } = input;
  if (deployment === "production") {
    return { enabled: true, reason: "production", url: url ?? "", anonKey: anonKey ?? "" };
  }
  if (deployment !== "preview" && isLoopbackUrl(url)) {
    return { enabled: true, reason: "local", url: url!, anonKey: anonKey ?? "" };
  }
  const actualRef = getRemoteProjectRef(url);
  if (actualRef === PRODUCTION_SUPABASE_REF) {
    return {
      enabled: false,
      reason: "production_target_forbidden",
      url: DISABLED_PREVIEW_SUPABASE_URL,
      anonKey: DISABLED_PREVIEW_ANON_KEY,
    };
  }
  if (actualRef && ephemeralRef && ephemeralRef.toLowerCase() === actualRef &&
      actualRef !== PRODUCTION_SUPABASE_REF && anonKey) {
    return { enabled: true, reason: "ephemeral", url: url!, anonKey };
  }
  return {
    enabled: false,
    reason: "preview_unconfigured",
    url: DISABLED_PREVIEW_SUPABASE_URL,
    anonKey: DISABLED_PREVIEW_ANON_KEY,
  };
}

/** Server runtime Vercel env is authoritative; public env is the browser fallback. */
export function getServerSupabaseConnection(): IsolationDecision {
  return resolveSupabaseConnection({
    deployment: process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ephemeralRef: process.env.NEXT_PUBLIC_ARTALES_EPHEMERAL_SUPABASE_REF,
  });
}

/** NEXT_PUBLIC_VERCEL_ENV is injected by Vercel for Next.js browser bundles. */
export function getBrowserSupabaseConnection(): IsolationDecision {
  return resolveSupabaseConnection({
    deployment: process.env.NEXT_PUBLIC_VERCEL_ENV,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ephemeralRef: process.env.NEXT_PUBLIC_ARTALES_EPHEMERAL_SUPABASE_REF,
  });
}
