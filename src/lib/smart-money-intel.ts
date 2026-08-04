/**
 * Smart Money Intelligence
 * Unified token dashboard, cross-chain tracking, narrative detection
 */

import { getJupiterExecutor } from './jupiter-executor';
import { getHealthMetrics as getGmgnHealth } from './gmgn';
import { getHealthMetrics as getDexHealth } from './dexscreener';
import { calculateFreshness } from './freshness';

export interface SmartMoneySignal {
  walletAddress: string;
  walletLabel?: string;
  walletTags: string[];
  tokenMint: string;
  tokenSymbol: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  amountToken: number;
  priceUsd: number;
  timestamp: number;
  pnl30d?: number;
  winRate?: number;
  confidence: number; // 0-100
}

export interface TokenIntelligence {
  tokenMint: string;
  symbol: string;
  name: string;
  
  // Smart money metrics
  smartMoneyNetFlow24h: number;
  smartMoneyBuyers24h: number;
  smartMoneySellers24h: number;
  topSmartMoneyHolders: SmartMoneyHolder[];
  
  // KOL/Influencer metrics
  kolHolders: KolHolder[];
  kolNetFlow24h: number;
  
  // Risk metrics
  bundlerRate: number;
  ratTraderRate: number;
  sniperCount: number;
  rugRatio: number;
  devHolderRate: number;
  top10HolderRate: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  liquidityLocked: boolean;
  
  // Cross-chain presence
  chains: ChainPresence[];
  
  // Narrative tags
  narratives: NarrativeTag[];
  
  // Freshness
  lastUpdated: number;
  dataQuality: 'high' | 'medium' | 'low';
}

export interface SmartMoneyHolder {
  address: string;
  label?: string;
  tags: string[];
  balance: number;
  valueUsd: number;
  pnl30d: number;
  winRate: number;
  recentActivity: SmartMoneySignal[];
}

export interface KolHolder {
  address: string;
  twitterHandle: string;
  twitterName: string;
  followers: number;
  balance: number;
  valueUsd: number;
  avgBuyPrice?: number;
  pnlUsd?: number;
  lastBuyTs?: number;
}

export interface ChainPresence {
  chain: string;
  tokenMint: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  holders: number;
  dexCount: number;
  isPrimary: boolean;
}

export interface NarrativeTag {
  name: string;
  category: 'sector' | 'trend' | 'event' | 'meme' | 'ai' | 'defi' | 'nft' | 'gaming' | 'rwa' | 'depin';
  strength: number; // 0-100
  relatedTokens: string[];
  description: string;
  startedAt: number;
  trending: boolean;
}

export interface NarrativeCluster {
  id: string;
  name: string;
  description: string;
  category: NarrativeTag['category'];
  tokens: ClusterToken[];
  totalMarketCap: number;
  totalVolume24h: number;
  avgPriceChange24h: number;
  smartMoneyInflow24h: number;
  topNarratives: NarrativeTag[];
  startedAt: number;
  isEmerging: boolean;
}

export interface ClusterToken {
  tokenMint: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  smartMoneyInflow: number;
  narrativeRelevance: number; // 0-100
}

export interface CrossChainToken {
  tokenMint: string;
  symbol: string;
  name: string;
  chains: ChainPresence[];
  primaryChain: string;
  totalLiquidityUsd: number;
  totalVolume24h: number;
  priceUsd: number; // Average across chains
  arbitrageOpportunity?: ArbitrageSignal;
}

export interface ArbitrageSignal {
  buyChain: string;
  sellChain: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  estimatedProfitUsd: number;
  confidence: number;
}

class SmartMoneyIntelligence {
  private gmgnHealth = getGmgnHealth();
  private dexHealth = getDexHealth();
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute

  // Known chain configurations
  private readonly CHAINS = {
    solana: { id: 'solana', name: 'Solana', nativeToken: 'SOL' },
    ethereum: { id: 'ethereum', name: 'Ethereum', nativeToken: 'ETH' },
    bsc: { id: 'bsc', name: 'BSC', nativeToken: 'BNB' },
    base: { id: 'base', name: 'Base', nativeToken: 'ETH' },
    arbitrum: { id: 'arbitrum', name: 'Arbitrum', nativeToken: 'ETH' },
    polygon: { id: 'polygon', name: 'Polygon', nativeToken: 'MATIC' },
  };

