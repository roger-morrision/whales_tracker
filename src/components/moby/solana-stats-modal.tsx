"use client";

import { X, Globe, Zap, Shield, Activity, Server, Clock, Flame } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SOLANA_STATS, SOLANA_TVL_HISTORY, fmtUsd, fmtNum, timeLabel } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { SectionHeader, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function SolanaStatsModal() {
  const open = useMoby((s) => s.solanaStatsOpen);
  const setOpen = useMoby((s) => s.setSolanaStatsOpen);

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
              <Globe className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Solana ecosystem</h2>
              <span className="text-[10px] text-bull flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" /> Live
              </span>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {/* TPS card */}
              <div className="rounded-2xl p-4 bg-gradient-to-br from-[#9945FF]/12 to-transparent border border-[#9945FF]/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="h-3.5 w-3.5 text-[#9945FF]" />
                  <span className="text-xs font-semibold">Transactions per second</span>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold tabular">{fmtNum(SOLANA_STATS.tps)}</span>
                  <span className="text-xs text-muted-foreground pb-1">TPS now</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">24h peak:</span>{" "}
                    <span className="font-semibold tabular">{fmtNum(SOLANA_STATS.tpsPeak24h)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">7d avg:</span>{" "}
                    <span className="font-semibold tabular">{fmtNum(SOLANA_STATS.tpsAvg7d)}</span>
                  </div>
                </div>
              </div>

              {/* TVL chart */}
              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold">Total Value Locked</div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold tabular">{fmtUsd(SOLANA_STATS.tvl, { compact: true })}</span>
                    <span className="text-[11px] text-bull tabular">+{SOLANA_STATS.tvlChange24h.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={SOLANA_TVL_HISTORY}>
                      <defs>
                        <linearGradient id="sol-tvl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="var(--bull)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="var(--bull)" strokeWidth={2} fill="url(#sol-tvl)" isAnimationActive={false} />
                      <XAxis dataKey="t" tickFormatter={(v) => timeLabel(v)} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <Tooltip
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(v) => timeLabel(v)}
                        formatter={(v: number) => [fmtUsd(v, { compact: true }), "TVL"]}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Validators grid */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={<Shield className="h-3.5 w-3.5" />} label="Validators" value={fmtNum(SOLANA_STATS.validators)} sub={`${SOLANA_STATS.activeValidators} active`} />
                <StatCard icon={<Activity className="h-3.5 w-3.5" />} label="Nakamoto coef." value={String(SOLANA_STATS.nakamotoCoefficient)} sub="Decentralization" />
                <StatCard icon={<Server className="h-3.5 w-3.5" />} label="Total stake" value={fmtUsd(SOLANA_STATS.stake, { compact: true })} sub="SOL staked" />
                <StatCard icon={<Flame className="h-3.5 w-3.5" />} label="Staking APY" value={`${SOLANA_STATS.apy}%`} sub="Annual yield" />
              </div>

              {/* Block / epoch info */}
              <div className="rounded-xl border border-border p-3">
                <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-bull" /> Block & epoch
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <div className="text-muted-foreground">Block time</div>
                    <div className="font-semibold tabular">{SOLANA_STATS.blockTime}ms</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Slot time</div>
                    <div className="font-semibold tabular">{SOLANA_STATS.slotTime}ms</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Current epoch</div>
                    <div className="font-semibold tabular">#{SOLANA_STATS.epoch}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Time remaining</div>
                    <div className="font-semibold">{SOLANA_STATS.epochTimeRemaining}</div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Epoch progress</span>
                    <span className="font-semibold tabular">{(SOLANA_STATS.epochProgress * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195]" style={{ width: `${SOLANA_STATS.epochProgress * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Activity stats */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={<Flame className="h-3.5 w-3.5" />} label="Fees burned 24h" value={fmtUsd(SOLANA_STATS.feeBurned24h, { compact: true })} sub="Network usage" />
                <StatCard icon={<Activity className="h-3.5 w-3.5" />} label="New accounts 24h" value={fmtNum(SOLANA_STATS.newAccounts24h)} sub="Wallet growth" />
                <StatCard icon={<Server className="h-3.5 w-3.5" />} label="Active wallets 7d" value={fmtNum(SOLANA_STATS.activeWallets7d)} sub="Unique addresses" />
                <StatCard icon={<Globe className="h-3.5 w-3.5" />} label="Programs" value={fmtNum(SOLANA_STATS.programsDeployed)} sub="Deployed onchain" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="flex items-center gap-1 mb-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-sm font-bold tabular">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
