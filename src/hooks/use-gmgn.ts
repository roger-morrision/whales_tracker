"use client";

import { useEffect, useState } from "react";

/**
 * Generic GMGN fetch hook.
 * Returns { data, loading, error, refetch }.
 *
 * Auto-fetches on mount and on URL change. Does NOT refetch on re-render.
 */

export interface GmgnState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  source: "gmgn" | "simulated" | null;
  refetch: () => void;
}

export function useGmgn<T>(url: string | null, opts?: { refreshMs?: number }): GmgnState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"gmgn" | "simulated" | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) {
      // Defer to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        setData(null);
        setLoading(false);
        setSource(null);
      });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    // Defer setState calls to avoid the synchronous-setState-in-effect lint
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        setSource(json.source ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || err?.name === "AbortError") return;
        setError(err?.message ?? "fetch failed");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, nonce]);

  // Optional auto-refresh (skipped when tab is hidden to avoid wasted CLI subprocess spawns)
  useEffect(() => {
    if (!url || !opts?.refreshMs) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setNonce((n) => n + 1);
    }, opts.refreshMs);
    return () => clearInterval(id);
  }, [url, opts?.refreshMs]);

  return { data, loading, error, source, refetch: () => setNonce((n) => n + 1) };
}
