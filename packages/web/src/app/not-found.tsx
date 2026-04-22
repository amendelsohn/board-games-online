import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="card bg-base-100 shadow-lg max-w-md mx-auto">
        <div className="card-body">
          <h1 className="text-5xl font-bold text-primary mb-2">404</h1>
          <h2 className="text-2xl font-semibold mb-6">Page Not Found</h2>
          <p className="mb-6 text-base-content/70">
            Sorry, we couldn't find the page you're looking for. It might have
            been removed, had its name changed, or is temporarily unavailable.
          </p>
          <div className="card-actions justify-center">
            <Link href="/" className="btn btn-primary">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
