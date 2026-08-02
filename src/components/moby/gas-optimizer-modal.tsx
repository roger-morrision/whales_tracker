"use client";

import { useMemo, useState } from "react";
import { X, Zap, Clock, TrendingUp, Activity } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getGasEstimates, CONGESTION_HISTORY, fmtNum } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function GasOptimizerModal() {
  const open = useMoby((s) => s.gasOptimizerOpen);
  const setOpen = useMoby((s) => s.setGasOptimizerOpen);
  const [selected, setSelected] = useState("fast");
  const estimates = useMemo(() => getGasEstimates(), []);
  const currentCongestion = CONGESTION_HISTORY[CONGESTION_HISTORY.length - 1]?.v ?? 50;
  const congestionLabel = currentCongestion > 70 ? "High" : currentCongestion > 40 ? "Medium" : "Low";
  const congestionColor = currentCongestion > 70 ? "text-bear" : currentCongestion > 40 ? "text-gold" : "text-bull";

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
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl"
          >
            <div className="sticky top-0 bg-background/95 backdrop-blur-xl px-4 py-3 border-b border-border flex items-center gap-2 z-10">
              <Zap className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Gas fee optimizer</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Current congestion */}
              <div className="rounded-2xl p-4 bg-gradient-to-br from-bull/10 to-transparent border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Network congestion</div>
                    <div className={cn("text-2xl font-bold", congestionColor)}>{congestionLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular">{currentCongestion}%</div>
                    <div className="text-[10px] text-muted-foreground">load</div>
                  </div>
                </div>
                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={CONGESTION_HISTORY}>
                      <defs>
                        <linearGradient id="congestion" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="var(--bull)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="var(--bull)" strokeWidth={2} fill="url(#congestion)" isAnimationActive={false} />
                      <XAxis dataKey="t" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} interval={4} tickFormatter={(v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric" })} />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`${v}%`, "Congestion"]}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Last 24 hours · updates every minute</div>
              </div>

              {/* Priority options */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Priority fee</div>
                <div className="space-y-2">
                  {estimates.map((e) => (
                    <button
                      key={e.priority}
                      onClick={() => setSelected(e.priority)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-colors",
                        selected === e.priority ? "border-bull/30 bg-bull/5" : "border-border hover:bg-surface-2"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "h-8 w-8 rounded-lg grid place-items-center",
                          e.priority === "turbo" ? "bg-bear/15 text-bear" :
                          e.priority === "fast" ? "bg-bull/15 text-bull" :
                          e.priority === "standard" ? "bg-gold/15 text-gold" :
                          "bg-surface-3 text-muted-foreground"
                        )}>
                          <Zap className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold">{e.label}</span>
                            {e.recommended && <Chip variant="bull">Recommended</Chip>}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> {e.estimatedTime}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold tabular">${e.feeUsd.toFixed(4)}</div>
                          <div className="text-[10px] text-muted-foreground tabular">{fmtNum(e.feeLamports)} lamports</div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-muted-foreground">Inclusion confidence</span>
                          <span className="font-semibold tabular">{e.confidence}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", e.confidence >= 95 ? "bg-bull" : e.confidence >= 85 ? "bg-gold" : "bg-bear")}
                            style={{ width: `${e.confidence}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className="rounded-xl p-3 bg-bull/5 border border-bull/20">
                <div className="text-xs font-semibold text-bull mb-1 flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" /> Recommendation
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Network congestion is {congestionLabel.toLowerCase()}. {currentCongestion > 70 ? "Use Fast or Turbo priority to ensure your transaction lands in the next block." : "Standard priority should be sufficient for most transactions."}
                </p>
              </div>

              <button
                onClick={() => {
                  // Wire to settings persistence
                  const tier = selected as "slow" | "standard" | "fast";
                  useMoby.getState().setSettings({
                    defaultGas: tier,
                    priorityFee: 0.001,
                  });
                  useMoby.getState().pushToast({
                    title: "Gas settings saved",
                    description: `Default ${tier} priority saved to settings.`,
                    type: "success",
                  });
                }}
                className="w-full py-2.5 rounded-xl bg-bull text-background text-sm font-bold hover:opacity-90"
              >
                Save as default
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
