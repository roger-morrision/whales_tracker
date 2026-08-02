"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { X, Flame, Rocket, Zap, ExternalLink, RefreshCw, Filter, TrendingUp, AlertTriangle } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { Chip, Sparkline } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PumpFunToken {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  launchpad: string;
  status: "bonding" | "graduating" | "graduated" | "migrated";
  marketCap: number;
  bondingCurveProgress: number;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  ageMinutes: number;
  creator: string;
  creatorVerified: boolean;
  description: string;
  migratedTo?: string | null;
  migrationProgress?: number;
  socials?: { twitter?: string; telegram?: string };
  topHolderPct: number;
  devHoldingPct: number;
  isLive: boolean;
}

type TabKey = "new" | "graduating" | "graduated" | "migrating";

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: "new", label: "New launches", emoji: "🆕" },
  { key: "graduating", label: "Graduating", emoji: "🎓" },
  { key: "graduated", label: "Graduated", emoji: "✅" },
  { key: "migrating", label: "Migrated", emoji: "🔀" },
];

const LAUNCHPAD_FILTERS = ["all", "pump.fun", "letsbonk.fun", "Raydium Launch Lab", "Moonshot"] as const;

function fmtUsd(n: number, compact = true): string {
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtAge(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${Math.floor(min / 1440)}d`;
}

function fmtPrice(n: number): string {
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

const STATUS_META: Record<PumpFunToken["status"], { label: string; color: string; bg: string }> = {
  bonding: { label: "Bonding curve", color: "text-gold", bg: "bg-gold/10" },
  graduating: { label: "Graduating!", color: "text-bull", bg: "bg-bull/10" },
  graduated: { label: "Graduated", color: "text-bull", bg: "bg-bull/10" },
  migrated: { label: "Migrated", color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10" },
};

const LP_COLORS: Record<string, string> = {
  "pump.fun": "from-[#00FF7F] to-[#00CC66]",
  "letsbonk.fun": "from-[#F97316] to-[#EF4444]",
  "Raydium Launch Lab": "from-[#1ABC9C] to-[#16A085]",
  Moonshot: "from-[#A855F7] to-[#7E22CE]",
  PumpSwap: "from-[#00FF7F] to-[#00CC66]",
};

export function PumpFunExplorerModal() {
  const open = useMoby((s) => s.pumpFunOpen);
  const setOpen = useMoby((s) => s.setPumpFunOpen);
  const [tab, setTab] = useState<TabKey>("new");
  const [launchpad, setLaunchpad] = useState<(typeof LAUNCHPAD_FILTERS)[number]>("all");
  const [tokens, setTokens] = useState<PumpFunToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      const lpParam = launchpad !== "all" ? `&launchpad=${encodeURIComponent(launchpad)}` : "";
      const res = await fetch(`/api/pumpfun?type=${tab}&limit=30${lpParam}`);
      const data = await res.json();
      setTokens(data.tokens || []);
      setCounts(data.launchpads || {});
    } catch {
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [tab, launchpad]);

  useEffect(() => {
    if (open) fetchTokens();
  }, [open, fetchTokens]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(fetchTokens, 30_000);
    return () => clearInterval(interval);
  }, [open, fetchTokens]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md h-[90vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Flame className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Launchpad explorer</h2>
              <button onClick={fetchTokens} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground" aria-label="Refresh">
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </button>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab selector */}
            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors flex items-center justify-center gap-1", tab === t.key ? "bg-surface-3 text-foreground" : "text-muted-foreground")}>
                  <span>{t.emoji}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Launchpad filters */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pb-2">
              {LAUNCHPAD_FILTERS.map((lp) => (
                <button key={lp} onClick={() => setLaunchpad(lp)} className={cn("shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors", launchpad === lp ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-2 text-muted-foreground border-border")}>
                  {lp === "all" ? "All platforms" : lp}
                </button>
              ))}
            </div>

            {/* Stats bar */}
            <div className="px-4 pb-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" /> Live</span>
              <span>{tokens.length} tokens</span>
              {counts["pump.fun"] !== undefined && <span>pump.fun: {counts["pump.fun"]}</span>}
              {counts["letsbonk.fun"] !== undefined && <span>bonk: {counts["letsbonk.fun"]}</span>}
              <span className="ml-auto">Auto-refresh 30s</span>
            </div>

            {/* Token list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4 space-y-2">
              {loading && tokens.length === 0 && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="rounded-xl border border-border p-3 animate-pulse">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="h-9 w-9 rounded-full bg-surface-3" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 w-20 bg-surface-3 rounded" />
                          <div className="h-2 w-32 bg-surface-3 rounded" />
                        </div>
                        <div className="h-4 w-12 bg-surface-3 rounded" />
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-3" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && tokens.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No tokens found for this filter.
                </div>
              )}

              {tokens.map((t) => (
                <PumpFunTokenCard key={t.id} token={t} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PumpFunTokenCard({ token }: { token: PumpFunToken }) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = STATUS_META[token.status];
  const lpColor = LP_COLORS[token.launchpad] || "from-[#64748B] to-[#334155]";
  const isBull = token.priceChange24h >= 0;
  // Deterministic sparkline: seed from token.id so the shape doesn't reshuffle
  // every time the parent re-renders or fetches new tokens.
  const sparkData = useMemo(() => {
    const seedStr = token.id || token.symbol;
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const out: number[] = [];
    let v = token.price * 0.8;
    for (let i = 0; i < 20; i++) {
      v = v * (1 + (rng() - 0.4) * 0.1);
      out.push(v);
    }
    out.push(token.price);
    return out;
  }, [token.id, token.price]);

  const devRisk = token.devHoldingPct > 10;
  const holderRisk = token.topHolderPct > 20;

  return (
    <div className="rounded-xl border border-border p-3 hover:bg-surface-2/50 transition-colors">
      {/* Row 1: identity */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br grid place-items-center text-xs font-bold text-white shrink-0", lpColor)}>
          {token.symbol.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">${token.symbol}</span>
            <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded", statusMeta.bg, statusMeta.color)}>
              {statusMeta.label}
            </span>
            {token.isLive && <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" />}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {token.launchpad} · {fmtAge(token.ageMinutes)} old · {token.holders} holders
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold tabular">{fmtUsd(token.marketCap)}</div>
          <div className={cn("text-[10px] tabular", isBull ? "text-bull" : "text-bear")}>
            {isBull ? "+" : ""}{token.priceChange24h.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Row 2: bonding curve or migration progress */}
      {token.status === "bonding" || token.status === "graduating" ? (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[9px] mb-0.5">
            <span className="text-muted-foreground">Bonding curve</span>
            <span className={cn("font-semibold tabular", token.bondingCurveProgress > 85 ? "text-bull" : "text-foreground")}>
              {token.bondingCurveProgress}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", token.bondingCurveProgress > 85 ? "bg-bull" : "bg-gold")}
              style={{ width: `${token.bondingCurveProgress}%` }}
            />
          </div>
          {token.bondingCurveProgress > 85 && (
            <div className="text-[9px] text-bull font-semibold mt-0.5">
              🎓 Graduating soon! {100 - token.bondingCurveProgress}% to go
            </div>
          )}
        </div>
      ) : null}

      {token.status === "migrated" && token.migrationProgress !== undefined && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[9px] mb-0.5">
            <span className="text-muted-foreground">Migration to {token.migratedTo}</span>
            <span className="text-[#22D3EE] font-semibold tabular">{token.migrationProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full rounded-full bg-[#22D3EE]" style={{ width: `${token.migrationProgress}%` }} />
          </div>
        </div>
      )}

      {token.status === "graduated" && token.migratedTo && (
        <div className="mb-2 flex items-center gap-1.5 text-[10px]">
          <Chip variant="bull">Migrated to {token.migratedTo}</Chip>
          <span className="text-muted-foreground">Now trading on AMM</span>
        </div>
      )}

      {/* Row 3: stats */}
      <div className="grid grid-cols-4 gap-1 text-[9px]">
        <div><span className="text-muted-foreground">Price: </span><span className="font-semibold tabular">{fmtPrice(token.price)}</span></div>
        <div><span className="text-muted-foreground">Vol: </span><span className="font-semibold tabular">{fmtUsd(token.volume24h)}</span></div>
        <div><span className="text-muted-foreground">Liq: </span><span className="font-semibold tabular">{fmtUsd(token.liquidity)}</span></div>
        <div><span className="text-muted-foreground">Dev: </span><span className={cn("font-semibold tabular", devRisk ? "text-bear" : "text-foreground")}>{token.devHoldingPct}%</span></div>
      </div>

      {/* Risk indicators */}
      {(devRisk || holderRisk) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {devRisk && <span className="text-[9px] text-bear bg-bear/10 px-1.5 py-0.5 rounded font-semibold">⚠️ Dev holds {token.devHoldingPct}%</span>}
          {holderRisk && <span className="text-[9px] text-bear bg-bear/10 px-1.5 py-0.5 rounded font-semibold">⚠️ Top holder {token.topHolderPct}%</span>}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-bull hover:opacity-80 mt-1.5"
      >
        {expanded ? "Less ▲" : "More info ▼"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 pt-2 border-t border-border">
          <div className="text-[10px] text-muted-foreground">{token.description}</div>
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            <div><span className="text-muted-foreground">Creator: </span><span className="font-mono">{token.creator}</span> {token.creatorVerified && "✓"}</div>
            <div><span className="text-muted-foreground">Mint: </span><span className="font-mono">{token.mint}</span></div>
          </div>
          {token.socials && (token.socials.twitter || token.socials.telegram) && (
            <div className="flex gap-2">
              {token.socials.twitter && <a href={token.socials.twitter} target="_blank" rel="noopener noreferrer" className="text-[10px] text-bull hover:underline">𝕏 Twitter</a>}
              {token.socials.telegram && <a href={token.socials.telegram} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#229ED9] hover:underline">✈️ Telegram</a>}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        <button
          onClick={() => useMoby.getState().pushToast({ title: "Added to watchlist", description: `$${token.symbol} from ${token.launchpad}`, type: "success" })}
          className="py-1.5 rounded-md border border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        >
          ⭐ Watch
        </button>
        <button
          onClick={() => useMoby.getState().pushToast({ title: "Buy signal", description: `Buying $${token.symbol} at ${fmtPrice(token.price)}`, type: "alert" })}
          className="py-1.5 rounded-md bg-bull text-background text-[10px] font-bold"
        >
          🟢 Buy
        </button>
        <button
          onClick={() => useMoby.getState().pushToast({ title: "Security check", description: `Analyzing $${token.symbol}...`, type: "info" })}
          className="py-1.5 rounded-md border border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        >
          🛡️ Audit
        </button>
      </div>
    </div>
  );
}
