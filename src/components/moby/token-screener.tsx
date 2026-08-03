"use client";

import { useMemo, useState, useEffect } from "react";
import { X, SlidersHorizontal, RotateCcw, Check } from "lucide-react";
import { TOKENS, fmtUsd, fmtPrice, fmtNum, fmtAge } from "@/lib/moby-data";
import { useMoby, type ScreenerFilters } from "@/lib/moby-store";
import { useGmgn } from "@/hooks/use-gmgn";
import { TokenIcon, Sparkline, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { k: string; label: string; endpoint: string }[] = [
  { k: "trending", label: "Trending", endpoint: "/api/solana/trending?limit=50&sort=volume" },
  { k: "gainers", label: "Top gainers", endpoint: "/api/solana/gainers?limit=50&timeframe=24h" },
  { k: "newest", label: "Newest", endpoint: "/api/solana/new?limit=50" },
  { k: "smartMoney", label: "Smart money", endpoint: "/api/solana/trending?limit=50&sort=tx_count" },
  { k: "volume", label: "Volume", endpoint: "/api/solana/trending?limit=50&sort=volume" },
  { k: "liquidity", label: "Liquidity", endpoint: "/api/solana/trending?limit=50&sort=market_cap" },
];

export function TokenScreenerModal() {
  const open = useMoby((s) => s.screenerOpen);
  const setOpen = useMoby((s) => s.setScreenerOpen);
  const [sortBy, setSortBy] = useState("trending");
  const [search, setSearch] = useState("");
  const [minLiquidity, setMinLiquidity] = useState(0);
  const [minChange, setMinChange] = useState(-100);

  const sortOption = SORT_OPTIONS.find((s) => s.k === sortBy) || SORT_OPTIONS[0];
  const { data, loading, source } = useGmgn<{ tokens: any[] }>(
    open ? sortOption.endpoint : null,
    { refreshMs: 60_000 }
  );

  // Apply client-side filters
  const results = useMemo(() => {
    const tokens = data?.tokens || [];
    return tokens.filter((t: any) => {
      if (t.liquidity < minLiquidity) return false;
      const change = t.change_24h ?? 0;
      if (change < minChange) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.symbol?.toLowerCase().includes(q) && !t.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data, search, minLiquidity, minChange]);

  const reset = () => {
    setSortBy("trending");
    setSearch("");
    setMinLiquidity(0);
    setMinChange(-100);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog" aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Token screener</h2>
              {source && (
                <Chip variant={source === "dexscreener" ? "bull" : "outline"} className="text-[9px]">
                  {source === "dexscreener" ? "live" : "demo"}
                </Chip>
              )}
              <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Filters */}
              <div className="p-4 space-y-3 border-b border-border">
                {/* Search */}
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by symbol or name…"
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bull/40"
                />

                {/* Sort */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Sort by</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SORT_OPTIONS.map((s) => (
                      <button
                        key={s.k}
                        onClick={() => setSortBy(s.k)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                          sortBy === s.k
                            ? "bg-bull/15 text-bull border-bull/30"
                            : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min liquidity */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Min liquidity</span>
                    <span className="text-[11px] font-semibold tabular">{minLiquidity === 0 ? "Any" : `$${(minLiquidity / 1000).toFixed(0)}K`}</span>
                  </div>
                  <input type="range" min={0} max={500_000} step={10_000} value={minLiquidity} onChange={(e) => setMinLiquidity(Number(e.target.value))} className="w-full accent-bull h-1.5" />
                </div>

                {/* Min change */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Min change %</span>
                    <span className="text-[11px] font-semibold tabular">{minChange === -100 ? "Any" : `≥${minChange}%`}</span>
                  </div>
                  <input type="range" min={-100} max={100} step={5} value={minChange} onChange={(e) => setMinChange(Number(e.target.value))} className="w-full accent-bull h-1.5" />
                </div>
              </div>

              {/* Results */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-semibold">{results.length}</span> tokens match
                  </span>
                </div>

                {/* Loading */}
                {loading && results.length === 0 ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="rounded-xl border border-border p-2.5 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-surface-3" />
                          <div className="flex-1 space-y-1">
                            <div className="h-3 w-20 bg-surface-3 rounded" />
                            <div className="h-2 w-32 bg-surface-3 rounded" />
                          </div>
                          <div className="h-4 w-12 bg-surface-3 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No tokens match these filters.
                    <br />
                    <button onClick={reset} className="text-bull mt-1 hover:opacity-80">Reset filters</button>
                  </div>
                ) : (
                  /* Real token list */
                  <div className="space-y-1">
                    {results.map((t: any, idx: number) => {
                      const change = t.change_24h ?? 0;
                      const isBull = change >= 0;
                      const tk = TOKENS.find((tt) => tt.mint === t.address);
                      const ageMin = t.created_at ? Math.round((Date.now() - t.created_at) / 60000) : 0;
                      const ageLabel = ageMin > 0 ? (ageMin < 60 ? `${ageMin}m` : ageMin < 1440 ? `${Math.floor(ageMin / 60)}h` : `${Math.floor(ageMin / 1440)}d`) : "";

                      return (
                        <div
                          key={t.address || idx}
                          onClick={() => {
                            setOpen(false);
                            if (tk) {
                              useMoby.getState().openToken(tk.id);
                            } else {
                              useMoby.getState().viewExternalToken(t);
                            }
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-2 transition-colors text-left cursor-pointer"
                        >
                          <div className="w-5 text-center text-[10px] font-mono text-muted-foreground">{idx + 1}</div>
                          {t.image_uri ? (
                            <img
                              src={t.image_uri}
                              alt={t.symbol}
                              className="h-9 w-9 rounded-full object-cover shrink-0"
                              onError={(e) => { (e.currentTarget.style.display = "none"); }}
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-surface-3 to-surface-2 grid place-items-center text-xs font-bold shrink-0">
                              {t.symbol?.[0] ?? "?"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm truncate">{t.symbol}</span>
                              {t.smart_money_holders > 0 && <Chip variant="bull" className="text-[9px]">SMART ↑</Chip>}
                              {t.dex && <Chip variant="outline" className="text-[9px]">{t.dex}</Chip>}
                              {ageLabel && <span className="text-[9px] text-muted-foreground">{ageLabel}</span>}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              <span className="text-[10px] text-muted-foreground truncate">
                                {t.name} · Liq {fmtUsd(t.liquidity ?? 0, { compact: true })}
                              </span>
                              {t.smart_money_holders > 0 && (
                                <span className="text-[10px] text-bull">· {t.smart_money_holders} smart</span>
                              )}
                              {t.txns_24h_buys > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  · <span className="text-bull">{t.txns_24h_buys}b</span> <span className="text-bear">{t.txns_24h_sells}s</span>
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Sparkline */}
                          <div className="w-12 h-5 shrink-0 hidden xs:block">
                            <Sparkline
                              data={(() => {
                                const pts: number[] = [];
                                let v = t.price * (1 - change / 100);
                                for (let i = 0; i < 15; i++) {
                                  v = v * (1 + (Math.random() - 0.4) * 0.03 + change / 1500);
                                  pts.push(v);
                                }
                                pts.push(t.price);
                                return pts;
                              })()}
                              width={48}
                              height={20}
                              bullish={isBull}
                            />
                          </div>
                          {/* Price */}
                          <div className="text-right shrink-0">
                            <div className="text-xs font-semibold tabular">{fmtPrice(t.price ?? 0)}</div>
                            <div className={cn("text-[10px] tabular", isBull ? "text-bull" : "text-bear")}>
                              {isBull ? "+" : ""}{change.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
