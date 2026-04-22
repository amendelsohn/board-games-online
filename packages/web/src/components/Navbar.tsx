"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export default function Navbar() {
  return (
    <header className="navbar bg-base-100/80 backdrop-blur border-b border-base-300 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between px-4">
        <Link href="/" className="text-lg md:text-xl font-bold tracking-tight">
          <span className="text-primary">Board</span>
          <span className="text-secondary">Games</span>
          <span className="text-base-content/60">.online</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
