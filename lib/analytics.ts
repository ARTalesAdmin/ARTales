export type AnalyticsEnvironment =
  | "public"
  | "reader"
  | "account"
  | "member"
  | "admin"
  | "checkout"
  | "auth"
  | "api"
  | "unknown";

export type AnalyticsEventType =
  | "page_view"
  | "work_detail_view"
  | "reader_open"
  | "account_page_view"
  | "member_page_view"
  | "admin_page_view"
  | "checkout_page_view"
  | "auth_page_view"
  | "api_ignored";

export type AnalyticsEntityType = "work" | "author" | "collection" | "account" | "admin" | null;

export type ClassifiedPageView = {
  environment: AnalyticsEnvironment;
  eventType: AnalyticsEventType;
  entityType: AnalyticsEntityType;
  entitySlug: string | null;
};

function cleanPath(input: string) {
  const withoutOrigin = input.startsWith("http") ? new URL(input).pathname : input;
  const [pathOnly] = withoutOrigin.split("?");
  return pathOnly || "/";
}

function pathSegment(path: string, index: number) {
  return path.split("/").filter(Boolean)[index] ?? null;
}

export function classifyPageView(pathInput: string): ClassifiedPageView {
  const path = cleanPath(pathInput);

  if (path.startsWith("/api/")) {
    return { environment: "api", eventType: "api_ignored", entityType: null, entitySlug: null };
  }

  if (path.startsWith("/member/admin")) {
    return { environment: "admin", eventType: "admin_page_view", entityType: "admin", entitySlug: pathSegment(path, 2) };
  }

  if (path.startsWith("/member")) {
    return { environment: "member", eventType: "member_page_view", entityType: null, entitySlug: pathSegment(path, 1) };
  }

  if (path.startsWith("/account")) {
    return { environment: "account", eventType: "account_page_view", entityType: "account", entitySlug: pathSegment(path, 1) };
  }

  if (path.startsWith("/checkout")) {
    return { environment: "checkout", eventType: "checkout_page_view", entityType: null, entitySlug: pathSegment(path, 1) };
  }

  if (path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot-password") || path.startsWith("/reset-password") || path.startsWith("/auth")) {
    return { environment: "auth", eventType: "auth_page_view", entityType: null, entitySlug: pathSegment(path, 0) };
  }

  if (path.startsWith("/reader/")) {
    return { environment: "reader", eventType: "reader_open", entityType: "work", entitySlug: pathSegment(path, 1) };
  }

  if (path.startsWith("/work/")) {
    return { environment: "public", eventType: "work_detail_view", entityType: "work", entitySlug: pathSegment(path, 1) };
  }

  if (path.startsWith("/author/")) {
    return { environment: "public", eventType: "page_view", entityType: "author", entitySlug: pathSegment(path, 1) };
  }

  if (path.startsWith("/collections/")) {
    return { environment: "public", eventType: "page_view", entityType: "collection", entitySlug: pathSegment(path, 1) };
  }

  return { environment: "public", eventType: "page_view", entityType: null, entitySlug: null };
}

export function environmentLabel(environment: string) {
  const labels: Record<string, string> = {
    public: "Veřejný web",
    reader: "Reader",
    account: "Účet",
    member: "Interní zóna",
    admin: "Admin",
    checkout: "Checkout",
    auth: "Auth",
    api: "API",
    unknown: "Neznámé",
  };

  return labels[environment] ?? environment;
}

export function eventTypeLabel(eventType: string) {
  const labels: Record<string, string> = {
    page_view: "Zobrazení stránky",
    work_detail_view: "Detail díla",
    reader_open: "Otevření readeru",
    account_page_view: "Účet",
    member_page_view: "Interní stránka",
    admin_page_view: "Admin stránka",
    checkout_page_view: "Checkout",
    auth_page_view: "Auth stránka",
  };

  return labels[eventType] ?? eventType;
}
