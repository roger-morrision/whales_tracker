"use client";

import {
  X,
  UserPlus,
  UserCheck,
  Trophy,
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
} from "lucide-react";
import { TRADERS, fmtUsd, fmtPct, fmtAgo, fmtNum } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip, SectionHeader } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function TraderDetailSheet() {
  const traderId = useMoby((s) => s.selectedTraderId);
  const openTrader = useMoby((s) => s.openTrader);
  const trader = TRADERS.find((t) => t.id === traderId) ?? null;

  return (
    <AnimatePresence>
      {trader && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          onClick={() => openTrader(null)}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-gold/20 rounded-t-3xl sm:rounded-3xl"
          >
            <TraderDetailContent traderId={trader.id} onClose={() => openTrader(null)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TraderDetailContent({ traderId, onClose }: { traderId: string; onClose: () => void }) {
  const trader = TRADERS.find((t) => t.id === traderId)!;
  const followed = useMoby((s) => s.followedTraders.includes(traderId));
  const toggleFollow = useMoby((s) => s.toggleFollow);
  const openToken = useMoby((s) => s.openToken);

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={onClose} className="text-muted-foreground text-sm hover:text-foreground">
          ← Back
        </button>
        <span className="font-semibold text-sm flex-1">Trader profile</span>
        <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Profile */}
      <div className="p-4 text-center">
        <div className="relative inline-block mb-2">
          <div className={cn("h-20 w-20 rounded-full bg-gradient-to-br grid place-items-center text-3xl font-bold text-white ring-4 ring-background", trader.avatarColor)}>
            {trader.avatarGlyph}
          </div>
          {trader.rank <= 3 && (
            <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-gold grid place-items-center ring-2 ring-background">
              <Trophy className="h-3.5 w-3.5 text-background" />
            </span>
          )}
        </div>
        <h2 className="font-bold text-lg">{trader.displayName}</h2>
        <button className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          @{trader.handle} <Copy className="h-3 w-3" />
        </button>
        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">{trader.bio}</p>
        <div className="flex justify-center gap-1.5 mt-3">
          {trader.tags.map((t) => (
            <Chip key={t} variant={t === "Whale" ? "gold" : t === "KOL" ? "bull" : "default"}>
              {t}
            </Chip>
          ))}
        </div>
        <button
          onClick={() => toggleFollow(trader.id)}
          className={cn(
            "mt-3 w-full max-w-[200px] mx-auto py-2 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors",
            followed
              ? "bg-surface-3 text-foreground border border-border"
              : "bg-bull text-background hover:opacity-90"
          )}
        >
          {followed ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {followed ? "Following" : "Follow trader"}
        </button>
      </div>

      {/* Stats */}
      <div className="px-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Smart score" value={`${trader.smartScore}`} accent="gold" icon={<Target className="h-3 w-3" />} />
          <Stat label="Win rate" value={`${trader.winRate}%`} accent="bull" icon={<TrendingUp className="h-3 w-3" />} />
          <Stat label="Followers" value={fmtNum(trader.followers)} accent="default" />
        </div>
      </div>

      {/* PnL */}
      <div className="px-4 mt-3">
        <div className="rounded-xl p-3 bg-gradient-to-br from-[#14F195]/12 to-transparent border border-bull/20">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">30d realized PnL</div>
          <div className="text-2xl font-bold tabular text-bull">
            +{fmtUsd(trader.pnl30d, { compact: true })}
          </div>
          <div className="text-[11px] text-bull tabular">+{fmtPct(trader.pnl30dPct)} · all-time ROI +{fmtPct(trader.roiAllTime)}</div>
        </div>
      </div>

      {/* Top holdings */}
      <div className="px-4 mt-4">
        <SectionHeader title="Top holdings" emoji="📊" />
        <div className="space-y-2">
          {trader.topHoldings.map((h, i) => (
            <button
              key={h.symbol}
              onClick={() => {
                const tk = h.symbol.toLowerCase();
                const idMap: Record<string, string> = {
                  sol: "sol", wif: "wif", jup: "jup", bonk: "bonk", jto: "jto",
                  drift: "drift", io: "io", tnsr: "tensor", hnt: "hnt", eth: "eth",
                  rndr: "rndr", basd: "based", popcat: "popcat",
                };
                if (idMap[tk]) openToken(idMap[tk]);
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-surface-2 transition-colors"
            >
              <div className={cn(
                "h-9 w-9 rounded-full grid place-items-center text-xs font-bold text-white",
                i === 0 && "bg-bull",
                i === 1 && "bg-[#22D3EE]",
                i === 2 && "bg-gold",
                i === 3 && "bg-[#9945FF]",
                i >= 4 && "bg-surface-3 text-muted-foreground"
              )}>
                {h.symbol.slice(0, 2)}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold">${h.symbol}</div>
                <div className="text-[11px] text-muted-foreground">Position #{i + 1}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular">{h.pct}%</div>
                <div className="text-[11px] text-muted-foreground">of portfolio</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent trades */}
      <div className="px-4 mt-4 pb-6">
        <SectionHeader title="Recent trades" emoji="⚡" action="All" />
        <div className="space-y-1">
          {trader.recentTrades.map((tr) => {
            const isBuy = tr.side === "BUY";
            return (
              <div key={tr.id} className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-surface-2 transition-colors">
                <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", isBuy ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear")}>
                  {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">${tr.tokenSymbol}</span>
                    <span className={cn("text-[10px] font-bold", isBuy ? "text-bull" : "text-bear")}>{tr.side}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular">
                    {fmtNum(tr.tokenAmount)} @ {fmtUsd(tr.price)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular">{fmtUsd(tr.usdValue, { compact: true })}</div>
                  {tr.pnlPct !== undefined && (
                    <div className={cn("text-[10px] tabular", tr.pnlPct >= 0 ? "text-bull" : "text-bear")}>
                      {tr.pnlPct >= 0 ? "+" : ""}{tr.pnlPct.toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "default",
  icon,
}: {
  label: string;
  value: string;
  accent?: "default" | "bull" | "gold";
  icon?: React.ReactNode;
}) {
  const color = accent === "bull" ? "text-bull" : accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <div className="rounded-xl border border-border p-2.5 text-center">
      {icon && <div className={cn("inline-flex items-center justify-center mb-1", color)}>{icon}</div>}
      <div className={cn("text-sm font-bold tabular", color)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
