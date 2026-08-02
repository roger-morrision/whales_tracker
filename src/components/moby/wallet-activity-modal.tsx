"use client";

import { useState, useMemo } from "react";
import {
  X,
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Flame,
  Gift,
  Send,
  ExternalLink,
  Filter,
} from "lucide-react";
import { WALLET_ACTIVITY, fmtUsd, fmtNum, fmtAgo, type WalletActivity } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip } from "./primitives";
import { WalletLink } from "./wallet-link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const TYPE_META: Record<WalletActivity["type"], { label: string; icon: typeof Activity; color: string }> = {
  SWAP: { label: "Swap", icon: RefreshCw, color: "text-[#22D3EE] bg-[#22D3EE]/10" },
  TRANSFER_IN: { label: "Receive", icon: ArrowDownLeft, color: "text-bull bg-bull/10" },
  TRANSFER_OUT: { label: "Send", icon: ArrowUpRight, color: "text-bear bg-bear/10" },
  STAKE: { label: "Stake", icon: Flame, color: "text-gold bg-gold/10" },
  UNSTAKE: { label: "Unstake", icon: Flame, color: "text-muted-foreground bg-surface-3" },
  MINT: { label: "Mint", icon: Gift, color: "text-[#9945FF] bg-[#9945FF]/10" },
  BURN: { label: "Burn", icon: Flame, color: "text-bear bg-bear/10" },
  BRIDGE: { label: "Bridge", icon: Send, color: "text-[#22D3EE] bg-[#22D3EE]/10" },
};

const FILTERS = ["all", "swap", "transfer", "stake", "bridge"] as const;

export function WalletActivityModal() {
  const open = useMoby((s) => s.walletActivityOpen);
  const setOpen = useMoby((s) => s.setWalletActivityOpen);
  const wallet = useMoby((s) => s.wallet);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const filtered = useMemo(
    () =>
      WALLET_ACTIVITY.filter((a) => {
        if (filter === "all") return true;
        if (filter === "swap") return a.type === "SWAP";
        if (filter === "transfer") return a.type === "TRANSFER_IN" || a.type === "TRANSFER_OUT";
        if (filter === "stake") return a.type === "STAKE" || a.type === "UNSTAKE";
        if (filter === "bridge") return a.type === "BRIDGE";
        return true;
      }),
    [filter]
  );

  const totalIn = WALLET_ACTIVITY
    .filter((a) => a.type === "TRANSFER_IN" || a.type === "MINT" || a.type === "UNSTAKE")
    .reduce((s, a) => s + a.usdValue, 0);
  const totalOut = WALLET_ACTIVITY
    .filter((a) => a.type === "TRANSFER_OUT" || a.type === "BURN")
    .reduce((s, a) => s + a.usdValue, 0);
  const totalGas = WALLET_ACTIVITY.reduce((s, a) => s + a.gasUsd, 0);

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
              <Activity className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Wallet activity</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Wallet header */}
              <div className="p-4 border-b border-border bg-gradient-to-br from-[#14F195]/8 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#14F195] to-[#9945FF] grid place-items-center font-bold text-background">
                    Z
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Connected wallet</div>
                    <div className="font-mono text-xs truncate">
                      {wallet?.address ?? "0x7a3f...b9c2"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-surface-2 p-2">
                    <div className="text-[9px] text-muted-foreground uppercase">Received</div>
                    <div className="text-sm font-bold tabular text-bull">+{fmtUsd(totalIn, { compact: true })}</div>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2">
                    <div className="text-[9px] text-muted-foreground uppercase">Sent</div>
                    <div className="text-sm font-bold tabular text-bear">-{fmtUsd(totalOut, { compact: true })}</div>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2">
                    <div className="text-[9px] text-muted-foreground uppercase">Gas</div>
                    <div className="text-sm font-bold tabular">{fmtUsd(totalGas, { decimals: 2 })}</div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-3 border-b border-border">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium capitalize border",
                      filter === f
                        ? "bg-bull/15 text-bull border-bull/30"
                        : "bg-surface-2 text-muted-foreground border-border"
                    )}
                  >
                    {f === "all" ? "All activity" : f}
                  </button>
                ))}
              </div>

              {/* Activity list */}
              <div className="p-3 space-y-1.5">
                {filtered.map((a) => {
                  const meta = TYPE_META[a.type];
                  const Icon = meta.icon;
                  const isIncoming = a.type === "TRANSFER_IN" || a.type === "MINT" || a.type === "UNSTAKE";
                  return (
                    <div key={a.id} className="rounded-lg border border-border p-2.5 hover:bg-surface-2 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0", meta.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold">{meta.label}</span>
                            <Chip variant="outline">{a.chain}</Chip>
                            {a.status === "pending" && <Chip variant="gold">Pending</Chip>}
                            {a.status === "failed" && <Chip variant="bear">Failed</Chip>}
                          </div>
                          <div className="text-[11px] text-muted-foreground tabular">
                            {fmtNum(a.amount)} {a.tokenSymbol}
                            {" · "}
                            <WalletLink
                              label={a.counterpartyLabel ?? "Unknown"}
                              address={a.counterparty}
                              variant="muted"
                              className="text-[11px]"
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-sm font-semibold tabular", isIncoming ? "text-bull" : "text-foreground")}>
                            {isIncoming ? "+" : "-"}
                            {fmtUsd(a.usdValue, { compact: true })}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{fmtAgo(a.agoSeconds)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 pl-[46px]">
                        <span className="text-[10px] font-mono text-muted-foreground truncate">{a.txHash}</span>
                        <a
                          href={`https://solscan.io/tx/${a.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-bull hover:opacity-80 inline-flex items-center gap-0.5 ml-2 shrink-0"
                        >
                          <ExternalLink className="h-2.5 w-2.5" /> View
                        </a>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No activity matches this filter.
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
