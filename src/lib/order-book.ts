/**
 * Order Book Depth (L2) Visualization
 * Aggregated bids/asks from top 5 DEXes on Solana
 */

export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number; // Cumulative amount
  valueUsd: number; // Cumulative USD value
}

export interface OrderBookSnapshot {
  tokenId: string;
  symbol: string;
  bids: OrderBookLevel[]; // Sorted descending (highest bid first)
  asks: OrderBookLevel[]; // Sorted ascending (lowest ask first)
  spread: number; // In basis points
  spreadUsd: number; // In USD
  timestamp: number;
  source: string;
  dexes: string[]; // Which DEXes contributed
}

export interface PoolLiquidity {
  dex: string;
  poolAddress: string;
  tokenA: { mint: string; symbol: string; amount: number };
  tokenB: { mint: string; symbol: string; amount: number };
  price: number; // TokenA per TokenB
  liquidityUsd: number;
  feeBps: number;
}

class OrderBookAggregator {
  private cache: Map<string, { snapshot: OrderBookSnapshot; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds
  private readonly MAX_DEXES = 5;
  private readonly DEPTH_LEVELS = 50;

  async getOrderBook(tokenMint: string, quoteMint: string = 'So11111111111111111111111111111111111111112'): Promise<OrderBookSnapshot | null> {
    const cacheKey = `${tokenMint}-${quoteMint}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.snapshot;
    }

    try {
      // Fetch pools from multiple DEXes
      const pools = await this.fetchPoolsFromDexes(tokenMint, quoteMint);
      
      if (pools.length === 0) {
        return null;
      }

      // Aggregate order books from all pools
      const snapshot = this.aggregateOrderBooks(tokenMint, pools);
      
      // Cache the result
      this.cache.set(cacheKey, { snapshot, timestamp: Date.now() });
      
      return snapshot;
    } catch (error) {
      console.error('[OrderBook] Failed to fetch:', error);
      return null;
    }
  }

  private async fetchPoolsFromDexes(tokenMint: string, quoteMint: string): Promise<PoolLiquidity[]> {
    const pools: PoolLiquidity[] = [];
    
    // In production, fetch from each DEX API:
    // - Raydium: https://api.raydium.io/v2/main/pairs
    // - Orca: https://api.orca.so/v1/whirlpools
    // - Meteora: https://dlob-api.meteora.ag/pairs
    // - Lifinity: https://api.lifinity.io/v1/pools
    // - Phoenix: https://api.phoenix.trade/v1/markets
    
    // For now, use DexScreener to get top pools
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/solana/${tokenMint}`,
        { signal: AbortSignal.timeout(8000) }
      );
      
      if (!response.ok) return pools;
      
      const data = await response.json();
      const pairs = data.pairs || [];
      
      // Filter for SOL/USDC pairs and sort by liquidity
      const solPairs = pairs
        .filter((p: any) => p.chainId === 'solana' && p.quoteToken?.symbol === 'SOL')
        .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
        .slice(0, this.MAX_DEXES);
      
      for (const pair of solPairs) {
        pools.push({
          dex: pair.dexId || 'unknown',
          poolAddress: pair.pairAddress,
          tokenA: {
            mint: pair.baseToken?.address || '',
            symbol: pair.baseToken?.symbol || '',
            amount: pair.liquidity?.base || 0,
          },
          tokenB: {
            mint: pair.quoteToken?.address || '',
            symbol: pair.quoteToken?.symbol || '',
            amount: pair.liquidity?.quote || 0,
          },
          price: parseFloat(pair.priceNative || '0'),
          liquidityUsd: pair.liquidity?.usd || 0,
          feeBps: this.estimateFeeBps(pair.dexId),
        });
      }
    } catch (error) {
      console.error('[OrderBook] DexScreener fetch failed:', error);
    }
    
