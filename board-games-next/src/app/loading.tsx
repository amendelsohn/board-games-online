"use client";

import React from "react";

export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div className="spinner" />
        <p style={{ color: "#666", fontSize: "1.2rem" }}>Loading...</p>

        <style jsx>{`
          .spinner {
            width: 48px;
            height: 48px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #0070f3;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
