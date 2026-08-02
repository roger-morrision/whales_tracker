"use client";

import { useState } from "react";
import { X, Flame, TrendingUp, Users, Clock, Shield } from "lucide-react";
import { VALIDATORS, STAKE_POSITIONS, fmtUsd, fmtNum, fmtPct } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip, SectionHeader } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function StakingModal() {
  const open = useMoby((s) => s.stakingOpen);
  const setOpen = useMoby((s) => s.setStakingOpen);
  const [tab, setTab] = useState<"positions" | "validators">("positions");

  const totalStaked = STAKE_POSITIONS.reduce((s, p) => s + p.amountUsd, 0);
  const totalRewards = STAKE_POSITIONS.reduce((s, p) => s + p.rewardsUsd, 0);
  const avgApy = STAKE_POSITIONS.reduce((s, p) => s + p.apy * p.amountUsd, 0) / totalStaked;

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
              <Flame className="h-4 w-4 text-gold" />
              <h2 className="font-semibold text-sm flex-1">Staking</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {[
                { k: "positions", label: "My Stakes" },
                { k: "validators", label: "Validators" },
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
              {tab === "positions" && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border p-2.5 text-center">
                      <div className="text-lg font-bold tabular">{fmtUsd(totalStaked, { compact: true })}</div>
                      <div className="text-[10px] text-muted-foreground">Staked</div>
                    </div>
                    <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center">
                      <div className="text-lg font-bold tabular text-bull">{fmtUsd(totalRewards, { compact: true })}</div>
                      <div className="text-[10px] text-muted-foreground">Rewards</div>
                    </div>
                    <div className="rounded-xl border border-border p-2.5 text-center">
                      <div className="text-lg font-bold tabular text-bull">{avgApy.toFixed(2)}%</div>
                      <div className="text-[10px] text-muted-foreground">Avg APY</div>
                    </div>
                  </div>

                  {STAKE_POSITIONS.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#14F195] to-[#22D3EE] grid place-items-center font-bold text-background text-xs">
                          {p.validatorName[0]}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{p.validatorName}</div>
                          <div className="text-[10px] text-muted-foreground">{p.stakedAgoDays}d ago · {p.unbondingPeriodDays}d unbonding</div>
                        </div>
                        <Chip variant="bull">{p.apy}% APY</Chip>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase">Staked</div>
                          <div className="font-semibold tabular">{p.amount} SOL</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase">Value</div>
                          <div className="font-semibold tabular">{fmtUsd(p.amountUsd, { compact: true })}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase">Rewards</div>
                          <div className="font-semibold tabular text-bull">+{p.rewardsEarned} SOL</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          onClick={() =>
                            useMoby.getState().pushToast({
                              title: "Unstake queued",
                              description: `Unstaking ${p.amount} SOL from ${p.validatorName}.`,
                              type: "info",
                            })
                          }
                          className="py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2"
                        >
                          Unstake
                        </button>
                        <button
                          onClick={() =>
                            useMoby.getState().pushToast({
                              title: "Rewards claimed",
                              description: `Claimed ${p.rewardsEarned} SOL rewards.`,
                              type: "success",
                            })
                          }
                          className="py-1.5 rounded-lg bg-bull text-background text-xs font-bold hover:opacity-90"
                        >
                          Claim rewards
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "validators" && (
                <div className="space-y-2">
                  {VALIDATORS.map((v) => (
                    <div key={v.id} className="rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white", v.avatarColor)}>
                          {v.avatarGlyph}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm">{v.name}</span>
                            {v.verified && <Shield className="h-3 w-3 text-bull" />}
                            <Chip variant="outline" className="ml-auto">#{v.rank}</Chip>
                          </div>
                          <div className="text-[11px] text-muted-foreground tabular">
                            {fmtNum(v.activeStakers)} stakers · {fmtNum(v.totalStaked)} SOL
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase">APY</div>
                          <div className="font-semibold tabular text-bull">{v.apy}%</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase">Commission</div>
                          <div className="font-semibold tabular">{v.commission}%</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase">Uptime</div>
                          <div className="font-semibold tabular">{v.uptime}%</div>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          useMoby.getState().pushToast({
                            title: "Stake initiated",
                            description: `Demo: Stake with ${v.name} at ${v.apy}% APY.`,
                            type: "info",
                          })
                        }
                        className="w-full mt-2 py-1.5 rounded-lg bg-bull/15 text-bull text-xs font-bold hover:bg-bull/20"
                      >
                        Stake with {v.name}
                      </button>
                    </div>
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
