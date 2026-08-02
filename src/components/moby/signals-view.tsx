"use client";

import { useMemo, useState } from "react";
import { Zap, Bookmark, BookmarkCheck, X, ShieldCheck, AlertTriangle, ArrowUpRight } from "lucide-react";
import { fmtUsd, fmtNum, fmtAgo, type SmartSignal } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { useGmgn } from "@/hooks/use-gmgn";
import { TokenIcon, Chip, SectionHeader } from "./primitives";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  SmartSignal["type"],
  { label: string; emoji: string; color: "bull" | "bear" | "gold" }
> = {
  SMART_MONEY_ENTRY: { label: "Smart money entry", emoji: "🐋", color: "bull" },
  WHALE_ACCUMULATION: { label: "Whale accumulation", emoji: "🐳", color: "bull" },
  EARLY_ENTRY: { label: "Early entry", emoji: "⚡", color: "gold" },
  CLUSTER_BUY: { label: "Cluster buy", emoji: "🎯", color: "bull" },
  DIVERGENCE: { label: "Divergence", emoji: "⚠️", color: "bear" },
  TRENDING: { label: "Trending", emoji: "📈", color: "gold" },
};

const FILTERS = ["all", "early", "cluster", "whale", "divergence"] as const;
type Filter = (typeof FILTERS)[number];

export function SignalsView() {
  const signals = useMoby((s) => s.signals);
  const dismissed = useMoby((s) => s.dismissedSignals);
  const saved = useMoby((s) => s.savedSignals);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () =>
      signals.filter((s) => {
        if (dismissed.includes(s.id)) return false;
        if (filter === "all") return true;
        if (filter === "early") return s.type === "EARLY_ENTRY";
        if (filter === "cluster") return s.type === "CLUSTER_BUY";
        if (filter === "whale") return s.type === "WHALE_ACCUMULATION" || s.type === "SMART_MONEY_ENTRY";
        if (filter === "divergence") return s.type === "DIVERGENCE";
        return true;
      }),
    [signals, dismissed, filter]
  );

  return (
    <div className="space-y-4">
      <SignalsHeader count={visible.length} savedCount={saved.length} />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors border",
              filter === f
                ? "bg-bull/15 text-bull border-bull/30"
                : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {f === "all" ? "All signals" : f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((s) => (
          <SignalCard key={s.id} signal={s} />
        ))}
        {visible.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No signals match this filter.
          </div>
        )}
      </div>

      {/* GMGN live signals */}
      <GmgnSignalsSection />
    </div>
  );
}

function SignalsHeader({ count, savedCount }: { count: number; savedCount: number }) {
  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-[#9945FF]/12 via-[#14F195]/8 to-transparent border border-[#9945FF]/20">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-bull" />
        <h2 className="text-sm font-semibold">Smart money signals</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-bull font-semibold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" /> {count} live
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Real-time alerts when tracked smart wallets make moves. Saved: <span className="text-foreground font-medium">{savedCount}</span>
      </p>
      {count === 0 && (
        <div className="text-center py-8 mt-4">
          <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold mb-1">All signals dismissed</p>
          <p className="text-xs text-muted-foreground mb-3">New signals will appear here as smart wallets make moves.</p>
          <button
            onClick={() => useMoby.setState((s) => ({ dismissedSignals: [] }))}
            className="px-3 py-1.5 rounded-lg bg-bull/15 text-bull border border-bull/30 text-xs font-bold hover:bg-bull/20"
          >
            Reset dismissed signals
          </button>
        </div>
      )}
    </div>
  );
}

