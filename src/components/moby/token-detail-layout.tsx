"use client";

import * as React from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Star,
  AlertTriangle,
  Shield,
  Lock,
  Unlock,
  Globe,
  Brain,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  MessageCircle,
  Activity,
  Wallet,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShieldCheck,
  Target,
  Send,
} from "lucide-react";

import { useMoby } from "@/lib/moby-store";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtPrice, fmtPct, fmtNum } from "@/lib/moby-data";
import { StalenessBadge } from "@/components/ui/staleness-badge";
import { HolderDistributionSection } from "./holder-distribution";
import { TokenIcon, Chip, Sparkline, WalletLink } from "./primitives";
import { useGmgn } from "@/hooks/use-gmgn";
import { Token } from "@/lib/moby-data";

import { useState, useMemo } from "react";

export function TokenDetailLayout() {
  const tokenId = useMoby((s) => s.selectedTokenId);
  const openToken = useMoby((s) => s.openToken);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const token = useMoby((s) => s.tokens?.find((t) => t.id === tokenId) ?? null);
  const prices = useMoby((s) => s.prices);
  const watchlist = useMoby((s) => s.watchlist);
  const toggleWatch = useMoby((s) => s.toggleWatch);
  const openTrade = useMoby((s) => s.openTrade);
  const openAlertCreator = useMoby((s) => s.openAlertCreator);
  const toggleCompareId = useMoby((s) => s.toggleCompareId);
  const setCompareOpen = useMoby((s) => s.setCompareOpen);
  const compareIds = useMoby((s) => s.compareIds);

  const watched = watchlist.includes(tokenId ?? "");
  const inCompare = compareIds.includes(tokenId ?? "");
  
  const live = prices[tokenId ?? ""]?.price ?? token?.price ?? 0;
  const delta24h = token ? ((live - token.price) / token.price) * 100 : 0;
  const isBull = delta24h >= 0;

  const [activeTab, setActiveTab] = useState<"overview" | "trades" | "holders" | "top-traders">("overview");
  const [range, setRange] = useState<"1M" | "5M" | "1H" | "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL">("1D");
  const [orderType, setOrderType] = useState<"Market" | "Limit" | "DCA" | "Adv">("Market");
  const [tradeSide, setTradeSide] = useState<"Buy" | "Sell">("Buy");
  const [amount, setAmount] = useState(0.1); // SOL

  // Build chart data (simplified for now)
  const chartData = useMemo(() => {
    if (!token?.sparkline) return [];
    
    const base = token.sparkline;
    const n = base.length;
    
    // Simple deterministic variation
    return base.map((v, i) => ({
      x: i * 60_000, // timestamp in ms
      y: i === n - 1 ? live : v * (1 + ((i * 17) % 100 - 50) / 1000), // small variation
    }));
  }, [token, live]);

  if (!token) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Select a token to view details</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]"> {/* 64px for top bar */}
      {/* Left Sidebar */}
      <aside className="w-64 bg-surface border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-left">{token.symbol}</h3>
          <button
            onClick={() => openToken(null)}
            className="p-1 rounded hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Tabs */}
        <nav className="space-y-1 px-3 pt-4 pb-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex w-full items-center px-3 py-2 rounded text-sm font-medium transition-colors",
              activeTab === "overview" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Target className="mr-2 h-4 w-4" /> Overview
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={cn(
              "flex w-full items-center px-3 py-2 rounded text-sm font-medium transition-colors",
              activeTab === "trades" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="mr-2 h-4 w-4" /> Trades
          </button>
          <button
            onClick={() => setActiveTab("holders")}
            className={cn(
              "flex w-full items-center px-3 py-2 rounded text-sm font-medium transition-colors",
              activeTab === "holders" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="mr-2 h-4 w-4" /> Holders
          </button>
          <button
            onClick={() => setActiveTab("top-traders")}
            className={cn(
              "flex w-full items-center px-3 py-2 rounded text-sm font-medium transition-colors",
              activeTab === "top-traders" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TrendingUp className="mr-2 h-4 w-4" /> Top Traders
          </button>
        </nav>
        
        {/* Filters */}
        <div className="px-4 pt-4 pb-2 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4" />
            <span className="text-xs font-medium">Filters</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[ "All", "KOL 2", "Tracking 1", "Renames", "DEV 10", "Smart 29" ].map((filter, index) => (
              <button
                key={index}
                onClick={() => {}}
                className={cn(
                  "px-2 py-0.5 text-xs rounded border",
                  index === 0 ? "bg-muted/20 text-muted-foreground" : "hover:bg-surface-2 hover:text-foreground"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        
        {/* Additional sections */}
        <div className="mt-auto pt-4 px-4 border-t border-border">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">Tracking 1</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium">DCA</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-bull" />
              <span className="text-xs font-medium">Liquidity Pool</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-medium">Dev Token 3</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex-col overflow-hidden">
        {/* Token Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 mb-3 sm:mb-0">
            <TokenIcon 
              symbol={token.symbol} 
              glyph={token.logoGlyph} 
              color={token.logoColor} 
              size="lg" 
              live={token.ageHours < 200} 
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-left">{token.name}</span>
                <span className="text-xs text-muted-foreground">${token.symbol}</span>
                {!token.verified && <Chip variant="bear" text-xs>Unverified</Chip>}
                {token.verified && (
                  <span className="text-bull" title="Verified">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {token.chain} · {token.category} · age {/* fmtAge(token.ageHours) */}
              </div>
            </div>
          </div>
          
          {/* Price and Actions */}
          <div className="flex-1 sm:w-auto flex-col sm:flex-row sm:items-end sm:gap-4">
            <div className="flex items-end gap-3 mb-2 sm:mb-0">
              <span className="text-4xl font-bold tabular-nums">{fmtPrice(live)}</span>
              <div className={cn(
                "flex items-center gap-1.5 pb-1 text-sm font-semibold",
                isBull ? "text-bull" : "text-bear"
              )}>
                {isBull ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {isBull ? "+" : ""}
                {fmtPct(delta24h)}
              </div>
            </div>
            
            {/* Key Metrics Row */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Liq</div>
                <div className="font-semibold">{fmtUsd(token.liquidity ?? 0, { compact: true })}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">24h Vol</div>
                <div className="font-semibold">{fmtUsd(token.volume24h ?? 0, { compact: true })}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Tax</div>
                <div className="font-semibold text-[10px]">{token.tax ?? 0}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeframe Selector and Chart */}
        <div className="flex-1 overflow-hidden">
          <div className="px-4 pt-3">
            {/* Timeframe buttons */}
            <div className="flex gap-0.5 mb-3">
              {[
                "1M", "5M", "1H", "1D", "1W", "1M", "3M", "6M", "1Y", "ALL"
              ].map((timeframe) => (
                <button
                  key={timeframe}
                  onClick={() => setRange(timeframe as any)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-semibold rounded",
                    range === timeframe ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>
          
          {/* Chart Container */}
          <div className="flex-1 relative">
            <div className="absolute inset-0">
              {/* Simplified chart area - in reality would use lightweight-charts or similar */}
              <div className="h-full w-full bg-surface/50 rounded-lg flex items-center justify-center">
                <div className="text-muted-foreground text-center">
                  <p>Chart Area</p>
                  <p className="text-xs">(Would show candlestick chart with volume)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="p-4 overflow-y-auto">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* AI Summary */}
              <div className="rounded-xl p-4 bg-gradient-to-br from-[#14F195]/12 via-[#22D3EE]/8 to-transparent border border-bull/20">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-bull" />
                  <div>
                    <span className="font-semibold">{token.name}</span> is {isBull ? "trending up" : "pulling back"} {Math.abs(delta24h).toFixed(1)}% over 24h.
                    {token.smartMoneyInflow24h > 0
                      ? ` Smart money has net accumulated ${fmtUsd(token.smartMoneyInflow24h, { compact: true })} from ${token.smartMoneyHolders} tracked wallets.`
                      : ` Smart money has distributed ${fmtUsd(Math.abs(token.smartMoneyInflow24h), { compact: true })} over 24h.`}
                    Liquidity is {fmtUsd(token.liquidity, { compact: true })} with 24h volume of {fmtUsd(token.volume24h, { compact: true })}.
                    {token.smartMoneyHolders >= 150
                      ? " Smart-money concentration is high — strong conviction."
                      : " Smart-money concentration is moderate — monitor for follow-through."}
                  </div>
                </div>
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
              
              {/* Stats Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Market cap</div>
                  <div className="font-semibold">{fmtUsd(token.marketCap ?? 0, { compact: true })}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Liquidity</div>
                  <div className="font-semibold">{fmtUsd(token.liquidity ?? 0, { compact: true })}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">24h volume</div>
                  <div className="font-semibold">{fmtUsd(token.volume24h ?? 0, { compact: true })}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Holders</div>
                  <div className="font-semibold">{fmtNum(token.holders ?? 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Age</div>
                  <div className="font-semibold">{/* fmtAge(token.ageHours) */}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Smart wallets</div>
                  <div className="font-semibold">{fmtNum(token.smartMoneyHolders ?? 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Top 10%</div>
                  <div className="font-semibold">{((token.top10HolderPct ?? 0) * 100).toFixed(2)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Dev hold</div>
                  <div className="font-semibold">{((token.devHoldPct ?? 0) * 100).toFixed(2)}%</div>
                </div>
              </div>
            </div>
          )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Market cap</div>
                  <div className="font-semibold">{fmtUsd(token.marketCap ?? 0, { compact: true })}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Liquidity</div>
                  <div className="font-semibold">{fmtUsd(token.liquidity ?? 0, { compact: true })}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">24h volume</div>
                  <div className="font-semibold">{fmtUsd(token.volume24h ?? 0, { compact: true })}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Holders</div>
                  <div className="font-semibold">{fmtNum(token.holders ?? 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Age</div>
                  <div className="font-semibold">{/* fmtAge(token.ageHours) */}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Smart wallets</div>
                  <div className="font-semibold">{fmtNum(token.smartMoneyHolders ?? 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Top 10%</div>
                  <div className="font-semibold">{((token.top10HolderPct ?? 0) * 100).toFixed(2)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Dev hold</div>
                  <div className="font-semibold">{((token.devHoldPct ?? 0) * 100).toFixed(2)}%</div>
                </div>
              </div>
            </div>
          )
          \n
          {activeTab === "trades" && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Trades
              </h3>
              <div className="space-y-2">
                {/* Mock trade data */}
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-2">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center">
                      {i % 2 === 0 ? <TrendingUpIcon className="text-bull" /> : <TrendingDownIcon className="text-bear" />}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">Trade #{i + 1}</p>
                      <p className="text-xs text-muted-foreground">2m ago • SOL</p>
                    </div>
                    <span className="text-right font-semibold">
                      {i % 2 === 0 ? "+" : "-"}{fmtUsd((i + 1) * 1000)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === "holders" && (
            <>
              <HolderDistributionSection tokenId={token.id} />
              <div className="mt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Top Holders
                </h3>
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors">
                      <span className="w-6 text-center text-xs text-muted-foreground font-bold">#{i + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-bull/10 flex items-center justify-center text-bull font-bold text-sm">
                        {(i + 1).toString()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">Wallet Label {i + 1}</p>
                        <p className="text-xs text-muted-foreground">Holder • 1.2K SOL</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{fmtUsd((5 - i) * 10000)}</p>
                        <p className="text-xs {i % 2 === 0 ? 'text-bull' : 'text-bear'}">
                          {i % 2 === 0 ? "+" : "-"}{fmtPct((i + 1) * 5)} 30d
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {activeTab === "top-traders" && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Traders
              </h3>
              <div className="space-y-2">
                {/* Mock top traders data */}
                {Array.from({ length: 3 }).map((trader, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-surface-2">
                    <div className="flex-1">
                      <p className="font-medium">{trader === 0 ? "Latuche" : trader === 1 ? "Cupsey" : "WhaleWatcher"}</p>
                      <p className="text-xs text-muted-foreground">SOL Balance: {trader === 0 ? "27.97" : trader === 1 ? "5.002" : "150.5"} • Last Active: {trader === 0 ? "17h" : trader === 1 ? "17h" : "2h"} • Wallet Age: {trader === 0 ? "81d" : trader === 1 ? "368d" : "45d"}</p>
                    </div>
                    <div className="flex-1 text-right space-y-1">
                      <p className="font-semibold">
                        Sold: ${trader === 0 ? "2.62K" : trader === 1 ? "366.9" : "6.1K"} / ${trader === 0 ? "115K" : trader === 1 ? "287K" : "98K"}
                      </p>
                      <p className="font-semibold">
                        Bought: ${trader === 0 ? "1.22K" : trader === 1 ? "326.1" : "5.4K"} / ${trader === 0 ? "53.7K" : trader === 1 ? "255K" : "45K"}
                      </p>
                      <p className={cn("font-semibold", trader === 0 ? "text-bull" : trader === 1 ? "text-bear" : "text-bull")}>
                        {trader === 0 ? "+" : trader === 1 ? "+" : "+"}{fmtUsd(trader === 0 ? 1.35 : trader === 1 ? 36.88 : 12.5)} ({trader === 0 ? "+106.87%" : trader === 1 ? "+11.18%" : "+25.4%"})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </main>

      {/* Right Sidebar - Trading Interface */}
      <aside className="w-80 bg-surface border-l border-border flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Trade {token.symbol}</h3>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-bull/20 flex items-center justify-center text-[10px] font-bold">
                SOL
              </div>
              <ButtonVariant className="ml-2" />
            </div>
          </div>
          
          {/* Market Stats */}
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Vol</span>
              <span className="font-medium">$2.06K</span>
            </div>
            <div className="flex justify-between">
              <span>Buys</span>
              <span className="font-medium">18/$1K</span>
            </div>
            <div className="flex justify-between">
              <span>Sells</span>
              <span className="font-medium">23/$751</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Net Buy</span>
              <span className="text-bull">+$559</span>
            </div>
          </div>
          
          {/* Connection Indicator */}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-3 w-3 rounded-full bg-bull/20" />
            <span>Connection 4</span>
          </div>
        </div>

        {/* Order Entry */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 rounded-full bg-bull/10 flex items-center justify-center text-[9px] font-bold">
                {tradeSide === "Buy" ? <TrendingUpIcon className="text-bull" /> : <TrendingDownIcon className="text-bear" />}
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="font-semibold">{tradeSide}</p>
                <p className="text-xs text-muted-foreground">Market · 1 SOL = {fmtPrice(live / 0.00000182)} LARP</p>
              </div>
              <button
                onClick={() => setTradeSide(tradeSide === "Buy" ? "Sell" : "Buy")}
                className="p-1 rounded hover:bg-surface-2"
              >
                {/* Swap icon */}
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Order Type Tabs */}
          <div className="mb-4">
            <div className="flex gap-1 rounded-md bg-surface-2">
              {[ "Market", "Limit", "DCA", "Adv" ].map((type, index) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type as any)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-none transition-colors hover:bg-surface-3",
                    orderType === type ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Selection */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">Amount</span>
              <span className="ml-auto text-xs text-muted-foreground">{amount} SOL (${fmtUsd(amount * live)})</span>
            </div>
            <div className="flex gap-1">
              {[ 0.01, 0.1, 0.5, 1, 2, 5 ].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  className={cn(
                    "h-9 w-9 rounded flex items-center justify-center transition-colors",
                    amount === amt ? "bg-bull/20 text-bull border-bull/30" : "hover:bg-surface-2 hover:text-foreground"
                  )}
                >
                  {amt.toString()}
                </button>
              ))}
            </div>
          </div>

          {/* Price/Rate Info */}
          <div className="mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rate</span>
                <span className="font-semibold">{fmtPrice(live / 0.00000182)} LARP</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Price Impact</span>
                <span className="font-semibold text-[9px]">0.0%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Min Receive</span>
                <span className="font-semibold">{fmtUsd(amount * live * 0.99)}</span>
              </div>
            </div>
          </div>

          {/* Auto Trade Settings */}
          <div className="mb-6 pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4" />
              <span className="font-semibold">Auto trade</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={0.000454}
                readOnly
                className="w-20 pl-2 pr-1 text-right border-b border-border bg-transparent"
              />
              <span className="ml-auto text-xs text-muted-foreground">SOL</span>
            </div>
          </div>

          {/* Community Callout */}
          <div className="mt-6 pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4" />
              <span className="font-semibold">Post your thesis to community</span>
            </div>
            <button
              onClick={() => {}}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded border border-border hover:bg-surface-2"
            >
              <Send className="h-3 w-3" /> Connect your X account
            </button>
          </div>

          {/* Token Safety/Stats */}
          <div className="mt-auto pt-3 border-t border-border">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-3 w-3 text-gold" />
                <span className="font-semibold">Top 10:</span>
                <span className="ml-auto text-[10px] font-semibold">20.51%</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <span className="font-semibold">Holders:</span>
                <span className="ml-auto text-[10px] font-semibold">1,779</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-bear" />
                <span className="font-semibold">Snipers:</span>
                <span className="ml-auto text-[10px] font-semibold">0%</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-bear" />
                <span className="font-semibold">Phishing:</span>
                <span className="ml-auto text-[10px] font-semibold">10.4%</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-bear" />
                <span className="font-semibold">Bundler:</span>
                <span className="ml-auto text-[10px] font-semibold">8.4%</span>
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink className="h-3 w-3" />
                <span className="font-semibold">Dex Paid:</span>
                <span className="ml-auto text-[10px] font-semibold">$398 CTO</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                <span className="font-semibold">Burnt:</span>
                <span className="ml-auto text-[10px] font-semibold">100%</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-bear" />
                <span className="font-semibold">Rug %:</span>
                <span className="ml-auto text-[10px] font-semibold">0%</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="mt-4 p-3 bg-red/5 rounded-xl border border-red/20 text-xs">
            <AlertTriangle className="h-4 w-4 text-red mb-2" />
            <p className="mb-1">New tokens may not be accurately detected and could contain malicious methods.</p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            if (tradeSide === "Buy") {
              openTrade(token.id, "BUY");
            } else {
              openTrade(token.id, "SELL");
            }
          }}
          className="mt-4 w-full py-3 rounded-xl bg-bull text-background text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center"
        >
          {tradeSide === "Buy" ? "Buy" : "Sell"}
        </button>
      </aside>
    </div>
  );
}

// Helper components
function X() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function Sparkles() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2.97l3.89 8.26L23 9.25l-5.38.76L15 13.3l1.13 4.13L12 16.5l-1.13-4.13L3 12.56l5.38-.76L9 9.25z" />
    </svg>
  );
}

function Zap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3h1.42l4.12 9.16H11l-3.17 6.88H9.3l5.33-11.38H21l-4.03 8.94H14.58l-3.86 8.66z" />
    </svg>
  );
}

function ButtonVariant() {
  return (
    <button className="h-8 w-8 rounded border border-surface-3 hover:bg-surface-2">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2V4m0 16v2m6-6H8" />
      </svg>
    </button>
  );
}