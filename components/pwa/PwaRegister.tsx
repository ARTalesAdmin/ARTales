"use client";

import { useCallback, useEffect, useState } from "react";

const VERSION_URL = "/version.json";
const VERSION_STORAGE_KEY = "artales_app_version";
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

type VersionMarker = {
  version: string;
};

export default function PwaRegister({ locale }: { locale: "cs" | "en" }) {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    try {
      const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return;

      const marker = (await response.json()) as Partial<VersionMarker>;
      if (typeof marker.version !== "string" || marker.version.length === 0) return;

      const currentVersion = window.localStorage.getItem(VERSION_STORAGE_KEY);
      if (currentVersion === null) {
        window.localStorage.setItem(VERSION_STORAGE_KEY, marker.version);
      } else if (currentVersion !== marker.version) {
        setAvailableVersion(marker.version);
      }
    } catch {
      // An update check must never interrupt reading or navigation.
    }
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkForUpdate(), 0);
    const interval = window.setInterval(() => void checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [checkForUpdate]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch {
        // PWA support must never block ARTales itself.
      }
    };

    void register();
  }, []);

  const refresh = () => {
    if (!availableVersion) return;
    window.localStorage.setItem(VERSION_STORAGE_KEY, availableVersion);
    window.location.reload();
  };

  if (!availableVersion) return null;

  return (
    <aside className="artales-update-banner" role="status" aria-live="polite">
      <span>{locale === "cs" ? "Je dostupná nová verze ARTales." : "A new version of ARTales is available."}</span>
      <button type="button" onClick={refresh}>
        {locale === "cs" ? "Aktualizovat" : "Refresh"}
      </button>
    </aside>
  );
}