  // Narrative keyword mappings
  private readonly NARRATIVE_KEYWORDS: Record<NarrativeTag['category'], string[]> = {
    ai: ['ai', 'artificial intelligence', 'llm', 'gpt', 'agent', 'neural', 'machine learning'],
    defi: ['defi', 'dex', 'amm', 'lending', 'borrowing', 'yield', 'staking', 'liquidity'],
    gaming: ['game', 'gaming', 'play-to-earn', 'p2e', 'metaverse', 'nft game'],
    meme: ['meme', 'pepe', 'dog', 'cat', 'frog', 'wojak', 'chad'],
    nft: ['nft', 'collectible', 'digital art', 'profile picture', 'pfp'],
    rwa: ['rwa', 'real world asset', 'tokenized', 'treasury', 'bond'],
    depin: ['depin', 'physical infrastructure', 'wireless', 'sensor', 'compute'],
    sector: ['layer 1', 'layer 2', 'infrastructure', 'oracle', 'bridge'],
    trend: ['trending', 'viral', 'hype', 'pump', 'moon'],
    event: ['airdrop', 'launch', 'tge', 'ido', 'ico', 'presale'],
  };

  async getTokenIntelligence(tokenMint: string, chain: string = 'solana'): Promise<TokenIntelligence | null> {
    const cacheKey = `intel:${chain}:${tokenMint}`;
    const cached = this.getCached<TokenIntelligence>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch from multiple sources in parallel
      const [
        gmgnToken,
        gmgnSecurity,
        gmgnHolders,
        gmgnTraders,
        gmgnSmartMoney,
        gmgnKol,
        dexPairs,
      ] = await Promise.allSettled([
        this.fetchGmgnToken(tokenMint, chain),
        this.fetchGmgnSecurity(tokenMint, chain),
        this.fetchGmgnHolders(tokenMint, chain, 50),
        this.fetchGmgnTraders(tokenMint, chain, 50),
        this.fetchGmgnSmartMoney(tokenMint, chain, 50),
        this.fetchGmgnKol(tokenMint, chain, 30),
        this.fetchDexPairs(tokenMint, chain),
      ]);

      // Cross-chain presence
      const crossChain = await this.fetchCrossChainPresence(tokenMint, chain);

      // Detect narratives
      const narratives = this.detectNarratives(
        gmgnToken.value?.symbol || '',
        gmgnToken.value?.name || '',
        gmgnSmartMoney.value,
        gmgnKol.value,
        crossChain
      );

      const intelligence: TokenIntelligence = {
        tokenMint,
        symbol: gmgnToken.value?.symbol || 'UNKNOWN',
        name: gmgnToken.value?.name || 'Unknown Token',
        
        // Smart money
        smartMoneyNetFlow24h: this.calculateNetFlow(gmgnSmartMoney.value, 'buy') - this.calculateNetFlow(gmgnSmartMoney.value, 'sell'),
        smartMoneyBuyers24h: this.countUniqueWallets(gmgnSmartMoney.value, 'buy'),
        smartMoneySellers24h: this.countUniqueWallets(gmgnSmartMoney.value, 'sell'),
        topSmartMoneyHolders: this.extractTopSmartMoneyHolders(gmgnHolders.value),
        
        // KOL
        kolHolders: this.extractKolHolders(gmgnKol.value),
        kolNetFlow24h: this.calculateKolNetFlow(gmgnKol.value),
        
        // Risk
        bundlerRate: gmgnToken.value?.bundler_rate || 0,
        ratTraderRate: gmgnToken.value?.rat_trader_amount_rate || 0,
        sniperCount: gmgnToken.value?.sniper_count || 0,
        rugRatio: gmgnToken.value?.rug_ratio || 0,
        devHolderRate: gmgnToken.value?.dev_holder_rate || 0,
        top10HolderRate: gmgnToken.value?.top_10_holder_rate || 0,
        mintAuthorityRevoked: gmgnSecurity.value?.is_mint_authority_revoked || false,
        freezeAuthorityRevoked: gmgnSecurity.value?.is_freeze_authority_revoked || false,
        liquidityLocked: gmgnSecurity.value?.liquidity_locked || false,
        
        // Cross-chain
        chains: crossChain,
        
        // Narratives
        narratives,
        
        // Freshness
        lastUpdated: Date.now(),
        dataQuality: this.assessDataQuality(gmgnToken.value, gmgnSecurity.value, dexPairs.value),
      };

      this.setCached(cacheKey, intelligence);
      return intelligence;
    } catch (error) {
      console.error('[SmartMoneyIntel] Error fetching token intelligence:', error);
      return null;
    }
  }

  async getNarrativeClusters(): Promise<NarrativeCluster[]> {
    const cacheKey = 'narrative:clusters';
    const cached = this.getCached<NarrativeCluster[]>(cacheKey);
    if (cached) return cached;

    try {
      // Get trending tokens from multiple sources
      const [gmgnTrending, dexTrending, dexNewPairs] = await Promise.allSettled([
        this.fetchGmgnTrending('1h', 'smart_money', 50),
        this.fetchDexTrending(50),
        this.fetchDexNewPairs(50),
      ]);

      const allTokens = [
        ...(gmgnTrending.value || []),
        ...(dexTrending.value || []),
        ...(dexNewPairs.value || []),
      ];

      // Cluster by narrative
      const clusters = this.clusterByNarrative(allTokens);
      
      this.setCached(cacheKey, clusters);
      return clusters;
    } catch (error) {
      console.error('[SmartMoneyIntel] Error fetching narrative clusters:', error);
      return [];
    }
  }

  async getCrossChainTokens(tokenMints: string[]): Promise<CrossChainToken[]> {
    const results: CrossChainToken[] = [];
    
    for (const mint of tokenMints) {
      const crossChain = await this.fetchCrossChainPresence(mint, 'solana');
      if (crossChain.length > 1) {
        const primary = crossChain.find(c => c.isPrimary) || crossChain[0];
        const totalLiquidity = crossChain.reduce((sum, c) => sum + c.liquidityUsd, 0);
        const totalVolume = crossChain.reduce((sum, c) => sum + c.volume24h, 0);
        const avgPrice = crossChain.reduce((sum, c) => sum + c.priceUsd, 0) / crossChain.length;
        
        // Check for arbitrage
        const arbitrage = this.detectArbitrage(crossChain);
        
        results.push({
          tokenMint: mint,
          symbol: primary.symbol || '',
          name: primary.name || '',
          chains: crossChain,
          primaryChain: primary.chain,
          totalLiquidityUsd: totalLiquidity,
          totalVolume24h: totalVolume,
          priceUsd: avgPrice,
          arbitrageOpportunity: arbitrage,
        });
      }
    }
    
    return results;
  }

  async getSmartMoneyFeed(chain: string = 'solana', limit: number = 50): Promise<SmartMoneySignal[]> {
    const cacheKey = `smartfeed:${chain}:${limit}`;
    const cached = this.getCached<SmartMoneySignal[]>(cacheKey);
    if (cached) return cached;

    try {
      // This would call the GMGN CLI track smartmoney endpoint
      const signals = await this.fetchGmgnSmartMoneyFeed(chain, limit);
      
      this.setCached(cacheKey, signals);
      return signals;
    } catch (error) {
      console.error('[SmartMoneyIntel] Error fetching smart money feed:', error);
      return [];
    }
  }

  async getEmergingNarratives(limit: number = 10): Promise<NarrativeCluster[]> {
    const clusters = await this.getNarrativeClusters();
    
    // Filter for emerging narratives (started recently, high smart money inflow)
    const now = Date.now();
    const emerging = clusters
      .filter(c => 
        c.isEmerging && 
        c.startedAt > now - 7 * 24 * 60 * 60 * 1000 && // Last 7 days
        c.smartMoneyInflow24h > 10000 // Min $10k smart money inflow
      )
      .sort((a, b) => b.smartMoneyInflow24h - a.smartMoneyInflow24h)
      .slice(0, limit);
    
    return emerging;
  }

  // Private methods
  private async fetchGmgnToken(address: string, chain: string): Promise<any> {
    // Would call gmgn-cli token info
    return { status: 'fulfilled', value: null };
  }

  private async fetchGmgnSecurity(address: string, chain: string): Promise<any> {
    return { status: 'fulfilled', value: null };
  }

  private async fetchGmgnHolders(address: string, chain: string, limit: number): Promise<any> {
    return { status: 'fulfilled', value: null };
  }

  private async fetchGmgnTraders(address: string, chain: string, limit: number): Promise<any> {
    return { status: 'fulfilled', value: null };
  }

  private async fetchGmgnSmartMoney(address: string, chain: string, limit: number): Promise<any> {
    return { status: 'fulfilled', value: null };
  }

  private async fetchGmgnKol(address: string, chain: string, limit: number): Promise<any> {
    return { status: 'fulfilled', value: null };
  }

  private async fetchGmgnTrending(timeframe: string, orderBy: string, limit: number): Promise<any> {
    return { status: 'fulfilled', value: [] };
  }

  private async fetchGmgnSmartMoneyFeed(chain: string, limit: number): Promise<SmartMoneySignal[]> {
    return [];
  }

  private async fetchDexPairs(address: string, chain: string): Promise<any> {
    return { status: 'fulfilled', value: null };
  }

  private async fetchDexTrending(limit: number): Promise<any> {
    return { status: 'fulfilled', value: [] };
  }

  private async fetchDexNewPairs(limit: number): Promise<any> {
    return { status: 'fulfilled', value: [] };
  }

  private async fetchCrossChainPresence(tokenMint: string, primaryChain: string): Promise<ChainPresence[]> {
    const chains: ChainPresence[] = [];
    
    // Primary chain
    chains.push({
      chain: primaryChain,
      tokenMint,
      symbol: '',
      name: '',
      priceUsd: 0,
      liquidityUsd: 0,
      volume24h: 0,
      holders: 0,
      dexCount: 0,
      isPrimary: true,
    });

    // Check other chains (would query each chain's DexScreener/API)
    for (const [chainId, chainInfo] of Object.entries(this.CHAINS)) {
      if (chainId === primaryChain) continue;
      
      // Would query chain-specific API
      // For now, return empty
    }
    
    return chains;
  }

  private calculateNetFlow(signals: any, side: 'buy' | 'sell'): number {
    if (!signals || !Array.isArray(signals)) return 0;
    return signals
      .filter((s: any) => s.type === side)
      .reduce((sum: number, s: any) => sum + (s.amount_usd || 0), 0);
  }

  private countUniqueWallets(signals: any, side: 'buy' | 'sell'): number {
    if (!signals || !Array.isArray(signals)) return 0;
    const wallets = new Set(
      signals
        .filter((s: any) => s.type === side)
        .map((s: any) => s.address)
    );
    return wallets.size;
  }

  private extractTopSmartMoneyHolders(holders: any): SmartMoneyHolder[] {
    if (!holders || !Array.isArray(holders)) return [];
    return holders
      .filter((h: any) => h.is_smart_money)
      .slice(0, 10)
      .map((h: any) => ({
        address: h.address,
        label: h.label,
        tags: h.tags || [],
        balance: h.balance || 0,
        valueUsd: h.value_usd || 0,
        pnl30d: h.pnl_30d || 0,
        winRate: h.win_rate || 0,
        recentActivity: [],
      }));
  }

  private extractKolHolders(kols: any): KolHolder[] {
    if (!kols || !Array.isArray(kols)) return [];
    return kols.slice(0, 10).map((k: any) => ({
      address: k.address,
      twitterHandle: k.twitter_handle || '',
      twitterName: k.twitter_name || '',
      followers: k.followers || 0,
      balance: k.balance || 0,
      valueUsd: k.value_usd || 0,
      avgBuyPrice: k.avg_buy_price,
      pnlUsd: k.pnl_usd,
      lastBuyTs: k.last_buy_ts,
    }));
  }

  private calculateKolNetFlow(kols: any): number {
    if (!kols || !Array.isArray(kols)) return 0;
    return kols.reduce((sum: number, k: any) => sum + (k.buy_usd || 0) - (k.sell_usd || 0), 0);
  }

  private detectNarratives(
    symbol: string,
    name: string,
    smartMoney: any,
    kols: any,
    crossChain: ChainPresence[]
  ): NarrativeTag[] {
    const narratives: NarrativeTag[] = [];
    const text = `${symbol} ${name}`.toLowerCase();
    const now = Date.now();

    for (const [category, keywords] of Object.entries(this.NARRATIVE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          const strength = this.calculateNarrativeStrength(
            category as NarrativeTag['category'],
            smartMoney,
            kols,
            crossChain
          );
          
          narratives.push({
            name: this.formatNarrativeName(category, keyword),
            category: category as NarrativeTag['category'],
            strength,
            relatedTokens: [], // Would populate from cluster
            description: `${category} narrative detected via "${keyword}"`,
            startedAt: now - Math.random() * 30 * 24 * 60 * 60 * 1000,
            trending: strength > 70,
          });
        }
      }
    }

    // Smart money narrative
    if (smartMoney && Array.isArray(smartMoney) && smartMoney.length > 5) {
      narratives.push({
        name: 'Smart Money Accumulation',
        category: 'trend',
        strength: Math.min(100, smartMoney.length * 5),
        relatedTokens: [],
        description: 'Multiple smart money wallets accumulating',
        startedAt: now - Math.random() * 7 * 24 * 60 * 60 * 1000,
        trending: true,
      });
    }

    // KOL narrative
    if (kols && Array.isArray(kols) && kols.length > 3) {
      narratives.push({
        name: 'KOL Interest',
        category: 'trend',
        strength: Math.min(100, kols.length * 10),
        relatedTokens: [],
        description: `${kols.length} KOLs holding position`,
        startedAt: now - Math.random() * 14 * 24 * 60 * 60 * 1000,
        trending: kols.length > 5,
      });
    }

    return narratives.slice(0, 5); // Top 5 narratives
  }

  private calculateNarrativeStrength(
    category: NarrativeTag['category'],
    smartMoney: any,
    kols: any,
    crossChain: ChainPresence[]
  ): number {
    let strength = 30; // Base

    if (smartMoney && Array.isArray(smartMoney)) {
      strength += Math.min(30, smartMoney.length * 2);
    }
    if (kols && Array.isArray(kols)) {
      strength += Math.min(20, kols.length * 3);
    }
    if (crossChain.length > 1) {
      strength += 15; // Multi-chain presence
    }

    return Math.min(100, strength);
  }

  private formatNarrativeName(category: string, keyword: string): string {
    const formatted = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    return `${formatted} (${category})`;
  }

  private clusterByNarrative(tokens: any[]): NarrativeCluster[] {
    const clusters = new Map<string, NarrativeCluster>();
    
    for (const token of tokens) {
      // Determine primary narrative for this token
      const primaryNarrative = this.getPrimaryNarrative(token);
      if (!primaryNarrative) continue;

      const clusterId = `${primaryNarrative.category}:${primaryNarrative.name}`;
      
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, {
          id: clusterId,
          name: primaryNarrative.name,
          description: primaryNarrative.description,
          category: primaryNarrative.category,
          tokens: [],
          totalMarketCap: 0,
          totalVolume24h: 0,
          avgPriceChange24h: 0,
          smartMoneyInflow24h: 0,
          topNarratives: [primaryNarrative],
          startedAt: primaryNarrative.startedAt,
          isEmerging: primaryNarrative.trending,
        });
      }

      const cluster = clusters.get(clusterId)!;
      cluster.tokens.push({
        tokenMint: token.address || token.token_address || '',
        symbol: token.symbol || '',
        name: token.name || '',
        priceUsd: token.price || 0,
        marketCap: token.market_cap || 0,
        volume24h: token.volume_24h || 0,
        priceChange24h: token.price_change_24h || 0,
        smartMoneyInflow: token.smart_money_inflow_24h || 0,
        narrativeRelevance: primaryNarrative.strength,
      });
      cluster.totalMarketCap += token.market_cap || 0;
      cluster.totalVolume24h += token.volume_24h || 0;
      cluster.smartMoneyInflow24h += token.smart_money_inflow_24h || 0;
    }

    // Calculate averages and sort
    for (const cluster of clusters.values()) {
      if (cluster.tokens.length > 0) {
        cluster.avgPriceChange24h = cluster.tokens.reduce((sum, t) => sum + t.priceChange24h, 0) / cluster.tokens.length;
      }
    }

    return Array.from(clusters.values())
      .filter(c => c.tokens.length >= 2) // Min 2 tokens per cluster
      .sort((a, b) => b.smartMoneyInflow24h - a.smartMoneyInflow24h);
  }

  private getPrimaryNarrative(token: any): NarrativeTag | null {
    const narratives = this.detectNarratives(
      token.symbol || '',
      token.name || '',
      null, null, []
    );
    return narratives.length > 0 ? narratives[0] : null;
  }

  private detectArbitrage(chains: ChainPresence[]): ArbitrageSignal | undefined {
    if (chains.length < 2) return undefined;

    let maxSpread = 0;
    let bestSignal: ArbitrageSignal | null = null;

    for (let i = 0; i < chains.length; i++) {
      for (let j = i + 1; j < chains.length; j++) {
        const spread = Math.abs(chains[i].priceUsd - chains[j].priceUsd);
        const avgPrice = (chains[i].priceUsd + chains[j].priceUsd) / 2;
        const spreadPct = avgPrice > 0 ? (spread / avgPrice) * 100 : 0;

        if (spreadPct > maxSpread && spreadPct > 0.5) { // Min 0.5% spread
          maxSpread = spreadPct;
          const buyChain = chains[i].priceUsd < chains[j].priceUsd ? chains[i] : chains[j];
          const sellChain = chains[i].priceUsd < chains[j].priceUsd ? chains[j] : chains[i];
          
          bestSignal = {
            buyChain: buyChain.chain,
            sellChain: sellChain.chain,
            buyPrice: buyChain.priceUsd,
            sellPrice: sellChain.priceUsd,
            spreadPct,
            estimatedProfitUsd: spread * 1000, // Rough estimate for $1000 trade
            confidence: Math.min(90, spreadPct * 10),
          };
        }
      }
    }

    return bestSignal || undefined;
  }

  private assessDataQuality(gmgnToken: any, gmgnSecurity: any, dexPairs: any): 'high' | 'medium' | 'low' {
    let score = 0;
    if (gmgnToken) score += 40;
    if (gmgnSecurity) score += 30;
    if (dexPairs) score += 30;
    
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCached<T>(key: string, data: T): void {
    if (this.cache.size > 500) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// Singleton
let smartMoneyIntelInstance: SmartMoneyIntelligence | null = null;

export function getSmartMoneyIntelligence(): SmartMoneyIntelligence {
  if (!smartMoneyIntelInstance) {
    smartMoneyIntelInstance = new SmartMoneyIntelligence();
  }
  return smartMoneyIntelInstance;
}

// React hook
export function useSmartMoneyIntelligence() {
  const intel = getSmartMoneyIntelligence();

  return {
    getTokenIntelligence: (tokenMint: string, chain?: string) => intel.getTokenIntelligence(tokenMint, chain),
    getNarrativeClusters: () => intel.getNarrativeClusters(),
    getCrossChainTokens: (tokenMints: string[]) => intel.getCrossChainTokens(tokenMints),
    getSmartMoneyFeed: (chain?: string, limit?: number) => intel.getSmartMoneyFeed(chain, limit),
    getEmergingNarratives: (limit?: number) => intel.getEmergingNarratives(limit),
  };
}

export type {
  SmartMoneySignal,
  TokenIntelligence,
  SmartMoneyHolder,
  KolHolder,
  ChainPresence,
  NarrativeTag,
  NarrativeCluster,
  ClusterToken,
  CrossChainToken,
  ArbitrageSignal,
};