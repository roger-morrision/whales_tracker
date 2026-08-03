"use client";

import { useMemo, useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Flame, TrendingUp, Star, StarOff, Calendar, Rocket, RefreshCw, X } from "lucide-react";
import { TOKENS, NARRATIVES, LAUNCHES, fmtUsd, fmtPct, fmtNum, fmtPrice, fmtAge, fmtAgo, type Token } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { useGmgn } from "@/hooks/use-gmgn";
import { usePullToRefresh } from "./mobile-helpers";
import { useLiveTokens } from "@/hooks/use-live-tokens";
import { TokenIcon, Sparkline, Chip, SectionHeader } from "./primitives";
import { MarketOverview } from "./market-overview";
import { NewsFeed } from "./news-feed";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function DiscoverView() {
  const [section, setSection] = useState<"trending" | "gainers" | "new">("trending");
  const refreshFeeds = useMoby((s) => s.refreshFeeds);
  const { pullDistance, isRefreshing, touchHandlers } = usePullToRefresh(refreshFeeds);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minLiquidity: 0,
    minVolume: 0,
    minChange: -100,
    sortBy: "volume" as "volume" | "change" | "market_cap" | "tx_count",
    timeframe: "24h" as "1h" | "6h" | "24h",
  });

  // Fetch real tokens from DexScreener
  const trendingUrl = `/api/solana/trending?limit=30&sort=${filters.sortBy}`;
  const gainersUrl = `/api/solana/gainers?limit=30&timeframe=${filters.timeframe}`;
  const newUrl = `/api/solana/new?limit=30`;
  const currentUrl = section === "trending" ? trendingUrl : section === "gainers" ? gainersUrl : newUrl;
  const { data: tokenData, loading, source } = useGmgn<{ tokens: any[] }>(currentUrl, { refreshMs: 60_000 });

  // Apply client-side filters
  const list = useMemo(() => {
    const tokens = tokenData?.tokens || [];
    return tokens.filter((t: any) => {
      if (t.liquidity < filters.minLiquidity) return false;
      if (t.volume_24h < filters.minVolume) return false;
      const change = filters.timeframe === "1h" ? t.change_1h : filters.timeframe === "6h" ? t.change_6h : t.change_24h;
      if (change < filters.minChange) return false;
      return true;
    });
  }, [tokenData, filters]);

  return (
    <div className="space-y-6" {...touchHandlers}>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-muted-foreground text-xs overflow-hidden transition-all"
          style={{ height: `${pullDistance}px` }}
        >
          {isRefreshing ? (
            <><RefreshCw className="h-4 w-4 animate-spin mr-1" /> Refreshing…</>
          ) : (
            <span>{pullDistance > 50 ? "↑ Release to refresh" : "↓ Pull to refresh"}</span>
          )}
        </div>
      )}
      <HeroBanner />

      {/* Main focus: Solana trending tokens */}
      <TopBoostsRow />
      <GmgnTrendingRow />
      <GmgnHotSearchesRow />

      {/* Discover tokens — trending/gainers/new with real DexScreener data */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold">🧭 Discover tokens</span>
            {source && (
              <Chip variant={source === "dexscreener" ? "bull" : "outline"} className="text-[9px]">
                {source === "dexscreener" ? "live" : "demo"}
              </Chip>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-7 px-2 grid place-items-center rounded-lg text-[11px] font-semibold border transition-colors relative",
                showFilters || filters.minLiquidity > 0 || filters.minVolume > 0 || filters.minChange > -100
                  ? "bg-bull/15 text-bull border-bull/30"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Flame className="h-3 w-3 inline mr-0.5" />Filter
              {(filters.minLiquidity > 0 || filters.minVolume > 0 || filters.minChange > -100) && (
                <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 grid place-items-center rounded-full bg-bull text-[8px] font-bold text-background">
                  {[filters.minLiquidity > 0, filters.minVolume > 0, filters.minChange > -100].filter(Boolean).length}
                </span>
              )}
            </button>
            <button
              onClick={() => useMoby.getState().setScreenerOpen(true)}
              className="h-7 px-2 grid place-items-center rounded-lg text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground"
            >
              Screener →
            </button>
          </div>
        </div>

        {/* Filter popup */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-3"
            >
              <div className="rounded-xl border border-border bg-surface-2/50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Filters</span>
                  <button
                    onClick={() => {
                      setFilters({ minLiquidity: 0, minVolume: 0, minChange: -100, sortBy: "volume", timeframe: "24h" });
                    }}
                    className="text-[10px] text-muted-foreground hover:text-bull"
                  >
                    Reset
                  </button>
                </div>

                {/* Timeframe (only for gainers) */}
                {section === "gainers" && (
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">Timeframe</div>
                    <div className="flex gap-1">
                      {(["1h", "6h", "24h"] as const).map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setFilters((f) => ({ ...f, timeframe: tf }))}
                          className={cn(
                            "flex-1 py-1 rounded-md text-[10px] font-semibold border",
                            filters.timeframe === tf ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-3 text-muted-foreground border-border"
                          )}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sort by (only for trending) */}
                {section === "trending" && (
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">Sort by</div>
                    <div className="flex gap-1">
                      {([
                        { k: "volume", label: "Volume" },
                        { k: "change", label: "Change" },
                        { k: "market_cap", label: "Mkt Cap" },
                        { k: "tx_count", label: "Tx Count" },
                      ] as const).map((s) => (
                        <button
                          key={s.k}
                          onClick={() => setFilters((f) => ({ ...f, sortBy: s.k }))}
                          className={cn(
                            "flex-1 py-1 rounded-md text-[10px] font-semibold border",
                            filters.sortBy === s.k ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-3 text-muted-foreground border-border"
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Min liquidity */}
                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Min liquidity</span>
                    <span className="font-semibold tabular">{filters.minLiquidity === 0 ? "Any" : `$${(filters.minLiquidity / 1000).toFixed(0)}K`}</span>
                  </div>
                  <input type="range" min={0} max={500_000} step={10_000} value={filters.minLiquidity} onChange={(e) => setFilters((f) => ({ ...f, minLiquidity: parseInt(e.target.value) }))} className="w-full h-1.5 rounded-full bg-surface-3 accent-bull cursor-pointer" />
                </div>

                {/* Min volume */}
                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Min 24h volume</span>
                    <span className="font-semibold tabular">{filters.minVolume === 0 ? "Any" : `$${(filters.minVolume / 1000).toFixed(0)}K`}</span>
                  </div>
                  <input type="range" min={0} max={1_000_000} step={50_000} value={filters.minVolume} onChange={(e) => setFilters((f) => ({ ...f, minVolume: parseInt(e.target.value) }))} className="w-full h-1.5 rounded-full bg-surface-3 accent-bull cursor-pointer" />
                </div>

                {/* Min change */}
                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Min change %</span>
                    <span className="font-semibold tabular">{filters.minChange === -100 ? "Any" : `≥${filters.minChange}%`}</span>
                  </div>
                  <input type="range" min={-100} max={100} step={5} value={filters.minChange} onChange={(e) => setFilters((f) => ({ ...f, minChange: parseInt(e.target.value) }))} className="w-full h-1.5 rounded-full bg-surface-3 accent-bull cursor-pointer" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-surface-2 rounded-lg mb-3">
          {[
            { k: "trending", label: "🔥 Trending" },
            { k: "gainers", label: "📈 Gainers" },
            { k: "new", label: "✨ New" },
          ].map((s) => (
            <button
              key={s.k}
              onClick={() => setSection(s.k as typeof section)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                section === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading && list.length === 0 && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border border-border p-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-surface-3" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-20 bg-surface-3 rounded" />
                    <div className="h-2 w-32 bg-surface-3 rounded" />
                  </div>
                  <div className="h-4 w-12 bg-surface-3 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Real token list */}
        <div className="space-y-1">
          {list.map((t: any, idx: number) => (
            <RealTokenRow key={t.address || idx} token={t} rank={section === "trending" ? idx + 1 : undefined} />
          ))}
        </div>

        {/* Empty state */}
        {!loading && list.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No tokens match your filters. Try relaxing the criteria.
          </div>
        )}
      </section>

      {/* Whale buy/sell flows — live on-chain */}
      <WhaleFlowsRow />

      {/* "More" button — opens modal with MarketOverview, Narratives, Launches, Tools, News */}
      <button
        onClick={() => useMoby.getState().setDiscoverMoreOpen(true)}
        className="w-full py-3 rounded-xl border border-border bg-surface-2/50 hover:bg-surface-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-base">📋</span>
        Market, Narratives, News & Tools
        <ArrowUpRight className="h-3.5 w-3.5" />
      </button>

      {/* "More" modal with all secondary panels */}
      <DiscoverMoreModal />
    </div>
  );
}

// ===== Discover "More" Modal — secondary panels =====
function DiscoverMoreModal() {
  const open = useMoby((s) => s.discoverMoreOpen);
  const setOpen = useMoby((s) => s.setDiscoverMoreOpen);
  const [tab, setTab] = useState<"market" | "narratives" | "launches" | "tools" | "news">("market");

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
            role="dialog" aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <h2 className="font-semibold text-sm flex-1">More panels</h2>
              <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab selector */}
            <div className="flex gap-0.5 p-2 border-b border-border bg-surface-3/30 overflow-x-auto no-scrollbar">
              {[
                { k: "market", label: "📊 Market" },
                { k: "narratives", label: "🔥 Narratives" },
                { k: "launches", label: "🚀 Launches" },
                { k: "tools", label: "🧰 Tools" },
                { k: "news", label: "📰 News" },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k as typeof tab)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap",
                    tab === t.k ? "bg-bull/15 text-bull" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
              {tab === "market" && <MarketOverview />}
              {tab === "narratives" && <NarrativesRow />}
              {tab === "launches" && <LaunchCalendar />}
              {tab === "tools" && <InsightsGrid />}
              {tab === "news" && <NewsFeed />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ===== Whale Buy/Sell Flows Row (real GMGN smart-money feed) =====
function WhaleFlowsRow() {
  const { data, loading, source } = useGmgn<{ trades: any[] }>(
    "/api/gmgn/smart-money-feed?chain=sol&limit=10",
    { refreshMs: 30_000 }
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">🐋 Whale buy/sell</span>
          {source && (
            <Chip variant={source === "gmgn" || source === "dexscreener" ? "bull" : "outline"} className="text-[9px]">
              {source === "gmgn" || source === "dexscreener" ? "live" : "demo"}
            </Chip>
          )}
        </div>
        <button
          onClick={() => useMoby.getState().setActiveTab("whales")}
          className="text-[11px] text-muted-foreground hover:text-bull"
        >
          All →
        </button>
      </div>
      <div className="space-y-1">
        {loading && !data ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-lg border border-border p-2 animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-surface-3" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-20 bg-surface-3 rounded" />
                  <div className="h-2 w-32 bg-surface-3 rounded" />
                </div>
                <div className="h-4 w-12 bg-surface-3 rounded" />
              </div>
            </div>
          ))
        ) : data?.trades && data.trades.length > 0 ? (
          data.trades.slice(0, 8).map((t: any, i: number) => {
            const isBuy = t.type === "buy";
            return (
              <div
                key={i}
                onClick={() => {
                  const tk = TOKENS.find((tt) => tt.mint === t.token_address);
                  if (tk) {
                    useMoby.getState().openToken(tk.id);
                  } else {
                    useMoby.getState().viewExternalToken({
                      address: t.token_address,
                      symbol: t.token_symbol,
                      name: t.token_symbol,
                      price: t.price ?? 0,
                      change_24h: t.price_change_since ?? 0,
                      volume_24h: t.amount_usd ?? 0,
                      market_cap: 0,
                      liquidity: 0,
                      dex: "SOL",
                    });
                  }
                }}
                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <div className={cn(
                  "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                  isBuy ? "bg-bull/15" : "bg-bear/15"
                )}>
                  {isBuy ? <ArrowUpRight className="h-3.5 w-3.5 text-bull" /> : <ArrowDownRight className="h-3.5 w-3.5 text-bear" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold">{t.token_symbol}</span>
                    <Chip variant={isBuy ? "bull" : "bear"} className="text-[9px]">{isBuy ? "BUY" : "SELL"}</Chip>
                    {t.wallet_tags?.includes("smart_degen") && <Chip variant="bull" className="text-[9px]">SMART</Chip>}
                    {t.wallet_tags?.includes("renowned") && <Chip variant="gold" className="text-[9px]">KOL</Chip>}
                    <span className="text-[10px] text-muted-foreground truncate">{t.wallet_label || "Whale"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {fmtUsd(t.amount_usd, { compact: true })} · {t.ts ? new Date(t.ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                    {t.price_change_since && t.price_change_since > 0 && (
                      <span className="text-bull ml-1">· since trade: +{t.price_change_since.toFixed(1)}x</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-xs font-bold tabular", isBuy ? "text-bull" : "text-bear")}>
                    {isBuy ? "+" : "-"}{fmtUsd(t.amount_usd, { compact: true })}
                  </div>
                  {t.pnl_30d_usd !== undefined && (
                    <div className={cn("text-[9px] tabular", t.pnl_30d_usd >= 0 ? "text-bull" : "text-bear")}>
                      30d: {t.pnl_30d_usd >= 0 ? "+" : ""}{fmtUsd(t.pnl_30d_usd, { compact: true })}
                    </div>
                  )}
                </div>
                {/* Follow wallet button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useMoby.getState().openWalletDetail(t.wallet_address || t.address, t.wallet_label || "Smart wallet");
                  }}
                  className="h-7 w-7 grid place-items-center rounded-md hover:bg-surface-3 text-muted-foreground shrink-0"
                  aria-label="View wallet"
                >
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-center py-4 text-xs text-muted-foreground">No recent whale activity.</div>
        )}
      </div>
    </section>
  );
}

function InsightsGrid() {
  return (
    <section>
      <SectionHeader title="Tools & insights" emoji="🧰" />
      <div className="grid grid-cols-3 gap-2">
        <InsightCard
          emoji="🌐"
          title="Solana stats"
          sub="TPS · TVL · Validators"
          accent="from-[#9945FF]/15"
          onClick={() => useMoby.getState().setSolanaStatsOpen(true)}
        />
        <InsightCard
          emoji="🏆"
          title="P&L leaderboard"
          sub="Top earners today"
          accent="from-[#F59E0B]/15"
          onClick={() => useMoby.getState().setPnlLeaderboardOpen(true)}
        />
        <InsightCard
          emoji="💬"
          title="Social sentiment"
          sub="What Twitter thinks"
          accent="from-[#22D3EE]/15"
          onClick={() => useMoby.getState().setSocialOpen(true)}
        />
        <InsightCard
          emoji="📋"
          title="Copy trading"
          sub="Mirror top traders"
          accent="from-[#14F195]/15"
          onClick={() => useMoby.getState().setCopyTradeOpen(true)}
        />
        <InsightCard
          emoji="🎯"
          title="Limit orders"
          sub="Set price targets"
          accent="from-[#EC4899]/15"
          onClick={() => useMoby.getState().setLimitOrdersOpen(true)}
        />
        <InsightCard
          emoji="📅"
          title="DCA scheduler"
          sub="Automate buys"
          accent="from-[#A855F7]/15"
          onClick={() => useMoby.getState().setDcaOpen(true)}
        />
        <InsightCard
          emoji="⚡"
          title="Perpetuals"
          sub="Leverage · Funding"
          accent="from-[#F59E0B]/15"
          onClick={() => useMoby.getState().setPerpsOpen(true)}
        />
        <InsightCard
          emoji="🚀"
          title="Launch scanner"
          sub="New tokens w/ smart money"
          accent="from-[#14F195]/15"
          onClick={() => useMoby.getState().setLaunchScannerOpen(true)}
        />
        <InsightCard
          emoji="🎁"
          title="Airdrops"
          sub="Claim eligible tokens"
          accent="from-[#F59E0B]/15"
          onClick={() => useMoby.getState().setAirdropOpen(true)}
        />
        <InsightCard
          emoji="🕸️"
          title="Smart money map"
          sub="Wallet-to-wallet flows"
          accent="from-[#9945FF]/15"
          onClick={() => useMoby.getState().setSmartMoneyMapOpen(true)}
        />
        <InsightCard
          emoji="🔥"
          title="Launchpad explorer"
          sub="pump.fun · bonk · Raydium"
          accent="from-[#00FF7F]/15"
          onClick={() => useMoby.getState().setPumpFunOpen(true)}
        />
      </div>
    </section>
  );
}

function InsightCard({
  emoji,
  title,
  sub,
  accent,
  onClick,
}: {
  emoji: string;
  title: string;
  sub: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border p-2.5 text-left bg-gradient-to-br to-transparent hover:bg-surface-2 transition-colors",
        accent
      )}
    >
      <div className="text-xl mb-1">{emoji}</div>
      <div className="text-[11px] font-semibold">{title}</div>
      <div className="text-[9px] text-muted-foreground truncate">{sub}</div>
    </button>
  );
}

function LaunchCalendar() {
  return (
    <section>
      <SectionHeader title="Upcoming launches" emoji="🚀" action="All" onAction={() => useMoby.getState().setLaunchScannerOpen(true)} />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {LAUNCHES.map((l) => {
          const d = new Date(l.date);
          const day = d.getDate();
          const month = d.toLocaleString("en-US", { month: "short" });
          return (
            <div
              key={l.id}
              className="shrink-0 w-44 rounded-xl border border-border overflow-hidden bg-surface-2"
            >
              <div className={cn("h-16 bg-gradient-to-br grid place-items-center text-2xl", l.color)}>
                {l.glyph}
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold text-bull bg-bull/10 px-1.5 py-0.5 rounded">
                    {month} {day}
                  </span>
                  <Chip variant="outline">{l.chain}</Chip>
                </div>
                <div className="font-semibold text-sm">${l.tokenSymbol}</div>
                <div className="text-[11px] text-muted-foreground truncate">{l.tokenName}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground">{l.category}</span>
                  {l.raiseUsd && (
                    <span className="text-[10px] text-gold font-semibold tabular">
                      {fmtUsd(l.raiseUsd, { compact: true })} raise
                    </span>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); useMoby.getState().pushToast({ title: "Reminder set", description: `We'll notify you when ${l.tokenSymbol} launches.`, type: "success" }); }} className="mt-2 w-full py-1 rounded-md bg-surface-3 hover:bg-surface-3/70 text-[10px] font-semibold flex items-center justify-center gap-1">
                  <Rocket className="h-2.5 w-2.5" /> Set reminder
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HeroBanner() {
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const setActiveTab = useMoby((s) => s.setActiveTab);
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-[#14F195]/15 via-[#22D3EE]/10 to-[#9945FF]/15 border border-bull/20">
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-bull/20 blur-3xl" />
      <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[#9945FF]/20 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2 w-2 rounded-full bg-bull live-dot" />
          <span className="text-[10px] uppercase tracking-wider text-bull font-semibold">Live · Onchain</span>
        </div>
        <h2 className="text-xl font-bold leading-tight mb-1">
          Smart money is accumulating <span className="text-bull">MNGO</span>
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          7 tracked wallets clustered in within 60 minutes · $1.24M net inflow · 92% confidence
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => useMoby.getState().openToken("mngo")}
            className="px-3 py-1.5 rounded-lg bg-bull text-background text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            View token
          </button>
          <button
            onClick={() => setCopilotOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-surface-3 transition-colors"
          >
            Ask Moby why
          </button>
          <button
            onClick={() => setActiveTab("whales")}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-surface-3 transition-colors"
          >
            See who →
          </button>
        </div>
      </div>
    </div>
  );
}

function NarrativesRow() {
  const openNarrative = useMoby((s) => s.openNarrative);
  return (
    <section>
      <SectionHeader title="Hot narratives" emoji="📊" action="All" onAction={() => useMoby.getState().setLaunchScannerOpen(true)} />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {NARRATIVES.map((n) => (
          <button
            key={n.id}
            onClick={() => openNarrative(n.id)}
            className={cn(
              "relative shrink-0 w-40 p-3 rounded-xl bg-gradient-to-br border border-border text-left overflow-hidden card-hover",
              n.color
            )}
            style={{ background: "linear-gradient(135deg, var(--surface-2), var(--surface-3))" }}
          >
            <div className={cn("absolute inset-0 opacity-25 bg-gradient-to-br", n.color)} />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{n.emoji}</span>
                <span className="text-[10px] font-bold text-bull bg-bull/15 px-1.5 py-0.5 rounded-md">
                  +{n.change24h.toFixed(1)}%
                </span>
              </div>
              <h3 className="font-semibold text-sm">{n.name}</h3>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{n.description}</p>
              <div className="mt-2 flex items-center gap-1">
                {n.topTokens.slice(0, 3).map((tid) => {
                  const tk = TOKENS.find((x) => x.id === tid);
                  if (!tk) return null;
                  return (
                    <span key={tid} className="text-[10px] font-mono bg-background/40 px-1.5 py-0.5 rounded">
                      {tk.symbol}
                    </span>
                  );
                })}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function TokenRow({ token, rank }: { token: Token; rank?: number }) {
  const openToken = useMoby((s) => s.openToken);
  const prices = useMoby((s) => s.prices);
  const watchlist = useMoby((s) => s.watchlist);
  const toggleWatch = useMoby((s) => s.toggleWatch);

  const p = prices[token.id];
  const price = p?.price ?? token.price;
  const delta = ((price - token.price) / token.price) * 100;
  const isBull = delta >= 0;
  const watched = watchlist.includes(token.id);

  return (
    <div
      onClick={() => openToken(token.id)}
      className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-2 cursor-pointer transition-colors"
    >
      <div className="w-5 text-center text-xs font-mono text-muted-foreground">
        {rank ?? ""}
      </div>
      <TokenIcon
        symbol={token.symbol}
        glyph={token.logoGlyph}
        color={token.logoColor}
        size="md"
        live={token.ageHours < 200}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{token.symbol}</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          {!token.verified && <Chip variant="bear">New</Chip>}
          {token.smartMoneyInflow24h > 1_000_000 && <Chip variant="bull">Smart ↑</Chip>}
          <Chip variant="outline">{fmtAge(token.ageHours)}</Chip>
          <span className="text-[10px] text-muted-foreground truncate ml-0.5">
            {token.smartMoneyHolders} smart
          </span>
        </div>
      </div>
      <Sparkline data={token.sparkline} width={56} height={24} bullish={isBull} />
      <div className="text-right">
        <div className="text-sm font-semibold tabular">{fmtPrice(price)}</div>
        <div className={cn("text-xs tabular flex items-center justify-end gap-0.5", isBull ? "text-bull" : "text-bear")}>
          {isBull ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {fmtPct(delta, false)}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleWatch(token.id);
          useMoby.getState().pushToast({
            title: watched ? "Removed from watchlist" : "Added to watchlist",
            description: `$${token.symbol} ${watched ? "removed" : "added"}`,
            type: watched ? "info" : "success",
          });
        }}
        className="ml-1 h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground hover:text-foreground"
        aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
      >
        {watched ? <Star className="h-3.5 w-3.5 fill-gold text-gold" /> : <StarOff className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function SmartMoneyMovers() {
  const movers = useMemo(
    () => [...TOKENS].sort((a, b) => b.smartMoneyInflow24h - a.smartMoneyInflow24h).slice(0, 5),
    []
  );
  const openToken = useMoby((s) => s.openToken);
  return (
    <section>
      <SectionHeader title="Smart money movers" emoji="🐋" action="All" onAction={() => useMoby.getState().setActiveTab("whales")} />
      <div className="rounded-xl border border-border overflow-hidden">
        {movers.map((t, i) => {
          const inflow = t.smartMoneyInflow24h;
          const isBull = inflow >= 0;
          return (
            <button
              key={t.id}
              onClick={() => openToken(t.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors text-left",
                i > 0 && "border-t border-border"
              )}
            >
              <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm">{t.symbol}</span>
                  <span className="text-[11px] text-muted-foreground">{t.smartMoneyHolders} smart</span>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground">{fmtAge(t.ageHours)} old</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{t.name}</div>
              </div>
              <div className="text-right">
                <div className={cn("text-sm font-semibold tabular", isBull ? "text-bull" : "text-bear")}>
                  {isBull ? "+" : "-"}
                  {fmtUsd(Math.abs(inflow), { compact: true })}
                </div>
                <div className="text-[11px] text-muted-foreground">24h net</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ===== GMGN Trending Row =====
function GmgnTrendingRow() {
  const { data, loading, source } = useGmgn<{ tokens: any[] }>(
    "/api/gmgn/trending?timeframe=1h&orderBy=volume&limit=8",
    { refreshMs: 60_000 }
  );

  return (
    <section>
      <SectionHeader
        title="GMGN Trending"
        emoji="🔥"
        action="View all"
        onAction={() => useMoby.getState().openTokenList({ title: "🔥 GMGN Trending", endpoint: "/api/gmgn/trending?timeframe=1h&orderBy=volume&limit=30" })}
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {loading && !data ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="shrink-0 w-32 h-32 rounded-xl bg-surface-2 animate-pulse" />
          ))
        ) : data?.tokens && data.tokens.length > 0 ? (
          data.tokens.map((t: any, i: number) => (
            <div
              key={t.address || i}
              className="shrink-0 w-32 rounded-xl border border-border bg-surface-2/50 p-2.5 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#14F195] to-[#9945FF] grid place-items-center text-[10px] font-bold text-background shrink-0">
                  {t.symbol?.[0] ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{t.symbol}</div>
                  <div className="text-[9px] text-muted-foreground">#{t.rank ?? i + 1}</div>
                </div>
              </div>
              <div className="text-xs font-semibold tabular">{fmtPrice(t.price)}</div>
              <div className={cn("text-[10px] tabular flex items-center gap-0.5", t.price_change_24h >= 0 ? "text-bull" : "text-bear")}>
                {t.price_change_24h >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {Math.abs(t.price_change_24h).toFixed(2)}%
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-border text-[9px] text-muted-foreground tabular">
                MC {fmtUsd(t.market_cap, { compact: true })}
              </div>
              <div className="text-[9px] text-muted-foreground tabular">
                Vol {fmtUsd(t.volume_24h, { compact: true })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-muted-foreground py-8">No trending tokens available.</div>
        )}
      </div>
      {source && (
        <div className="text-[10px] text-muted-foreground mt-1 px-1">
          Source: <span className={source === "gmgn" ? "text-bull" : ""}>{(source === "gmgn" || source === "dexscreener") ? "GMGN/DexScreener live" : "simulated (GMGN unavailable)"}</span>
        </div>
      )}
    </section>
  );
}

// ===== GMGN Hot Searches Row =====
function GmgnHotSearchesRow() {
  const { data, loading, source } = useGmgn<{ hotSearches: any[] }>(
    "/api/gmgn/hot-searches?chain=sol&interval=1h&limit=6",
    { refreshMs: 120_000 }
  );

  // Track search_count_24h history per token for sparkline rendering.
  // Each refresh appends a data point (capped at 8 per token).
  const [history, setHistory] = useState<Record<string, number[]>>({});
  useEffect(() => {
    if (!data?.hotSearches) return;
    // Defer setState to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      setHistory((prev) => {
        const next = { ...prev };
        for (const h of data.hotSearches) {
          const key = h.token_address || h.symbol;
          const arr = next[key] || [];
          arr.push(h.search_count_24h || 0);
          if (arr.length > 8) arr.shift();
          next[key] = arr;
        }
        return next;
      });
    });
  }, [data]);

  return (
    <section>
      <SectionHeader
        title="GMGN Hot Searches"
        emoji="🔍"
        action="View all"
        onAction={() => useMoby.getState().openTokenList({ title: "🔍 Hot Searches", endpoint: "/api/gmgn/hot-searches?chain=sol&interval=1h&limit=30" })}
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {loading && !data ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="shrink-0 w-32 h-28 rounded-xl bg-surface-2 animate-pulse" />
          ))
        ) : data?.hotSearches && data.hotSearches.length > 0 ? (
          data.hotSearches.map((h: any, i: number) => {
            const key = h.token_address || h.symbol;
            const sparkData = history[key] || [];
            const trend = sparkData.length >= 2 ? sparkData[sparkData.length - 1] - sparkData[0] : 0;
            const trendColor = trend > 0 ? "text-bull" : trend < 0 ? "text-bear" : "text-muted-foreground";
            return (
              <div
                key={key || i}
                className="shrink-0 w-32 rounded-xl border border-border bg-surface-2/50 p-2.5 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FF6347] grid place-items-center text-[10px] font-bold text-background shrink-0">
                    #{h.rank ?? i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{h.symbol}</div>
                    <div className="text-[9px] text-muted-foreground truncate">{h.search_count_24h.toLocaleString()} searches</div>
                  </div>
                </div>
                {/* Sparkline showing search-volume trend */}
                {sparkData.length >= 2 && (
                  <div className="h-6 my-1">
                    <Sparkline data={sparkData} height={24} bullish={trend >= 0} />
                  </div>
                )}
                <div className="text-xs font-semibold tabular">{fmtPrice(h.price)}</div>
                <div className={cn("text-[10px] tabular flex items-center gap-0.5", h.change_24h >= 0 ? "text-bull" : "text-bear")}>
                  {h.change_24h >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                  {Math.abs(h.change_24h).toFixed(2)}%
                  {sparkData.length >= 2 && (
                    <span className={cn("ml-auto", trendColor)}>
                      {trend > 0 ? "▲" : trend < 0 ? "▼" : "■"}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-muted-foreground py-8">No hot searches available.</div>
        )}
      </div>
      {source && (
        <div className="text-[10px] text-muted-foreground mt-1 px-1">
          Source: <span className={source === "gmgn" ? "text-bull" : ""}>{(source === "gmgn" || source === "dexscreener") ? "GMGN/DexScreener live" : "simulated (GMGN unavailable)"}</span>
        </div>
      )}
    </section>
  );
}

// ===== DexScreener Top Boosts Row =====
function TopBoostsRow() {
  const { data, loading, source } = useGmgn<{ tokens: any[] }>(
    "/api/dexscreener/top-boosts?chain=solana&limit=8",
    { refreshMs: 120_000 }
  );

  return (
    <section>
      <SectionHeader
        title="🚀 Top Boosted"
        emoji=""
        action="View all"
        onAction={() => useMoby.getState().openTokenList({ title: "🚀 Top Boosted Tokens", endpoint: "/api/dexscreener/top-boosts?chain=solana&limit=30" })}
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {loading && !data ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="shrink-0 w-32 h-32 rounded-xl bg-surface-2 animate-pulse" />
          ))
        ) : data?.tokens && data.tokens.length > 0 ? (
          data.tokens.map((t: any, i: number) => (
            <a
              key={t.address || i}
              onClick={() => useMoby.getState().viewExternalToken(t)}
              className="shrink-0 w-32 rounded-xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-2.5 hover:border-gold/40 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                {t.image_uri ? (
                  <img
                    src={t.image_uri}
                    alt={t.symbol}
                    className="h-7 w-7 rounded-full object-cover shrink-0"
                    onError={(e) => { (e.currentTarget.style.display = "none"); }}
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-gold to-bull grid place-items-center text-[10px] font-bold text-background shrink-0">
                    {t.symbol?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{t.symbol}</div>
                  <div className="text-[9px] text-gold font-semibold">🚀 ${t.total_boosts_usd}</div>
                </div>
              </div>
              <div className="text-xs font-semibold tabular">{fmtPrice(t.price)}</div>
              <div className={cn("text-[10px] tabular flex items-center gap-0.5", t.price_change_24h >= 0 ? "text-bull" : "text-bear")}>
                {t.price_change_24h >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {Math.abs(t.price_change_24h).toFixed(2)}%
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-border text-[9px] text-muted-foreground tabular">
                MC {fmtUsd(t.market_cap, { compact: true })}
              </div>
            </a>
          ))
        ) : (
          <div className="text-xs text-muted-foreground py-8">No boosted tokens available.</div>
        )}
      </div>
      {source && (
        <div className="text-[10px] text-muted-foreground mt-1 px-1">
          Source: <span className={(source === "gmgn" || source === "dexscreener") ? "text-bull" : ""}>
            {(source === "gmgn" || source === "dexscreener") ? "DexScreener live" : "simulated"}
          </span>
        </div>
      )}
    </section>
  );
}

// ===== Real Token Row (DexScreener data) =====
function RealTokenRow({ token, rank }: { token: any; rank?: number }) {
  const openToken = useMoby((s) => s.openToken);
  const watchlist = useMoby((s) => s.watchlist);
  const toggleWatch = useMoby((s) => s.toggleWatch);
  const watched = watchlist.includes(token.address);

  const change24h = token.change_24h ?? 0;
  const change1h = token.change_1h ?? 0;
  const isBull = change24h >= 0;
  const ageMin = token.created_at ? Math.round((Date.now() - token.created_at) / 60000) : 0;
  const ageLabel = ageMin > 0 ? (ageMin < 60 ? `${ageMin}m` : ageMin < 1440 ? `${Math.floor(ageMin / 60)}h` : `${Math.floor(ageMin / 1440)}d`) : "";

  // Generate sparkline from 24h change approximation
  const sparkData = useMemo(() => {
    const points: number[] = [];
    let v = token.price * (1 - change24h / 100);
    for (let i = 0; i < 20; i++) {
      v = v * (1 + (Math.random() - 0.5) * 0.02 + (change24h / 100 / 20));
      points.push(v);
    }
    points.push(token.price);
    return points;
  }, [token.price, token.change_24h]);

  return (
    <div
      onClick={() => {
        // Try to find in local TOKENS first, otherwise view as external token in-app
        const tk = TOKENS.find((t) => t.mint === token.address);
        if (tk) {
          openToken(tk.id);
        } else {
          // View external token in-app (no redirect to external websites)
          useMoby.getState().viewExternalToken(token);
        }
      }}
      className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-2 cursor-pointer transition-colors"
    >
      <div className="w-5 text-center text-xs font-mono text-muted-foreground">
        {rank ?? ""}
      </div>
      {/* Token icon */}
      {token.image_uri ? (
        <img
          src={token.image_uri}
          alt={token.symbol}
          className="h-9 w-9 rounded-full object-cover shrink-0"
          onError={(e) => { (e.currentTarget.style.display = "none"); }}
        />
      ) : (
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-surface-3 to-surface-2 grid place-items-center text-xs font-bold shrink-0">
          {token.symbol?.[0] ?? "?"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{token.symbol}</span>
          <Chip variant="outline" className="text-[9px]">{token.dex}</Chip>
          {ageLabel && <span className="text-[9px] text-muted-foreground">{ageLabel}</span>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="truncate max-w-[100px]">{token.name}</span>
          <span>·</span>
          <span>MC {fmtUsd(token.market_cap, { compact: true })}</span>
          <span>·</span>
          <span>Liq {fmtUsd(token.liquidity, { compact: true })}</span>
          {token.txns_24h_buys > 0 && (
            <>
              <span>·</span>
              <span className="text-bull">{token.txns_24h_buys}b</span>
              <span className="text-bear">{token.txns_24h_sells}s</span>
            </>
          )}
        </div>
      </div>
      {/* Sparkline */}
      <div className="w-16 h-8 hidden xs:block">
        <Sparkline data={sparkData} width={64} height={32} bullish={isBull} />
      </div>
      {/* Price + change */}
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold tabular">{fmtPrice(token.price)}</div>
        <div className={cn("text-[10px] tabular flex items-center justify-end gap-0.5", isBull ? "text-bull" : "text-bear")}>
          {isBull ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
          {Math.abs(change24h).toFixed(1)}%
        </div>
      </div>
      {/* Watchlist toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleWatch(token.address);
        }}
        className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground shrink-0"
        aria-label="Watchlist"
      >
        {watched ? <Star className="h-3.5 w-3.5 fill-gold text-gold" /> : <StarOff className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
