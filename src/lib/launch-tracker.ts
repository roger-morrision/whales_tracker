/**
 * New Pair Launch Tracker
 * Real-time detection of new token launches on pump.fun, Raydium CPMM, etc.
 */

export interface NewPair {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string;
  dex: 'pumpfun' | 'raydium' | 'orca' | 'meteora' | 'phoenix' | 'lifinity';
  poolAddress: string;
  quoteMint: string;
  quoteSymbol: string;
  initialPrice: number;
  initialLiquidityUsd: number;
  initialMarketCap: number;
  creatorAddress: string;
  creatorTokenBalance: number;
  creatorTokenPct: number;
  isRenounced: boolean;
  isFrozen: boolean;
  launchTimestamp: number;
  ageSeconds: number;
  firstTradeTimestamp?: number;
  volumeUsd: number;
  tradesCount: number;
  buyersCount: number;
  smartMoneyBuyers: number;
  socialLinks: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  riskFlags: string[];
  source: 'pumpfun' | 'dexscreener' | 'gmgn' | 'rpc';
}

export interface LaunchFilters {
  minLiquidityUsd?: number;
  maxLiquidityUsd?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  maxAgeSeconds?: number;
  minSmartMoneyBuyers?: number;
  requireRenounced?: boolean;
  requireFrozen?: boolean;
  dexes?: string[];
  quoteSymbols?: string[];
}

export interface LaunchStats {
  totalLaunches24h: number;
  totalVolume24h: number;
  avgInitialLiquidity: number;
  dexesBreakdown: { dex: string; count: number; volumeUsd: number }[];
  topTokens: { symbol: string; volumeUsd: number; priceChange: number }[];
  successRate: number; // % that reached certain milestones
}

