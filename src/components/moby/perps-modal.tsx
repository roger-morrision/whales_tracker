"use client";

import { useState, useMemo } from "react";
import { X, TrendingUp, TrendingDown, Flame, Activity, Zap } from "lucide-react";
import { PERP_MARKETS, PERP_POSITIONS, fmtUsd, fmtPrice, fmtPct, fmtNum, fmtAgo, type PerpMarket, type PerpPosition } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip, Sparkline } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function PerpsModal() {
  const open = useMoby((s) => s.perpsOpen);
  const setOpen = useMoby((s) => s.setPerpsOpen);
  const [tab, setTab] = useState<"markets" | "positions">("markets");
  const [selectedMarket, setSelectedMarket] = useState<PerpMarket | null>(null);

  const totalPnl = PERP_POSITIONS.reduce((s, p) => s + p.unrealizedPnl, 0);
  const totalMargin = PERP_POSITIONS.reduce((s, p) => s + p.marginUsd, 0);

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
            className="relative w-full sm:max-w-md h-[90vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Zap className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Perpetuals</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {[
                { k: "markets", label: "Markets" },
                { k: "positions", label: `My Positions (${PERP_POSITIONS.length})` },
              ].map((s) => (
                <button
                  key={s.k}
                  onClick={() => setTab(s.k as typeof tab)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                    tab === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
              {tab === "markets" ? (
                <div className="space-y-2">
                  {PERP_MARKETS.map((m) => (
                    <PerpMarketCard key={m.id} market={m} onClick={() => setSelectedMarket(m)} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border p-2.5 text-center">
                      <div className="text-lg font-bold tabular">{fmtUsd(totalMargin, { compact: true })}</div>
                      <div className="text-[10px] text-muted-foreground">Margin</div>
                    </div>
                    <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center">
                      <div className={cn("text-lg font-bold tabular", totalPnl >= 0 ? "text-bull" : "text-bear")}>
                        {totalPnl >= 0 ? "+" : "-"}{fmtUsd(Math.abs(totalPnl), { compact: true })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Unrealized PnL</div>
                    </div>
                    <div className="rounded-xl border border-border p-2.5 text-center">
                      <div className="text-lg font-bold tabular">{PERP_POSITIONS.length}</div>
                      <div className="text-[10px] text-muted-foreground">Open</div>
                    </div>
                  </div>

                  {PERP_POSITIONS.map((p) => (
                    <PerpPositionCard key={p.id} position={p} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PerpMarketCard({ market, onClick }: { market: PerpMarket; onClick: () => void }) {
  const isBull = market.priceChange24h >= 0;
  const fundingPositive = market.fundingRate >= 0;
  const nextFundingH = Math.floor(market.nextFundingMs / 3600000);

  return (
    <div
      onClick={onClick}
      className="rounded-xl border border-border p-3 hover:bg-surface-2 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white text-sm", market.color)}>
          {market.glyph}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">{market.symbol}</span>
            <Chip variant="outline">{market.maxLeverage}x</Chip>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{market.name}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular">{fmtPrice(market.markPrice)}</div>
          <div className={cn("text-[11px] tabular flex items-center justify-end gap-0.5", isBull ? "text-bull" : "text-bear")}>
            {isBull ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {fmtPct(market.priceChange24h)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Funding (8h)</div>
          <div className={cn("text-[11px] font-semibold tabular", fundingPositive ? "text-bull" : "text-bear")}>
            {fundingPositive ? "+" : ""}{market.fundingRate.toFixed(4)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Open Interest</div>
          <div className="text-[11px] font-semibold tabular">{fmtUsd(market.openInterestUsd, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Next funding</div>
          <div className="text-[11px] font-semibold tabular">{nextFundingH}h</div>
        </div>
      </div>

      {/* Long/Short ratio bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[9px] mb-0.5">
          <span className="text-bull">{market.openInterestLong}% Long</span>
          <span className="text-bear">{market.openInterestShort}% Short</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-3">
          <div className="bg-bull" style={{ width: `${market.openInterestLong}%` }} />
          <div className="bg-bear" style={{ width: `${market.openInterestShort}%` }} />
        </div>
      </div>
    </div>
  );
}

function PerpPositionCard({ position }: { position: PerpPosition }) {
  const isLong = position.side === "LONG";
  const isProfit = position.unrealizedPnl >= 0;
  const liquidationDistance = Math.abs(
    ((position.markPrice - position.liquidationPrice) / position.markPrice) * 100
  );

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Chip variant={isLong ? "bull" : "bear"}>{position.side}</Chip>
        <span className="font-semibold text-sm">{position.marketSymbol}</span>
        <span className="text-[10px] text-muted-foreground">{position.leverage}x</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{fmtAgo(position.openedAgoSec)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Size</div>
          <div className="font-semibold tabular">{fmtUsd(position.sizeUsd, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Entry</div>
          <div className="font-semibold tabular">{fmtPrice(position.entryPrice)}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Mark</div>
          <div className="font-semibold tabular">{fmtPrice(position.markPrice)}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Margin</div>
          <div className="font-semibold tabular">{fmtUsd(position.marginUsd, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Liq. Price</div>
          <div className="font-semibold tabular text-bear">{fmtPrice(position.liquidationPrice)}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Unrealized PnL</div>
          <div className={cn("font-semibold tabular", isProfit ? "text-bull" : "text-bear")}>
            {isProfit ? "+" : ""}{fmtUsd(position.unrealizedPnl)} ({fmtPct(position.unrealizedPnlPct)})
          </div>
        </div>
      </div>

      {/* Liquidation distance bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[9px] mb-0.5">
          <span className="text-muted-foreground">Liquidation distance</span>
          <span className={cn("font-semibold tabular", liquidationDistance < 10 ? "text-bear" : "text-muted-foreground")}>
            {liquidationDistance.toFixed(1)}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
          <div
            className={cn("h-full rounded-full", liquidationDistance < 10 ? "bg-bear" : liquidationDistance < 25 ? "bg-gold" : "bg-bull")}
            style={{ width: `${Math.min(100, liquidationDistance * 2)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button className="py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2">
          Add margin
        </button>
        <button className="py-1.5 rounded-lg bg-bull text-background text-xs font-bold hover:opacity-90">
          Close position
        </button>
      </div>
    </div>
  );
}