    return pools;
  }

  private estimateFeeBps(dexId?: string): number {
    const fees: Record<string, number> = {
      'raydium': 25, // 0.25%
      'orca': 30, // 0.3%
      'meteora': 10, // 0.1% (dynamic)
      'lifinity': 20, // 0.2%
      'phoenix': 5, // 0.05% (CLOB)
    };
    return fees[dexId?.toLowerCase() || ''] || 30;
  }

  private aggregateOrderBooks(tokenMint: string, pools: PoolLiquidity[]): OrderBookSnapshot {
    // For AMM pools, we simulate order book depth from liquidity curves
    // Real CLOB (Phoenix, OpenBook) would provide actual L2 data
    
    const allBids: OrderBookLevel[] = [];
    const allAsks: OrderBookLevel[] = [];
    
    // Use the highest liquidity pool as reference price
    const mainPool = pools[0];
    const midPrice = mainPool.price;
    
    // Aggregate liquidity across pools to build depth
    const totalLiquidityUsd = pools.reduce((sum, p) => sum + p.liquidityUsd, 0);
    
    // Generate bid levels (below mid price)
    let bidCumulative = 0;
    let bidCumulativeUsd = 0;
    for (let i = 0; i < this.DEPTH_LEVELS; i++) {
      const priceImpact = (i + 1) * 0.001; // 0.1% per level
      const price = midPrice * (1 - priceImpact);
      
      // Amount available at this price (simplified AMM curve)
      const amount = (totalLiquidityUsd / midPrice) * 0.02 * Math.exp(-i * 0.1);
      bidCumulative += amount;
      bidCumulativeUsd += amount * price;
      
      allBids.push({
        price,
        amount,
        total: bidCumulative,
        valueUsd: bidCumulativeUsd,
      });
    }
    
    // Generate ask levels (above mid price)
    let askCumulative = 0;
    let askCumulativeUsd = 0;
    for (let i = 0; i < this.DEPTH_LEVELS; i++) {
      const priceImpact = (i + 1) * 0.001;
      const price = midPrice * (1 + priceImpact);
      
      const amount = (totalLiquidityUsd / midPrice) * 0.02 * Math.exp(-i * 0.1);
      askCumulative += amount;
      askCumulativeUsd += amount * price;
      
      allAsks.push({
        price,
        amount,
        total: askCumulative,
        valueUsd: askCumulativeUsd,
      });
    }
    
    // Calculate spread
    const bestBid = allBids[0]?.price || midPrice;
    const bestAsk = allAsks[0]?.price || midPrice;
    const spread = ((bestAsk - bestBid) / midPrice) * 10000; // basis points
    const spreadUsd = bestAsk - bestBid;
    
    return {
      tokenId: tokenMint,
      symbol: mainPool.tokenA.symbol,
      bids: allBids,
      asks: allAsks,
      spread,
      spreadUsd,
      timestamp: Date.now(),
      source: 'aggregated-amm',
      dexes: pools.map(p => p.dex),
    };
  }

  // Calculate slippage for a given order size
  calculateSlippage(snapshot: OrderBookSnapshot, side: 'buy' | 'sell', amountUsd: number): number {
    const levels = side === 'buy' ? snapshot.asks : snapshot.bids;
    let remaining = amountUsd;
    let weightedPriceSum = 0;
    let totalAmount = 0;
    
    for (const level of levels) {
      const levelValueUsd = level.amount * level.price;
      const take = Math.min(remaining, levelValueUsd);
      const takeAmount = take / level.price;
      
      weightedPriceSum += takeAmount * level.price;
      totalAmount += takeAmount;
      remaining -= take;
      
      if (remaining <= 0) break;
    }
    
    if (totalAmount === 0) return 0;
    
    const avgPrice = weightedPriceSum / totalAmount;
    const midPrice = (snapshot.bids[0]?.price + snapshot.asks[0]?.price) / 2;
    
    return side === 'buy' 
      ? ((avgPrice - midPrice) / midPrice) * 100 
      : ((midPrice - avgPrice) / midPrice) * 100;
  }

  // Get price impact for multiple order sizes (for UI slider)
  getPriceImpactCurve(snapshot: OrderBookSnapshot, side: 'buy' | 'sell', sizesUsd: number[]): number[] {
    return sizesUsd.map(size => this.calculateSlippage(snapshot, side, size));
  }
}

// Singleton
let orderBookAggregatorInstance: OrderBookAggregator | null = null;

export function getOrderBookAggregator(): OrderBookAggregator {
  if (!orderBookAggregatorInstance) {
    orderBookAggregatorInstance = new OrderBookAggregator();
  }
  return orderBookAggregatorInstance;
}

// React hook
export function useOrderBook(tokenMint: string, quoteMint?: string) {
  const aggregator = getOrderBookAggregator();
  
  return {
    getSnapshot: () => aggregator.getOrderBook(tokenMint, quoteMint),
    calculateSlippage: (snapshot: OrderBookSnapshot, side: 'buy' | 'sell', amountUsd: number) => 
      aggregator.calculateSlippage(snapshot, side, amountUsd),
    getPriceImpactCurve: (snapshot: OrderBookSnapshot, side: 'buy' | 'sell', sizes: number[]) =>
      aggregator.getPriceImpactCurve(snapshot, side, sizes),
  };
}

export type { OrderBookLevel, OrderBookSnapshot, PoolLiquidity };