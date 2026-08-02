"use client";

import { useMemo, useState } from "react";
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
  Share2,
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
import { useGmgn } from "@/hooks/use-gmgn";
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

      {/* GMGN live data: security + smart money + KOL + top holders */}
      {token.mint && token.mint !== "0x0000000000000000000000000000000000000000" && (
        <GmgnPanel mint={token.mint} symbol={token.symbol} />
      )}

      {/* External links + tools */}
      <div className="px-4 mt-4 pb-6 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.open(`https://solscan.io/token/${token.symbol}`, "_blank");
              }
            }}
            className="h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Explorer
          </button>
          <button
            onClick={() => {
              useMoby.getState().openToken(null);
              setTimeout(() => useMoby.getState().openChart(token.id), 100);
            }}
            className="h-9 rounded-lg bg-bull/15 text-bull border border-bull/30 text-xs font-bold inline-flex items-center justify-center gap-1 hover:bg-bull/20"
          >
            <TrendingUp className="h-3 w-3" /> Chart
          </button>
          <button
            onClick={() => useMoby.getState().openAlertCreator(token.id)}
            className="h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            <Bell className="h-3 w-3" /> Alert
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              useMoby.getState().openToken(null);
              setTimeout(() => useMoby.getState().openSecurityAudit(token.id), 150);
            }}
            className="h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            🛡️ Audit
          </button>
          <button
            onClick={() => {
              useMoby.getState().openToken(null);
              setTimeout(() => useMoby.getState().openPrediction(token.id), 150);
            }}
            className="h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            🔮 Predict
          </button>
          <button
            onClick={() => {
              useMoby.getState().openToken(null);
              setTimeout(() => useMoby.getState().openLiquidityDepth(token.id), 150);
            }}
            className="h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            📊 Depth
          </button>
        </div>
        <button
          onClick={() => {
            const text = `${token.name} ($${token.symbol})\nPrice: ${fmtPrice(live)}\n24h: ${delta24h >= 0 ? "+" : ""}${delta24h.toFixed(2)}%\nSmart money: ${token.smartMoneyHolders} wallets\n\nDiscovered on Moby 🐋`;
            // Prefer Web Share API on mobile; otherwise open Moby's share modal
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({ title: `${token.symbol} on Moby`, text }).catch(() => {});
            } else {
              useMoby.getState().openShare({
                title: `${token.name} ($${token.symbol})`,
                description: `Price: ${fmtPrice(live)} · 24h: ${delta24h >= 0 ? "+" : ""}${delta24h.toFixed(2)}% · Smart money: ${token.smartMoneyHolders} wallets`,
                url: "https://moby.win",
              });
            }
          }}
          className="w-full h-9 rounded-lg bg-bull/15 text-bull border border-bull/30 text-xs font-bold inline-flex items-center justify-center gap-1 hover:bg-bull/20"
        >
          <Share2 className="h-3 w-3" /> Share {token.symbol}
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

