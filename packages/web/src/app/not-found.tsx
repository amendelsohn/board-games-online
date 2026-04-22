import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-6">
      <div className="surface-ivory max-w-md w-full px-7 py-8 text-center flex flex-col gap-3 parlor-fade">
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
          ◆ Four oh four ◆
        </div>
        <h1
          className="font-display tracking-tight"
          style={{ fontSize: "var(--text-display-md)" }}
        >
          Nothing here.
        </h1>
        <p className="text-sm text-base-content/65 leading-relaxed">
          The room you're looking for has either packed up for the night or was
          never set. Head back to the lobby and pick a game.
        </p>
        <div className="mt-2">
          <Link
            href="/"
            className="btn btn-primary rounded-full px-6 font-semibold"
          >
            Back home →
          </Link>
        </div>
      </div>
    </div>
  );
}