function SignalCard({ signal }: { signal: SmartSignal }) {
  const openToken = useMoby((s) => s.openToken);
  const toggleSave = useMoby((s) => s.toggleSaveSignal);
  const dismiss = useMoby((s) => s.dismissSignal);
  const saved = useMoby((s) => s.savedSignals.includes(signal.id));
  const meta = TYPE_META[signal.type];
  const isBull = signal.usdInflow >= 0;
  const confidenceColor =
    signal.confidence >= 85 ? "text-bull" : signal.confidence >= 70 ? "text-gold" : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-lg grid place-items-center text-lg shrink-0",
            meta.color === "bull" && "bg-bull/15",
            meta.color === "bear" && "bg-bear/15",
            meta.color === "gold" && "bg-gold/15"
          )}
        >
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => openToken(signal.tokenId)}
              className="inline-flex items-center gap-1.5 hover:text-bull"
            >
              <span className="font-semibold text-sm">${signal.tokenSymbol}</span>
              <span className="text-[11px] text-muted-foreground truncate">{signal.tokenName}</span>
            </button>
            <Chip variant={meta.color}>{meta.label}</Chip>
            <Chip variant="outline" className="ml-auto">
              {signal.chain}
            </Chip>
          </div>
          <p className="text-sm mt-1.5">{signal.title}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">{signal.description}</p>

          <div className="flex items-center gap-4 mt-2.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Wallets</span>
              <span className="text-xs font-semibold tabular">{signal.smartWalletsCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Inflow</span>
              <span className={cn("text-xs font-semibold tabular", isBull ? "text-bull" : "text-bear")}>
                {isBull ? "+" : "-"}
                {fmtUsd(Math.abs(signal.usdInflow), { compact: true })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Confidence</span>
              <span className={cn("text-xs font-semibold tabular", confidenceColor)}>{signal.confidence}%</span>
            </div>
            <span className="ml-auto text-[10px] text-muted-foreground">{fmtAgo(signal.agoSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pl-[52px]">
        <button
          onClick={() => openToken(signal.tokenId)}
          className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md bg-bull text-background text-[11px] font-semibold hover:opacity-90"
        >
          Validate <ShieldCheck className="h-3 w-3" />
        </button>
        <button
          onClick={() => toggleSave(signal.id)}
          className={cn(
            "h-7 px-2.5 inline-flex items-center gap-1 rounded-md border text-[11px] font-semibold",
            saved
              ? "border-gold/40 text-gold bg-gold/10"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {saved ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
          {saved ? "Saved" : "Save"}
        </button>
        <button
          onClick={() => dismiss(signal.id)}
          className="ml-auto h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-3"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ===== GMGN Live Signals Section =====
const SIGNAL_TYPE_META: Record<string, { label: string; emoji: string; color: string }> = {
  smart_money_buy: { label: "Smart money buy", emoji: "🐋", color: "text-bull" },
  smart_money_sell: { label: "Smart money sell", emoji: "🔥", color: "text-bear" },
  large_buy: { label: "Large buy", emoji: "🐳", color: "text-bull" },
  price_spike: { label: "Price spike", emoji: "⚡", color: "text-gold" },
  new_listing: { label: "New listing", emoji: "🆕", color: "text-bull" },
};

function GmgnSignalsSection() {
  const { data, loading, source } = useGmgn<{ signals: any[] }>(
    "/api/gmgn/signals?chain=sol&limit=15",
    { refreshMs: 60_000 }
  );

  return (
    <section className="rounded-2xl border border-border bg-surface-2/40 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
        <div className="h-5 w-5 rounded-md bg-gradient-to-br from-[#14F195] to-[#9945FF] grid place-items-center text-[10px] font-bold text-background">
          G
        </div>
        <span className="text-xs font-semibold">GMGN Live Signals</span>
        {source && (
          <Chip variant={(source === "gmgn" || source === "dexscreener") ? "bull" : "outline"} className="text-[9px]">
            {(source === "gmgn" || source === "dexscreener") ? "live" : "demo"}
          </Chip>
        )}
        <a
          href="https://gmgn.ai/solana/signal"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[10px] text-muted-foreground hover:text-bull"
        >
          View all →
        </a>
      </div>
      <div className="p-3 max-h-[400px] overflow-y-auto scrollbar-thin space-y-1.5">
        {loading && !data ? (
          [1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-3 animate-pulse" />)
        ) : data?.signals && data.signals.length > 0 ? (
          data.signals.map((s: any, i: number) => {
            const meta = SIGNAL_TYPE_META[s.signal_type] || { label: s.signal_type, emoji: "•", color: "" };
            return (
              <div
                key={i}
                className="rounded-lg border border-border p-2.5 flex items-center gap-2 hover:bg-surface-2 transition-colors cursor-pointer"
                onClick={() => window.open(`https://gmgn.ai/sol/token/${s.token_address}`, "_blank")}
              >
                <div className="h-8 w-8 rounded-lg bg-surface-3 grid place-items-center text-base shrink-0">
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">${s.symbol}</span>
                    <span className={cn("text-[10px] font-semibold", meta.color)}>{meta.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {s.name} · {fmtUsd(s.amount_usd, { compact: true })} · {fmtAgo(Math.floor((Date.now() - s.ts * 1000) / 1000))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold tabular">{fmtUsd(s.amount_usd, { compact: true })}</div>
                  {s.change_24h !== undefined && (
                    <div className={cn("text-[10px] tabular", s.change_24h >= 0 ? "text-bull" : "text-bear")}>
                      {s.change_24h >= 0 ? "+" : ""}{s.change_24h.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-muted-foreground py-6 text-center">No live signals available.</div>
        )}
      </div>
    </section>
  );
}
