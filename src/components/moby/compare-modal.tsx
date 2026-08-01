"use client";

import { useMemo, useState } from "react";
import { X, GitCompareArrows, Plus, Check, Trophy, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { TOKENS, TOKENS_BY_ID, fmtUsd, fmtPrice, fmtNum, fmtPct } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Sparkline, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function CompareModal() {
  const open = useMoby((s) => s.compareOpen);
  const setOpen = useMoby((s) => s.setCompareOpen);
  const compareIds = useMoby((s) => s.compareIds);
  const toggleCompare = useMoby((s) => s.toggleCompareId);
  const clearCompare = useMoby((s) => s.clearCompare);
  const prices = useMoby((s) => s.prices);
  const [showPicker, setShowPicker] = useState(false);

  const tokens = useMemo(
    () => compareIds.map((id) => TOKENS_BY_ID[id]).filter(Boolean),
    [compareIds]
  );

  const best = useMemo(() => {
    if (tokens.length < 2) return null;
    return {
      change: tokens.reduce((b, t) => (t.change24h > (b?.change24h ?? -Infinity) ? t : b), tokens[0]),
      mcap: tokens.reduce((b, t) => (t.marketCap > (b?.marketCap ?? 0) ? t : b), tokens[0]),
      liquidity: tokens.reduce((b, t) => (t.liquidity > (b?.liquidity ?? 0) ? t : b), tokens[0]),
      volume: tokens.reduce((b, t) => (t.volume24h > (b?.volume24h ?? 0) ? t : b), tokens[0]),
      smart: tokens.reduce((b, t) => (t.smartMoneyInflow24h > (b?.smartMoneyInflow24h ?? -Infinity) ? t : b), tokens[0]),
      holders: tokens.reduce((b, t) => (t.smartMoneyHolders > (b?.smartMoneyHolders ?? 0) ? t : b), tokens[0]),
    };
  }, [tokens]);

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
              <GitCompareArrows className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Compare tokens</h2>
              {compareIds.length > 0 && (
                <button
                  onClick={clearCompare}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
              {tokens.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-2xl bg-surface-2 grid place-items-center text-3xl mx-auto mb-3">
                    ⚖️
                  </div>
                  <h3 className="font-semibold mb-1">Compare up to 3 tokens</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Side-by-side comparison of price, market cap, liquidity, smart money, and more.
                  </p>
                  <button
                    onClick={() => setShowPicker(true)}
                    className="px-4 py-2 rounded-xl bg-bull text-background text-sm font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Add tokens
                  </button>
                </div>
              ) : (
                <>
                  {/* Token headers */}
                  <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${tokens.length}, 1fr)` }}>
                    {tokens.map((t) => {
                      const live = prices[t.id]?.price ?? t.price;
                      return (
                        <div key={t.id} className="rounded-xl border border-border p-2.5 text-center">
                          <button
                            onClick={() => toggleCompare(t.id)}
                            className="ml-auto block text-muted-foreground hover:text-bear text-[10px]"
                          >
                            ✕ remove
                          </button>
                          <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="md" className="mx-auto mb-1" />
                          <div className="font-semibold text-sm">{t.symbol}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{t.name}</div>
                          <div className="text-xs font-semibold tabular mt-1">{fmtPrice(live)}</div>
                          <div className={cn("text-[10px] tabular", t.change24h >= 0 ? "text-bull" : "text-bear")}>
                            {t.change24h >= 0 ? "+" : ""}
                            {t.change24h.toFixed(2)}%
                          </div>
                          <Sparkline data={t.sparkline} width={80} height={20} bullish={t.change24h >= 0} className="mx-auto mt-1" />
                        </div>
                      );
                    })}
                    {tokens.length < 3 && (
                      <button
                        onClick={() => setShowPicker(true)}
                        className="rounded-xl border-2 border-dashed border-border grid place-items-center hover:border-bull/40 hover:bg-surface-2/50"
                      >
                        <Plus className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground mt-1">Add</span>
                      </button>
                    )}
                  </div>

                  {/* Comparison rows */}
                  {best && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <CompareRow label="24h change" tokens={tokens} best={best.change} getValue={(t) => t.change24h} format={(v) => fmtPct(v)} colorize="sign" />
                      <CompareRow label="Market cap" tokens={tokens} best={best.mcap} getValue={(t) => t.marketCap} format={(v) => fmtUsd(v, { compact: true })} />
                      <CompareRow label="Liquidity" tokens={tokens} best={best.liquidity} getValue={(t) => t.liquidity} format={(v) => fmtUsd(v, { compact: true })} />
                      <CompareRow label="24h volume" tokens={tokens} best={best.volume} getValue={(t) => t.volume24h} format={(v) => fmtUsd(v, { compact: true })} />
                      <CompareRow label="Smart money inflow" tokens={tokens} best={best.smart} getValue={(t) => t.smartMoneyInflow24h} format={(v) => `${v >= 0 ? "+" : "-"}${fmtUsd(Math.abs(v), { compact: true })}`} colorize="sign" />
                      <CompareRow label="Smart wallets" tokens={tokens} best={best.holders} getValue={(t) => t.smartMoneyHolders} format={(v) => fmtNum(v)} />
                      <CompareRow label="Holders" tokens={tokens} best={best.holders} getValue={(t) => t.holders} format={(v) => fmtNum(v)} />
                      <CompareRow label="Age" tokens={tokens} best={null} getValue={(t) => t.ageHours} format={(v) => (v < 24 ? `${v}h` : `${Math.floor(v / 24)}d`)} />
                      <CompareRow label="Chain" tokens={tokens} best={null} getValue={(t) => t.chain as unknown as number} format={(v) => String(v)} />
                      <CompareRow label="Category" tokens={tokens} best={null} getValue={(t) => t.category as unknown as number} format={(v) => String(v)} last />
                    </div>
                  )}

                  {/* Winner summary */}
                  {best && (
                    <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Trophy className="h-3.5 w-3.5 text-gold" />
                        <span className="text-xs font-semibold">Smart money favorite</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={best.smart.symbol} glyph={best.smart.logoGlyph} color={best.smart.logoColor} size="sm" />
                        <div>
                          <div className="text-sm font-semibold">{best.smart.symbol}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Highest smart-money inflow · {fmtUsd(best.smart.smartMoneyInflow24h, { compact: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {showPicker && (
                    <div className="mt-3 rounded-xl border border-border p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">Pick a token</div>
                      <div className="max-h-40 overflow-y-auto scrollbar-thin">
                        {TOKENS.filter((t) => !compareIds.includes(t.id)).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              toggleCompare(t.id);
                              setShowPicker(false);
                            }}
                            className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-surface-2 text-left"
                          >
                            <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="xs" />
                            <span className="text-xs font-semibold">{t.symbol}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CompareRow({
  label,
  tokens,
  best,
  getValue,
  format,
  colorize,
  last,
}: {
  label: string;
  tokens: typeof TOKENS;
  best: (typeof TOKENS)[number] | null;
  getValue: (t: (typeof TOKENS)[number]) => number;
  format: (v: number) => string;
  colorize?: "sign";
  last?: boolean;
}) {
  return (
    <div className={cn("grid gap-2 p-2.5 border-border", !last && "border-b")} style={{ gridTemplateColumns: `repeat(${tokens.length}, 1fr)` }}>
      <div className="col-span-full text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>
      {tokens.map((t) => {
        const v = getValue(t);
        const isBest = best && t.id === best.id;
        const isBull = colorize === "sign" ? v >= 0 : undefined;
        return (
          <div
            key={t.id}
            className={cn(
              "text-center py-1 rounded relative",
              isBest && "bg-gold/10 ring-1 ring-gold/30"
            )}
          >
            {isBest && (
              <Trophy className="absolute -top-1 -right-1 h-3 w-3 text-gold" />
            )}
            <span
              className={cn(
                "text-xs font-semibold tabular",
                isBull === true && "text-bull",
                isBull === false && "text-bear"
              )}
            >
              {format(v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
