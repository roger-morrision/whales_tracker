'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Users, Star, AlertTriangle, 
  Shield, Lock, Unlock, Globe, Brain, Zap, Target,
  ArrowUpRight, ArrowDownRight, RefreshCw, Filter,
  ChevronDown, ChevronUp, ExternalLink, Search
} from 'lucide-react';
import { useSmartMoneyIntelligence } from '@/lib/smart-money-intel';
import { useMoby } from '@/lib/moby-store';
import { StalenessBadge } from '@/components/ui/staleness-badge';
import { cn } from '@/lib/utils';
import { fmtUsd, fmtPct, fmtNum } from '@/lib/moby-data';

interface TokenIntelligenceDashboardProps {
  tokenMint?: string;
  symbol?: string;
  className?: string;
}

export function TokenIntelligenceDashboard({ 
  tokenMint, 
  symbol, 
  className 
}: TokenIntelligenceDashboardProps) {
  const { getTokenIntelligence, getNarrativeClusters, getSmartMoneyFeed } = useSmartMoneyIntelligence();
  const prices = useMoby((s) => s.prices);
  const selectedChain = useMoby((s) => s.selectedChain);
  
  const [intelligence, setIntelligence] = useState<any>(null);
  const [narratives, setNarratives] = useState<any[]>([]);
  const [smartMoneyFeed, setSmartMoneyFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'smart-money' | 'narratives' | 'cross-chain' | 'risk'>('overview');
    const [error, setError] = useState<string | null>(null);

    const prices = useMoby((s) => s.prices);
    const selectedChain = useMoby((s) => s.selectedChain);
    const token = useMoby((s) => tokenMint ? s.tokens?.find?.((t: any) => t.id === tokenMint) : null);
    const livePrice = tokenMint ? prices[tokenMint]?.price ?? token?.price ?? 0 : 0;

  useEffect(() => {
    if (!tokenMint) return;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [intel, narrativeClusters, feed] = await Promise.allSettled([
          getTokenIntelligence(tokenMint, selectedChain),
          getNarrativeClusters(),
          getSmartMoneyFeed(selectedChain, 30),
        ]);

        if (intel.status === 'fulfilled') setIntelligence(intel.value);
        if (narrativeClusters.status === 'fulfilled') setNarratives(narrativeClusters.value);
        if (feed.status === 'fulfilled') setSmartMoneyFeed(feed.value);
      } catch (err) {
        setError('Failed to load intelligence data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [tokenMint, selectedChain, getTokenIntelligence, getNarrativeClusters, getSmartMoneyFeed]);

  if (!tokenMint) {
    return (
      <div className={cn('p-6 text-center text-muted-foreground', className)}>
        <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Select a token to view intelligence</p>
      </div>
    );
  }

  if (loading && !intelligence) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <div className="w-8 h-8 border-4 border-bull border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-6 text-center text-destructive', className)}>
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 text-sm underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const freshness = intelligence?.lastUpdated 
    ? calculateFreshness(intelligence.lastUpdated, 'tokenInfo')
    : null;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-bull/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-bull" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">{intelligence?.symbol || symbol} Intelligence</h2>
            <p className="text-sm text-muted-foreground">
              {intelligence?.name} • {selectedChain}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StalenessBadge 
            timestamp={intelligence?.lastUpdated || 0} 
            dataType="tokenInfo"
            compact
          />
          <button 
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-surface-3 rounded-lg text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Overview', icon: Target },
          { id: 'smart-money', label: 'Smart Money', icon: Users },
          { id: 'narratives', label: 'Narratives', icon: Zap },
          { id: 'cross-chain', label: 'Cross-Chain', icon: Globe },
          { id: 'risk', label: 'Risk', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'overview' && intelligence && (
          <OverviewTab intelligence={intelligence} livePrice={livePrice} freshness={freshness} />
        )}
        
        {activeTab === 'smart-money' && intelligence && (
          <SmartMoneyTab intelligence={intelligence} feed={smartMoneyFeed} />
        )}
        
        {activeTab === 'narratives' && (
          <NarrativesTab narratives={narratives} tokenIntel={intelligence} />
        )}
        
        {activeTab === 'cross-chain' && intelligence && (
          <CrossChainTab intelligence={intelligence} />
        )}
        
        {activeTab === 'risk' && intelligence && (
          <RiskTab intelligence={intelligence} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ intelligence, livePrice, freshness }: any) {
  if (!intelligence) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Smart Money Flow */}
      <MetricCard
        title="Smart Money Net Flow (24h)"
        value={fmtUsd(intelligence.smartMoneyNetFlow24h, { compact: true, sign: true })}
        icon={intelligence.smartMoneyNetFlow24h >= 0 ? TrendingUp : TrendingDown}
        iconColor={intelligence.smartMoneyNetFlow24h >= 0 ? 'text-bull' : 'text-bear'}
        subtitle={`${intelligence.smartMoneyBuyers24h} buyers · ${intelligence.smartMoneySellers24h} sellers`}
      />

      {/* KOL Flow */}
      <MetricCard
        title="KOL Net Flow (24h)"
        value={fmtUsd(intelligence.kolNetFlow24h, { compact: true, sign: true })}
        icon={intelligence.kolNetFlow24h >= 0 ? TrendingUp : TrendingDown}
        iconColor={intelligence.kolNetFlow24h >= 0 ? 'text-bull' : 'text-bear'}
        subtitle={`${intelligence.kolHolders?.length || 0} KOLs holding`}
      />

      {/* Price */}
      <MetricCard
        title="Current Price"
        value={livePrice > 0 ? `$${fmtNum(livePrice)}` : '—'}
        icon={Zap}
        iconColor="text-gold"
        subtitle={freshness ? `Updated ${freshness.ageDisplay}` : 'No price data'}
      />

      {/* Data Quality */}
      <MetricCard
        title="Data Quality"
        value={intelligence.dataQuality || 'low'}
        icon={Shield}
        iconColor={intelligence.dataQuality === 'high' ? 'text-bull' : intelligence.dataQuality === 'medium' ? 'text-gold' : 'text-bear'}
        subtitle="Source reliability"
      />

      {/* Top Smart Money Holders */}
      <div className="lg:col-span-2">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          Top Smart Money Holders
        </h3>
        <div className="space-y-2">
          {intelligence.topSmartMoneyHolders?.slice(0, 5).map((holder: any, i: number) => (
            <SmartMoneyHolderRow key={holder.address} holder={holder} rank={i + 1} />
          )) || (
            <p className="text-muted-foreground text-center py-4">No smart money holders detected</p>
          )}
        </div>
      </div>

      {/* Top KOL Holders */}
      <div className="lg:col-span-2">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Star className="w-5 h-5 text-gold" />
          KOL / Influencer Holders
        </h3>
        <div className="space-y-2">
          {intelligence.kolHolders?.slice(0, 5).map((kol: any, i: number) => (
            <KolHolderRow key={kol.address} kol={kol} rank={i + 1} />
          )) || (
            <p className="text-muted-foreground text-center py-4">No KOL holders detected</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SmartMoneyTab({ intelligence, feed }: any) {
  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatBox 
          label="Net Inflow (24h)" 
          value={fmtUsd(intelligence?.smartMoneyNetFlow24h || 0, { compact: true, sign: true })}
          color={intelligence?.smartMoneyNetFlow24h >= 0 ? 'bull' : 'bear'}
        />
        <StatBox 
          label="Active Buyers" 
          value={intelligence?.smartMoneyBuyers24h || 0}
          color="bull"
        />
        <StatBox 
          label="Active Sellers" 
          value={intelligence?.smartMoneySellers24h || 0}
          color="bear"
        />
      </div>

      {/* Live Feed */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-gold" />
          Live Smart Money Feed
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {feed?.slice(0, 20).map((signal: any, i: number) => (
            <SmartMoneySignalRow key={`${signal.walletAddress}-${signal.timestamp}`} signal={signal} />
          )) || (
            <p className="text-muted-foreground text-center py-4">No live feed data</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NarrativesTab({ narratives, tokenIntel }: any) {
  return (
    <div className="space-y-4">
      {/* Token Narratives */}
      {tokenIntel?.narratives?.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Token Narratives
          </h3>
          <div className="flex flex-wrap gap-2">
            {tokenIntel.narratives.map((narrative: any) => (
              <NarrativeBadge key={narrative.name} narrative={narrative} />
            ))}
          </div>
        </div>
      )}

      {/* Market Narrative Clusters */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-muted-foreground" />
          Market Narrative Clusters
        </h3>
        {narratives?.length > 0 ? (
          <div className="space-y-3">
            {narratives.slice(0, 10).map((cluster: any) => (
              <NarrativeClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">No narrative clusters detected</p>
        )}
      </div>
    </div>
  );
}

function CrossChainTab({ intelligence }: any) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {intelligence?.chains?.map((chain: any) => (
          <ChainPresenceCard key={chain.chain} chain={chain} />
        ))}
      </div>
      
      {intelligence?.chains?.length > 1 && (
        <div className="rounded-lg border border-bull/20 bg-bull/5 p-4">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-bull" />
            Arbitrage Opportunity
          </h4>
          <p className="text-sm text-muted-foreground">
            Token detected on {intelligence.chains.length} chains. Cross-chain arbitrage may be available.
          </p>
        </div>
      )}
    </div>
  );
}

function RiskTab({ intelligence }: any) {
  if (!intelligence) return null;

  const riskItems = [
    { label: 'Mint Authority Revoked', value: intelligence.mintAuthorityRevoked, good: true, icon: Lock },
    { label: 'Freeze Authority Revoked', value: intelligence.freezeAuthorityRevoked, good: true, icon: Lock },
    { label: 'Liquidity Locked', value: intelligence.liquidityLocked, good: true, icon: Shield },
    { label: 'Bundler Rate', value: `${(intelligence.bundlerRate * 100).toFixed(1)}%`, good: intelligence.bundlerRate < 0.1, icon: Users },
    { label: 'Rat Trader Rate', value: `${(intelligence.ratTraderRate * 100).toFixed(1)}%`, good: intelligence.ratTraderRate < 0.05, icon: AlertTriangle },
    { label: 'Sniper Count', value: intelligence.sniperCount, good: intelligence.sniperCount < 5, icon: Target },
    { label: 'Rug Ratio', value: `${(intelligence.rugRatio * 100).toFixed(1)}%`, good: intelligence.rugRatio < 0.3, icon: AlertTriangle },
    { label: 'Dev Holder Rate', value: `${(intelligence.devHolderRate * 100).toFixed(1)}%`, good: intelligence.devHolderRate < 0.1, icon: Users },
    { label: 'Top 10 Holder Rate', value: `${(intelligence.top10HolderRate * 100).toFixed(1)}%`, good: intelligence.top10HolderRate < 0.35, icon: Users },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {riskItems.map((item, i) => (
          <RiskItemCard key={i} {...item} />
        ))}
      </div>
    </div>
  );
}

// Helper Components
function MetricCard({ title, value, icon: Icon, iconColor, subtitle }: any) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className={cn('w-5 h-5', iconColor)} />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}

function StatBox({ label, value, color }: any) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className={cn("text-2xl font-bold tabular-nums", color === 'bull' ? 'text-bull' : color === 'bear' ? 'text-bear' : 'text-foreground')}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function SmartMoneyHolderRow({ holder, rank }: any) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors">
      <span className="w-6 text-center text-xs text-muted-foreground font-bold">#{rank}</span>
      <div className="w-8 h-8 rounded-full bg-bull/10 flex items-center justify-center text-bull font-bold text-sm">
        {holder.label?.charAt(0) || holder.address.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{holder.label || `${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`}</p>
        <p className="text-xs text-muted-foreground">
          {holder.tags?.join(', ') || 'Smart Money'}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm">{fmtUsd(holder.valueUsd, { compact: true })}</p>
        <p className="text-xs {holder.pnl30d >= 0 ? 'text-bull' : 'text-bear'}">
          {holder.pnl30d >= 0 ? '+' : ''}{fmtPct(holder.pnl30d / 100)} 30d
        </p>
      </div>
    </div>
  );
}

function KolHolderRow({ kol, rank }: any) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors">
      <span className="w-6 text-center text-xs text-muted-foreground font-bold">#{rank}</span>
      <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold text-sm">
        @
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">@{kol.twitter_handle}</p>
        <p className="text-xs text-muted-foreground">{kol.twitter_name} • {kol.followers.toLocaleString()} followers</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm">{fmtUsd(kol.valueUsd, { compact: true })}</p>
        {kol.pnlUsd !== undefined && (
          <p className="text-xs {kol.pnlUsd >= 0 ? 'text-bull' : 'text-bear'}">
            {kol.pnlUsd >= 0 ? '+' : ''}{fmtUsd(kol.pnlUsd, { compact: true })}
          </p>
        )}
      </div>
    </div>
  );
}

function SmartMoneySignalRow({ signal }: any) {
  const isBuy = signal.side === 'buy';
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors border-l-2 {isBuy ? 'border-bull' : 'border-bear'}">
      <div className="w-8 h-8 rounded-full {isBuy ? 'bg-bull/10' : 'bg-bear/10'} flex items-center justify-center">
        {isBuy ? <TrendingUp className="w-4 h-4 text-bull" /> : <TrendingDown className="w-4 h-4 text-bear" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {signal.walletLabel || `${signal.walletAddress.slice(0, 6)}...${signal.walletAddress.slice(-4)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {signal.tokenSymbol} • {signal.walletTags?.join(', ') || 'Smart Money'}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm {isBuy ? 'text-bull' : 'text-bear'}">
          {isBuy ? '+' : '-'}{fmtUsd(signal.amountUsd, { compact: true })}
        </p>
        <p className="text-xs text-muted-foreground">
          {fmtUsd(signal.priceUsd)} • {new Date(signal.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function NarrativeBadge({ narrative }: any) {
  const categoryColors: Record<string, string> = {
    ai: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    defi: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    gaming: 'bg-green-500/20 text-green-400 border-green-500/30',
    meme: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    nft: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    rwa: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    depin: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    sector: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    trend: 'bg-red-500/20 text-red-400 border-red-500/30',
    event: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
      categoryColors[narrative.category] || 'bg-muted text-muted-foreground border-border'
    )}>
      {narrative.trending && <Zap className="w-3 h-3 animate-pulse" />}
      <span>{narrative.name}</span>
      <span className="font-mono">{narrative.strength}%</span>
    </span>
  );
}

function NarrativeClusterCard({ cluster }: any) {
  return (
    <div className="rounded-xl border bg-card p-4 hover:border-bull/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{cluster.name}</h4>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {cluster.category}
            </span>
            {cluster.isEmerging && (
              <span className="text-xs px-2 py-0.5 rounded bg-bull/10 text-bull">
                Emerging
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{cluster.description}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">{cluster.tokens.length} tokens</p>
          <p className="text-xs text-muted-foreground">{fmtUsd(cluster.totalMarketCap, { compact: true })} mcap</p>
        </div>
      </div>
      
      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <div className="bg-surface-2 rounded p-2">
          <p className="text-muted-foreground">Volume 24h</p>
          <p className="font-semibold">{fmtUsd(cluster.totalVolume24h, { compact: true })}</p>
        </div>
        <div className="bg-surface-2 rounded p-2">
          <p className="text-muted-foreground">Avg 24h Change</p>
          <p className="font-semibold {cluster.avgPriceChange24h >= 0 ? 'text-bull' : 'text-bear'}">
            {cluster.avgPriceChange24h >= 0 ? '+' : ''}{cluster.avgPriceChange24h.toFixed(2)}%
          </p>
        </div>
        <div className="bg-surface-2 rounded p-2">
          <p className="text-muted-foreground">Smart Money Inflow</p>
          <p className="font-semibold text-bull">{fmtUsd(cluster.smartMoneyInflow24h, { compact: true })}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {cluster.topNarratives.slice(0, 3).map((n: any) => (
          <NarrativeBadge key={n.name} narrative={n} />
        ))}
      </div>
    </div>
  );
}

function ChainPresenceCard({ chain }: any) {
  return (
    <div className="rounded-xl border bg-card p-4 {chain.isPrimary ? 'border-bull/30' : ''}">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold">
            {chain.chain.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-semibold">{chain.chain} {chain.isPrimary && '✓'}</p>
            <p className="text-xs text-muted-foreground">{chain.dexCount} DEXes</p>
          </div>
        </div>
        {chain.isPrimary && <span className="text-xs px-2 py-0.5 rounded bg-bull/10 text-bull">Primary</span>}
      </div>
      
      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <div className="bg-surface-2 rounded p-2">
          <p className="text-muted-foreground">Price</p>
          <p className="font-semibold">{fmtUsd(chain.priceUsd)}</p>
        </div>
        <div className="bg-surface-2 rounded p-2">
          <p className="text-muted-foreground">Liquidity</p>
          <p className="font-semibold">{fmtUsd(chain.liquidityUsd, { compact: true })}</p>
        </div>
        <div className="bg-surface-2 rounded p-2">
          <p className="text-muted-foreground">Volume 24h</p>
          <p className="font-semibold">{fmtUsd(chain.volume24h, { compact: true })}</p>
        </div>
        <div className="bg-surface-2 rounded p-2">
          <p className="text-muted-foreground">Holders</p>
          <p className="font-semibold">{fmtNum(chain.holders)}</p>
        </div>
      </div>
    </div>
  );
}

function RiskItemCard({ label, value, good, icon: Icon }: any) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Security check</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-lg {good ? 'text-bull' : 'text-bear'}">
          {typeof value === 'boolean' ? (value ? '✓ Pass' : '✗ Fail') : value}
        </p>
        <p className="text-xs {good ? 'text-bull' : 'text-bear'}">
          {good ? 'Low risk' : 'High risk'}
        </p>
      </div>
    </div>
  );
}