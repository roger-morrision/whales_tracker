"use client";

import { useMemo } from "react";
import { X, SlidersHorizontal, RotateCcw, Check } from "lucide-react";
import { TOKENS, fmtUsd, fmtPrice, fmtNum } from "@/lib/moby-data";
import { useMoby, type Chain, type Category, type ScreenerFilters } from "@/lib/moby-store";
import { TokenIcon, Sparkline, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const ALL_CHAINS: Chain[] = ["SOL", "ETH", "BASE", "BTC"];
const ALL_CATEGORIES: Category[] = ["DeFi", "Meme", "AI", "L1", "L2", "Gaming", "DePIN", "RWA", "NFT", "Stablecoin"];

const SORT_OPTIONS: { k: ScreenerFilters["sortBy"]; label: string }[] = [
  { k: "trending", label: "Trending" },
  { k: "gainers", label: "Top gainers" },
  { k: "newest", label: "Newest" },
  { k: "smartMoney", label: "Smart money" },
  { k: "volume", label: "Volume" },
  { k: "liquidity", label: "Liquidity" },
];

export function TokenScreenerModal() {
  const open = useMoby((s) => s.screenerOpen);
  const setOpen = useMoby((s) => s.setScreenerOpen);
  const filters = useMoby((s) => s.screenerFilters);
  const setFilters = useMoby((s) => s.setScreenerFilters);
  const reset = useMoby((s) => s.resetScreenerFilters);
  const openToken = useMoby((s) => s.openToken);

  const results = useMemo(() => {
    let list = TOKENS.filter((t) => {
      if (filters.chains.length && !filters.chains.includes(t.chain as Chain)) return false;
      if (filters.categories.length && !filters.categories.includes(t.category as Category)) return false;
      if (t.liquidity < filters.minLiquidity) return false;
      if (t.smartMoneyHolders < filters.minSmartMoneyHolders) return false;
      if (filters.maxAgeHours > 0 && t.ageHours > filters.maxAgeHours) return false;
      if (t.volume24h < filters.minVolume24h) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!t.symbol.toLowerCase().includes(q) && !t.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    switch (filters.sortBy) {
      case "gainers":
        list = list.sort((a, b) => b.change24h - a.change24h);
        break;
      case "newest":
        list = list.sort((a, b) => a.ageHours - b.ageHours);
        break;
      case "smartMoney":
        list = list.sort((a, b) => b.smartMoneyInflow24h - a.smartMoneyInflow24h);
        break;
      case "volume":
        list = list.sort((a, b) => b.volume24h - a.volume24h);
        break;
      case "liquidity":
        list = list.sort((a, b) => b.liquidity - a.liquidity);
        break;
      default:
        list = list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    }
    return list;
  }, [filters]);

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
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Token screener</h2>
              <button
                onClick={reset}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Filters */}
              <div className="p-4 space-y-4 border-b border-border">
                {/* Search */}
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ search: e.target.value })}
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
                        onClick={() => setFilters({ sortBy: s.k })}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                          filters.sortBy === s.k
                            ? "bg-bull/15 text-bull border-bull/30"
                            : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chains */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Chains</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_CHAINS.map((c) => {
                      const active = filters.chains.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() =>
                            setFilters({
                              chains: active
                                ? filters.chains.filter((x) => x !== c)
                                : [...filters.chains, c],
                            })
                          }
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                            active
                              ? "bg-bull/15 text-bull border-bull/30"
                              : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
                          )}
                        >
                          {active && <Check className="h-2.5 w-2.5 inline mr-0.5" />}
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Categories</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_CATEGORIES.map((c) => {
                      const active = filters.categories.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() =>
                            setFilters({
                              categories: active
                                ? filters.categories.filter((x) => x !== c)
                                : [...filters.categories, c],
                            })
                          }
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                            active
                              ? "bg-bull/15 text-bull border-bull/30"
                              : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
                          )}
                        >
                          {active && <Check className="h-2.5 w-2.5 inline mr-0.5" />}
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-2 gap-3">
                  <RangeField
                    label="Min liquidity ($)"
                    value={filters.minLiquidity}
                    step={100_000}
                    min={0}
                    max={100_000_000}
                    format={(v) => fmtUsd(v, { compact: true })}
                    onChange={(v) => setFilters({ minLiquidity: v })}
                  />
                  <RangeField
                    label="Min 24h volume ($)"
                    value={filters.minVolume24h}
                    step={100_000}
                    min={0}
                    max={1_000_000_000}
                    format={(v) => fmtUsd(v, { compact: true })}
                    onChange={(v) => setFilters({ minVolume24h: v })}
                  />
                  <RangeField
                    label="Min smart wallets"
                    value={filters.minSmartMoneyHolders}
                    step={10}
                    min={0}
                    max={500}
                    format={(v) => `${Math.round(v)}`}
                    onChange={(v) => setFilters({ minSmartMoneyHolders: v })}
                  />
                  <RangeField
                    label="Max age (hours)"
                    value={filters.maxAgeHours}
                    step={24}
                    min={0}
                    max={2016}
                    format={(v) => (v === 0 ? "Any" : `${Math.round(v)}h`)}
                    onChange={(v) => setFilters({ maxAgeHours: v })}
                  />
                </div>
              </div>

              {/* Results */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-semibold">{results.length}</span> tokens match
                  </span>
                </div>
                <div className="space-y-1">
                  {results.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        openToken(t.id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-2 transition-colors text-left"
                    >
                      <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="md" live={t.ageHours < 200} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm">{t.symbol}</span>
                          {t.smartMoneyInflow24h > 1_000_000 && <Chip variant="bull">Smart ↑</Chip>}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {t.chain} · {fmtUsd(t.liquidity, { compact: true })} liq · {t.smartMoneyHolders} smart
                        </div>
                      </div>
                      <Sparkline data={t.sparkline} width={50} height={20} bullish={t.change24h >= 0} />
                      <div className="text-right">
                        <div className="text-xs font-semibold tabular">{fmtPrice(t.price)}</div>
                        <div className={cn("text-[10px] tabular", t.change24h >= 0 ? "text-bull" : "text-bear")}>
                          {t.change24h >= 0 ? "+" : ""}
                          {t.change24h.toFixed(1)}%
                        </div>
                      </div>
                    </button>
                  ))}
                  {results.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No tokens match these filters.
                      <br />
                      <button onClick={reset} className="text-bull mt-1 hover:opacity-80">
                        Reset filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <span className="text-[11px] font-semibold tabular text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-bull h-1.5"
      />
    </div>
  );
}
