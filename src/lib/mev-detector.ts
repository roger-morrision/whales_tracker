/**
 * MEV/Sandwich Attack Detection
 * Monitors mempool for sandwich attacks and MEV activity
 */

export interface MevAttack {
  id: string;
  type: 'sandwich' | 'backrun' | 'frontrun' | 'arbitrage' | 'liquidation';
  tokenMint: string;
  tokenSymbol: string;
  victimTxHash: string;
  attackerTxHashes: string[];
  blockNumber: number;
  timestamp: number;
  profitUsd: number;
  victimLossUsd: number;
  dex: string;
  poolAddress: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: {
    victimAmountIn: number;
    victimAmountOut: number;
    attackerAmountIn: number;
    attackerAmountOut: number;
    priceImpact: number;
  };
}

export interface MevStats {
  totalAttacks24h: number;
  totalProfit24h: number;
  totalVictimLoss24h: number;
  attacksByType: Record<string, number>;
  topAttackers: { address: string; profitUsd: number; count: number }[];
  topVictims: { address: string; lossUsd: number; count: number }[];
  mostTargetedTokens: { symbol: string; attackCount: number; totalLossUsd: number }[];
  dexBreakdown: { dex: string; count: number; profitUsd: number }[];
}

class MevDetector {
  private cache: Map<string, { attacks: MevAttack[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private listeners: Set<(attacks: MevAttack[]) => void> = new Set();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  async getRecentAttacks(
    tokenMint?: string,
    limit: number = 50,
    timeRangeHours: number = 24
  ): Promise<MevAttack[]> {
    const cacheKey = `attacks-${tokenMint || 'all'}-${limit}-${timeRangeHours}h`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.attacks;
    }

    try {
      // In production, this would query a mempool indexer like:
      // - Helius Enhanced Transactions API
      // - QuickNode Mempool API
      // - Jito MEV Explorer API
      // - EigenPhi MEV API
      // - Custom Solana RPC with geyser plugin
      
      // For now, simulate with realistic data
      const attacks = this.generateMockAttacks(tokenMint, limit, timeRangeHours);
      
      this.cache.set(cacheKey, { attacks, timestamp: Date.now() });
      return attacks;
    } catch (error) {
      console.error('[MEV Detector] Failed to fetch attacks:', error);
      return [];
    }
  }

  async getMevStats(timeRangeHours: number = 24): Promise<MevStats> {
    const attacks = await this.getRecentAttacks(undefined, 500, timeRangeHours);
    
    const attacksByType: Record<string, number> = {};
    const attackerMap = new Map<string, { profitUsd: number; count: number }>();
    const victimMap = new Map<string, { lossUsd: number; count: number }>();
    const tokenMap = new Map<string, { attackCount: number; totalLossUsd: number }>();
    const dexMap = new Map<string, { count: number; profitUsd: number }>();

    for (const attack of attacks) {
      attacksByType[attack.type] = (attacksByType[attack.type] || 0) + 1;
      
      for (const attackerHash of attack.attackerTxHashes) {
        const existing = attackerMap.get(attackerHash) || { profitUsd: 0, count: 0 };
        existing.profitUsd += attack.profitUsd / attack.attackerTxHashes.length;
        existing.count += 1;
        attackerMap.set(attackerHash, existing);
      }
      
      const victimKey = attack.victimTxHash.slice(0, 8);
      const vExisting = victimMap.get(victimKey) || { lossUsd: 0, count: 0 };
      vExisting.lossUsd += attack.victimLossUsd;
      vExisting.count += 1;
      victimMap.set(victimKey, vExisting);
      
      const tokenExisting = tokenMap.get(attack.tokenSymbol) || { attackCount: 0, totalLossUsd: 0 };
      tokenExisting.attackCount += 1;
      tokenExisting.totalLossUsd += attack.victimLossUsd;
      tokenMap.set(attack.tokenSymbol, tokenExisting);
      
      const dexExisting = dexMap.get(attack.dex) || { count: 0, profitUsd: 0 };
      dexExisting.count += 1;
      dexExisting.profitUsd += attack.profitUsd;
      dexMap.set(attack.dex, dexExisting);
    }

    return {
      totalAttacks24h: attacks.length,
      totalProfit24h: attacks.reduce((sum, a) => sum + a.profitUsd, 0),
      totalVictimLoss24h: attacks.reduce((sum, a) => sum + a.victimLossUsd, 0),
      attacksByType,
      topAttackers: Array.from(attackerMap.entries())
        .map(([address, data]) => ({ address, ...data }))
        .sort((a, b) => b.profitUsd - a.profitUsd)
        .slice(0, 10),
      topVictims: Array.from(victimMap.entries())
        .map(([address, data]) => ({ address, ...data }))
        .sort((a, b) => b.lossUsd - a.lossUsd)
        .slice(0, 10),
      mostTargetedTokens: Array.from(tokenMap.entries())
        .map(([symbol, data]) => ({ symbol, ...data }))
        .sort((a, b) => b.attackCount - a.attackCount)
        .slice(0, 10),
      dexBreakdown: Array.from(dexMap.entries())
        .map(([dex, data]) => ({ dex, ...data }))
        .sort((a, b) => b.profitUsd - a.profitUsd),
    };
  }

  subscribe(callback: (attacks: MevAttack[]) => void): () => void {
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
      const attacks = await this.getRecentAttacks(undefined, 20, 1);
      if (attacks.length > 0) {
        for (const listener of this.listeners) {
          try {
            listener(attacks);
          } catch (error) {
            console.error('[MEV Detector] Listener error:', error);
          }
        }
      }
    };
    
    poll(); // Initial poll
    this.pollingInterval = setInterval(poll, 15000); // Poll every 15s
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  // Generate realistic mock data for development
  private generateMockAttacks(
    tokenMint?: string,
    limit: number = 50,
    timeRangeHours: number = 24
  ): MevAttack[] {
    const tokens = [
      { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF' },
      { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK', symbol: 'JUP' },
      { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xnnB7YaYGpXv8j', symbol: 'BONK' },
      { mint: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', symbol: 'USDC' },
    ];
    
    const filteredTokens = tokenMint 
      ? tokens.filter(t => t.mint === tokenMint)
      : tokens;
    
    if (filteredTokens.length === 0) return [];
    
    const dexes = ['Raydium', 'Orca', 'Meteora', 'Phoenix', 'Lifinity'];
    const types: MevAttack['type'][] = ['sandwich', 'backrun', 'frontrun', 'arbitrage'];
    const severities: MevAttack['severity'][] = ['low', 'medium', 'high', 'critical'];
    
    const attacks: MevAttack[] = [];
    const now = Date.now();
    const startTime = now - timeRangeHours * 3600000;
    
    for (let i = 0; i < limit; i++) {
      const token = filteredTokens[Math.floor(Math.random() * filteredTokens.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const dex = dexes[Math.floor(Math.random() * dexes.length)];
      const timestamp = startTime + Math.random() * (now - startTime);
      
      const victimAmountIn = 1000 + Math.random() * 100000;
      const priceImpact = 0.001 + Math.random() * 0.05;
      const profitUsd = victimAmountIn * priceImpact * (0.3 + Math.random() * 0.5);
      const victimLossUsd = profitUsd * (0.8 + Math.random() * 0.4);
      
      attacks.push({
        id: `mev_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        victimTxHash: `tx_victim_${Math.random().toString(36).slice(2, 20)}`,
        attackerTxHashes: Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => 
          `tx_attacker_${Math.random().toString(36).slice(2, 20)}`
        ),
        blockNumber: 200000000 + Math.floor(Math.random() * 100000),
        timestamp,
        profitUsd,
        victimLossUsd,
        dex,
        poolAddress: `pool_${Math.random().toString(36).slice(2, 20)}`,
        severity,
        details: {
          victimAmountIn,
          victimAmountOut: victimAmountIn * (1 - priceImpact),
          attackerAmountIn: victimAmountIn * 0.1,
          attackerAmountOut: victimAmountIn * 0.1 * (1 + priceImpact),
          priceImpact: priceImpact * 100,
        },
      });
    }
    
    return attacks.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Check if a specific transaction is likely a sandwich victim
  async analyzeTransaction(txHash: string): Promise<{
    isVictim: boolean;
    confidence: number;
    attackDetails?: Partial<MevAttack>;
  }> {
    // In production, this would:
    // 1. Fetch transaction details from RPC
    // 2. Analyze pre/post balances
    // 3. Check for sandwich pattern (buy -> victim -> sell in same block)
    // 4. Calculate price impact
    
    return {
      isVictim: false,
      confidence: 0,
    };
  }
}

// Singleton
let mevDetectorInstance: MevDetector | null = null;

export function getMevDetector(): MevDetector {
  if (!mevDetectorInstance) {
    mevDetectorInstance = new MevDetector();
  }
  return mevDetectorInstance;
}

// React hook
export function useMevDetector(tokenMint?: string) {
  const detector = getMevDetector();
  
  return {
    getRecentAttacks: (limit?: number, timeRangeHours?: number) => 
      detector.getRecentAttacks(tokenMint, limit, timeRangeHours),
    getMevStats: (timeRangeHours?: number) => 
      detector.getMevStats(timeRangeHours),
    subscribe: (callback: (attacks: MevAttack[]) => void) => 
      detector.subscribe(callback),
  };
}

export type { MevAttack, MevStats };