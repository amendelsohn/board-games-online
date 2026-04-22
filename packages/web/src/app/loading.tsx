"use client";

import React from "react";

export default function Loading() {
  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-xl text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
