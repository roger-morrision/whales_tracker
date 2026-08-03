"use client";

import { X, ArrowUpRight, ArrowDownRight, Wallet, Copy, Star, StarOff, Share2, ExternalLink } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { useGmgn } from "@/hooks/use-gmgn";
import { fmtUsd, fmtPrice, fmtNum, fmtPct } from "@/lib/moby-data";
import { Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Wallet detail sheet — shows when clicking any wallet/holder/trader address.
 * Displays real on-chain holdings, P&L, stats, and trade history from GMGN.
 */
export function WalletDetailSheet() {
  const open = useMoby((s) => s.walletDetailOpen);
  const address = useMoby((s) => s.walletDetailAddress);
  const label = useMoby((s) => s.walletDetailLabel);
  const setOpen = useMoby((s) => s.setWalletDetailOpen);
  const toggleFollowWallet = useMoby((s) => s.toggleFollowWallet);
  const followedWallets = useMoby((s) => s.followedWallets);

  // Fetch wallet portfolio data
  const portfolioUrl = address ? `/api/gmgn/portfolio?wallet=${address}` : null;
  const { data: portfolioData, loading, source } = useGmgn<any>(portfolioUrl, { refreshMs: 60_000 });

  // Fetch wallet activity
  const activityUrl = address ? `/api/gmgn/wallet-activity?wallet=${address}&limit=20` : null;
  const { data: activityData } = useGmgn<any>(activityUrl, { refreshMs: 30_000 });

  const isFollowing = address ? followedWallets.includes(address) : false;
  const stats = portfolioData?.stats;
  const holdings = portfolioData?.holdings || [];
  const activity = activityData?.activity || [];

  return (
    <AnimatePresence>
      {open && address && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
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
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-gold/20 rounded-t-3xl sm:rounded-3xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-2 z-10">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gold to-bull grid place-items-center text-sm font-bold text-background shrink-0">
                {label?.[0]?.toUpperCase() || "W"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate">{label || "Wallet"}</span>
                  {source === "gmgn" && <Chip variant="bull" className="text-[9px]">GMGN live</Chip>}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{address}</div>
              </div>
              {/* Copy address */}
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(address);
                    useMoby.getState().pushToast({ title: "Address copied", type: "success" });
                  }
                }}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
                aria-label="Copy address"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {/* Follow/unfollow */}
              <button
                onClick={() => toggleFollowWallet(address, label)}
                className={cn(
                  "h-7 px-2 grid place-items-center rounded-lg text-[11px] font-semibold border transition-colors",
                  isFollowing ? "bg-bull/15 text-bull border-bull/30" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {isFollowing ? "✓ Following" : "+ Follow"}
              </button>
              {/* Close */}
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-24 rounded-xl bg-surface-3 animate-pulse" />
                  <div className="h-12 rounded-xl bg-surface-3 animate-pulse" />
                  <div className="h-12 rounded-xl bg-surface-3 animate-pulse" />
                </div>
              ) : stats ? (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border p-2.5 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase">Total value</div>
                      <div className="text-sm font-bold tabular">{fmtUsd(stats.total_value, { compact: true })}</div>
                    </div>
                    <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase">Realized P&L</div>
                      <div className={cn("text-sm font-bold tabular", stats.realized_profit >= 0 ? "text-bull" : "text-bear")}>
                        {stats.realized_profit >= 0 ? "+" : ""}{fmtUsd(stats.realized_profit, { compact: true })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border p-2.5 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase">Win rate</div>
                      <div className="text-sm font-bold tabular">{(stats.winrate * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  {/* Additional stats */}
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div className="rounded-lg border border-border p-2 text-center">
                      <div className="text-[9px] text-muted-foreground">30d P&L</div>
                      <div className={cn("font-bold tabular", (stats.pnl_30d ?? 0) >= 0 ? "text-bull" : "text-bear")}>
                        {stats.pnl_30d >= 0 ? "+" : ""}{fmtUsd(stats.pnl_30d, { compact: true })}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border p-2 text-center">
                      <div className="text-[9px] text-muted-foreground">Trades</div>
                      <div className="font-bold tabular">{stats.trade_count_30d ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-border p-2 text-center">
                      <div className="text-[9px] text-muted-foreground">Buys</div>
                      <div className="font-bold tabular text-bull">{stats.buy_count_30d ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-border p-2 text-center">
                      <div className="text-[9px] text-muted-foreground">Sells</div>
                      <div className="font-bold tabular text-bear">{stats.sell_count_30d ?? 0}</div>
                    </div>
                  </div>

                  {/* Holdings */}
                  {holdings.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                        Holdings ({holdings.length})
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                        {holdings.slice(0, 15).map((h: any, i: number) => {
                          const pnlPositive = (h.profit ?? 0) >= 0;
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold truncate">{h.symbol}</div>
                                <div className="text-[9px] text-muted-foreground tabular">
                                  {fmtNum(h.amount)} @ {fmtPrice(h.cost / Math.max(0.000001, h.amount))}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[11px] font-semibold tabular">{fmtUsd(h.usd_value, { compact: true })}</div>
                                <div className={cn("text-[9px] tabular", pnlPositive ? "text-bull" : "text-bear")}>
                                  {pnlPositive ? "+" : ""}{fmtUsd(h.profit, { compact: true })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recent activity */}
                  {activity.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                        Recent activity ({activity.length})
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                        {activity.slice(0, 15).map((a: any, i: number) => {
                          const isBuy = a.type === "buy";
                          return (
                            <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                              <div className={cn(
                                "h-6 w-6 rounded-lg grid place-items-center shrink-0",
                                isBuy ? "bg-bull/15" : "bg-bear/15"
                              )}>
                                {isBuy ? <ArrowUpRight className="h-3 w-3 text-bull" /> : <ArrowDownRight className="h-3 w-3 text-bear" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold">{a.token_symbol}</div>
                                <div className="text-[9px] text-muted-foreground">
                                  {new Date(a.ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </div>
                              </div>
                              <div className={cn("text-[11px] font-bold tabular", isBuy ? "text-bull" : "text-bear")}>
                                {isBuy ? "+" : "-"}{fmtUsd(a.value_usd, { compact: true })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Share wallet */}
                  <button
                    onClick={() => {
                      useMoby.getState().openShare({
                        title: `${label || "Wallet"} — ${address.slice(0, 8)}...`,
                        description: `Total: ${fmtUsd(stats.total_value, { compact: true })} · Win rate: ${(stats.winrate * 100).toFixed(0)}% · ${stats.trade_count_30d} trades/30d`,
                      });
                    }}
                    className="w-full h-9 rounded-lg bg-bull/15 text-bull border border-bull/30 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-bull/20"
                  >
                    <Share2 className="h-3 w-3" /> Share wallet
                  </button>
                </>
              ) : (
                <div className="text-center py-8">
                  <Wallet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <div className="text-sm text-muted-foreground">
                    {source === "gmgn" ? "No portfolio data available for this wallet." : "GMGN CLI not configured. Run `gmgn-cli config` to enable real wallet data."}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono break-all px-4">{address}</div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
