"use client";

import { useMemo } from "react";
import { TOKENS, type Token } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";

/**
 * Returns the full TOKENS array with live prices overlaid from the store.
 * Every component that displays token prices should use this instead of
 * importing TOKENS directly, so prices always reflect real on-chain data.
 *
 * The store's `prices` object is updated every 2.5s (local tick) and every
 * 15s (real DexScreener fetch). This hook merges those live prices into
 * the static token definitions.
 */
export function useLiveTokens(): Token[] {
  const prices = useMoby((s) => s.prices);

  return useMemo(() => {
    return TOKENS.map((t) => {
      const live = prices[t.id];
      if (!live) return t;
      // Overlay live price + recompute change from prev
      const change24h = live.prev > 0
        ? ((live.price - t.price) / t.price) * 100
        : t.change24h;
      return {
        ...t,
        price: live.price,
        change24h: Number(change24h.toFixed(2)),
      };
    });
  }, [prices]);
}

/**
 * Returns TOKENS_BY_ID equivalent with live prices overlaid.
 */
export function useLiveTokensById(): Record<string, Token> {
  const liveTokens = useLiveTokens();
  return useMemo(() => {
    const map: Record<string, Token> = {};
    for (const t of liveTokens) {
      map[t.id] = t;
    }
    return map;
  }, [liveTokens]);
}

/**
 * Get a single token with live price.
 */
export function useLiveToken(tokenId: string | null | undefined): Token | null {
  const prices = useMoby((s) => s.prices);
  return useMemo(() => {
    if (!tokenId) return null;
    const t = TOKENS.find((tk) => tk.id === tokenId);
    if (!t) return null;
    const live = prices[tokenId];
    if (!live) return t;
    const change24h = live.prev > 0
      ? ((live.price - t.price) / t.price) * 100
      : t.change24h;
    return {
      ...t,
      price: live.price,
      change24h: Number(change24h.toFixed(2)),
    };
  }, [tokenId, prices]);
}
