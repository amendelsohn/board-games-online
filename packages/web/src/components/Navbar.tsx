"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export default function Navbar() {
  return (
    <header
      className={[
        "sticky top-0 z-20",
        "border-b border-base-300/70",
        "bg-base-100/70 backdrop-blur-md supports-[backdrop-filter]:bg-base-100/60",
      ].join(" ")}
    >
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between px-5 md:px-6 h-14">
        <Link
          href="/"
          className="group flex items-baseline gap-1.5 leading-none"
          aria-label="BoardGames.online — home"
        >
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-content font-display text-sm tracking-tight"
        style={{ boxShadow: "var(--shadow-letterpress)" }}
      >
        P
      </span>
      <span className="font-display text-base md:text-lg tracking-tight">
        BoardGames
        <span className="text-base-content/50">.online</span>
      </span>
    </span>
  );
}
