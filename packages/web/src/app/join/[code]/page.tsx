"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ensurePlayer, getStoredName, storeName } from "@/lib/playerSession";

/**
 * Shareable invite alias: /join/:code.
 *
 * If the visitor already has a stored name, we forward straight to the lobby.
 * Otherwise we prompt once for a name, persist it, then forward. Invalid join
 * codes (not 4 letters) bounce home with ?invalidJoin=<code>.
 */
export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const rawCode =
    typeof params.code === "string" ? params.code.toUpperCase() : "";
  const code = rawCode.trim();
  const validCode = /^[A-Z]{4}$/.test(code);

  const [checked, setChecked] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validCode) {
      router.replace(`/?invalidJoin=${encodeURIComponent(rawCode || "")}`);
      return;
    }
    const stored = getStoredName();
    if (stored && stored.trim().length > 0) {
      router.replace(`/lobby/${code}`);
      return;
    }
    setNeedsName(true);
    setChecked(true);
  }, [router, code, rawCode, validCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) {
      setError("Please enter a name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      storeName(name);
      await ensurePlayer(name);
      router.replace(`/lobby/${code}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (!checked || !needsName) {
    return (
      <div className="max-w-md mx-auto mt-24 px-6 flex flex-col items-center gap-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              style={{
                animation: "parlorWinPulse 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
        <div className="text-sm text-base-content/60 uppercase tracking-[0.2em]">
          Taking you to the table…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-20 flex flex-col gap-8">
      <section className="flex flex-col items-center gap-5 text-center parlor-rise">
        <div className="rule-ornament">
          <span className="rule-ornament-line" />
          <span>◆ You're invited ◆</span>
          <span className="rule-ornament-line" />
        </div>
        <h1
          className="font-display leading-[1.05]"
          style={{ fontSize: "var(--text-display-sm)" }}
        >
          Joining table{" "}
          <span className="font-mono tracking-[0.2em] text-primary">{code}</span>
        </h1>
        <p className="text-base-content/65 max-w-sm">
          Pick a name others will see. It saves to this device — no account
          needed.
        </p>
      </section>

      <form
        onSubmit={submit}
        className="surface-ivory p-5 md:p-6 flex flex-col gap-5 parlor-rise"
        style={{ animationDelay: "80ms" }}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="join-name-input"
            className="text-[10px] font-semibold uppercase tracking-[0.22em] text-base-content/55"
          >
            Your name
          </label>
          <input
            id="join-name-input"
            type="text"
            autoFocus
            placeholder="How should others see you?"
            className="w-full bg-transparent border-0 outline-none font-display text-xl placeholder:text-base-content/30 placeholder:font-sans placeholder:text-base"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={40}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="border border-error/40 bg-error/10 text-error px-3 py-2 rounded-lg text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-xs uppercase tracking-[0.2em] text-base-content/50 hover:text-base-content transition-colors"
            onClick={() => router.replace("/")}
          >
            ← Home
          </button>
          <button
            type="submit"
            className="btn btn-primary rounded-full px-6 font-semibold tracking-wide"
            disabled={submitting || nameInput.trim().length === 0}
          >
            {submitting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Take me in →"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
