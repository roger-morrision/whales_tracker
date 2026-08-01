"use client";

import { useState, useMemo } from "react";
import {
  X,
  ArrowDown,
  Settings,
  Zap,
  TrendingUp,
  Shield,
  Info,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { TOKENS_BY_ID, fmtPrice, fmtUsd, fmtNum, fmtPct } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function TradeModal() {
  const open = useMoby((s) => s.tradeOpen);
  const tokenId = useMoby((s) => s.tradeTokenId);
  const side = useMoby((s) => s.tradeSide);
  const close = useMoby((s) => s.closeTrade);
  const settings = useMoby((s) => s.settings);
  const wallet = useMoby((s) => s.wallet);
  const setWalletOpen = useMoby((s) => s.setWalletOpen);

  const token = tokenId ? TOKENS_BY_ID[tokenId] : null;
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(settings.defaultSlippage);
  const [showSettings, setShowSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const prices = useMoby((s) => s.prices);
  const livePrice = token ? prices[token.id]?.price ?? token.price : 0;

  const { amountOut, priceImpact, minReceived, gasFee } = useMemo(() => {
    if (!token || !amount) return { amountOut: 0, priceImpact: 0, minReceived: 0, gasFee: 0 };
    const usdIn = parseFloat(amount) || 0;
    const baseOut = usdIn / livePrice;
    // Larger swaps have more price impact
    const impact = Math.min(15, (usdIn / Math.max(1, token.liquidity)) * 100);
    const afterImpact = baseOut * (1 - impact / 100);
    const minRec = afterImpact * (1 - slippage / 100);
    const gas = token.chain === "SOL" ? 0.0008 : token.chain === "ETH" ? 12.4 : 1.2;
    return {
      amountOut: afterImpact,
      priceImpact: impact,
      minReceived: minRec,
      gasFee: gas,
    };
  }, [token, amount, livePrice, slippage]);

  if (!token) return null;

  const isBuy = side === "BUY";
  const impactColor =
    priceImpact < 0.5 ? "text-bull" : priceImpact < 2 ? "text-gold" : "text-bear";

  const handleSubmit = () => {
    if (!wallet) {
      setWalletOpen(true);
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        close();
        setAmount("");
      }, 1500);
    }, 1800);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => !submitting && close()}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <div className="flex bg-surface-2 rounded-lg p-0.5">
                <button
                  onClick={() => useMoby.setState({ tradeSide: "BUY" })}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-bold transition-colors",
                    side === "BUY" ? "bg-bull text-background" : "text-muted-foreground"
                  )}
                >
                  Buy
                </button>
                <button
                  onClick={() => useMoby.setState({ tradeSide: "SELL" })}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-bold transition-colors",
                    side === "SELL" ? "bg-bear text-background" : "text-muted-foreground"
                  )}
                >
                  Sell
                </button>
              </div>
              <h2 className="font-semibold text-sm flex-1">
                {isBuy ? "Buy" : "Sell"} {token.symbol}
              </h2>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3",
                  showSettings ? "text-bull" : "text-muted-foreground"
                )}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => !submitting && close()}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {showSettings && (
              <div className="p-4 border-b border-border bg-surface-2/50">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Slippage tolerance</div>
                <div className="flex gap-1.5 mb-2">
                  {[0.5, 1, 2, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-semibold border",
                        slippage === s
                          ? "bg-bull/15 text-bull border-bull/30"
                          : "bg-surface-2 text-muted-foreground border-border"
                      )}
                    >
                      {s}%
                    </button>
                  ))}
                  <input
                    type="number"
                    value={slippage}
                    step={0.1}
                    min={0.1}
                    max={50}
                    onChange={(e) => setSlippage(Number(e.target.value))}
                    className="w-16 bg-surface-2 border border-border rounded-md text-[11px] px-2 py-1 text-center tabular"
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Higher slippage = more likely to fill, but worse price.
                </div>
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* You pay */}
              <div className="rounded-xl border border-border bg-surface-2/50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {isBuy ? "You pay" : "You sell"}
                  </span>
                  {wallet && (
                    <span className="text-[10px] text-muted-foreground">
                      Balance: <span className="tabular text-foreground">${wallet.balanceUsd.toLocaleString()}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-2xl font-bold tabular placeholder:text-muted-foreground focus:outline-none"
                  />
                  <div className="flex items-center gap-1 bg-surface-3 rounded-lg px-2 py-1.5">
                    <span className="text-xs font-semibold">USD</span>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setAmount(String((wallet?.balanceUsd ?? 1000) * pct / 100))}
                      className="flex-1 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-surface-3 rounded"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center -my-1">
                <div className="h-7 w-7 rounded-full bg-surface-2 border-2 border-background grid place-items-center">
                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              {/* You receive */}
              <div className="rounded-xl border border-border bg-surface-2/50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {isBuy ? "You receive" : "You get"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Price: <span className="tabular text-foreground">{fmtPrice(livePrice)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={amountOut > 0 ? fmtNum(amountOut) : ""}
                    readOnly
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-2xl font-bold tabular placeholder:text-muted-foreground focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 bg-surface-3 rounded-lg px-2 py-1.5">
                    <TokenIcon symbol={token.symbol} glyph={token.logoGlyph} color={token.logoColor} size="xs" />
                    <span className="text-xs font-semibold">{token.symbol}</span>
                  </div>
                </div>
              </div>

              {/* Route preview */}
              {amount && parseFloat(amount) > 0 && (
                <div className="rounded-xl border border-border p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Route
                    </span>
                    <span className="font-medium">USD → SOL → {token.symbol}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Price impact
                    </span>
                    <span className={cn("font-semibold tabular", impactColor)}>{priceImpact.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Min received
                    </span>
                    <span className="font-semibold tabular">{fmtNum(minReceived)} {token.symbol}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" /> Network fee
                    </span>
                    <span className="font-semibold tabular">${gasFee.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Slippage</span>
                    <span className="font-semibold tabular">{slippage}%</span>
                  </div>
                </div>
              )}

              {/* Smart money context */}
              {token.smartMoneyInflow24h > 0 && (
                <div className="rounded-lg p-2 bg-bull/8 border border-bull/20 flex items-center gap-2">
                  <span className="text-base">🐋</span>
                  <div className="text-[11px]">
                    <span className="text-bull font-semibold">Smart money net inflow</span>
                    <span className="text-muted-foreground"> · {fmtUsd(token.smartMoneyInflow24h, { compact: true })} in 24h</span>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!amount || parseFloat(amount) <= 0 || submitting || success}
                className={cn(
                  "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50",
                  success
                    ? "bg-bull text-background"
                    : isBuy
                    ? "bg-bull text-background hover:opacity-90"
                    : "bg-bear text-white hover:opacity-90"
                )}
              >
                {success ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Transaction confirmed
                  </>
                ) : submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing transaction…
                  </>
                ) : !wallet ? (
                  "Connect wallet to continue"
                ) : (
                  `${isBuy ? "Buy" : "Sell"} ${token.symbol}`
                )}
              </button>

              {!wallet && (
                <p className="text-[10px] text-center text-muted-foreground">
                  By continuing, you agree to Moby's Terms. Slippage may vary based on network conditions.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
