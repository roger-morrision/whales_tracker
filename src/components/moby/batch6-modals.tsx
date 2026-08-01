"use client";

import { useState, useMemo } from "react";
import { X, TrendingUp, TrendingDown, Activity, AlertTriangle, BarChart3 } from "lucide-react";
import {
  PORTFOLIO_ANALYTICS,
  getCorrelationMatrix,
  YIELD_POSITIONS,
  UNLOCK_SCHEDULE,
  GOVERNANCE_PROPOSALS,
  DEFI_POSITIONS,
  CALENDAR_EVENTS,
  MANAGED_WALLETS,
  getWatchlistPerformance,
  TOKENS_BY_ID,
  fmtUsd,
  fmtPct,
  fmtNum,
} from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip, SectionHeader } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function PortfolioAnalyticsModal() {
  const open = useMoby((s) => s.analyticsOpen);
  const setOpen = useMoby((s) => s.setAnalyticsOpen);
  const a = PORTFOLIO_ANALYTICS;
  const corr = useMemo(() => getCorrelationMatrix(), []);
  const [tab, setTab] = useState<"metrics" | "correlation" | "risk">("metrics");

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
              <BarChart3 className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Portfolio analytics</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {[{ k: "metrics", l: "Metrics" }, { k: "correlation", l: "Correlation" }, { k: "risk", l: "Risk" }].map((s) => (
                <button key={s.k} onClick={() => setTab(s.k as typeof tab)} className={cn("flex-1 py-1.5 text-xs font-medium rounded-md", tab === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground")}>{s.l}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
              {tab === "metrics" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Total return" value={`+${fmtUsd(a.totalReturn, { compact: true })}`} sub={fmtPct(a.totalReturnPct)} accent="bull" />
                    <Metric label="Sharpe ratio" value={a.sharpeRatio.toFixed(2)} sub="Risk-adjusted" accent={a.sharpeRatio > 1.5 ? "bull" : "default"} />
                    <Metric label="Sortino ratio" value={a.sortinoRatio.toFixed(2)} sub="Downside-adjusted" accent={a.sortinoRatio > 2 ? "bull" : "default"} />
                    <Metric label="Profit factor" value={a.profitFactor.toFixed(2)} sub="Gross profit / loss" accent={a.profitFactor > 1.5 ? "bull" : "default"} />
                    <Metric label="Max drawdown" value={fmtUsd(a.maxDrawdown, { compact: true })} sub={fmtPct(a.maxDrawdownPct)} accent="bear" />
                    <Metric label="Volatility" value={`${a.volatility.toFixed(1)}%`} sub="Annualized" accent="default" />
                    <Metric label="Alpha" value={`+${a.alpha.toFixed(1)}%`} sub="vs market" accent="bull" />
                    <Metric label="Beta" value={a.beta.toFixed(2)} sub="Market sensitivity" accent={a.beta > 1.2 ? "bear" : "default"} />
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Best & worst days</div>
                    <div className="flex gap-3">
                      <div className="flex-1 rounded-lg bg-bull/5 p-2">
                        <div className="text-[10px] text-muted-foreground">Best day</div>
                        <div className="text-sm font-bold text-bull">+{a.bestDay.return}%</div>
                        <div className="text-[10px] text-muted-foreground">{a.bestDay.date}</div>
                      </div>
                      <div className="flex-1 rounded-lg bg-bear/5 p-2">
                        <div className="text-[10px] text-muted-foreground">Worst day</div>
                        <div className="text-sm font-bold text-bear">{a.worstDay.return}%</div>
                        <div className="text-[10px] text-muted-foreground">{a.worstDay.date}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Trading stats</div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div><div className="text-muted-foreground text-[9px]">Win rate</div><div className="font-semibold tabular">{a.winRate}%</div></div>
                      <div><div className="text-muted-foreground text-[9px]">Avg win</div><div className="font-semibold tabular text-bull">+{fmtUsd(a.avgWin)}</div></div>
                      <div><div className="text-muted-foreground text-[9px]">Avg loss</div><div className="font-semibold tabular text-bear">{fmtUsd(a.avgLoss)}</div></div>
                    </div>
                  </div>
                </div>
              )}
              {tab === "correlation" && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">How correlated your holdings are with major assets. Lower = better diversification.</div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr>
                            <th className="p-1"></th>
                            {corr.tokens.map((t) => <th key={t} className="p-1 text-muted-foreground font-medium">{t}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {corr.matrix.map((row, i) => (
                            <tr key={i}>
                              <td className="p-1 font-semibold text-muted-foreground">{corr.tokens[i]}</td>
                              {row.map((val, j) => (
                                <td key={j} className="p-1 text-center">
                                  <span className={cn("inline-block w-8 h-6 rounded grid place-items-center font-semibold tabular text-[9px]",
                                    val >= 0.8 ? "bg-bear/20 text-bear" :
                                    val >= 0.6 ? "bg-gold/20 text-gold" :
                                    val >= 0.4 ? "bg-surface-3 text-muted-foreground" :
                                    "bg-bull/20 text-bull"
                                  )}>{val.toFixed(2)}</span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="BTC correlation" value={a.correlationBTC.toFixed(2)} accent={a.correlationBTC > 0.7 ? "bear" : "bull"} />
                    <Metric label="ETH correlation" value={a.correlationETH.toFixed(2)} accent={a.correlationETH > 0.7 ? "bear" : "bull"} />
                    <Metric label="SOL correlation" value={a.correlationSOL.toFixed(2)} accent={a.correlationSOL > 0.8 ? "bear" : "bull"} />
                  </div>
                </div>
              )}
              {tab === "risk" && (
                <div className="space-y-3">
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-gold/15 to-transparent border border-gold/20">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Risk score</div>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold tabular text-gold">{a.riskScore}</span>
                      <span className="text-sm font-semibold text-gold pb-1">/ 100 · {a.riskLabel}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-3 overflow-hidden mt-2">
                      <div className="h-full bg-gradient-to-r from-bull via-gold to-bear" style={{ width: `${a.riskScore}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                      <span>Conservative</span><span>Moderate</span><span>Aggressive</span><span>Very Aggressive</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <RiskBar label="Volatility" value={a.volatility} max={100} suffix="%" />
                    <RiskBar label="Beta (market sensitivity)" value={a.beta * 50} max={100} suffix="" displayValue={a.beta.toFixed(2)} />
                    <RiskBar label="Max drawdown severity" value={Math.abs(a.maxDrawdownPct) * 3} max={100} suffix="%" displayValue={a.maxDrawdownPct.toFixed(1) + "%"} />
                    <RiskBar label="Concentration risk" value={68} max={100} suffix="%" />
                    <RiskBar label="Liquidity risk" value={24} max={100} suffix="%" />
                  </div>
                  <div className="rounded-xl border border-border p-3 bg-surface-2/50">
                    <div className="text-xs font-semibold mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-gold" /> Risk assessment</div>
                    <p className="text-[11px] text-muted-foreground">Your portfolio is <span className="text-gold font-semibold">{a.riskLabel.toLowerCase()}</span> with high Solana correlation ({a.correlationSOL.toFixed(2)}). Consider adding BTC or stablecoins to reduce volatility.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Metric({ label, value, sub, accent = "default" }: { label: string; value: string; sub?: string; accent?: "bull" | "bear" | "default" }) {
  const color = accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : "text-foreground";
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className={cn("text-base font-bold tabular", color)}>{value}</div>
      {sub && <div className={cn("text-[10px] tabular", color)}>{sub}</div>}
    </div>
  );
}

function RiskBar({ label, value, max, suffix, displayValue }: { label: string; value: number; max: number; suffix: string; displayValue?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 66 ? "bg-bear" : pct > 33 ? "bg-gold" : "bg-bull";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular">{displayValue ?? `${value.toFixed(0)}${suffix}`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ========== YIELD FARMING MODAL ==========
export function YieldFarmingModal() {
  const open = useMoby((s) => s.yieldOpen);
  const setOpen = useMoby((s) => s.setYieldOpen);
  const positions: typeof YIELD_POSITIONS[number][] = YIELD_POSITIONS;
  const totalPosition = positions.reduce((s: number, p: any) => s + p.myPosition, 0);
  const totalRewards = positions.reduce((s: number, p: any) => s + p.rewardsUsd, 0);
  const weightedApy = positions.reduce((s: number, p: any) => s + p.apy * p.myPosition, 0) / totalPosition;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-base">🌾</span>
              <h2 className="font-semibold text-sm flex-1">Yield farming</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{fmtUsd(totalPosition, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Total TVL</div></div>
                <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center"><div className="text-lg font-bold tabular text-bull">{fmtUsd(totalRewards, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Rewards</div></div>
                <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular text-bull">{weightedApy.toFixed(1)}%</div><div className="text-[10px] text-muted-foreground">Avg APY</div></div>
              </div>
              {positions.map((p: any) => (
                <div key={p.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br grid place-items-center text-sm", p.protocolColor)}>{p.protocolGlyph}</div>
                    <div className="flex-1"><div className="flex items-center gap-1.5"><span className="font-semibold text-sm">{p.protocol}</span><Chip variant="outline">{p.type}</Chip></div><div className="text-[11px] text-muted-foreground">{p.pair} · {p.daysActive}d active</div></div><Chip variant="bull">{p.apy}% APY</Chip>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div><div className="text-[9px] text-muted-foreground uppercase">Position</div><div className="font-semibold tabular">{fmtUsd(p.myPosition, { compact: true })}</div></div>
                    <div><div className="text-[9px] text-muted-foreground uppercase">Rewards</div><div className="font-semibold tabular text-bull">{p.rewardsEarned} {p.rewardsToken}</div></div>
                    <div><div className="text-[9px] text-muted-foreground uppercase">IL</div><div className={cn("font-semibold tabular", p.impermanentLoss < 0 ? "text-bear" : "text-foreground")}>{p.impermanentLoss}%</div></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-[10px]"><span className="text-muted-foreground">Base APR: </span><span className="font-semibold tabular">{p.aprBase}%</span></div>
                    <div className="text-[10px]"><span className="text-muted-foreground">Reward APR: </span><span className="font-semibold tabular text-bull">{p.aprRewards}%</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button className="py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2">Withdraw</button>
                    <button className="py-1.5 rounded-lg bg-bull text-background text-xs font-bold hover:opacity-90">Claim {p.rewardsToken}</button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ========== TOKEN UNLOCKS MODAL ==========
export function UnlocksModal() {
  const open = useMoby((s) => s.unlocksOpen);
  const setOpen = useMoby((s) => s.setUnlocksOpen);
  const unlocks: typeof UNLOCK_SCHEDULE[number][] = UNLOCK_SCHEDULE;
  const totalUsd = unlocks.reduce((s: number, u: any) => s + u.amountUsd, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-gold/20 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-base">🔓</span>
              <h2 className="font-semibold text-sm flex-1">Token unlock schedule</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              <div className="rounded-2xl p-4 bg-gradient-to-br from-bear/10 to-transparent border border-bear/20">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total unlock value (next 90d)</div>
                <div className="text-3xl font-bold tabular text-bear">{fmtUsd(totalUsd, { compact: true })}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Unlocks create sell pressure. Monitor closely.</div>
              </div>
              {unlocks.sort((a: any, b: any) => a.daysUntil - b.daysUntil).map((u: any) => (
                <div key={u.id} className={cn("rounded-xl border p-3", u.status === "imminent" ? "border-bear/30 bg-bear/5" : "border-border")}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center text-sm", u.color)}>{u.glyph}</div>
                    <div className="flex-1"><div className="flex items-center gap-1.5"><span className="font-semibold text-sm">{u.tokenSymbol}</span><Chip variant={u.status === "imminent" ? "bear" : "outline"}>{u.status === "imminent" ? "⚠️ Imminent" : `${u.daysUntil}d`}</Chip></div><div className="text-[11px] text-muted-foreground">{u.tokenName} · {u.type}</div></div>
                    <div className="text-right"><div className="text-sm font-bold tabular">{fmtUsd(u.amountUsd, { compact: true })}</div><div className="text-[10px] text-muted-foreground">{fmtNum(u.amount)} tokens</div></div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Date: <span className="font-semibold text-foreground">{u.date}</span></span>
                    <span className="text-muted-foreground">Supply: <span className="font-semibold text-bear">{u.pctOfSupply}%</span></span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ========== GOVERNANCE MODAL ==========
export function GovernanceModal() {
  const open = useMoby((s) => s.governanceOpen);
  const setOpen = useMoby((s) => s.setGovernanceOpen);
  const votedProposals = useMoby((s) => s.votedProposals);
  const vote = useMoby((s) => s.vote);
  const proposals: typeof GOVERNANCE_PROPOSALS[number][] = GOVERNANCE_PROPOSALS;
  const [filter, setFilter] = useState<"all" | "active" | "passed" | "failed">("all");
  const filtered = filter === "all" ? proposals : proposals.filter((p: any) => p.status === filter);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-base">🗳️</span>
              <h2 className="font-semibold text-sm flex-1">Governance</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {[{ k: "all", l: "All" }, { k: "active", l: "Active" }, { k: "passed", l: "Passed" }, { k: "failed", l: "Failed" }].map((s) => (
                <button key={s.k} onClick={() => setFilter(s.k as typeof filter)} className={cn("flex-1 py-1.5 text-xs font-medium rounded-md", filter === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground")}>{s.l}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4 space-y-2">
              {filtered.map((p: any) => {
                const myVote = votedProposals[p.id];
                const forPct = (p.forVotes / p.totalVotes) * 100;
                const againstPct = (p.againstVotes / p.totalVotes) * 100;
                return (
                  <div key={p.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Chip variant={p.status === "active" ? "bull" : p.status === "passed" ? "default" : "bear"}>{p.status}</Chip>
                      <Chip variant="outline">{p.type}</Chip>
                      {p.daysLeft > 0 && <span className="text-[10px] text-muted-foreground ml-auto">{p.daysLeft}d left</span>}
                    </div>
                    <div className="text-sm font-semibold mb-1">{p.title}</div>
                    <p className="text-[11px] text-muted-foreground mb-2">{p.description}</p>
                    <div className="mb-2">
                      <div className="flex h-2 rounded-full overflow-hidden bg-surface-3">
                        <div className="bg-bull" style={{ width: `${forPct}%` }} />
                        <div className="bg-bear" style={{ width: `${againstPct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] mt-0.5"><span className="text-bull">{forPct.toFixed(1)}% For</span><span className="text-bear">{againstPct.toFixed(1)}% Against</span></div>
                    </div>
                    <div className="text-[10px] text-muted-foreground mb-2">Quorum: {p.quorumPct}% · Proposed by @{p.proposer} · Your power: {fmtNum(p.votingPower)}</div>
                    {p.status === "active" && (
                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => vote(p.id, "for")} disabled={!!myVote} className={cn("py-1.5 rounded-md text-[11px] font-bold border disabled:opacity-50", myVote === "for" ? "bg-bull/20 text-bull border-bull/40" : "border-border text-muted-foreground hover:text-bull")}>👍 For</button>
                        <button onClick={() => vote(p.id, "against")} disabled={!!myVote} className={cn("py-1.5 rounded-md text-[11px] font-bold border disabled:opacity-50", myVote === "against" ? "bg-bear/20 text-bear border-bear/40" : "border-border text-muted-foreground hover:text-bear")}>👎 Against</button>
                        <button onClick={() => vote(p.id, "abstain")} disabled={!!myVote} className={cn("py-1.5 rounded-md text-[11px] font-bold border disabled:opacity-50", myVote === "abstain" ? "bg-surface-3 text-foreground border-border" : "border-border text-muted-foreground")}>🤐 Abstain</button>
                      </div>
                    )}
                    {myVote && <div className="text-[10px] text-bull mt-1">✓ You voted {myVote}</div>}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ========== DEFI POSITIONS MODAL ==========
export function DeFiPositionsModal() {
  const open = useMoby((s) => s.defiOpen);
  const setOpen = useMoby((s) => s.setDefiOpen);
  const positions: typeof DEFI_POSITIONS[number][] = DEFI_POSITIONS;
  const totalValue = positions.reduce((s: number, p: any) => s + p.amountUsd, 0);
  const totalCollateral = positions.filter((p: any) => p.type === "Lending").reduce((s: number, p: any) => s + p.amountUsd, 0);
  const totalDebt = positions.filter((p: any) => p.type === "Borrowing").reduce((s: number, p: any) => s + (p.debtUsd ?? 0), 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-base">🔗</span>
              <h2 className="font-semibold text-sm flex-1">DeFi positions</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{fmtUsd(totalValue, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Total</div></div>
                <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center"><div className="text-lg font-bold tabular text-bull">{fmtUsd(totalCollateral, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Collateral</div></div>
                <div className="rounded-xl border border-bear/30 bg-bear/5 p-2.5 text-center"><div className="text-lg font-bold tabular text-bear">{fmtUsd(totalDebt, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Debt</div></div>
              </div>
              {positions.map((p: any) => (
                <div key={p.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br grid place-items-center text-sm", p.protocolColor)}>{p.protocolGlyph}</div>
                    <div className="flex-1"><div className="flex items-center gap-1.5"><span className="font-semibold text-sm">{p.protocol}</span><Chip variant="outline">{p.type}</Chip></div><div className="text-[11px] text-muted-foreground">{p.asset} · {p.chain}</div></div><Chip variant="bull">{p.apy}% APY</Chip>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div><div className="text-[9px] text-muted-foreground uppercase">Amount</div><div className="font-semibold tabular">{fmtUsd(p.amountUsd, { compact: true })}</div></div>
                    {p.healthFactor !== undefined && <div><div className="text-[9px] text-muted-foreground uppercase">Health</div><div className={cn("font-semibold tabular", p.healthFactor > 2 ? "text-bull" : p.healthFactor > 1.5 ? "text-gold" : "text-bear")}>{p.healthFactor.toFixed(2)}</div></div>}
                    {p.liquidationPrice !== undefined && <div><div className="text-[9px] text-muted-foreground uppercase">Liq. price</div><div className="font-semibold tabular text-bear">${p.liquidationPrice}</div></div>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ========== MARKET CALENDAR MODAL ==========
export function CalendarModal() {
  const open = useMoby((s) => s.calendarOpen);
  const setOpen = useMoby((s) => s.setCalendarOpen);
  const events: typeof CALENDAR_EVENTS[number][] = CALENDAR_EVENTS;
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-base">📅</span>
              <h2 className="font-semibold text-sm flex-1">Market calendar</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
              {sorted.map((e) => {
                const d = new Date(e.date);
                const day = d.getDate();
                const month = d.toLocaleString("en-US", { month: "short" });
                const impactColor = e.impact === "bullish" ? "text-bull bg-bull/10" : e.impact === "bearish" ? "text-bear bg-bear/10" : "text-muted-foreground bg-surface-3";
                return (
                  <div key={e.id} className="rounded-xl border border-border p-3 flex items-start gap-3">
                    <div className="shrink-0 text-center">
                      <div className={cn("rounded-lg p-1.5 w-12", e.importance === "high" ? "bg-gold/10" : "bg-surface-2")}>
                        <div className="text-[9px] text-muted-foreground">{month}</div>
                        <div className="text-lg font-bold tabular">{day}</div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-semibold">{e.title}</span>
                        {e.time && <span className="text-[10px] text-muted-foreground">{e.time}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-1">{e.description}</p>
                      <div className="flex items-center gap-1.5">
                        <Chip variant="outline">{e.type}</Chip>
                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded", impactColor)}>{e.impact}</span>
                        {e.importance === "high" && <span className="text-[9px] font-bold text-gold">⭐ High impact</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ========== MULTI-WALLET MANAGER MODAL ==========
export function MultiWalletModal() {
  const open = useMoby((s) => s.multiWalletOpen);
  const setOpen = useMoby((s) => s.setMultiWalletOpen);
  const activeWalletId = useMoby((s) => s.activeWalletId);
  const setActiveWalletId = useMoby((s) => s.setActiveWalletId);
  const wallets: typeof MANAGED_WALLETS[number][] = MANAGED_WALLETS;
  const totalBalance = wallets.reduce((s: number, w: any) => s + w.balanceUsd, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl">
            <div className="sticky top-0 bg-background/95 backdrop-blur-xl px-4 py-3 border-b border-border flex items-center gap-2 z-10">
              <span className="text-base">👛</span>
              <h2 className="font-semibold text-sm flex-1">My wallets</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-2xl p-4 bg-gradient-to-br from-bull/10 to-transparent border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total balance (all wallets)</div>
                <div className="text-3xl font-bold tabular">{fmtUsd(totalBalance)}</div>
                <div className="text-[11px] text-muted-foreground">{wallets.length} wallets · {wallets.filter((w: any) => w.isConnected).length} connected</div>
              </div>
              {wallets.map((w: any) => (
                <button key={w.id} onClick={() => setActiveWalletId(w.id)} className={cn("w-full rounded-xl border p-3 text-left transition-colors", activeWalletId === w.id ? "border-bull/30 bg-bull/5" : "border-border hover:bg-surface-2")}>
                  <div className="flex items-center gap-2.5">
                    <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white", w.color)}>{w.glyph}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{w.label}</span>
                        {w.isPrimary && <Chip variant="gold">Primary</Chip>}
                        {w.isConnected ? <span className="text-[9px] font-bold text-bull bg-bull/10 px-1 py-0.5 rounded">Connected</span> : <span className="text-[9px] font-bold text-muted-foreground bg-surface-3 px-1 py-0.5 rounded">Offline</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">{w.address} · {w.chain}</div>
                    </div>
                    <div className="text-right"><div className="text-sm font-bold tabular">{fmtUsd(w.balanceUsd, { compact: true })}</div></div>
                  </div>
                </button>
              ))}
              <button className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1.5">+ Add wallet</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ========== WATCHLIST PERFORMANCE MODAL ==========
export function WatchlistPerfModal() {
  const open = useMoby((s) => s.watchlistPerfOpen);
  const setOpen = useMoby((s) => s.setWatchlistPerfOpen);
  const watchlist = useMoby((s) => s.watchlist);
  const openToken = useMoby((s) => s.openToken);
  const perf = getWatchlistPerformance(watchlist);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl">
            <div className="sticky top-0 bg-background/95 backdrop-blur-xl px-4 py-3 border-b border-border flex items-center gap-2 z-10">
              <span className="text-base">⭐</span>
              <h2 className="font-semibold text-sm flex-1">Watchlist performance</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border p-3"><div className="text-[10px] text-muted-foreground uppercase">Total market cap</div><div className="text-xl font-bold tabular">{fmtUsd(perf.totalValue, { compact: true })}</div></div>
                <div className="rounded-xl border border-border p-3"><div className="text-[10px] text-muted-foreground uppercase">Avg 24h change</div><div className={cn("text-xl font-bold tabular", perf.avgChange >= 0 ? "text-bull" : "text-bear")}>{fmtPct(perf.avgChange)}</div></div>
              </div>
              {perf.bestPerformer && perf.worstPerformer && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-bull/30 bg-bull/5 p-3"><div className="text-[10px] text-muted-foreground uppercase">Best performer</div><div className="text-lg font-bold text-bull">${perf.bestPerformer.symbol}</div><div className="text-xs font-semibold text-bull">{fmtPct(perf.bestPerformer.change)}</div></div>
                  <div className="rounded-xl border border-bear/30 bg-bear/5 p-3"><div className="text-[10px] text-muted-foreground uppercase">Worst performer</div><div className="text-lg font-bold text-bear">${perf.worstPerformer.symbol}</div><div className="text-xs font-semibold text-bear">{fmtPct(perf.worstPerformer.change)}</div></div>
                </div>
              )}
              {perf.allocation.length > 0 && (
                <div className="rounded-xl border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Allocation breakdown</div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-surface-3 mb-2">
                    {perf.allocation.map((a: any, i: number) => (
                      <div key={i} className={cn("bg-gradient-to-r", a.color)} style={{ width: `${a.pct}%` }} />
                    ))}
                  </div>
                  <div className="space-y-1">
                    {perf.allocation.map((a: any, i: number) => (
                      <button key={i} onClick={() => { setOpen(false); setTimeout(() => openToken(a.id), 200); }} className="w-full flex items-center gap-2 text-[11px] hover:text-bull">
                        <span className={cn("h-2 w-2 rounded-full bg-gradient-to-r", a.color)} />
                        <span className="font-semibold">${a.symbol}</span>
                        <span className="text-muted-foreground tabular ml-auto">{a.pct.toFixed(1)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-border p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">All watchlist tokens</div>
                <div className="space-y-1">
                  {watchlist.map((id) => {
                    const t = TOKENS_BY_ID[id];
                    if (!t) return null;
                    return (
                      <button key={id} onClick={() => { setOpen(false); setTimeout(() => openToken(id), 200); }} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 text-left">
                        <div className={cn("h-7 w-7 rounded-full bg-gradient-to-br grid place-items-center text-xs font-bold text-white", t.logoColor)}>{t.logoGlyph}</div>
                        <div className="flex-1"><div className="text-xs font-semibold">{t.symbol}</div><div className="text-[10px] text-muted-foreground">{t.name}</div></div>
                        <div className="text-right"><div className="text-xs font-semibold tabular">{fmtUsd(t.marketCap, { compact: true })}</div><div className={cn("text-[10px] tabular", t.change24h >= 0 ? "text-bull" : "text-bear")}>{fmtPct(t.change24h)}</div></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
