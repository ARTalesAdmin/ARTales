const DEFAULT_LOCAL_APP_URL = "http://localhost:3000";
const PRODUCTION_SITE_URL = "https://artales.net";

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function normalizeUrl(value: string | undefined | null) {
  const url = value?.trim();
  if (!url) return null;
  return trimTrailingSlash(url);
}

export function getAppUrl() {
  const configuredUrl =
    normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeUrl(process.env.APP_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (configuredUrl) return configuredUrl;

  const vercelProductionUrl = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProductionUrl) {
    return vercelProductionUrl.startsWith("http")
      ? vercelProductionUrl
      : `https://${vercelProductionUrl}`;
  }

  const vercelUrl = normalizeUrl(process.env.VERCEL_URL);
  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  return DEFAULT_LOCAL_APP_URL;
}

export function buildAppUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppUrl()}${normalizedPath}`;
}
