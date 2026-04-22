"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bgo.theme";
const LIGHT = "parlor-day";
const DARK = "parlor-night";

type Theme = typeof LIGHT | typeof DARK;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(LIGHT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const preferred: Theme =
      stored === DARK || stored === LIGHT
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? DARK
          : LIGHT;
    setTheme(preferred);
    document.documentElement.setAttribute("data-theme", preferred);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === DARK ? LIGHT : DARK;
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === DARK ? "Switch to day theme" : "Switch to night theme"
      }
      title={theme === DARK ? "Day" : "Night"}
      className={[
        "group relative h-9 w-[4.25rem] rounded-full",
        "border border-base-300",
        "bg-base-200/60 backdrop-blur",
        "transition-colors",
        "hover:bg-base-200",
      ].join(" ")}
    >
      {/* track labels */}
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-base-content/50"
      >
        <span
          className={
            theme === LIGHT ? "opacity-0" : "opacity-100 transition-opacity"
          }
        >
          day
        </span>
        <span
          className={
            theme === DARK ? "opacity-0" : "opacity-100 transition-opacity"
          }
        >
          ngt
        </span>
      </span>
      {/* thumb */}
      <span
        aria-hidden
        className={[
          "absolute top-1 h-7 w-7 rounded-full",
          "bg-primary text-primary-content",
          "flex items-center justify-center",
          "shadow-[inset_0_1px_0_oklch(100%_0_0_/_.25),0_2px_6px_oklch(0%_0_0_/_0.18)]",
          "transition-transform duration-300",
          "[transition-timing-function:var(--ease-parlor)]",
          mounted && theme === DARK
            ? "translate-x-[2.4rem]"
            : "translate-x-1",
        ].join(" ")}
      >
        {theme === DARK ? (
          // moon
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        ) : (
          // sun
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M3 12h2M19 12h2M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}
