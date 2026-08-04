/**
 * Cross-DEX Arbitrage Scanner
 * Detects price differences across Raydium, Orca, Meteora, Phoenix, Lifinity
 */

export interface ArbitrageOpportunity {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number; // Percentage profit after fees
  estimatedProfitUsd: number;
  maxTradeSizeUsd: number; // Limited by liquidity
  buyPoolAddress: string;
  sellPoolAddress: string;
  timestamp: number;
  confidence: number; // 0-100
  route: string[]; // e.g., ['Raydium', 'Orca']
  fees: {
    buyFeeBps: number;
    sellFeeBps: number;
    totalFeeBps: number;
    estimatedFeeUsd: number;
  };
  risks: string[];
}

export interface DexPool {
  dex: string;
  poolAddress: string;
  tokenA: { mint: string; symbol: string; amount: number };
  tokenB: { mint: string; symbol: string; amount: number };
  price: number; // TokenA per TokenB
  liquidityUsd: number;
  feeBps: number;
  lastUpdate: number;
}

export interface ArbitrageStats {
  totalOpportunities24h: number;
  totalEstimatedProfit24h: number;
  avgSpreadPct: number;
  topPairs: { pair: string; count: number; avgSpread: number }[];
  topDexes: { dex: string; count: number; avgSpread: number }[];
  bestOpportunity: ArbitrageOpportunity | null;
}

