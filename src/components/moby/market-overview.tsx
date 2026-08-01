"use client";

import { useMemo } from "react";
import {
  Activity,
  Gauge,
  Fuel,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import {
  MARKET_STATS,
  FEAR_GREED_HISTORY,
  getHeatmapTokens,
  fmtUsd,
  fmtNum,
  fmtPct,
} from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { SectionHeader, Sparkline } from "./primitives";
import { cn } from "@/lib/utils";

export function MarketOverview() {
  const openToken = useMoby((s) => s.openToken);
  const heatmap = useMemo(() => getHeatmapTokens().slice(0, 16), []);
  const total = heatmap.reduce((s, t) => s + t.mcap, 0);

  return (
    <div className="space-y-3">
      <SectionHeader title="Market overview" emoji="🌐" action="Details" onAction={() => useMoby.getState().setActiveTab("discover")} />

      <div className="grid grid-cols-2 gap-2">
        <FearGreedCard />
        <MarketCapCard />
      </div>

      <DominanceBar />

      <div className="grid grid-cols-2 gap-2">
        <GasCard />
        <VolumeCard />
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3.5 w-3.5 text-bull" />
          <span className="text-xs font-semibold">Top tokens heatmap</span>
          <span className="ml-auto text-[10px] text-muted-foreground">size = market cap</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {heatmap.map((t) => {
            const size = Math.max(40, Math.min(120, Math.sqrt(t.mcap / 1_000_000) * 1.4));
            const isBull = t.change >= 0;
            return (
              <button
                key={t.id}
                onClick={() => openToken(t.id)}
                style={{ width: size, height: size * 0.7 }}
                className={cn(
                  "rounded-md grid place-items-center text-center p-1 hover:opacity-90 transition-opacity border border-white/5",
                  isBull ? "bg-bull/20" : "bg-bear/20"
                )}
              >
                <div className="text-[10px] font-bold leading-tight">{t.symbol}</div>
                <div className={cn("text-[9px] tabular font-semibold", isBull ? "text-bull" : "text-bear")}>
                  {isBull ? "+" : ""}
                  {t.change.toFixed(1)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FearGreedCard() {
  const v = MARKET_STATS.fearGreedIndex;
  const label = MARKET_STATS.fearGreedLabel;
  const yesterday = MARKET_STATS.fearGreedYesterday;
  const delta = v - yesterday;

  // Color based on value
  const color =
    v < 25 ? "text-bear" : v < 45 ? "text-orange-400" : v < 55 ? "text-muted-foreground" : v < 75 ? "text-bull" : "text-gold";
  const bgColor =
    v < 25 ? "from-bear/20" : v < 45 ? "from-orange-500/15" : v < 55 ? "from-surface-3" : v < 75 ? "from-bull/20" : "from-gold/20";

  return (
    <div className={cn("rounded-xl p-3 bg-gradient-to-br to-transparent border border-border", bgColor)}>
      <div className="flex items-center gap-1 mb-1">
        <Gauge className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fear & Greed</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={cn("text-3xl font-bold tabular", color)}>{v}</span>
        <span className={cn("text-xs font-semibold pb-1", color)}>{label}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <Sparkline data={FEAR_GREED_HISTORY} width={80} height={16} bullish={delta >= 0} />
        <span className={cn("text-[10px] tabular ml-auto", delta >= 0 ? "text-bull" : "text-bear")}>
          {delta >= 0 ? "+" : ""}
          {delta} vs yesterday
        </span>
      </div>
    </div>
  );
}

function MarketCapCard() {
  const total = MARKET_STATS.totalMarketCap;
  const vol = MARKET_STATS.totalVolume24h;
  return (
    <div className="rounded-xl p-3 border border-border">
      <div className="flex items-center gap-1 mb-1">
        <TrendingUp className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total mcap</span>
      </div>
      <div className="text-2xl font-bold tabular">{fmtUsd(total, { compact: true })}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground">24h vol</span>
        <span className="text-[11px] font-semibold tabular">{fmtUsd(vol, { compact: true })}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">{fmtNum(MARKET_STATS.activeCryptos)} coins</span>
        <span className="text-[10px] text-muted-foreground">·</span>
        <span className="text-[10px] text-muted-foreground">{fmtNum(MARKET_STATS.markets)} markets</span>
      </div>
    </div>
  );
}

function DominanceBar() {
  const btc = MARKET_STATS.btcDominance;
  const eth = MARKET_STATS.ethDominance;
  const sol = MARKET_STATS.solDominance;
  const others = 100 - btc - eth - sol;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">Dominance</span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-bull">+{MARKET_STATS.solMcapChange24h.toFixed(1)}%</span>
          <span className="text-muted-foreground">SOL 24h</span>
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-3 mb-2">
        <div className="bg-[#F7931A]" style={{ width: `${btc}%` }} />
        <div className="bg-[#627EEA]" style={{ width: `${eth}%` }} />
        <div className="bg-bull" style={{ width: `${sol}%` }} />
        <div className="bg-muted" style={{ width: `${others}%` }} />
      </div>
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        <DomCell label="BTC" value={btc} change={MARKET_STATS.btcMcapChange24h} color="bg-[#F7931A]" />
        <DomCell label="ETH" value={eth} change={MARKET_STATS.ethMcapChange24h} color="bg-[#627EEA]" />
        <DomCell label="SOL" value={sol} change={MARKET_STATS.solMcapChange24h} color="bg-bull" />
        <DomCell label="Others" value={others} change={0} color="bg-muted" />
      </div>
    </div>
  );
}

function DomCell({
  label,
  value,
  change,
  color,
}: {
  label: string;
  value: number;
  change: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <span className={cn("h-1.5 w-1.5 rounded-sm", color)} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="font-semibold tabular">{value.toFixed(1)}%</div>
      {change !== 0 && (
        <div className={cn("tabular text-[9px]", change >= 0 ? "text-bull" : "text-bear")}>
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function GasCard() {
  return (
    <div className="rounded-xl p-3 border border-border">
      <div className="flex items-center gap-1 mb-1">
        <Fuel className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gas tracker</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">ETH</span>
          <span className="text-sm font-semibold tabular">{MARKET_STATS.ethGas} <span className="text-[10px] text-muted-foreground">gwei</span></span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">SOL</span>
          <span className="text-sm font-semibold tabular">{fmtNum(MARKET_STATS.solGas)} <span className="text-[10px] text-muted-foreground">lamports</span></span>
        </div>
      </div>
      <div className="mt-1.5 text-[9px] text-muted-foreground">
        Standard · ~$0.0008 per swap
      </div>
    </div>
  );
}

function VolumeCard() {
  const tokens = getHeatmapTokens().slice(0, 3);
  return (
    <div className="rounded-xl p-3 border border-border">
      <div className="flex items-center gap-1 mb-1">
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Top volume</span>
      </div>
      <div className="space-y-1">
        {tokens.map((t, i) => (
          <div key={t.id} className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              {i + 1}. <span className="text-foreground font-medium">{t.symbol}</span>
            </span>
            <span className={cn("tabular font-semibold", t.change >= 0 ? "text-bull" : "text-bear")}>
              {t.change >= 0 ? "+" : ""}
              {t.change.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
