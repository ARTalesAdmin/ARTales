"use client";

import { useState } from "react";

type ThemeId = "light" | "dark";

type ThemeToggleProps = {
  labels?: {
    light: string;
    dark: string;
    aria: string;
  };
  compact?: boolean;
};

const defaultLabels = {
  light: "Light",
  dark: "Dark",
  aria: "Switch ARTales theme",
};

function readInitialTheme(): ThemeId {
  if (typeof document === "undefined") return "light";
  const value = document.documentElement.dataset.artalesTheme;
  return value === "dark" ? "dark" : "light";
}

function persistTheme(theme: ThemeId) {
  document.documentElement.dataset.artalesTheme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem("artales-theme", theme);
  document.cookie = `artales_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export default function ThemeToggle({ labels = defaultLabels, compact = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeId>(() => readInitialTheme());

  const nextTheme: ThemeId = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? labels.dark : labels.light;

  return (
    <button
      type="button"
      className={compact ? "artales-theme-toggle artales-theme-toggle--compact" : "artales-theme-toggle"}
      aria-label={labels.aria}
      aria-pressed={theme === "dark"}
      onClick={() => {
        persistTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      <span className="artales-theme-toggle__icon" aria-hidden="true">
        {theme === "dark" ? "☾" : "☼"}
      </span>
      <span className="artales-theme-toggle__label">{label}</span>
    </button>
  );
}
