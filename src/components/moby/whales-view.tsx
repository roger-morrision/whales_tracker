"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Trophy,
  TrendingUp,
  UserPlus,
  UserCheck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from "lucide-react";
import { TRADERS, TOKENS, fmtUsd, fmtNum, fmtAgo, fmtPct, type Trader, type WhaleFlow } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { useGmgn } from "@/hooks/use-gmgn";
import { TokenIcon, Chip, SectionHeader } from "./primitives";
import { WalletLink } from "./wallet-link";
import { cn } from "@/lib/utils";

const FLOW_TYPE_LABEL: Record<WhaleFlow["type"], string> = {
  ACCUMULATE: "Accumulating",
  DISTRIBUTE: "Distributing",
  NEW_POSITION: "New position",
  EXIT: "Exit",
};

export function WhalesView() {
  const [tab, setTab] = useState<"traders" | "flows" | "gmgn" | "trenches">("traders");
  const setPumpFunOpen = useMoby((s) => s.setPumpFunOpen);
  return (
    <div className="space-y-4">
      <LeaderboardHeader />
      <div className="flex gap-1 p-1 bg-surface-2 rounded-lg overflow-x-auto no-scrollbar">
        {[
          { k: "traders", label: "🏆 Top traders" },
          { k: "flows", label: "🌊 Live flows" },
          { k: "gmgn", label: "🟢 GMGN smart" },
          { k: "trenches", label: "🔥 Trenches" },
        ].map((s) => (
          <button
            key={s.k}
            onClick={() => {
              if (s.k === "trenches") {
                setPumpFunOpen(true);
              } else {
                setTab(s.k as typeof tab);
              }
            }}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
              tab === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {tab === "traders" ? <TradersList /> : tab === "flows" ? <LiveFlows /> : <GmgnSmartMoneyFeed />}
    </div>
  );
}

function LeaderboardHeader() {
  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-[#F59E0B]/12 via-[#EF4444]/8 to-transparent border border-gold/20">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-semibold">Smart money leaderboard</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-gold font-semibold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gold live-dot" /> Live
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Moby scores wallets by their actual on-chain performance — realized PnL, win rate, and timing. No vanity metrics.
      </p>
    </div>
  );
}

function TradersList() {
  const traders = useMemo(() => [...TRADERS].sort((a, b) => a.rank - b.rank), []);
  return (
    <div className="space-y-2">
      {traders.map((t) => (
        <TraderCard key={t.id} trader={t} />
      ))}
    </div>
  );
}

function TraderCard({ trader }: { trader: Trader }) {
  const openTrader = useMoby((s) => s.openTrader);
  const followed = useMoby((s) => s.followedTraders.includes(trader.id));
  const toggleFollow = useMoby((s) => s.toggleFollow);

  return (
    <div
      onClick={() => openTrader(trader.id)}
      className="rounded-xl border border-border p-3 hover:bg-surface-2 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <div
            className={cn(
              "h-12 w-12 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white ring-2 ring-background",
              trader.avatarColor
            )}
          >
            {trader.avatarGlyph}
          </div>
          {trader.isLive && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-bull ring-2 ring-background">
              <span className="absolute inset-0 rounded-full bg-bull live-dot" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{trader.displayName}</span>
            {trader.rank <= 3 && (
              <span className="text-[10px] font-bold text-gold bg-gold/15 px-1.5 py-0.5 rounded-md">
                #{trader.rank}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">@{trader.handle}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {trader.tags.map((tag) => (
              <Chip key={tag} variant={tag === "Whale" ? "gold" : tag === "KOL" ? "bull" : "default"}>
                {tag}
              </Chip>
            ))}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFollow(trader.id);
            useMoby.getState().pushToast({
              title: followed ? "Unfollowed" : "Following",
              description: `@${trader.handle} ${followed ? "removed" : "added"} to your followed traders`,
              type: followed ? "info" : "success",
            });
          }}
          className={cn(
            "shrink-0 h-8 px-2.5 inline-flex items-center gap-1 rounded-lg text-xs font-semibold transition-colors",
            followed
              ? "bg-surface-3 text-foreground border border-border"
              : "bg-bull text-background hover:opacity-90"
          )}
        >
          {followed ? (
            <>
              <UserCheck className="h-3 w-3" /> Following
            </>
          ) : (
            <>
              <UserPlus className="h-3 w-3" /> Follow
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        <Stat label="Smart score" value={`${trader.smartScore}`} accent={trader.smartScore >= 90 ? "bull" : "default"} />
        <Stat label="Win rate" value={`${trader.winRate}%`} />
        <Stat
          label="30d PnL"
          value={fmtUsd(trader.pnl30d, { compact: true })}
          accent="bull"
          sub={fmtPct(trader.pnl30dPct)}
        />
        <Stat label="All-time ROI" value={fmtPct(trader.roiAllTime)} accent="bull" />
      </div>

      <div className="mt-3">
        <div className="text-[10px] text-muted-foreground mb-1">Top holdings</div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-3">
          {trader.topHoldings.map((h, i) => (
            <div
              key={h.symbol}
              style={{ width: `${h.pct}%` }}
              className={cn(
                "h-full",
                i === 0 && "bg-bull",
                i === 1 && "bg-[#22D3EE]",
                i === 2 && "bg-gold",
                i === 3 && "bg-[#9945FF]",
                i >= 4 && "bg-surface-3"
              )}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {trader.topHoldings.map((h) => (
            <span key={h.symbol} className="text-[10px] text-muted-foreground">
              {h.symbol} <span className="text-foreground/80">{h.pct}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "bull" | "bear" | "gold";
}) {
  const color =
    accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tabular", color)}>{value}</div>
      {sub && <div className={cn("text-[10px] tabular", color)}>{sub}</div>}
    </div>
  );
}

function LiveFlows() {
  const flows = useMoby((s) => s.flows);
  const refreshFeeds = useMoby((s) => s.refreshFeeds);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-bull" />
          <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" />
          <span>Streaming live · last 5 min</span>
        </div>
        <button onClick={refreshFeeds} className="text-[11px] text-bull hover:opacity-80">
          Refresh
        </button>
      </div>
      <div className="space-y-2">
        {flows.map((f) => (
          <FlowCard key={f.id} flow={f} />
        ))}
      </div>
    </div>
  );
}

function FlowCard({ flow }: { flow: WhaleFlow }) {
  const openToken = useMoby((s) => s.openToken);
  const isBuy = flow.type === "ACCUMULATE" || flow.type === "NEW_POSITION";
  return (
    <div className="rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "h-9 w-9 rounded-lg grid place-items-center shrink-0",
            isBuy ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
          )}
        >
          {isBuy ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button onClick={() => { const tk = TOKENS.find(t => t.symbol === flow.tokenSymbol); if (tk) openToken(tk.id); }} className="font-semibold text-sm hover:text-bull">
              {flow.tokenSymbol}
            </button>
            <span className="text-[11px] text-muted-foreground">{FLOW_TYPE_LABEL[flow.type]}</span>
            <Chip variant="outline" className="ml-auto">
              {flow.chain}
            </Chip>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Wallet className="h-3 w-3 shrink-0" />
            <WalletLink
              label={flow.walletLabel}
              address={flow.walletAddress}
              showAddress
              variant="muted"
              className="truncate"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2.5 pl-[46px]">
        <div>
          <div className="text-[10px] text-muted-foreground">Value</div>
          <div className={cn("text-sm font-semibold tabular", isBuy ? "text-bull" : "text-bear")}>
            {isBuy ? "+" : "-"}
            {fmtUsd(flow.usdValue, { compact: true })}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Wallet score</div>
          <div className="text-sm font-semibold tabular text-gold">{flow.walletScore}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Price impact</div>
          <div className="text-sm font-semibold tabular">{flow.priceImpact.toFixed(2)}%</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pl-[46px]">
        <span className="text-[10px] text-muted-foreground">{fmtAgo(flow.agoSeconds)}</span>
        <span className="text-[10px] font-mono text-muted-foreground truncate">{flow.txHash}</span>
      </div>
    </div>
  );
}

// ===== GMGN Smart Money Feed =====
function GmgnSmartMoneyFeed() {
  // Pick a few trending tokens and aggregate their smart money activity
  const trendingUrl = "/api/gmgn/trending?timeframe=1h&orderBy=smart_money&limit=5";
  const { data: trendingData, loading: trendingLoading } = useGmgn<{ tokens: any[] }>(trendingUrl, { refreshMs: 60_000 });

  const tokens = trendingData?.tokens ?? [];
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedMint && tokens.length > 0 && tokens[0].address) {
      // Defer to avoid synchronous setState in effect
      Promise.resolve().then(() => setSelectedMint(tokens[0].address));
    }
  }, [tokens, selectedMint]);

  const activityUrl = selectedMint ? `/api/gmgn/smart-money?address=${selectedMint}&limit=20` : null;
  const { data: activityData, loading: activityLoading, source } = useGmgn<{ activity: any[] }>(activityUrl, { refreshMs: 30_000 });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {trendingLoading && !tokens.length ? (
          <div className="text-xs text-muted-foreground">Loading trending tokens...</div>
        ) : tokens.length > 0 ? (
          tokens.map((t: any) => (
            <button
              key={t.address}
              onClick={() => setSelectedMint(t.address)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors",
                selectedMint === t.address
                  ? "bg-bull/15 text-bull border-bull/30"
                  : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
              )}
            >
              ${t.symbol}
            </button>
          ))
        ) : (
          <div className="text-xs text-muted-foreground">No trending tokens available.</div>
        )}
      </div>

      {selectedMint && (
        <div className="space-y-2">
          {source && (
            <div className="text-[10px] text-muted-foreground px-1">
              Source: <span className={source === "gmgn" ? "text-bull" : ""}>{(source === "gmgn" || source === "dexscreener") ? "GMGN/DexScreener live" : "simulated (GMGN unavailable)"}</span>
            </div>
          )}
          {activityLoading && !activityData ? (
            [1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-surface-2 animate-pulse" />)
          ) : activityData?.activity && activityData.activity.length > 0 ? (
            activityData.activity.map((a: any, i: number) => {
              const isBuy = a.type === "buy";
              return (
                <div key={i} onClick={() => useMoby.getState().openWalletDetail(a.address, a.wallet_label || "Smart wallet")} className="rounded-xl border border-border p-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-surface-2 transition-colors">
                  <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0", isBuy ? "bg-bull/15" : "bg-bear/15")}>
                    {isBuy ? <ArrowUpRight className="h-4 w-4 text-bull" /> : <ArrowDownRight className="h-4 w-4 text-bear" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono truncate">{a.address}</span>
                      {a.wallet_tag && <Chip variant="outline" className="text-[9px]">{a.wallet_tag}</Chip>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {a.wallet_label || "Smart wallet"} · {new Date(a.ts * 1000).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-sm font-bold tabular", isBuy ? "text-bull" : "text-bear")}>
                      {isBuy ? "+" : "-"}{fmtUsd(a.amount_usd, { compact: true })}
                    </div>
                    {a.pnl_30d_usd !== undefined && (
                      <div className={cn("text-[10px] tabular", a.pnl_30d_usd >= 0 ? "text-bull" : "text-bear")}>
                        30d {a.pnl_30d_usd >= 0 ? "+" : ""}{fmtUsd(a.pnl_30d_usd, { compact: true })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No smart money activity found for this token.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