class ArbitrageScanner {
  private cache: Map<string, { opportunities: ArbitrageOpportunity[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 10000; // 10 seconds (fast for arb)
  private poolsCache: Map<string, DexPool[]> = new Map();
  private readonly POOLS_CACHE_TTL = 30000; // 30 seconds
  private listeners: Set<(opportunities: ArbitrageOpportunity[]) => void> = new Set();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  // DEX fee tiers (basis points)
  private readonly DEX_FEES: Record<string, number> = {
    'raydium': 25,    // 0.25%
    'orca': 30,       // 0.3% (Whirlpool standard)
    'meteora': 10,    // 0.1% (dynamic, can be lower)
    'phoenix': 5,     // 0.05% (CLOB)
    'lifinity': 20,   // 0.2%
    'openbook': 20,   // 0.2% (Serum)
  };

  async getOpportunities(
    tokenMints?: string[],
    minSpreadPct: number = 0.5,
    minProfitUsd: number = 10
  ): Promise<ArbitrageOpportunity[]> {
    const cacheKey = `arb-${tokenMints?.join(',') || 'all'}-${minSpreadPct}-${minProfitUsd}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.opportunities.filter(o => 
        o.spreadPct >= minSpreadPct && o.estimatedProfitUsd >= minProfitUsd
      );
    }

    try {
      // Fetch pools from all DEXes
      const allPools = await this.fetchAllPools();
      
      // Find arbitrage opportunities
      const opportunities = this.findArbitrageOpportunities(allPools, minSpreadPct, minProfitUsd);
      
      // Filter by token mints if specified
      const filtered = tokenMints 
        ? opportunities.filter(o => tokenMints.includes(o.tokenMint))
        : opportunities;

      this.cache.set(cacheKey, { opportunities: filtered, timestamp: Date.now() });
      
      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener(filtered);
        } catch (error) {
          console.error('[Arbitrage] Listener error:', error);
        }
      }
      
      return filtered;
    } catch (error) {
      console.error('[Arbitrage Scanner] Error:', error);
      return [];
    }
  }

  async getArbitrageStats(timeRangeHours: number = 24): Promise<ArbitrageStats> {
    const opportunities = await this.getOpportunities(undefined, 0.1, 1);
    
    const pairMap = new Map<string, { count: number; spreads: number[] }>();
    const dexMap = new Map<string, { count: number; spreads: number[] }>();
    
    for (const opp of opportunities) {
      const pairKey = `${opp.buyDex}→${opp.sellDex}`;
      const existing = pairMap.get(pairKey) || { count: 0, spreads: [] };
      existing.count++;
      existing.spreads.push(opp.spreadPct);
      pairMap.set(pairKey, existing);
      
      [opp.buyDex, opp.sellDex].forEach(dex => {
        const d = dexMap.get(dex) || { count: 0, spreads: [] };
        d.count++;
        d.spreads.push(opp.spreadPct);
        dexMap.set(dex, d);
      });
    }

    return {
      totalOpportunities24h: opportunities.length,
      totalEstimatedProfit24h: opportunities.reduce((sum, o) => sum + o.estimatedProfitUsd, 0),
      avgSpreadPct: opportunities.length > 0 
        ? opportunities.reduce((sum, o) => sum + o.spreadPct, 0) / opportunities.length 
        : 0,
      topPairs: Array.from(pairMap.entries())
        .map(([pair, data]) => ({ 
          pair, 
          count: data.count, 
          avgSpread: data.spreads.reduce((a, b) => a + b, 0) / data.count 
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topDexes: Array.from(dexMap.entries())
        .map(([dex, data]) => ({ 
          dex, 
          count: data.count, 
          avgSpread: data.spreads.reduce((a, b) => a + b, 0) / data.count 
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      bestOpportunity: opportunities.length > 0 ? opportunities[0] : null,
    };
  }

  subscribe(callback: (opportunities: ArbitrageOpportunity[]) => void): () => void {
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
      const opportunities = await this.getOpportunities(undefined, 0.3, 5);
      if (opportunities.length > 0) {
        for (const listener of this.listeners) {
          try {
            listener(opportunities);
          } catch (error) {
            console.error('[Arbitrage] Listener error:', error);
          }
        }
      }
    };
    
    poll();
    this.pollingInterval = setInterval(poll, 15000); // Poll every 15s
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  private async fetchAllPools(): Promise<DexPool[]> {
    const cacheKey = 'all-pools';
    const cached = this.poolsCache.get(cacheKey);
    
    if (cached && Date.now() - this.getPoolsCacheTimestamp() < this.POOLS_CACHE_TTL) {
      return cached;
    }

    const allPools: DexPool[] = [];
    
    // Fetch from DexScreener (covers most DEXes)
    try {
      const response = await fetch(
        'https://api.dexscreener.com/latest/dex/pairs/solana',
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (response.ok) {
        const data = await response.json();
        const pairs = data.pairs || [];
        
        // Filter and normalize
        for (const pair of pairs) {
          if (pair.chainId !== 'solana') continue;
          if (!pair.baseToken?.address || !pair.quoteToken?.address) continue;
          
          // Only SOL pairs for now
          if (pair.quoteToken.symbol !== 'SOL' && pair.quoteToken.symbol !== 'USDC') continue;
          
          const dex = pair.dexId?.toLowerCase() || 'unknown';
          const feeBps = this.DEX_FEES[dex] || 30;
          
          allPools.push({
            dex: dex.charAt(0).toUpperCase() + dex.slice(1),
            poolAddress: pair.pairAddress,
            tokenA: {
              mint: pair.baseToken.address,
              symbol: pair.baseToken.symbol,
              amount: pair.liquidity?.base || 0,
            },
            tokenB: {
              mint: pair.quoteToken.address,
              symbol: pair.quoteToken.symbol,
              amount: pair.liquidity?.quote || 0,
            },
            price: parseFloat(pair.priceNative || '0'),
            liquidityUsd: pair.liquidity?.usd || 0,
            feeBps,
            lastUpdate: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('[Arbitrage] DexScreener fetch failed:', error);
    }
    
    // Cache
    this.poolsCache.set(cacheKey, allPools);
    this.setPoolsCacheTimestamp(Date.now());
    
    return allPools;
  }

  private poolsCacheTimestamp = 0;
  private getPoolsCacheTimestamp() { return this.poolsCacheTimestamp; }
  private setPoolsCacheTimestamp(ts: number) { this.poolsCacheTimestamp = ts; }

  private findArbitrageOpportunities(
    pools: DexPool[],
    minSpreadPct: number,
    minProfitUsd: number
  ): ArbitrageOpportunity[] {
    // Group pools by token pair (tokenA/tokenB)
    const poolsByPair = new Map<string, DexPool[]>();
    
    for (const pool of pools) {
      // Normalize pair key (always smaller mint first)
      const mints = [pool.tokenA.mint, pool.tokenB.mint].sort();
      const pairKey = `${mints[0]}/${mints[1]}`;
      
      if (!poolsByPair.has(pairKey)) {
        poolsByPair.set(pairKey, []);
      }
      poolsByPair.get(pairKey)!.push(pool);
    }

    const opportunities: ArbitrageOpportunity[] = [];

    // For each pair, check all DEX combinations
    for (const [pairKey, pairPools] of poolsByPair) {
      if (pairPools.length < 2) continue; // Need at least 2 DEXes
      
      // Get unique DEXes
      const dexes = [...new Set(pairPools.map(p => p.dex))];
      if (dexes.length < 2) continue;
      
      // Check all buy/sell combinations
      for (let i = 0; i < pairPools.length; i++) {
        for (let j = 0; j < pairPools.length; j++) {
          if (i === j) continue;
          if (pairPools[i].dex === pairPools[j].dex) continue; // Same DEX
          
          const buyPool = pairPools[i];
          const sellPool = pairPools[j];
          
          // Ensure we're comparing same direction (both tokenA/tokenB or both tokenB/tokenA)
          const buyPrice = buyPool.price;
          const sellPrice = sellPool.price;
          
          if (buyPrice <= 0 || sellPrice <= 0) continue;
          
          // Calculate spread (sell higher than buy = profit)
          const rawSpread = (sellPrice - buyPrice) / buyPrice * 100;
          
          // Account for fees
          const totalFeeBps = buyPool.feeBps + sellPool.feeBps;
          const feeImpact = totalFeeBps / 100; // Convert to percentage
          const netSpread = rawSpread - feeImpact;
          
          if (netSpread < minSpreadPct) continue;
          
          // Calculate max trade size (limited by liquidity)
          const maxBuySizeUsd = buyPool.liquidityUsd * 0.1; // Max 10% of pool
          const maxSellSizeUsd = sellPool.liquidityUsd * 0.1;
          const maxTradeSizeUsd = Math.min(maxBuySizeUsd, maxSellSizeUsd, 50000); // Cap at $50k
          
          if (maxTradeSizeUsd < 100) continue; // Too small
          
          // Estimate profit
          const estimatedProfitUsd = maxTradeSizeUsd * (netSpread / 100);
          if (estimatedProfitUsd < minProfitUsd) continue;
          
          // Determine token symbol
          const tokenMint = buyPool.tokenA.mint;
          const tokenSymbol = buyPool.tokenA.symbol;
          
          // Confidence based on liquidity and spread
          const liquidityScore = Math.min(100, (buyPool.liquidityUsd + sellPool.liquidityUsd) / 200000 * 50);
          const spreadScore = Math.min(100, netSpread * 20);
          const confidence = Math.round((liquidityScore + spreadScore) / 2);
          
          // Risks
          const risks: string[] = [];
          if (buyPool.liquidityUsd < 50000) risks.push('Low buy-side liquidity');
          if (sellPool.liquidityUsd < 50000) risks.push('Low sell-side liquidity');
          if (totalFeeBps > 50) risks.push('High combined fees');
          if (netSpread > 5) risks.push('Unusually large spread - verify prices');
          
          opportunities.push({
            id: `arb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            tokenMint,
            tokenSymbol,
            buyDex: buyPool.dex,
            sellDex: sellPool.dex,
            buyPrice,
            sellPrice,
            spreadPct: netSpread,
            estimatedProfitUsd,
            maxTradeSizeUsd,
            buyPoolAddress: buyPool.poolAddress,
            sellPoolAddress: sellPool.poolAddress,
            timestamp: Date.now(),
            confidence,
            route: [buyPool.dex, sellPool.dex],
            fees: {
              buyFeeBps: buyPool.feeBps,
              sellFeeBps: sellPool.feeBps,
              totalFeeBps,
              estimatedFeeUsd: maxTradeSizeUsd * (totalFeeBps / 10000),
            },
            risks,
          });
        }
      }
    }

    // Sort by estimated profit descending
    return opportunities.sort((a, b) => b.estimatedProfitUsd - a.estimatedProfitUsd);
  }

  // Calculate optimal trade size for maximum profit (considering price impact)
  calculateOptimalTradeSize(opportunity: ArbitrageOpportunity): number {
    // Simplified: use 50% of max size to reduce price impact
    return opportunity.maxTradeSizeUsd * 0.5;
  }

  // Simulate arbitrage execution with price impact
  simulateExecution(opportunity: ArbitrageOpportunity, tradeSizeUsd: number): {
    expectedProfitUsd: number;
    priceImpactBuy: number;
    priceImpactSell: number;
    netSpread: number;
    success: boolean;
  } {
    // Simplified AMM price impact model
    // priceImpact ≈ tradeSize / liquidity * feeMultiplier
    const buyImpact = (tradeSizeUsd / opportunity.buyPrice) / 
      (opportunity.buyPrice * opportunity.maxTradeSizeUsd / opportunity.buyPrice) * 0.01;
    const sellImpact = (tradeSizeUsd / opportunity.sellPrice) / 
      (opportunity.sellPrice * opportunity.maxTradeSizeUsd / opportunity.sellPrice) * 0.01;
    
    const adjustedBuyPrice = opportunity.buyPrice * (1 + buyImpact);
    const adjustedSellPrice = opportunity.sellPrice * (1 - sellImpact);
    const adjustedSpread = (adjustedSellPrice - adjustedBuyPrice) / adjustedBuyPrice * 100;
    
    const totalFees = tradeSizeUsd * (opportunity.fees.totalFeeBps / 10000);
    const expectedProfit = tradeSizeUsd * (adjustedSpread / 100) - totalFees;
    
    return {
      expectedProfitUsd: expectedProfit,
      priceImpactBuy: buyImpact * 100,
      priceImpactSell: sellImpact * 100,
      netSpread: adjustedSpread,
      success: expectedProfit > 0,
    };
  }
}

// Singleton
let arbitrageScannerInstance: ArbitrageScanner | null = null;

export function getArbitrageScanner(): ArbitrageScanner {
  if (!arbitrageScannerInstance) {
    arbitrageScannerInstance = new ArbitrageScanner();
  }
  return arbitrageScannerInstance;
}

// React hook
export function useArbitrageScanner(tokenMints?: string[]) {
  const scanner = getArbitrageScanner();
  
  return {
    getOpportunities: (minSpreadPct?: number, minProfitUsd?: number) => 
      scanner.getOpportunities(tokenMints, minSpreadPct, minProfitUsd),
    getStats: (timeRangeHours?: number) => 
      scanner.getArbitrageStats(timeRangeHours),
    subscribe: (callback: (opportunities: ArbitrageOpportunity[]) => void) => 
      scanner.subscribe(callback),
    calculateOptimalSize: (opp: ArbitrageOpportunity) => 
      scanner.calculateOptimalTradeSize(opp),
    simulate: (opp: ArbitrageOpportunity, size: number) => 
      scanner.simulateExecution(opp, size),
  };
}

export type { ArbitrageOpportunity, DexPool, ArbitrageStats };