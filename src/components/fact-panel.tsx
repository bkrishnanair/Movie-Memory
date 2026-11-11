"use client";

import { useCallback, useEffect, useState } from "react";
import type { FactResult } from "@/lib/fact-types";

export function FactPanel() {
  const [result, setResult] = useState<FactResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFact = useCallback((signal?: AbortSignal) => {
    return fetch("/api/fact", { method: "POST", cache: "no-store", signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "We couldn't load a movie fact. Please try again.");
        }
        if (!signal?.aborted) setResult(body as FactResult);
      })
      .catch((cause: unknown) => {
        if (!signal?.aborted) {
          setError(cause instanceof Error ? cause.message : "We couldn't load a movie fact. Please try again.");
        }
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadFact(controller.signal);
    return () => controller.abort();
  }, [loadFact]);

  return (
    <section aria-labelledby="fact-heading" aria-busy={loading} className="mt-6 rounded-2xl border border-stone-300 bg-amber-50 p-6 sm:p-10">
      <h2 id="fact-heading" className="text-xs font-semibold tracking-[0.2em] text-stone-600 uppercase">A little movie trivia</h2>
      <div aria-live="polite">
        {loading && <p role="status" className="mt-4 text-stone-600">Finding a fact about your movie...</p>}
        {result && <p className="mt-4 text-lg leading-relaxed">{result.fact.text}</p>}
        {result?.source === "stale" && <p role="status" className="mt-3 text-sm text-stone-600">Showing your last saved fact. A new one is unavailable right now.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => {
          setLoading(true);
          setError(null);
          void loadFact();
        }}
        disabled={loading}
        className="mt-6 rounded-lg border border-stone-400 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-900 disabled:cursor-wait disabled:opacity-60"
      >
        {error ? "Try again" : "Refresh fact"}
      </button>
      <p className="mt-3 text-xs text-stone-600">Facts refresh at most once a minute.</p>
    </section>
  );
}