// ===== GMGN Live Data Panel =====
function GmgnPanel({ mint, symbol }: { mint: string; symbol: string }) {
  const [tab, setTab] = useState<"security" | "holders" | "smart" | "kol" | "traders">("security");
  const apiUrl = `/api/gmgn/${tab === "smart" ? "smart-money" : tab}?address=${mint}&limit=15`;
  const { data, loading, source } = useGmgn<any>(apiUrl, { refreshMs: 60_000 });

  return (
    <div className="px-4 mt-4">
      <div className="rounded-2xl border border-border bg-surface-2/50 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-md bg-gradient-to-br from-[#14F195] to-[#9945FF] grid place-items-center text-[10px] font-bold text-background">
              G
            </div>
            <span className="text-xs font-semibold">GMGN Live</span>
            {source && (
              <Chip variant={source === "gmgn" ? "bull" : "outline"} className="text-[9px]">
                {source === "gmgn" ? "live" : "demo"}
              </Chip>
            )}
          </div>
          <div className="ml-auto text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
            {mint.slice(0, 6)}...{mint.slice(-4)}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 p-2 border-b border-border bg-surface-3/30">
          {[
            { k: "security", label: "Security" },
            { k: "holders", label: "Holders" },
            { k: "smart", label: "Smart" },
            { k: "kol", label: "KOL" },
            { k: "traders", label: "Traders" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors",
                tab === t.k
                  ? "bg-bull/15 text-bull"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-3 max-h-[300px] overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-surface-3 animate-pulse" />
              ))}
            </div>
          ) : !data ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Failed to load GMGN data. Try again later.
            </div>
          ) : (
            <>
              {tab === "security" && <GmgnSecurityView data={data.security} />}
              {tab === "holders" && <GmgnHoldersView holders={data.holders || []} />}
              {tab === "smart" && <GmgnSmartView activity={data.activity || []} />}
              {tab === "kol" && <GmgnKolView kols={data.kols || []} />}
              {tab === "traders" && <GmgnTradersView traders={data.traders || []} />}
            </>
          )}
        </div>

        {/* Footer link to GMGN */}
        <div className="px-3 py-2 border-t border-border bg-surface-3/20">
          <a
            href={`https://gmgn.ai/sol/token/${mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground hover:text-bull inline-flex items-center gap-1"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            View full report on gmgn.ai
          </a>
        </div>
      </div>
    </div>
  );
}

function GmgnSecurityView({ data }: { data: any }) {
  if (!data) return <div className="text-xs text-muted-foreground py-4 text-center">No security data</div>;
  const checks: { label: string; ok: boolean; value?: string }[] = [
    { label: "Mint authority revoked", ok: data.is_mint_authority_revoked },
    { label: "Freeze authority revoked", ok: data.is_freeze_authority_revoked },
    { label: "Not honeypot", ok: !data.is_honeypot },
    { label: "LP locked", ok: !!data.liquidity_locked, value: data.lp_locked_ratio ? `${(data.lp_locked_ratio * 100).toFixed(0)}%` : undefined },
    { label: "Open source", ok: data.is_open_source },
    { label: "Not proxy", ok: !data.is_proxy },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {checks.map((c) => (
          <div key={c.label} className="rounded-lg border border-border p-2 flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full shrink-0", c.ok ? "bg-bull" : "bg-bear")} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium truncate">{c.label}</div>
              {c.value && <div className="text-[10px] text-muted-foreground tabular">{c.value}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="rounded-lg border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Top 10 holders</div>
          <div className={cn("text-sm font-bold tabular", (data.top10_holder_rate ?? 0) > 35 ? "text-bear" : "text-foreground")}>
            {(data.top10_holder_rate ?? 0).toFixed(2)}%
          </div>
        </div>
        <div className="rounded-lg border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Dev holdings</div>
          <div className={cn("text-sm font-bold tabular", (data.dev_holder_rate ?? 0) > 10 ? "text-bear" : "text-foreground")}>
            {(data.dev_holder_rate ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>
      {data.risks && data.risks.length > 0 && (
        <div className="rounded-lg border border-bear/30 bg-bear/5 p-2">
          <div className="text-[10px] font-semibold text-bear mb-1">⚠ Risks identified</div>
          <ul className="text-[10px] text-muted-foreground list-disc list-inside space-y-0.5">
            {data.risks.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GmgnHoldersView({ holders }: { holders: any[] }) {
  if (holders.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No holder data</div>;
  return (
    <div className="space-y-1">
      {holders.slice(0, 15).map((h, i) => (
        <div key={i} className="rounded-lg border border-border p-2 flex items-center gap-2">
          <div className="text-[10px] font-semibold text-muted-foreground w-5">{i + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono truncate">{h.address}</span>
              {h.is_dev && <Chip variant="bear" className="text-[9px]">DEV</Chip>}
              {h.is_smart_money && <Chip variant="bull" className="text-[9px]">SMART</Chip>}
              {h.is_kol && <Chip variant="gold" className="text-[9px]">KOL</Chip>}
            </div>
            <div className="text-[10px] text-muted-foreground tabular">
              {fmtNum(h.balance)} · {fmtUsd(h.value_usd, { compact: true })}
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-xs font-bold tabular", h.holder_rate > 5 ? "text-bear" : "text-foreground")}>
              {h.holder_rate.toFixed(2)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GmgnSmartView({ activity }: { activity: any[] }) {
  if (activity.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No smart money activity</div>;
  return (
    <div className="space-y-1">
      {activity.slice(0, 15).map((a, i) => {
        const isBuy = a.type === "buy";
        return (
          <div key={i} className="rounded-lg border border-border p-2 flex items-center gap-2">
            <div className={cn("h-7 w-7 rounded-lg grid place-items-center shrink-0", isBuy ? "bg-bull/15" : "bg-bear/15")}>
              {isBuy ? <ArrowUpRight className="h-3.5 w-3.5 text-bull" /> : <ArrowDownRight className="h-3.5 w-3.5 text-bear" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono truncate">{a.address}</span>
                {a.wallet_tag && <Chip variant="outline" className="text-[9px]">{a.wallet_tag}</Chip>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {a.wallet_label || "Smart wallet"} · {new Date(a.ts * 1000).toLocaleTimeString()}
              </div>
            </div>
            <div className="text-right">
              <div className={cn("text-xs font-bold tabular", isBuy ? "text-bull" : "text-bear")}>
                {isBuy ? "+" : "-"}{fmtUsd(a.amount_usd, { compact: true })}
              </div>
              {a.pnl_30d_usd !== undefined && (
                <div className={cn("text-[10px] tabular", a.pnl_30d_usd >= 0 ? "text-bull" : "text-bear")}>
                  30d: {a.pnl_30d_usd >= 0 ? "+" : ""}{fmtUsd(a.pnl_30d_usd, { compact: true })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GmgnKolView({ kols }: { kols: any[] }) {
  if (kols.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No KOL holders</div>;
  return (
    <div className="space-y-1">
      {kols.slice(0, 15).map((k, i) => (
        <div key={i} className="rounded-lg border border-border p-2 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#22D3EE] to-[#9945FF] grid place-items-center text-[10px] font-bold text-background shrink-0">
            {k.twitter_name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold truncate">@{k.twitter_handle}</span>
              <Chip variant="gold" className="text-[9px]">KOL</Chip>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {fmtNum(k.followers)} followers · {fmtUsd(k.value_usd, { compact: true })}
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-xs font-bold tabular", (k.pnl_usd ?? 0) >= 0 ? "text-bull" : "text-bear")}>
              {k.pnl_usd >= 0 ? "+" : ""}{fmtUsd(k.pnl_usd, { compact: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GmgnTradersView({ traders }: { traders: any[] }) {
  if (traders.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No trader data</div>;
  return (
    <div className="space-y-1">
      {traders.slice(0, 15).map((t, i) => {
        const isWin = t.pnl >= 0;
        return (
          <div key={i} className="rounded-lg border border-border p-2 flex items-center gap-2">
            <div className="text-[10px] font-semibold text-muted-foreground w-5">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono truncate">{t.address}</span>
                {t.is_smart_money && <Chip variant="bull" className="text-[9px]">SMART</Chip>}
                {t.is_kol && <Chip variant="gold" className="text-[9px]">KOL</Chip>}
              </div>
              <div className="text-[10px] text-muted-foreground tabular">
                Buy {fmtUsd(t.buy_usd, { compact: true })} · Sell {fmtUsd(t.sell_usd, { compact: true })}
              </div>
            </div>
            <div className="text-right">
              <div className={cn("text-xs font-bold tabular", isWin ? "text-bull" : "text-bear")}>
                {isWin ? "+" : ""}{fmtUsd(t.pnl, { compact: true })}
              </div>
              {t.pnl_rate !== undefined && (
                <div className={cn("text-[10px] tabular", isWin ? "text-bull" : "text-bear")}>
                  {isWin ? "+" : ""}{t.pnl_rate.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
