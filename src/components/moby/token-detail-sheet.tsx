"use client";

import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet"; // not used directly — using custom sheet for richer layout
import {
  X,
  Star,
  StarOff,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Wallet,
  Activity,
  TrendingUp,
  Bell,
  GitCompareArrows,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TOKENS_BY_ID, fmtUsd, fmtPrice, fmtPct, fmtNum, fmtAge, type Token } from "@/lib/moby-data";
import { useMoby, useToken } from "@/lib/moby-store";
import { TokenIcon, Chip, Sparkline } from "./primitives";
import { HolderDistributionSection } from "./holder-distribution";
import { WalletLink } from "./wallet-link";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Range = "5M" | "1H" | "1D" | "1W" | "ALL";

export function TokenDetailSheet() {
  const tokenId = useMoby((s) => s.selectedTokenId);
  const openToken = useMoby((s) => s.openToken);
  const token = useToken(tokenId);

  return (
    <AnimatePresence>
      {token && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => openToken(null)}
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
            <TokenDetailContent token={token} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TokenDetailContent({ token }: { token: Token }) {
  const [range, setRange] = useState<Range>("1D");
  const openToken = useMoby((s) => s.openToken);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const watchlist = useMoby((s) => s.watchlist);
  const toggleWatch = useMoby((s) => s.toggleWatch);
  const prices = useMoby((s) => s.prices);
  const openTrade = useMoby((s) => s.openTrade);
  const openAlertCreator = useMoby((s) => s.openAlertCreator);
  const toggleCompareId = useMoby((s) => s.toggleCompareId);
  const setCompareOpen = useMoby((s) => s.setCompareOpen);
  const compareIds = useMoby((s) => s.compareIds);
  const watched = watchlist.includes(token.id);
  const inCompare = compareIds.includes(token.id);

  const live = prices[token.id]?.price ?? token.price;
  const delta1h = ((live - token.price * (1 - token.change1h / 100)) / token.price) * 100;
  const delta24h = ((live - token.price * (1 - token.change24h / 100)) / token.price) * 100;
  const isBull = delta24h >= 0;

  // Build a synthetic chart series from the sparkline + live price.
  // Use the token id + index as a deterministic seed so the chart shape is stable
  // across renders (only the last point moves with `live`).
  const chartData = useMemo(() => {
    const base = token.sparkline;
    const n = base.length;
    // tiny deterministic wiggle from a hash of token.id + i
    const hash = (s: string) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 1000) / 1000; // 0..1
    };
    return base.map((v, i) => ({
      i,
      v: i === n - 1 ? live : v * (1 + (hash(`${token.id}-${i}`) - 0.5) * 0.01),
      t: i * 60_000,
    }));
  }, [token, live]);

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3 z-10">
        <TokenIcon symbol={token.symbol} glyph={token.logoGlyph} color={token.logoColor} size="md" live={token.ageHours < 200} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{token.name}</span>
            <span className="text-xs text-muted-foreground">${token.symbol}</span>
            {!token.verified && <Chip variant="bear">Unverified</Chip>}
            {token.verified && (
              <span className="text-bull" title="Verified">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {token.chain} · {token.category} · age {fmtAge(token.ageHours)}
          </div>
        </div>
        <button
          onClick={() => toggleWatch(token.id)}
          className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
          aria-label="Watchlist"
        >
          {watched ? <Star className="h-4 w-4 fill-gold text-gold" /> : <StarOff className="h-4 w-4" />}
        </button>
        <button
          onClick={() => openToken(null)}
          className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Price */}
      <div className="px-4 pt-4">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold tabular">{fmtPrice(live)}</span>
          <div className={cn("flex items-center gap-1 pb-1.5 text-sm font-semibold", isBull ? "text-bull" : "text-bear")}>
            {isBull ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {isBull ? "+" : ""}
            {fmtPct(delta24h)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
          <span>1h: <span className={cn("tabular font-medium", delta1h >= 0 ? "text-bull" : "text-bear")}>{isBull ? "+" : ""}{delta1h.toFixed(2)}%</span></span>
          <span>24h: <span className={cn("tabular font-medium", delta24h >= 0 ? "text-bull" : "text-bear")}>{isBull ? "+" : ""}{delta24h.toFixed(2)}%</span></span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 mt-3">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 12 }}>
              <defs>
                <linearGradient id="token-chart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isBull ? "var(--bull)" : "var(--bear)"} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={isBull ? "var(--bull)" : "var(--bear)"} stopOpacity="0" />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={isBull ? "var(--bull)" : "var(--bear)"}
                strokeWidth={2}
                fill="url(#token-chart)"
                isAnimationActive={false}
              />
              <XAxis dataKey="i" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [fmtPrice(v), "Price"]}
                labelFormatter={() => ""}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-0.5 justify-end px-2 -mt-1">
          {(["5M", "1H", "1D", "1W", "ALL"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold rounded",
                range === r ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Trade buttons */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => openTrade(token.id, "SELL")}
          className="py-2.5 rounded-xl bg-bear/15 text-bear border border-bear/30 text-sm font-bold hover:bg-bear/20 transition-colors"
        >
          Sell
        </button>
        <button
          onClick={() => openTrade(token.id, "BUY")}
          className="py-2.5 rounded-xl bg-bull text-background text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Buy
        </button>
      </div>

      {/* Quick actions: alert + compare */}
      <div className="px-4 mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => openAlertCreator(token.id)}
          className="py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2 flex items-center justify-center gap-1.5"
        >
          <Bell className="h-3 w-3" /> Create alert
        </button>
        <button
          onClick={() => {
            toggleCompareId(token.id);
            setCompareOpen(true);
          }}
          className={cn(
            "py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5",
            inCompare
              ? "border-gold/40 text-gold bg-gold/10"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
          )}
        >
          <GitCompareArrows className="h-3 w-3" /> {inCompare ? "In compare" : "Compare"}
        </button>
      </div>

      {/* AI Summary */}
      <div className="px-4 mt-4">
        <div className="rounded-xl p-3 bg-gradient-to-br from-[#14F195]/12 via-[#22D3EE]/8 to-transparent border border-bull/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-bull" />
            <span className="text-xs font-semibold">Moby AI summary</span>
            <Chip variant="bull" className="ml-auto">Live</Chip>
          </div>
          <p className="text-[12px] text-foreground/90 leading-relaxed">
            <span className="font-semibold">{token.name}</span> is {isBull ? "trending up" : "pulling back"} {Math.abs(delta24h).toFixed(1)}% over 24h.{" "}
            {token.smartMoneyInflow24h > 0
              ? `Smart money has net accumulated ${fmtUsd(token.smartMoneyInflow24h, { compact: true })} from ${token.smartMoneyHolders} tracked wallets.`
              : `Smart money has distributed ${fmtUsd(Math.abs(token.smartMoneyInflow24h), { compact: true })} over 24h.`}{" "}
            Liquidity is {fmtUsd(token.liquidity, { compact: true })} with 24h volume of {fmtUsd(token.volume24h, { compact: true })}.{" "}
            {token.smartMoneyHolders >= 150
              ? "Smart-money concentration is high — strong conviction."
              : "Smart-money concentration is moderate — monitor for follow-through."}
          </p>
          <button
            onClick={() => {
              setCopilotOpen(true);
              setTimeout(() => useMoby.getState().sendChat(`Analyze $${token.symbol}`), 250);
            }}
            className="mt-2 text-[11px] text-bull hover:opacity-80 flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" /> Ask Moby for a deeper dive →
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-2">
        <Stat label="Market cap" value={fmtUsd(token.marketCap, { compact: true })} />
        <Stat label="Liquidity" value={fmtUsd(token.liquidity, { compact: true })} />
        <Stat label="24h volume" value={fmtUsd(token.volume24h, { compact: true })} />
        <Stat label="Holders" value={fmtNum(token.holders)} />
        <Stat label="Age" value={fmtAge(token.ageHours)} />
        <Stat label="Smart wallets" value={fmtNum(token.smartMoneyHolders)} />
      </div>

      {/* Smart money panel */}
      <div className="px-4 mt-4">
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 mb-3">
            <Wallet className="h-3.5 w-3.5 text-bull" />
            <span className="text-xs font-semibold">Smart money on {token.symbol}</span>
            <Chip variant="bull" className="ml-auto">{token.smartMoneyHolders} wallets</Chip>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[10px] text-muted-foreground">24h net flow</div>
              <div className={cn("text-sm font-semibold tabular", token.smartMoneyInflow24h >= 0 ? "text-bull" : "text-bear")}>
                {token.smartMoneyInflow24h >= 0 ? "+" : "-"}
                {fmtUsd(Math.abs(token.smartMoneyInflow24h), { compact: true })}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Avg wallet score</div>
              <div className="text-sm font-semibold tabular text-gold">{Math.min(98, 70 + token.smartMoneyHolders % 28)}</div>
            </div>
          </div>
          {/* Mock smart wallet list */}
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => {
              const score = 92 - i * 6;
              const pct = 18 - i * 3;
              const walletLabels = ["Smart Wallet #4218", "Whale: 0xMoby", "KOL: DegenDiva", "Smart Wallet #9821"];
              const walletAddrs = [`0x${i + 4}2${(i + 1) * 3}...${i + 8}a${(i + 1) * 7}c`, `0xab${i}f...${i + 2}c`, `0xde${i}a...${i + 5}f`, `0x${i + 1}b${(i + 2) * 4}...${i + 3}d`];
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#14F195] to-[#9945FF] grid place-items-center text-[10px] font-bold text-background">
                    {String.fromCharCode(65 + i)}
                  </div>
                  <WalletLink
                    label={walletLabels[i]}
                    address={walletAddrs[i]}
                    variant="mono"
                    className="text-[11px] flex-1 min-w-0 truncate"
                  />
                  <span className="ml-auto text-gold tabular font-semibold">{score}</span>
                  <span className="text-muted-foreground tabular w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Whale transactions */}
      <div className="px-4 mt-4 pb-6">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3.5 w-3.5 text-bull" />
          <span className="text-xs font-semibold">Recent whale transactions</span>
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => {
            const isBuy = i % 3 !== 2;
            const usd = [42_000, 184_000, 612_000, 1_240_000][i];
            const walletLabels = ["Smart Wallet #4218", "Whale: 0xMoby", "Smart Wallet #9821", "KOL: DegenDiva"];
            const walletAddrs = [`0x${(i + 1) * 13}a...${i + 4}b`, `0x${(i + 2) * 17}c...${i + 5}d`, `0x${(i + 3) * 11}e...${i + 6}f`, `0x${(i + 4) * 19}g...${i + 7}h`];
            return (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2 text-xs">
                <span className={cn("h-6 w-6 rounded grid place-items-center", isBuy ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear")}>
                  {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                </span>
                <WalletLink
                  label={walletLabels[i]}
                  address={walletAddrs[i]}
                  variant="mono"
                  className="text-[11px] flex-1 min-w-0 truncate"
                />
                <span className="ml-auto tabular font-semibold">{isBuy ? "+" : "-"}{fmtUsd(usd, { compact: true })}</span>
                <span className="text-muted-foreground text-[10px]">{(i + 1) * 7}m ago</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Holder distribution + top holders */}
      <div className="px-4 mt-4">
        <HolderDistributionSection tokenId={token.id} />
      </div>

      {/* External links */}
      <div className="px-4 mt-4 pb-6 flex gap-2">
        <button className="flex-1 h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1">
          <ExternalLink className="h-3 w-3" /> Explorer
        </button>
        <button className="flex-1 h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1">
          <TrendingUp className="h-3 w-3" /> Chart
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular">{value}</div>
    </div>
  );
}
