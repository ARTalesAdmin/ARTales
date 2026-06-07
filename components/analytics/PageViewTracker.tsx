"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function getSessionId() {
  const key = "artales_analytics_session_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const path = `${window.location.pathname}${window.location.search}`;
    const payload = JSON.stringify({
      path,
      referrer: document.referrer || null,
      sessionId: getSessionId(),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/page-view", new Blob([payload], { type: "application/json" }));
      return;
    }

    void fetch("/api/analytics/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  }, [pathname]);

  return null;
}
