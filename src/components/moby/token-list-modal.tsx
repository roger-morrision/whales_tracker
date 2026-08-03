"use client";

import { useState, useMemo } from "react";
import { X, ArrowUpRight, ArrowDownRight, Flame } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { useGmgn } from "@/hooks/use-gmgn";
import { TOKENS, fmtUsd, fmtPrice, fmtAgo } from "@/lib/moby-data";
import { Chip, Sparkline } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Generic token list modal — opens when user clicks "View all" on any
 * trending/boosted/hot-search section. Shows a full scrollable table of
 * tokens from the specified API endpoint.
 */
export function TokenListModal() {
  const open = useMoby((s) => s.tokenListOpen);
  const config = useMoby((s) => s.tokenListConfig);
  const setOpen = useMoby((s) => s.setTokenListOpen);
  const [sortBy, setSortBy] = useState<"volume" | "change" | "market_cap" | "liquidity">("volume");
  const [minLiquidity, setMinLiquidity] = useState(0);

  const { data, loading, source } = useGmgn<any>(open && config ? config.endpoint : null, { refreshMs: 60_000 });

  // Extract tokens from response (handles both {tokens:[]} and {hotSearches:[]} shapes)
  const rawTokens = useMemo(() => {
    if (!data) return [];
    return data.tokens || data.hotSearches || [];
  }, [data]);

  // Apply filters + sort
  const tokens = useMemo(() => {
    let result = rawTokens.filter((t: any) => (t.liquidity ?? 0) >= minLiquidity);
    if (sortBy === "volume") result.sort((a: any, b: any) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0));
    else if (sortBy === "change") result.sort((a: any, b: any) => (b.change_24h ?? 0) - (a.change_24h ?? 0));
    else if (sortBy === "market_cap") result.sort((a: any, b: any) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
    else if (sortBy === "liquidity") result.sort((a: any, b: any) => (b.liquidity ?? 0) - (a.liquidity ?? 0));
    return result;
  }, [rawTokens, sortBy, minLiquidity]);

  return (
    <AnimatePresence>
      {open && config && (
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
              <span className="font-semibold text-sm flex-1">{config.title}</span>
              {source && (
                <Chip variant={source === "dexscreener" || source === "gmgn" ? "bull" : "outline"} className="text-[9px]">
                  {source === "dexscreener" || source === "gmgn" ? "live" : "demo"}
                </Chip>
              )}
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sort + filter bar */}
            <div className="flex items-center gap-2 p-2 border-b border-border bg-surface-3/30 overflow-x-auto no-scrollbar">
              <div className="flex gap-0.5">
                {([
                  { k: "volume", label: "Vol" },
                  { k: "change", label: "Change" },
                  { k: "market_cap", label: "MC" },
                  { k: "liquidity", label: "Liq" },
                ] as const).map((s) => (
                  <button
                    key={s.k}
                    onClick={() => setSortBy(s.k)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap",
                      sortBy === s.k ? "bg-bull/15 text-bull" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">Min liq:</span>
                <input
                  type="range"
                  min={0}
                  max={500_000}
                  step={10_000}
                  value={minLiquidity}
                  onChange={(e) => setMinLiquidity(parseInt(e.target.value))}
                  className="w-16 h-1 rounded-full bg-surface-3 accent-bull cursor-pointer"
                />
                <span className="text-[9px] tabular text-muted-foreground whitespace-nowrap">
                  {minLiquidity === 0 ? "Any" : `$${(minLiquidity / 1000).toFixed(0)}K`}
                </span>
              </div>
            </div>

            {/* Token list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loading && tokens.length === 0 ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="rounded-xl border border-border p-3 animate-pulse">
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
              ) : tokens.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No tokens found. Try relaxing filters.
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {tokens.map((t: any, idx: number) => {
                    const change = t.change_24h ?? 0;
                    const isBull = change >= 0;
                    const tk = TOKENS.find((tt) => tt.mint === t.address);
                    const ageMin = t.created_at ? Math.round((Date.now() - t.created_at) / 60000) : 0;
                    const ageLabel = ageMin > 0 ? (ageMin < 60 ? `${ageMin}m` : ageMin < 1440 ? `${Math.floor(ageMin / 60)}h` : `${Math.floor(ageMin / 1440)}d`) : "";

                    return (
                      <div
                        key={t.address || idx}
                        onClick={() => {
                          if (tk) {
                            useMoby.getState().setTokenListOpen(false);
                            useMoby.getState().openToken(tk.id);
                          } else {
                            useMoby.getState().viewExternalToken(t);
                          }
                        }}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-surface-2 cursor-pointer transition-colors"
                      >
                        <div className="w-5 text-center text-[10px] font-mono text-muted-foreground">{idx + 1}</div>
                        {t.image_uri ? (
                          <img
                            src={t.image_uri}
                            alt={t.symbol}
                            className="h-8 w-8 rounded-full object-cover shrink-0"
                            onError={(e) => { (e.currentTarget.style.display = "none"); }}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-surface-3 to-surface-2 grid place-items-center text-[10px] font-bold shrink-0">
                            {t.symbol?.[0] ?? "?"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm truncate">{t.symbol}</span>
                            {(t.smart_money_holders > 0 || t.boosts_active > 0) && (
                              <Chip variant="bull" className="text-[9px]">SMART ↑</Chip>
                            )}
                            {t.dex && <Chip variant="outline" className="text-[9px]">{t.dex}</Chip>}
                            {ageLabel && <span className="text-[9px] text-muted-foreground">{ageLabel}</span>}
                            {t.boosts_active && <span className="text-[9px] text-gold">🚀 {t.boosts_active}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="truncate max-w-[80px]">{t.name}</span>
                            <span>·</span>
                            <span className="tabular">MC {fmtUsd(t.market_cap ?? 0, { compact: true })}</span>
                            <span>·</span>
                            <span className="tabular">Vol {fmtUsd(t.volume_24h ?? 0, { compact: true })}</span>
                            {t.liquidity > 0 && (
                              <>
                                <span>·</span>
                                <span className="tabular">Liq {fmtUsd(t.liquidity, { compact: true })}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold tabular">{fmtPrice(t.price ?? 0)}</div>
                          <div className={cn("text-[10px] tabular flex items-center justify-end gap-0.5", isBull ? "text-bull" : "text-bear")}>
                            {isBull ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                            {Math.abs(change).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer count */}
            <div className="px-4 py-2 border-t border-border bg-surface-2/50 text-[10px] text-muted-foreground tabular">
              {tokens.length} tokens · {source === "dexscreener" ? "DexScreener live" : source === "gmgn" ? "GMGN live" : "simulated"}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
