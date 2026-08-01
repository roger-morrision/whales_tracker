"use client";

import { useMemo, useState } from "react";
import { X, FileText, Download, TrendingUp, TrendingDown, Calendar, Filter } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TAX_EVENTS, computeTaxSummary, fmtUsd, fmtNum } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip, SectionHeader } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function TaxCalculatorModal() {
  const open = useMoby((s) => s.taxOpen);
  const setOpen = useMoby((s) => s.setTaxOpen);
  const [tab, setTab] = useState<"summary" | "events" | "breakdown">("summary");

  const summary = useMemo(() => computeTaxSummary(), []);

  // Monthly cumulative gains for chart
  const monthly = useMemo(() => {
    const months: { month: string; gain: number; cumulative: number }[] = [];
    let cum = 0;
    for (let m = 1; m <= 12; m++) {
      const monthGain = TAX_EVENTS
        .filter((e) => e.type !== "TRANSFER" && parseInt(e.date.split("-")[1]) === m)
        .reduce((s, e) => s + e.gain, 0);
      cum += monthGain;
      months.push({
        month: new Date(2026, m - 1, 1).toLocaleString("en-US", { month: "short" }),
        gain: Math.round(monthGain),
        cumulative: Math.round(cum),
      });
    }
    return months;
  }, []);

  const byTokenData = useMemo(
    () =>
      Object.entries(summary.byToken)
        .map(([sym, gain]) => ({ symbol: sym, gain: Math.round(gain) }))
        .sort((a, b) => b.gain - a.gain),
    [summary]
  );

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
              <FileText className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Crypto tax report</h2>
              <span className="text-[10px] text-muted-foreground">Tax year 2026</span>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {[
                { k: "summary", label: "Summary" },
                { k: "events", label: "Events" },
                { k: "breakdown", label: "Breakdown" },
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
              {tab === "summary" && (
                <div className="space-y-3">
                  {/* Headline */}
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-bull/12 to-transparent border border-bull/20">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                      Estimated net gain
                    </div>
                    <div className={cn("text-3xl font-bold tabular", summary.netGain >= 0 ? "text-bull" : "text-bear")}>
                      {summary.netGain >= 0 ? "+" : "-"}
                      {fmtUsd(Math.abs(summary.netGain), { decimals: 0 })}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Across {summary.eventCount} taxable events · {fmtUsd(summary.totalProceeds, { compact: true })} proceeds
                    </div>
                  </div>

                  {/* Estimated tax */}
                  <div className="rounded-xl border border-bear/30 bg-bear/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold flex items-center gap-1">
                        <TrendingDown className="h-3.5 w-3.5 text-bear" />
                        Estimated tax owed
                      </span>
                      <Chip variant="bear">US · 32% / 15%</Chip>
                    </div>
                    <div className="text-2xl font-bold tabular text-bear">{fmtUsd(summary.totalTax, { decimals: 0 })}</div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                      <div>
                        <div className="text-muted-foreground">Short-term ({fmtUsd(summary.shortGain, { compact: true })})</div>
                        <div className="font-semibold tabular text-bear">{fmtUsd(summary.shortTermTax, { decimals: 0 })}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Long-term ({fmtUsd(summary.longGain, { compact: true })})</div>
                        <div className="font-semibold tabular text-bear">{fmtUsd(summary.longTermTax, { decimals: 0 })}</div>
                      </div>
                    </div>
                  </div>

                  {/* Cumulative chart */}
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-xs font-semibold mb-2">Cumulative gains · 2026</div>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthly}>
                          <defs>
                            <linearGradient id="taxCum" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.32" />
                              <stop offset="100%" stopColor="var(--bull)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="cumulative"
                            stroke="var(--bull)"
                            strokeWidth={2}
                            fill="url(#taxCum)"
                            isAnimationActive={false}
                          />
                          <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis hide domain={["dataMin", "dataMax"]} />
                          <Tooltip
                            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => [fmtUsd(v), "Cumulative"]}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Export buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-surface-2 flex items-center justify-center gap-1.5">
                      <Download className="h-3.5 w-3.5" /> CSV
                    </button>
                    <button className="py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-surface-2 flex items-center justify-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Form 8949
                    </button>
                  </div>

                  <p className="text-[10px] text-muted-foreground text-center">
                    Estimates use simplified US rates. Consult a tax professional for filing. Moby is not tax advice.
                  </p>
                </div>
              )}

              {tab === "events" && (
                <div className="space-y-1.5">
                  {TAX_EVENTS.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm">${e.tokenSymbol}</span>
                          <Chip variant={e.type === "TRANSFER" ? "default" : "outline"}>{e.type}</Chip>
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" /> {e.date}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-1.5 text-[11px]">
                        <div>
                          <div className="text-muted-foreground text-[9px]">Proceeds</div>
                          <div className="font-semibold tabular">{fmtUsd(e.proceeds, { compact: true })}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[9px]">Cost basis</div>
                          <div className="font-semibold tabular">{fmtUsd(e.costBasis, { compact: true })}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[9px]">{e.holdingPeriodDays < 365 ? "Short-term" : "Long-term"}</div>
                          <div className={cn("font-semibold tabular", e.gain >= 0 ? "text-bull" : "text-bear")}>
                            {e.gain >= 0 ? "+" : "-"}
                            {fmtUsd(Math.abs(e.gain), { compact: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "breakdown" && (
                <div className="space-y-3">
                  {/* By token */}
                  <div className="rounded-xl border border-border p-3">
                    <SectionHeader title="By token" emoji="🪙" />
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byTokenData} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="symbol"
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={50}
                          />
                          <Bar dataKey="gain" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                            {byTokenData.map((d, i) => (
                              <Cell key={i} fill={d.gain >= 0 ? "var(--bull)" : "var(--bear)"} />
                            ))}
                          </Bar>
                          <Tooltip
                            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => [fmtUsd(v), "Gain"]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* By chain */}
                  <div className="rounded-xl border border-border p-3">
                    <SectionHeader title="By chain" emoji="⛓" />
                    <div className="space-y-2">
                      {Object.entries(summary.byChain).map(([chain, gain]) => {
                        const total = Object.values(summary.byChain).reduce((s, v) => s + Math.abs(v), 0);
                        const pct = (Math.abs(gain) / total) * 100;
                        return (
                          <div key={chain}>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-medium">{chain}</span>
                              <span className={cn("tabular font-semibold", gain >= 0 ? "text-bull" : "text-bear")}>
                                {gain >= 0 ? "+" : "-"}
                                {fmtUsd(Math.abs(gain), { compact: true })}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", gain >= 0 ? "bg-bull" : "bg-bear")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
