"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { X, Shield, TrendingUp, TrendingDown, Flame, ArrowRight, Key, Copy, Check, Activity, Zap, AlertTriangle, Bell } from "lucide-react";
import {
  TRAILING_STOPS,
  HOT_WALLETS,
  TOKEN_MIGRATIONS,
  MEV_PROTECTION,
  TOKENS_BY_ID,
  fmtUsd,
  fmtPrice,
  fmtPct,
  fmtNum,
  fmtAgo,
  fmtAge,
} from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip, Sparkline, SectionHeader } from "./primitives";
import { WalletLink } from "./wallet-link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ========== TRAILING STOP LOSS ==========
export function TrailingStopsModal() {
  const open = useMoby((s) => s.trailingStopsOpen);
  const setOpen = useMoby((s) => s.setTrailingStopsOpen);
  const openToken = useMoby((s) => s.openToken);
  const userStops = useMoby((s) => s.trailingStops);
  const addTrailingStop = useMoby((s) => s.addTrailingStop);
  const removeTrailingStop = useMoby((s) => s.removeTrailingStop);
  const fireTrailingStop = useMoby((s) => s.fireTrailingStop);
  const prices = useMoby((s) => s.prices);

  // Sample data for empty state
  const active = TRAILING_STOPS.filter((t) => t.status === "active");
  const triggered = TRAILING_STOPS.filter((t) => t.status === "triggered");
  const totalProtected = active.reduce((s, t) => s + t.amountUsd, 0);
  const totalPnl = TRAILING_STOPS.reduce((s, t) => {
    const pnl = t.status === "triggered" ? t.amountUsd * 0.15 : ((t.currentPrice - t.entryPrice) / t.entryPrice) * t.amountUsd;
    return s + pnl;
  }, 0);

  // User stops: split active vs triggered
  const userActive = userStops.filter((t) => !t.triggered);
  const userTriggered = userStops.filter((t) => t.triggered);
  const userProtected = userActive.reduce((s, t) => s + t.buyUsd, 0);

  return (
    <ModalShell open={open} onClose={() => setOpen(false)} title="Trailing stops" icon={<TrendingDown className="h-4 w-4 text-bull" />}>
      {/* Stats: prefer user data */}
      {userStops.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{userActive.length}</div><div className="text-[10px] text-muted-foreground">Active</div></div>
          <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center"><div className="text-lg font-bold tabular text-bull">{fmtUsd(userProtected, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Protected</div></div>
          <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{userTriggered.length}</div><div className="text-[10px] text-muted-foreground">Triggered</div></div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{active.length}</div><div className="text-[10px] text-muted-foreground">Active</div></div>
          <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center"><div className="text-lg font-bold tabular text-bull">{fmtUsd(totalProtected, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Protected</div></div>
          <div className="rounded-xl border border-border p-2.5 text-center"><div className={cn("text-lg font-bold tabular", totalPnl >= 0 ? "text-bull" : "text-bear")}>{totalPnl >= 0 ? "+" : ""}{fmtUsd(totalPnl, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Total PnL</div></div>
        </div>
      )}

      {/* User trailing stops — active */}
      {userActive.length > 0 && (
        <div className="space-y-2 mb-3">
          {userActive.map((t) => {
            const token = TOKENS_BY_ID[t.tokenId];
            const currentPrice = prices[t.tokenId]?.price ?? t.peakPrice;
            const stopPrice = t.peakPrice * (1 - t.trailPct / 100);
            const distancePct = ((currentPrice - stopPrice) / stopPrice) * 100;
            const isProfit = currentPrice > t.peakPrice * 0.99;
            return (
              <div key={t.id} className="rounded-xl border border-bull/30 bg-bull/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  {token && <TokenIcon symbol={t.tokenSymbol} glyph={token.logoGlyph} color={token.logoColor} size="sm" />}
                  <span className="font-semibold text-sm">{t.tokenSymbol}</span>
                  <Chip variant="outline">{t.trailPct}% trail</Chip>
                  <span className="text-[10px] text-muted-foreground ml-auto">{fmtAgo((Date.now() - t.createdAt) / 1000)}</span>
                  <button
                    onClick={() => removeTrailingStop(t.id)}
                    className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-muted-foreground hover:text-bear"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                  <div><div className="text-[9px] text-muted-foreground uppercase">Peak</div><div className="font-semibold tabular text-bull">{fmtPrice(t.peakPrice)}</div></div>
                  <div><div className="text-[9px] text-muted-foreground uppercase">Current</div><div className={cn("font-semibold tabular", isProfit ? "text-bull" : "text-bear")}>{fmtPrice(currentPrice)}</div></div>
                  <div><div className="text-[9px] text-muted-foreground uppercase">Stop at</div><div className="font-semibold tabular text-bear">{fmtPrice(stopPrice)}</div></div>
                </div>
                <div className="mb-1">
                  <div className="flex items-center justify-between text-[9px] mb-0.5">
                    <span className="text-muted-foreground">Distance to stop</span>
                    <span className={cn("font-semibold tabular", distancePct < 3 ? "text-bear" : "text-foreground")}>{distancePct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className={cn("h-full rounded-full", distancePct < 3 ? "bg-bear" : distancePct < 6 ? "bg-gold" : "bg-bull")} style={{ width: `${Math.min(100, distancePct * 10)}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Position: {fmtUsd(t.buyUsd, { compact: true })}</span>
                  <button
                    onClick={() => fireTrailingStop(t.id)}
                    className="text-bear hover:opacity-80 font-semibold"
                  >
                    Sell now →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User trailing stops — triggered */}
      {userTriggered.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Triggered ({userTriggered.length})</div>
          {userTriggered.map((t) => (
            <div key={t.id} className="rounded-xl border border-border p-3 opacity-60 mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{t.tokenSymbol}</span>
                <Chip variant="default">Triggered</Chip>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Sold at {fmtPrice(t.triggeredPrice ?? t.peakPrice)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sample data when user has no stops */}
      {userStops.length === 0 && active.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sample trailing stops</div>
          {active.map((t) => {
            const isProfit = t.currentPrice > t.entryPrice;
            return (
              <div key={t.id} className="rounded-xl border border-border p-3 opacity-70">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{t.tokenSymbol}</span>
                  <Chip variant="outline">{t.trailPercent}% trail</Chip>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[10px]">
                  <div><div className="text-[9px] text-muted-foreground uppercase">Entry</div><div className="font-semibold tabular">{fmtPrice(t.entryPrice)}</div></div>
                  <div><div className="text-[9px] text-muted-foreground uppercase">Current</div><div className={cn("font-semibold tabular", isProfit ? "text-bull" : "text-bear")}>{fmtPrice(t.currentPrice)}</div></div>
                  <div><div className="text-[9px] text-muted-foreground uppercase">Highest</div><div className="font-semibold tabular text-bull">{fmtPrice(t.highestPrice)}</div></div>
                  <div><div className="text-[9px] text-muted-foreground uppercase">Stop</div><div className="font-semibold tabular text-bear">{fmtPrice(t.stopPrice)}</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create new trailing stop — quick picker */}
      <NewTrailingStopPicker onCreate={addTrailingStop} />
    </ModalShell>
  );
}

function NewTrailingStopPicker({
  onCreate,
}: {
  onCreate: (cfg: {
    tokenId: string;
    tokenSymbol: string;
    trailPct: number;
    buyUsd: number;
  }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tokenId, setTokenId] = useState("wif");
  const [trailPct, setTrailPct] = useState(10);
  const [buyUsd, setBuyUsd] = useState(100);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full py-2.5 rounded-xl border border-dashed border-bull/40 text-xs font-semibold text-bull hover:bg-bull/5 flex items-center justify-center gap-1.5 mt-2"
      >
        <TrendingDown className="h-3.5 w-3.5" /> + New trailing stop
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-bull/30 bg-bull/5 p-3 space-y-3 mt-2">
      <div className="text-xs font-semibold">New trailing stop</div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Token</div>
        <select
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-bull/40"
        >
          {TOKENS_BY_ID && Object.values(TOKENS_BY_ID).slice(0, 12).map((t: any) => (
            <option key={t.id} value={t.id}>{t.symbol} — {t.name}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-muted-foreground">Trail %</span>
          <span className="font-semibold tabular">{trailPct}%</span>
        </div>
        <input type="range" min={1} max={50} step={1} value={trailPct} onChange={(e) => setTrailPct(parseInt(e.target.value, 10))} className="w-full h-1.5 rounded-full bg-surface-3 accent-bull cursor-pointer" />
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-muted-foreground">Position size (USD)</span>
          <span className="font-semibold tabular">${buyUsd}</span>
        </div>
        <input type="range" min={10} max={1000} step={10} value={buyUsd} onChange={(e) => setBuyUsd(parseInt(e.target.value, 10))} className="w-full h-1.5 rounded-full bg-surface-3 accent-bull cursor-pointer" />
      </div>

      <div className="flex gap-2">
        <button onClick={() => setExpanded(false)} className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
        <button
          onClick={() => {
            const token = TOKENS_BY_ID[tokenId];
            if (token) {
              onCreate({
                tokenId: token.id,
                tokenSymbol: token.symbol,
                trailPct,
                buyUsd,
              });
              setExpanded(false);
            }
          }}
          className="flex-1 py-2 rounded-lg bg-bull text-background text-xs font-bold hover:opacity-90"
        >
          Set trailing stop
        </button>
      </div>
    </div>
  );
}

// ========== HOT WALLETS ==========
export function HotWalletsModal() {
  const open = useMoby((s) => s.hotWalletsOpen);
  const setOpen = useMoby((s) => s.setHotWalletsOpen);
  const sorted = [...HOT_WALLETS].sort((a, b) => b.volume24h - a.volume24h);
  const live = HOT_WALLETS.filter((w) => w.isLive).length;
  const totalVolume = HOT_WALLETS.reduce((s, w) => s + w.volume24h, 0);

  const TYPE_META: Record<string, { label: string; color: string }> = {
    whale: { label: "Whale", color: "#F59E0B" },
    smart_money: { label: "Smart", color: "#14F195" },
    kol: { label: "KOL", color: "#EC4899" },
    mev: { label: "MEV", color: "#A855F7" },
    fund: { label: "Fund", color: "#627EEA" },
  };

  return (
    <ModalShell open={open} onClose={() => setOpen(false)} title="Hot wallets" icon={<Flame className="h-4 w-4 text-bull" />}>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular text-bull">{live}</div><div className="text-[10px] text-muted-foreground">Live now</div></div>
        <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{HOT_WALLETS.length}</div><div className="text-[10px] text-muted-foreground">Tracked</div></div>
        <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{fmtUsd(totalVolume, { compact: true })}</div><div className="text-[10px] text-muted-foreground">24h volume</div></div>
      </div>
      <div className="space-y-2">
        {sorted.map((w, i) => {
          const meta = TYPE_META[w.type];
          const isProfit = w.pnl24h >= 0;
          return (
            <div key={w.id} className="rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white text-xs relative", w.color)}>
                  {w.glyph}
                  {w.isLive && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-bull ring-2 ring-background"><span className="absolute inset-0 rounded-full bg-bull live-dot" /></span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <WalletLink label={w.label} address={w.address} className="text-sm font-semibold" />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} title={meta.label} />
                    <span className="text-[9px] text-muted-foreground uppercase">{meta.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular">
                    Score {w.score} · {w.trades24h} trades · top ${w.topToken}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-sm font-bold tabular", isProfit ? "text-bull" : "text-bear")}>{isProfit ? "+" : ""}{fmtUsd(w.pnl24h, { compact: true })}</div>
                  <div className={cn("text-[10px] tabular", isProfit ? "text-bull" : "text-bear")}>{isProfit ? "+" : ""}{w.pnlPct.toFixed(1)}%</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div><span className="text-muted-foreground">Vol 24h: </span><span className="font-semibold tabular">{fmtUsd(w.volume24h, { compact: true })}</span></div>
                <div><span className="text-muted-foreground">Win rate: </span><span className="font-semibold tabular">{w.winRate}%</span></div>
                <div><span className="text-muted-foreground">Last active: </span><span className="font-semibold">{fmtAgo(w.lastActiveSec)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}

// ========== TOKEN MIGRATIONS ==========
export function MigrationsModal() {
  const open = useMoby((s) => s.migrationsOpen);
  const setOpen = useMoby((s) => s.setMigrationsOpen);
  return (
    <ModalShell open={open} onClose={() => setOpen(false)} title="Token migrations" icon={<ArrowRight className="h-4 w-4 text-bull" />}>
      <div className="text-[11px] text-muted-foreground mb-3">Track tokens migrating between chains. Migration can affect token value and require action.</div>
      <div className="space-y-2">
        {TOKEN_MIGRATIONS.map((m) => (
          <div key={m.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center text-sm", m.color)}>{m.glyph}</div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm">{m.tokenSymbol}</span>
                  <Chip variant={m.status === "completed" ? "bull" : m.status === "in_progress" ? "gold" : "outline"}>{m.status.replace("_", " ")}</Chip>
                </div>
                <div className="text-[11px] text-muted-foreground">{m.tokenName}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-[11px] font-semibold">
                  <span className="text-muted-foreground">{m.fromChain}</span>
                  <ArrowRight className="h-3 w-3 text-bull" />
                  <span className="text-bull">{m.toChain}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{m.date}</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">{m.reason}</div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div><span className="text-muted-foreground">Ratio: </span><span className="font-semibold">{m.ratio}</span></div>
              <div><span className="text-muted-foreground">Old: </span><span className="font-mono text-muted-foreground">{m.oldContract}</span></div>
              <div><span className="text-muted-foreground">New: </span><span className="font-mono text-muted-foreground">{m.newContract}</span></div>
            </div>
            {m.status !== "completed" && (
              <button onClick={() => useMoby.getState().pushToast({ title: "Migration started", description: `${m.tokenSymbol} migration from ${m.fromChain} to ${m.toChain} initiated.`, type: "info" })} className="w-full mt-2 py-1.5 rounded-lg bg-bull/15 text-bull border border-bull/30 text-xs font-bold">Migrate tokens</button>
            )}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

// ========== MEV PROTECTION INFO ==========
export function MevProtectionModal() {
  const open = useMoby((s) => s.mevInfoOpen);
  const setOpen = useMoby((s) => s.setMevInfoOpen);
  return (
    <ModalShell open={open} onClose={() => setOpen(false)} title="MEV protection" icon={<Shield className="h-4 w-4 text-bull" />}>
      <div className="rounded-2xl p-4 bg-gradient-to-br from-bull/10 to-transparent border border-bull/20 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-bull" />
          <div>
            <div className="text-sm font-bold text-bull">Protection active</div>
            <div className="text-[10px] text-muted-foreground">Mode: {MEV_PROTECTION.mode} — Moby auto-selects MEV-protected routes</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div><div className="text-[9px] text-muted-foreground uppercase">Swaps protected 24h</div><div className="text-lg font-bold tabular text-bull">{MEV_PROTECTION.protectedSwaps24h}</div></div>
          <div><div className="text-[9px] text-muted-foreground uppercase">Value saved 24h</div><div className="text-lg font-bold tabular text-bull">{fmtUsd(MEV_PROTECTION.valueSaved24h)}</div></div>
          <div><div className="text-[9px] text-muted-foreground uppercase">Attacks blocked</div><div className="text-lg font-bold tabular text-bull">{MEV_PROTECTION.attacksBlocked24h}</div></div>
        </div>
      </div>
      <div>
        <SectionHeader title="Route protection" emoji="🛡️" />
        <div className="space-y-2">
          {MEV_PROTECTION.routes.map((r, i) => (
            <div key={i} className={cn("rounded-xl border p-3 flex items-center gap-2.5", r.protected ? "border-bull/30 bg-bull/5" : "border-bear/30 bg-bear/5")}>
              <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", r.protected ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear")}>
                {r.protected ? <Shield className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{r.label}</div>
                <div className="text-[10px] text-muted-foreground">{r.description}</div>
              </div>
              <Chip variant={r.protected ? "bull" : "bear"}>{r.protected ? "Protected" : "Unprotected"}</Chip>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border p-3 mt-3 bg-surface-2/50">
        <div className="text-xs font-semibold mb-1 flex items-center gap-1"><Zap className="h-3 w-3 text-bull" /> How MEV protection works</div>
        <p className="text-[11px] text-muted-foreground">Moby routes your swaps through Jupiter Ultra with built-in MEV protection. This prevents sandwich attacks where bots front-run your trade to extract value. Dynamic slippage automatically adjusts based on real-time pool conditions.</p>
      </div>
    </ModalShell>
  );
}

// ========== WALLET IMPORT ==========
export function WalletImportModal() {
  const open = useMoby((s) => s.walletImportOpen);
  const setOpen = useMoby((s) => s.setWalletImportOpen);
  const connect = useMoby((s) => s.connectWallet);
  const [method, setMethod] = useState<"seed" | "private" | "watch">("seed");
  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending import timer when modal closes
  useEffect(() => {
    if (!open) {
      if (importTimerRef.current) {
        clearTimeout(importTimerRef.current);
        importTimerRef.current = null;
      }
      // Defer setState to avoid synchronous setState in effect
      Promise.resolve().then(() => setImporting(false));
      // Don't clear input here — let the submit handler do it to avoid losing
      // user input if the modal is briefly closed and reopened.
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (importTimerRef.current) clearTimeout(importTimerRef.current);
    };
  }, []);

  const handleImport = () => {
    if (!input.trim()) return;
    setImporting(true);
    // Clear sensitive input immediately on submit
    const submittedInput = input;
    setInput("");
    importTimerRef.current = setTimeout(() => {
      // For watch-only mode, pass the address through
      const address = method === "watch" ? submittedInput.trim() : undefined;
      connect("Imported Wallet", address);
      setImporting(false);
      setOpen(false);
      importTimerRef.current = null;
    }, 1500);
  };

  return (
    <ModalShell open={open} onClose={() => setOpen(false)} title="Import wallet" icon={<Key className="h-4 w-4 text-bull" />}>
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 mb-3 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
        <div className="text-[10px] text-muted-foreground">Moby never stores your seed phrase or private key. Import is processed locally in your browser. Always verify the URL before entering sensitive data.</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { k: "seed", label: "Seed phrase", emoji: "🌱" },
          { k: "private", label: "Private key", emoji: "🔑" },
          { k: "watch", label: "Watch only", emoji: "👁️" },
        ].map((m) => (
          <button key={m.k} onClick={() => { setMethod(m.k as typeof method); setShowInput(true); setInput(""); }} className={cn("py-2 rounded-lg border text-center transition-colors", method === m.k && showInput ? "border-bull/30 bg-bull/10" : "border-border hover:bg-surface-2")}>
            <div className="text-lg">{m.emoji}</div>
            <div className="text-[10px] font-semibold">{m.label}</div>
          </button>
        ))}
      </div>

      {showInput && (
        <div className="space-y-3">
          {method === "seed" && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Enter 12 or 24 word seed phrase</div>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="word1 word2 word3 word4..." className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs font-mono h-20 resize-none focus:outline-none focus:ring-2 focus:ring-bull/40" />
            </div>
          )}
          {method === "private" && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Enter private key</div>
              <input type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x..." className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-bull/40" />
            </div>
          )}
          {method === "watch" && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Enter wallet address to watch</div>
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x7a3f... or Solana address" className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-bull/40" />
              <div className="text-[10px] text-muted-foreground mt-1">Watch-only wallets can view balances and activity but cannot send transactions.</div>
            </div>
          )}
          <button onClick={handleImport} disabled={!input.trim() || importing} className="w-full py-2.5 rounded-xl bg-bull text-background text-sm font-bold disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2">
            {importing ? (<><span className="h-2 w-2 rounded-full bg-background live-dot" /> Importing...</>) : (<><Key className="h-4 w-4" /> Import wallet</>)}
          </button>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-border p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Or create a new wallet</div>
        <button onClick={() => { connect("New Wallet"); setOpen(false); }} className="w-full py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2">
          ✨ Create new wallet
        </button>
      </div>
    </ModalShell>
  );
}

// ========== WATCHLIST ALERTS ==========
export function WatchlistAlertsModal() {
  const open = useMoby((s) => s.watchlistAlertsOpen);
  const setOpen = useMoby((s) => s.setWatchlistAlertsOpen);
  const watchlist = useMoby((s) => s.watchlist);
  const openToken = useMoby((s) => s.openToken);
  const watchlistAlerts = useMoby((s) => s.watchlistAlerts);
  const setWatchlistAlert = useMoby((s) => s.setWatchlistAlert);
  const removeWatchlistAlert = useMoby((s) => s.removeWatchlistAlert);

  // Local form state keyed by tokenId (initialized from store)
  const [forms, setForms] = useState<Record<string, { above: string; below: string; smart: boolean; move10: boolean }>>({});

  // Sync form state when modal opens
  useEffect(() => {
    if (!open) return;
    const next: Record<string, { above: string; below: string; smart: boolean; move10: boolean }> = {};
    watchlist.forEach((id) => {
      const cfg = watchlistAlerts[id];
      next[id] = {
        above: cfg?.priceAbove ? String(cfg.priceAbove) : "",
        below: cfg?.priceBelow ? String(cfg.priceBelow) : "",
        smart: cfg?.smartMoneyEntry ?? true,
        move10: cfg?.move10 ?? true,
      };
    });
    // Defer to avoid synchronous setState in effect
    Promise.resolve().then(() => setForms(next));
  }, [open, watchlist, watchlistAlerts]);

  const handleSave = (tokenId: string) => {
    const f = forms[tokenId];
    if (!f) return;
    const above = parseFloat(f.above);
    const below = parseFloat(f.below);
    setWatchlistAlert(tokenId, {
      priceAbove: isNaN(above) ? undefined : above,
      priceBelow: isNaN(below) ? undefined : below,
      smartMoneyEntry: f.smart,
      move10: f.move10,
    });
  };

  return (
    <ModalShell open={open} onClose={() => setOpen(false)} title="Watchlist alerts" icon={<Bell className="h-4 w-4 text-bull" />}>
      <div className="text-[11px] text-muted-foreground mb-3">Get notified when your watchlist tokens make significant moves. Configure custom thresholds per token.</div>
      <div className="space-y-2">
        {watchlist.map((id) => {
          const t = TOKENS_BY_ID[id];
          if (!t) return null;
          const f = forms[id] ?? { above: "", below: "", smart: true, move10: true };
          const hasExisting = !!watchlistAlerts[id];
          return (
            <div key={id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2.5 mb-2">
                <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="sm" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{t.symbol}</div>
                  <div className="text-[10px] text-muted-foreground tabular">{fmtPrice(t.price)} · {fmtPct(t.change24h)}</div>
                </div>
                <button onClick={() => { setOpen(false); setTimeout(() => openToken(id), 200); }} className="text-[10px] text-bull hover:opacity-80">View →</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase mb-1">Price above</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={f.above}
                    onChange={(e) => setForms((s) => ({ ...s, [id]: { ...f, above: e.target.value } }))}
                    placeholder={fmtPrice(t.price * 1.1)}
                    className="w-full bg-surface-2 border border-border rounded-md px-2 py-1 text-[11px] tabular focus:outline-none focus:ring-1 focus:ring-bull/40"
                  />
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase mb-1">Price below</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={f.below}
                    onChange={(e) => setForms((s) => ({ ...s, [id]: { ...f, below: e.target.value } }))}
                    placeholder={fmtPrice(t.price * 0.9)}
                    className="w-full bg-surface-2 border border-border rounded-md px-2 py-1 text-[11px] tabular focus:outline-none focus:ring-1 focus:ring-bull/40"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={f.smart}
                    onChange={(e) => setForms((s) => ({ ...s, [id]: { ...f, smart: e.target.checked } }))}
                    className="accent-bull"
                  /> Smart money entry
                </label>
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={f.move10}
                    onChange={(e) => setForms((s) => ({ ...s, [id]: { ...f, move10: e.target.checked } }))}
                    className="accent-bull"
                  /> 10%+ move
                </label>
                <div className="ml-auto flex items-center gap-1.5">
                  {hasExisting && (
                    <button
                      onClick={() => {
                        removeWatchlistAlert(id);
                        setForms((s) => ({ ...s, [id]: { above: "", below: "", smart: true, move10: true } }));
                      }}
                      className="text-[10px] text-bear hover:opacity-80"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => handleSave(id)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-md bg-bull text-background hover:opacity-90"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {watchlist.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">Add tokens to your watchlist to configure alerts.</div>
        )}
      </div>
    </ModalShell>
  );
}

// ========== MODAL SHELL (shared) ==========
function ModalShell({ open, onClose, title, icon, children }: { open: boolean; onClose: () => void; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              {icon}
              <h2 className="font-semibold text-sm flex-1">{title}</h2>
              <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
