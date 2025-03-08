import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        textAlign: "center",
        padding: "0 1rem",
      }}
    >
      <h1
        style={{
          fontSize: "3rem",
          marginBottom: "1rem",
          color: "#0070f3",
        }}
      >
        404
      </h1>
      <h2
        style={{
          fontSize: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        Page Not Found
      </h2>
      <p
        style={{
          maxWidth: "500px",
          marginBottom: "2rem",
          lineHeight: "1.5",
          color: "#666",
        }}
      >
        Sorry, we couldn't find the page you're looking for. It might have been
        removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          backgroundColor: "#0070f3",
          color: "white",
          borderRadius: "4px",
          textDecoration: "none",
          transition: "background-color 0.2s",
        }}
      >
        Return Home
      </Link>
    </div>
  );
}