class NewPairTracker {
  private cache: Map<string, { pairs: NewPair[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 15000; // 15 seconds
  private listeners: Set<(pairs: NewPair[]) => void> = new Set();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private seenPairs: Set<string> = new Set();

  async getNewPairs(
    filters?: LaunchFilters,
    limit: number = 50
  ): Promise<NewPair[]> {
    const cacheKey = `launches-${JSON.stringify(filters)}-${limit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.pairs;
    }

    try {
      // Fetch from multiple sources
      const [pumpfunPairs, dexscreenerPairs, gmgnPairs] = await Promise.allSettled([
        this.fetchPumpFunLaunches(),
        this.fetchDexScreenerNewPairs(),
        this.fetchGmgnNewPairs(),
      ]);

      const allPairs: NewPair[] = [];
      
      if (pumpfunPairs.status === 'fulfilled') allPairs.push(...pumpfunPairs.value);
      if (dexscreenerPairs.status === 'fulfilled') allPairs.push(...dexscreenerPairs.value);
      if (gmgnPairs.status === 'fulfilled') allPairs.push(...gmgnPairs.value);

      // Deduplicate by token mint
      const uniquePairs = this.deduplicatePairs(allPairs);
      
      // Apply filters
      const filtered = this.applyFilters(uniquePairs, filters);
      
      // Sort by launch time (newest first)
      const sorted = filtered
        .sort((a, b) => b.launchTimestamp - a.launchTimestamp)
        .slice(0, limit);

      // Detect new pairs (not seen before)
      const newPairs = sorted.filter(p => !this.seenPairs.has(p.tokenMint));
      for (const pair of newPairs) {
        this.seenPairs.add(pair.tokenMint);
      }

      this.cache.set(cacheKey, { pairs: sorted, timestamp: Date.now() });
      return sorted;
    } catch (error) {
      console.error('[LaunchTracker] Error:', error);
      return [];
    }
  }

  async getLaunchStats(timeRangeHours: number = 24): Promise<LaunchStats> {
    const pairs = await this.getNewPairs(undefined, 500);
    const cutoff = Date.now() - timeRangeHours * 3600000;
    const recentPairs = pairs.filter(p => p.launchTimestamp > cutoff);

    const dexMap = new Map<string, { count: number; volumeUsd: number }>();
    for (const pair of recentPairs) {
      const existing = dexMap.get(pair.dex) || { count: 0, volumeUsd: 0 };
      existing.count++;
      existing.volumeUsd += pair.volumeUsd;
      dexMap.set(pair.dex, existing);
    }

    // Calculate success rate (tokens that 2x from launch)
    let successCount = 0;
    for (const pair of recentPairs) {
      if (pair.ageSeconds > 3600 && pair.initialMarketCap > 0) {
        // Would need current price to calculate - simplified
        if (pair.volumeUsd > pair.initialLiquidityUsd * 2) successCount++;
      }
    }

    return {
      totalLaunches24h: recentPairs.length,
      totalVolume24h: recentPairs.reduce((sum, p) => sum + p.volumeUsd, 0),
      avgInitialLiquidity: recentPairs.length > 0 
        ? recentPairs.reduce((sum, p) => sum + p.initialLiquidityUsd, 0) / recentPairs.length 
        : 0,
      dexesBreakdown: Array.from(dexMap.entries())
        .map(([dex, data]) => ({ dex, ...data }))
        .sort((a, b) => b.count - a.count),
      topTokens: recentPairs
        .sort((a, b) => b.volumeUsd - a.volumeUsd)
        .slice(0, 10)
        .map(p => ({ symbol: p.tokenSymbol, volumeUsd: p.volumeUsd, priceChange: 0 })),
      successRate: recentPairs.length > 0 ? (successCount / recentPairs.length) * 100 : 0,
    };
  }

  subscribe(callback: (pairs: NewPair[]) => void): () => void {
    this.listeners.add(callback);
    this.startPolling();
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  private startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    
    const poll = async () => {
      const pairs = await this.getNewPairs(undefined, 20);
      const newPairs = pairs.filter(p => !this.seenPairs.has(p.tokenMint));
      
      if (newPairs.length > 0) {
        for (const listener of this.listeners) {
          try {
            listener(newPairs);
          } catch (error) {
            console.error('[LaunchTracker] Listener error:', error);
          }
        }
        for (const pair of newPairs) {
          this.seenPairs.add(pair.tokenMint);
        }
      }
    };
    
    poll();
    this.pollingInterval = setInterval(poll, 30000); // Poll every 30s
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  private async fetchPumpFunLaunches(): Promise<NewPair[]> {
    try {
      const response = await fetch('/api/pumpfun?type=new_creation&limit=30', {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.tokens || []).map((t: any) => ({
        id: `pf_${t.address}`,
        tokenMint: t.address,
        tokenSymbol: t.symbol,
        tokenName: t.name,
        tokenImage: t.image_uri || '',
        dex: 'pumpfun' as const,
        poolAddress: t.address,
        quoteMint: 'So11111111111111111111111111111111111111112',
        quoteSymbol: 'SOL',
        initialPrice: t.price || 0,
        initialLiquidityUsd: t.liquidity || 0,
        initialMarketCap: t.market_cap || 0,
        creatorAddress: t.creator_address || '',
        creatorTokenBalance: t.dev_holding || 0,
        creatorTokenPct: t.dev_holding_pct || 0,
        isRenounced: t.is_renounced || false,
        isFrozen: t.is_frozen || false,
        launchTimestamp: t.created_timestamp ? t.created_timestamp * 1000 : Date.now(),
        ageSeconds: t.created_timestamp ? Math.floor((Date.now() / 1000) - t.created_timestamp) : 0,
        volumeUsd: t.volume_24h || 0,
        tradesCount: t.txns_24h || 0,
        buyersCount: t.buyers_24h || 0,
        smartMoneyBuyers: t.smart_money_holders || 0,
        socialLinks: {
          twitter: t.twitter,
          telegram: t.telegram,
          website: t.website,
        },
        riskFlags: this.generateRiskFlags(t),
        source: 'pumpfun',
      }));
    } catch {
      return [];
    }
  }

  private async fetchDexScreenerNewPairs(): Promise<NewPair[]> {
    try {
      const response = await fetch(
        'https://api.dexscreener.com/latest/dex/pairs/solana',
        { signal: AbortSignal.timeout(8000) }
      );
      if (!response.ok) return [];
      const data = await response.json();
      const pairs = data.pairs || [];
      
      // Filter for very new pairs (created in last 24h)
      const now = Date.now();
      const newPairs = pairs
        .filter((p: any) => p.chainId === 'solana' && p.pairCreatedAt)
        .filter((p: any) => now - p.pairCreatedAt < 24 * 3600000)
        .sort((a: any, b: any) => b.pairCreatedAt - a.pairCreatedAt)
        .slice(0, 30);

      return newPairs.map((p: any) => ({
        id: `ds_${p.pairAddress}`,
        tokenMint: p.baseToken?.address || '',
        tokenSymbol: p.baseToken?.symbol || '',
        tokenName: p.baseToken?.name || '',
        tokenImage: p.info?.imageUrl || '',
        dex: (p.dexId || 'unknown') as NewPair['dex'],
        poolAddress: p.pairAddress,
        quoteMint: p.quoteToken?.address || '',
        quoteSymbol: p.quoteToken?.symbol || '',
        initialPrice: parseFloat(p.priceNative || '0'),
        initialLiquidityUsd: p.liquidity?.usd || 0,
        initialMarketCap: p.marketCap || p.fdv || 0,
        creatorAddress: '',
        creatorTokenBalance: 0,
        creatorTokenPct: 0,
        isRenounced: false,
        isFrozen: false,
        launchTimestamp: p.pairCreatedAt,
        ageSeconds: Math.floor((now - p.pairCreatedAt) / 1000),
        volumeUsd: p.volume?.h24 || 0,
        tradesCount: p.txns?.h24?.buys + p.txns?.h24?.sells || 0,
        buyersCount: p.txns?.h24?.buys || 0,
        smartMoneyBuyers: 0,
        socialLinks: {
          twitter: p.info?.socials?.find((s: any) => s.type === 'twitter')?.url,
          telegram: p.info?.socials?.find((s: any) => s.type === 'telegram')?.url,
          website: p.info?.websites?.[0]?.url,
        },
        riskFlags: [],
        source: 'dexscreener',
      }));
    } catch {
      return [];
    }
  }

  private async fetchGmgnNewPairs(): Promise<NewPair[]> {
    try {
      const response = await fetch('/api/gmgn/new-pairs?type=new_creation&limit=30', {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.tokens || []).map((t: any) => ({
        id: `gmgn_${t.address}`,
        tokenMint: t.address,
        tokenSymbol: t.symbol,
        tokenName: t.name,
        tokenImage: t.image_uri || '',
        dex: 'pumpfun' as const, // GMGN new pairs are typically pump.fun
        poolAddress: t.address,
        quoteMint: 'So11111111111111111111111111111111111111112',
        quoteSymbol: 'SOL',
        initialPrice: t.price || 0,
        initialLiquidityUsd: t.liquidity || 0,
        initialMarketCap: t.market_cap || 0,
        creatorAddress: t.creator_address || '',
        creatorTokenBalance: t.dev_holding || 0,
        creatorTokenPct: t.dev_holding_pct || 0,
        isRenounced: t.renounced_mint === 1 || t.renounced_mint === true,
        isFrozen: t.renounced_freeze_account === 1 || t.renounced_freeze_account === true,
        launchTimestamp: t.create_timestamp ? t.create_timestamp * 1000 : Date.now(),
        ageSeconds: t.create_timestamp ? Math.floor((Date.now() / 1000) - t.create_timestamp) : 0,
        volumeUsd: t.volume_24h || 0,
        tradesCount: t.txns_24h || 0,
        buyersCount: t.buyers_24h || 0,
        smartMoneyBuyers: t.smart_money_holders || 0,
        socialLinks: {
          twitter: t.twitter,
          telegram: t.telegram,
          website: t.website,
        },
        riskFlags: this.generateRiskFlags(t),
        source: 'gmgn',
      }));
    } catch {
      return [];
    }
  }

  private deduplicatePairs(pairs: NewPair[]): NewPair[] {
    const seen = new Map<string, NewPair>();
    for (const pair of pairs) {
      const existing = seen.get(pair.tokenMint);
      if (!existing || pair.launchTimestamp > existing.launchTimestamp) {
        seen.set(pair.tokenMint, pair);
      }
    }
    return Array.from(seen.values());
  }

  private applyFilters(pairs: NewPair[], filters?: LaunchFilters): NewPair[] {
    if (!filters) return pairs;
    
    return pairs.filter(p => {
      if (filters.minLiquidityUsd && p.initialLiquidityUsd < filters.minLiquidityUsd) return false;
      if (filters.maxLiquidityUsd && p.initialLiquidityUsd > filters.maxLiquidityUsd) return false;
      if (filters.minMarketCap && p.initialMarketCap < filters.minMarketCap) return false;
      if (filters.maxMarketCap && p.initialMarketCap > filters.maxMarketCap) return false;
      if (filters.maxAgeSeconds && p.ageSeconds > filters.maxAgeSeconds) return false;
      if (filters.minSmartMoneyBuyers && p.smartMoneyBuyers < filters.minSmartMoneyBuyers) return false;
      if (filters.requireRenounced && !p.isRenounced) return false;
      if (filters.requireFrozen && !p.isFrozen) return false;
      if (filters.dexes?.length && !filters.dexes.includes(p.dex)) return false;
      if (filters.quoteSymbols?.length && !filters.quoteSymbols.includes(p.quoteSymbol)) return false;
      return true;
    });
  }

  private generateRiskFlags(token: any): string[] {
    const flags: string[] = [];
    if (token.dev_holding_pct > 20) flags.push('High dev holdings');
    if (!token.is_renounced) flags.push('Mint not renounced');
    if (!token.is_frozen) flags.push('Freeze not renounced');
    if (token.rug_ratio > 0.3) flags.push('High rug ratio');
    if (token.is_honeypot) flags.push('Honeypot');
    if (token.liquidity < 10000) flags.push('Low liquidity');
    if (token.age_seconds && token.age_seconds < 300) flags.push('Very new (<5min)');
    return flags;
  }
}

// Singleton
let launchTrackerInstance: NewPairTracker | null = null;

export function getLaunchTracker(): NewPairTracker {
  if (!launchTrackerInstance) {
    launchTrackerInstance = new NewPairTracker();
  }
  return launchTrackerInstance;
}

// React hook
export function useLaunchTracker(filters?: LaunchFilters) {
  const tracker = getLaunchTracker();
  
  return {
    getNewPairs: (limit?: number) => tracker.getNewPairs(filters, limit),
    getStats: (timeRangeHours?: number) => tracker.getLaunchStats(timeRangeHours),
    subscribe: (callback: (pairs: NewPair[]) => void) => tracker.subscribe(callback),
  };
}

export type { NewPair, LaunchFilters, LaunchStats };