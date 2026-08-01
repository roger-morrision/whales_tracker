"use client";

import { useState, useMemo } from "react";
import { X, Scale, RefreshCw, Plus, Trash2, Target, TrendingUp } from "lucide-react";
import { PORTFOLIO, TOKENS_BY_ID, fmtUsd, fmtPct } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TargetAllocation {
  tokenId: string;
  targetPct: number;
}

export function RebalanceModal() {
  const open = useMoby((s) => s.rebalanceOpen);
  const setOpen = useMoby((s) => s.setRebalanceOpen);

  // Compute current allocations
  const current = useMemo(() => {
    const holdings = PORTFOLIO.cryptoHoldings.map((h) => {
      const tk = TOKENS_BY_ID[h.tokenId];
      const value = h.amount * (tk?.price ?? 0);
      return { tokenId: h.tokenId, value, symbol: tk?.symbol ?? "", token: tk };
    });
    const total = holdings.reduce((s, h) => s + h.value, 0);
    return holdings.map((h) => ({ ...h, pct: (h.value / total) * 100 })).sort((a, b) => b.value - a.value);
  }, []);

  const totalValue = current.reduce((s, h) => s + h.value, 0);

  // Target allocations (state)
  const [targets, setTargets] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    current.forEach((h, i) => {
      // Default: equal weight among top 5
      out[h.tokenId] = i < 5 ? 20 : 0;
    });
    return out;
  });

  const targetTotal = Object.values(targets).reduce((s, v) => s + v, 0);

  // Compute required trades
  const trades = useMemo(() => {
    return current.map((h) => {
      const targetValue = (targets[h.tokenId] ?? 0) / 100 * totalValue;
      const diff = targetValue - h.value;
      return {
        ...h,
        targetPct: targets[h.tokenId] ?? 0,
        targetValue,
        diff,
        action: diff > 1 ? "BUY" : diff < -1 ? "SELL" : "HOLD",
      };
    });
  }, [current, targets, totalValue]);

  const buys = trades.filter((t) => t.action === "BUY").reduce((s, t) => s + t.diff, 0);
  const sells = Math.abs(trades.filter((t) => t.action === "SELL").reduce((s, t) => s + t.diff, 0));

  const updateTarget = (tokenId: string, value: number) => {
    setTargets((prev) => ({ ...prev, [tokenId]: Math.max(0, Math.min(100, value)) }));
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
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Scale className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Rebalance portfolio</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border p-2.5 text-center">
                  <div className="text-sm font-bold tabular">{fmtUsd(totalValue, { compact: true })}</div>
                  <div className="text-[10px] text-muted-foreground">Total value</div>
                </div>
                <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center">
                  <div className="text-sm font-bold tabular text-bull">+{fmtUsd(buys, { compact: true })}</div>
                  <div className="text-[10px] text-muted-foreground">To buy</div>
                </div>
                <div className="rounded-xl border border-bear/30 bg-bear/5 p-2.5 text-center">
                  <div className="text-sm font-bold tabular text-bear">-{fmtUsd(sells, { compact: true })}</div>
                  <div className="text-[10px] text-muted-foreground">To sell</div>
                </div>
              </div>

              {/* Target total warning */}
              <div className={cn(
                "rounded-lg p-2.5 flex items-center justify-between text-[11px]",
                Math.abs(targetTotal - 100) < 0.5 ? "bg-bull/10 text-bull" : "bg-gold/10 text-gold"
              )}>
                <span>Target allocation total</span>
                <span className="font-bold tabular">{targetTotal.toFixed(1)}% {targetTotal === 100 ? "✓" : `(${(100 - targetTotal).toFixed(1)}% off)`}</span>
              </div>

              {/* Allocation editor */}
              <div className="space-y-2">
                {trades.map((t) => {
                  const diffPct = t.targetPct - t.pct;
                  return (
                    <div key={t.tokenId} className="rounded-xl border border-border p-2.5">
                      <div className="flex items-center gap-2 mb-2">
                        {t.token && (
                          <TokenIcon symbol={t.symbol} glyph={t.token.logoGlyph} color={t.token.logoColor} size="sm" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">${t.symbol}</div>
                          <div className="text-[10px] text-muted-foreground tabular">
                            {fmtUsd(t.value, { compact: true })} ({t.pct.toFixed(1)}%)
                          </div>
                        </div>
                        <Chip variant={t.action === "BUY" ? "bull" : t.action === "SELL" ? "bear" : "default"}>
                          {t.action}
                        </Chip>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-12">Target</span>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={t.targetPct}
                          onChange={(e) => updateTarget(t.tokenId, Number(e.target.value))}
                          className="flex-1 accent-bull h-1.5"
                        />
                        <span className="text-[11px] font-semibold tabular w-12 text-right">{t.targetPct}%</span>
                      </div>
                      {Math.abs(diffPct) > 0.5 && (
                        <div className="flex items-center justify-between text-[10px] mt-1.5 tabular">
                          <span className="text-muted-foreground">
                            {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}% change
                          </span>
                          <span className={cn("font-semibold", t.diff > 0 ? "text-bull" : "text-bear")}>
                            {t.diff > 0 ? "+" : "-"}{fmtUsd(Math.abs(t.diff), { compact: true })}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Execute */}
              <button className="w-full py-2.5 rounded-xl bg-bull text-background text-sm font-bold hover:opacity-90 flex items-center justify-center gap-1.5">
                <RefreshCw className="h-4 w-4" /> Execute rebalance
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                This will execute {trades.filter((t) => t.action !== "HOLD").length} trades. Estimated gas: $0.012
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
