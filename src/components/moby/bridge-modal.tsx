"use client";

import { useState, useMemo } from "react";
import { X, ArrowRight, Zap, Shield, Clock, TrendingDown } from "lucide-react";
import { BRIDGE_ROUTES, fmtUsd, fmtNum, type BridgeRoute } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CHAINS = ["SOL", "ETH", "BASE", "BTC"];
const CHAIN_GLYPHS: Record<string, string> = { SOL: "◎", ETH: "Ξ", BASE: "🔵", BTC: "₿" };
const CHAIN_COLORS: Record<string, string> = {
  SOL: "from-[#9945FF] to-[#14F195]",
  ETH: "from-[#627EEA] to-[#3B5BDB]",
  BASE: "from-[#22C55E] to-[#15803D]",
  BTC: "from-[#F7931A] to-[#C7701A]",
};

export function BridgeModal() {
  const open = useMoby((s) => s.bridgeOpen);
  const setOpen = useMoby((s) => s.setBridgeOpen);
  const [fromChain, setFromChain] = useState("SOL");
  const [toChain, setToChain] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<string>("br2");

  const routes = useMemo(
    () => BRIDGE_ROUTES.filter((r) => r.fromChain === fromChain && r.toChain === toChain),
    [fromChain, toChain]
  );

  const swapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
  };

  const selectedRouteObj = BRIDGE_ROUTES.find((r) => r.id === selectedRoute);
  const amountNum = parseFloat(amount) || 0;
  const receiveAmount = selectedRouteObj ? amountNum * (1 - selectedRouteObj.feePct / 100) : 0;

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
              <h2 className="font-semibold text-sm flex-1">Cross-chain bridge</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* From chain */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">From</div>
                <div className="rounded-xl border border-border bg-surface-2/50 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    {CHAINS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFromChain(c)}
                        className={cn(
                          "h-7 px-2 rounded-md text-[11px] font-semibold border",
                          fromChain === c ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-3 text-muted-foreground border-border"
                        )}
                      >
                        {CHAIN_GLYPHS[c]} {c}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-2xl font-bold tabular placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>

              {/* Swap button */}
              <div className="flex justify-center -my-2">
                <button
                  onClick={swapChains}
                  className="h-8 w-8 rounded-full bg-surface-2 border-2 border-background grid place-items-center hover:bg-surface-3"
                >
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </button>
              </div>

              {/* To chain */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">To</div>
                <div className="rounded-xl border border-border bg-surface-2/50 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    {CHAINS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setToChain(c)}
                        className={cn(
                          "h-7 px-2 rounded-md text-[11px] font-semibold border",
                          toChain === c ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-3 text-muted-foreground border-border"
                        )}
                      >
                        {CHAIN_GLYPHS[c]} {c}
                      </button>
                    ))}
                  </div>
                  <div className="text-2xl font-bold tabular text-muted-foreground">
                    {receiveAmount > 0 ? receiveAmount.toFixed(4) : "0.00"}
                  </div>
                </div>
              </div>

              {/* Route selection */}
              {routes.length > 0 ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Available routes ({routes.length})
                  </div>
                  <div className="space-y-2">
                    {routes.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRoute(r.id)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-colors",
                          selectedRoute === r.id ? "border-bull/30 bg-bull/5" : "border-border hover:bg-surface-2"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br grid place-items-center text-xs font-bold text-white", r.color)}>
                            {r.bridge[0]}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold">{r.bridge}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" /> {r.estimatedTime}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold tabular">{fmtUsd(r.feeUsd, { decimals: 2 })}</div>
                            <div className="text-[10px] text-muted-foreground tabular">{r.feePct}%</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <span className="text-muted-foreground">Reliability: </span>
                            <span className={cn("font-semibold", r.reliability >= 95 ? "text-bull" : "text-gold")}>{r.reliability}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Gas: </span>
                            <span className="font-semibold tabular">${r.gasUsd}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Max: </span>
                            <span className="font-semibold tabular">{fmtNum(r.maxAmount)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No bridge routes available for {fromChain} → {toChain}
                </div>
              )}

              {/* Bridge button */}
              <button
                disabled={!amount || parseFloat(amount) <= 0 || routes.length === 0}
                className="w-full py-3 rounded-xl bg-bull text-background text-sm font-bold disabled:opacity-50 hover:opacity-90"
              >
                Bridge {amount || "0"} {fromChain === "SOL" ? "SOL" : "ETH"} → {toChain}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
