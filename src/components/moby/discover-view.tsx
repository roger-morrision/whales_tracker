"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Flame, TrendingUp, Star, StarOff, Calendar, Rocket } from "lucide-react";
import { TOKENS, NARRATIVES, LAUNCHES, fmtUsd, fmtPct, fmtNum, fmtPrice, fmtAge, type Token } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Sparkline, Chip, SectionHeader } from "./primitives";
import { MarketOverview } from "./market-overview";
import { NewsFeed } from "./news-feed";
import { cn } from "@/lib/utils";

export function DiscoverView() {
  const [section, setSection] = useState<"trending" | "gainers" | "new">("trending");

  const trending = useMemo(() => TOKENS.filter((t) => t.rank).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)), []);
  const gainers = useMemo(() => [...TOKENS].sort((a, b) => b.change24h - a.change24h).slice(0, 8), []);
  const fresh = useMemo(() => [...TOKENS].sort((a, b) => a.ageHours - b.ageHours).slice(0, 8), []);

  const list = section === "trending" ? trending : section === "gainers" ? gainers : fresh;

  return (
    <div className="space-y-6">
      <HeroBanner />
      <MarketOverview />
      <NarrativesRow />
      <LaunchCalendar />

      <section>
        <SectionHeader
          title="Discover tokens"
          emoji="🧭"
          action="Screener"
          onAction={() => useMoby.getState().setScreenerOpen(true)}
        />
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
        <div className="space-y-1">
          {list.map((t, idx) => (
            <TokenRow key={t.id} token={t} rank={section === "trending" ? idx + 1 : undefined} />
          ))}
        </div>
      </section>

      <SmartMoneyMovers />
      <InsightsGrid />
      <NewsFeed />
    </div>
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
      <SectionHeader title="Upcoming launches" emoji="🚀" action="All" onAction={() => {}} />
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
                <button className="mt-2 w-full py-1 rounded-md bg-surface-3 hover:bg-surface-3/70 text-[10px] font-semibold flex items-center justify-center gap-1">
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
  const openToken = useMoby((s) => s.openToken);
  return (
    <section>
      <SectionHeader title="Hot narratives" emoji="📊" action="All" onAction={() => {}} />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {NARRATIVES.map((n) => (
          <button
            key={n.id}
            onClick={() => openToken(n.topTokens[0])}
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
          {!token.verified && <Chip variant="bear">New</Chip>}
          {token.smartMoneyInflow24h > 1_000_000 && <Chip variant="bull">Smart ↑</Chip>}
          <Chip variant="outline">{fmtAge(token.ageHours)}</Chip>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {token.name} · {token.smartMoneyHolders} smart wallets
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
