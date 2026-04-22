"use client";

import React from "react";
import Link from "next/link";

export default function Navbar() {
  return (
    <div className="navbar bg-base-200 shadow-md z-10">
      {/* Left section (empty to help with centering) */}
      <div className="navbar-start"></div>

      {/* Center section with title */}
      <div className="navbar-center">
        <Link href="/" className="text-xl font-bold">
          Board Games Online
        </Link>
      </div>

      {/* Right section with Join button */}
      <div className="navbar-end">
        <Link href="/join" className="btn btn-primary">
          Join
        </Link>
      </div>
    </div>
  );
}
