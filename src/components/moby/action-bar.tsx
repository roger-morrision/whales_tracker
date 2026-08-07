"use client";

import { useMemo, useState } from "react";
import { Clock, PieChart, Star, TrendingUp } from "lucide-react";
import { TOKENS, fmtPct, fmtPrice } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { cn } from "@/lib/utils";

type ScopeKey = "all" | "watchlist" | "holdings" | "recent";

export default function ActionBar() {
  const watchlist = useMoby((s) => s.watchlist);
  const portfolioHoldings = useMoby((s) => s.portfolioHoldings);
  const recentlyViewed = useMoby((s) => s.recentlyViewed);
  const prices = useMoby((s) => s.prices);
  const [selectedScope, setSelectedScope] = useState<ScopeKey>("all");

  const scopeData = useMemo(() => {
    const watchlistIds = watchlist;
    const holdingIds = portfolioHoldings.map((holding) => holding.tokenId);
    const recentIds = recentlyViewed;
    const allIds = Array.from(new Set([...watchlistIds, ...holdingIds, ...recentIds]));
    return {
      all: allIds,
      watchlist: watchlistIds,
      holdings: holdingIds,
      recent: recentIds,
    };
  }, [portfolioHoldings, recentlyViewed, watchlist]);

  const tabs: { id: ScopeKey; label: string; icon: typeof TrendingUp }[] = [
    { id: "all", label: "All", icon: TrendingUp },
    { id: "watchlist", label: "Watchlist", icon: Star },
    { id: "holdings", label: "Holdings", icon: PieChart },
    { id: "recent", label: "Recent", icon: Clock },
  ];

  const selectedTokenIds = scopeData[selectedScope];
  const previewTokens = selectedTokenIds
    .map((tokenId) => {
      const token = TOKENS.find((entry) => entry.id === tokenId);
      if (!token) return null;
      const livePrice = prices[tokenId]?.price ?? token.price;
      const changePct = token.price > 0 ? ((livePrice - token.price) / token.price) * 100 : 0;
      return { token, livePrice, changePct };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .slice(0, 3);

  return (
    <section className="border-b border-border bg-surface/70 px-4 py-3 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = scopeData[tab.id].length;
          const isSelected = selectedScope === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedScope(tab.id)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors",
                isSelected
                  ? "border-bull/30 bg-bull/15 text-bull"
                  : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px]",
                  isSelected ? "bg-bull text-background" : "bg-surface-3 text-foreground/80"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {previewTokens.length > 0 ? (
          previewTokens.map(({ token, livePrice, changePct }) => (
            <button
              key={`${selectedScope}-${token.id}`}
              onClick={() => useMoby.getState().openToken(token.id)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/70 px-3 py-1.5 text-left transition-colors hover:bg-surface-3"
            >
              <span className="text-xs font-semibold">{token.symbol}</span>
              <span className="tabular text-[11px] text-muted-foreground">{fmtPrice(livePrice)}</span>
              <span className={cn("tabular text-[11px] font-semibold", changePct >= 0 ? "text-bull" : "text-bear")}>
                {changePct >= 0 ? "+" : ""}
                {fmtPct(changePct)}
              </span>
            </button>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            No tokens in this scope yet. Add tokens to your watchlist or open a few detail pages to build a faster workspace.
          </p>
        )}
      </div>
    </section>
  );
}
