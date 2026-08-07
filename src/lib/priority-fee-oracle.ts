/**
 * Priority Fee Oracle
 * Real-time priority fee estimation from recent Solana blocks + Jito tip accounts
 * Provides optimal priority fees for fast transaction confirmation
 */

import { Connection, PublicKey, RpcResponseAndContext, SimulatedTransactionResponse } from '@solana/web3.js';
import { getJitoExecutor, JitoTipStreamData } from './jito-executor';

export interface PriorityFeeEstimate {
  min: number;
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
  recommended: number;
  jitoTip?: {
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    p99: number;
  };
  timestamp: number;
  source: 'recent-blocks' | 'jito-stream' | 'jupiter' | 'fallback';
}

export interface BlockPriorityFeeData {
  slot: number;
  fees: number[]; // micro-lamports per compute unit
  medianFee: number;
  avgFee: number;
  maxFee: number;
}

export interface PriorityFeeConfig {
  rpcEndpoint?: string;
  lookbackSlots?: number;
  updateIntervalMs?: number;
  jitoWeight?: number; // Weight for Jito tip stream (0-1)
  recentBlocksWeight?: number;
  jupiterWeight?: number;
}

class PriorityFeeOracle {
  private connection: Connection;
  private config: Required<PriorityFeeConfig>;
  private cachedEstimate: PriorityFeeEstimate | null = null;
  private cacheExpiry = 0;
  private updateInterval: NodeJS.Timeout | null = null;
  private recentBlocksCache: BlockPriorityFeeData[] = [];
  private subscribers: Set<(estimate: PriorityFeeEstimate) => void> = new Set();

  constructor(config: PriorityFeeConfig = {}) {
    this.config = {
      rpcEndpoint: config.rpcEndpoint || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      lookbackSlots: config.lookbackSlots || 150,
      updateIntervalMs: config.updateIntervalMs || 10000, // 10 seconds
      jitoWeight: config.jitoWeight ?? 0.5,
      recentBlocksWeight: config.recentBlocksWeight ?? 0.3,
      jupiterWeight: config.jupiterWeight ?? 0.2,
    };

    this.connection = new Connection(this.config.rpcEndpoint, 'confirmed');
    this.startPeriodicUpdates();
  }

  /**
   * Get current priority fee estimate
   */
  async getPriorityFees(forceRefresh = false): Promise<PriorityFeeEstimate> {
    const now = Date.now();
    
    if (!forceRefresh && this.cachedEstimate && now < this.cacheExpiry) {
      return this.cachedEstimate;
    }

    const estimate = await this.computePriorityFees();
    this.cachedEstimate = estimate;
    this.cacheExpiry = now + this.config.updateIntervalMs;
    
    // Notify subscribers
    this.notifySubscribers(estimate);
    
    return estimate;
  }

  /**
   * Compute priority fees from multiple sources
   */
  private async computePriorityFees(): Promise<PriorityFeeEstimate> {
    const [
      recentBlocksEstimate,
      jitoTipEstimate,
      jupiterEstimate,
    ] = await Promise.allSettled([
      this.getRecentBlocksEstimate(),
      this.getJitoTipEstimate(),
      this.getJupiterEstimate(),
    ]);

    // Weighted combination
    const estimates: Array<{ estimate: PriorityFeeEstimate; weight: number }> = [];
    
    if (recentBlocksEstimate.status === 'fulfilled') {
      estimates.push({ estimate: recentBlocksEstimate.value, weight: this.config.recentBlocksWeight });
    }
    
    if (jitoTipEstimate.status === 'fulfilled') {
      estimates.push({ estimate: jitoTipEstimate.value, weight: this.config.jitoWeight });
    }
    
    if (jupiterEstimate.status === 'fulfilled') {
      estimates.push({ estimate: jupiterEstimate.value, weight: this.config.jupiterWeight });
    }

    // Normalize weights
    const totalWeight = estimates.reduce((sum, e) => sum + e.weight, 0);
    const normalizedEstimates = estimates.map(e => ({
      ...e,
      weight: e.weight / totalWeight,
    }));

    // Compute weighted average for each tier
    const tiers: (keyof PriorityFeeEstimate)[] = ['min', 'low', 'medium', 'high', 'veryHigh', 'recommended'];
    const combined: Partial<PriorityFeeEstimate> = { timestamp: Date.now() };

    for (const tier of tiers) {
      let weightedSum = 0;
      for (const { estimate, weight } of normalizedEstimates) {
        if (estimate[tier] !== undefined) {
          weightedSum += estimate[tier] * weight;
        }
      }
      (combined as any)[tier] = Math.round(weightedSum);
    }

    // Add Jito tip percentiles if available
    if (jitoTipEstimate.status === 'fulfilled') {
      combined.jitoTip = jitoTipEstimate.value.jitoTip;
    }

    // Determine primary source
    const primarySource = normalizedEstimates.reduce((max, e) => e.weight > max.weight ? e : max, normalizedEstimates[0]);
    combined.source = primarySource.estimate.source;

    return combined as PriorityFeeEstimate;
  }

  /**
   * Get priority fee estimate from recent blocks
   * Uses getRecentPrioritizationFees RPC method
   */
  private async getRecentBlocksEstimate(): Promise<PriorityFeeEstimate> {
    try {
      // Get recent prioritization fees from the last N slots
      const fees = await this.connection.getRecentPrioritizationFees();
      
      if (!fees || fees.length === 0) {
        throw new Error('No prioritization fees returned');
      }

      // Convert to micro-lamports per compute unit
      const feeData = fees.map(f => f.prioritizationFee).sort((a, b) => a - b);
      
      // Calculate percentiles
      const getPercentile = (arr: number[], p: number) => {
        const idx = Math.floor(arr.length * p);
        return arr[Math.min(idx, arr.length - 1)];
      };

      // Also fetch recent blocks for more detailed analysis
      const recentBlocks = await this.analyzeRecentBlocks(Math.min(this.config.lookbackSlots, 50));

      return {
        min: getPercentile(feeData, 0.05),
        low: getPercentile(feeData, 0.25),
        medium: getPercentile(feeData, 0.50),
        high: getPercentile(feeData, 0.75),
        veryHigh: getPercentile(feeData, 0.95),
        recommended: getPercentile(feeData, 0.65), // Slightly above median
        timestamp: Date.now(),
        source: 'recent-blocks',
      };
    } catch (error) {
      console.warn('[PriorityFeeOracle] Recent blocks estimate failed:', error);
      throw error;
    }
  }

  /**
   * Analyze recent blocks for detailed fee data
   */
  private async analyzeRecentBlocks(limit: number): Promise<BlockPriorityFeeData[]> {
    const blocks: BlockPriorityFeeData[] = [];
    
    try {
      const slot = await this.connection.getSlot();
      
      for (let i = 0; i < limit; i++) {
        const targetSlot = slot - i;
        try {
          const block = await this.connection.getBlock(targetSlot, {
            maxSupportedTransactionVersion: 0,
            transactionDetails: 'full',
            rewards: false,
          });

          if (block?.transactions) {
            const fees: number[] = [];
            
            for (const tx of block.transactions) {
              if (tx.meta?.computeUnitsConsumed && tx.meta.computeUnitsConsumed > 0) {
                const fee = tx.meta.fee;
                const cu = tx.meta.computeUnitsConsumed;
                const feePerCu = Math.round((fee / cu) * 1_000_000); // micro-lamports per CU
                fees.push(feePerCu);
              }
            }

            if (fees.length > 0) {
              fees.sort((a, b) => a - b);
              blocks.push({
                slot: targetSlot,
                fees,
                medianFee: fees[Math.floor(fees.length / 2)],
                avgFee: fees.reduce((a, b) => a + b, 0) / fees.length,
                maxFee: fees[fees.length - 1],
              });
            }
          }
        } catch {
          // Skip failed blocks
        }
      }
    } catch (error) {
      console.warn('[PriorityFeeOracle] Block analysis failed:', error);
    }

    this.recentBlocksCache = blocks;
    return blocks;
  }

  /**
   * Get priority fee estimate from Jito tip stream
   */
  private async getJitoTipEstimate(): Promise<PriorityFeeEstimate> {
    const jitoExecutor = getJitoExecutor();
    const tipStreamData = (jitoExecutor as any).getTipStreamData?.() as JitoTipStreamData | null;
    
    if (!tipStreamData) {
      // Try to fetch directly
      try {
        const response = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/tip_stream');
        if (response.ok) {
          const data = await response.json() as JitoTipStreamData;
          return this.convertJitoTipToEstimate(data);
        }
      } catch {
        // Fall through
      }
      throw new Error('Jito tip stream unavailable');
    }

    return this.convertJitoTipToEstimate(tipStreamData);
  }

  private convertJitoTipToEstimate(data: JitoTipStreamData): PriorityFeeEstimate {
    // Convert Jito tip percentiles to priority fee tiers
    // Jito tips are in lamports, we add base priority fee
    const baseFee = 1000; // 0.000001 SOL base
    
    return {
      min: baseFee + (data.landed_tip_25th_percentile || 1000),
      low: baseFee + (data.landed_tip_50th_percentile || 5000),
      medium: baseFee + (data.landed_tip_75th_percentile || 20000),
      high: baseFee + (data.landed_tip_95th_percentile || 50000),
      veryHigh: baseFee + (data.landed_tip_99th_percentile || 100000),
      recommended: baseFee + (data.landed_tip_75th_percentile || 20000),
      timestamp: Date.now(),
      source: 'jito-stream',
      jitoTip: {
        p25: data.landed_tip_25th_percentile || 1000,
        p50: data.landed_tip_50th_percentile || 5000,
        p75: data.landed_tip_75th_percentile || 20000,
        p95: data.landed_tip_95th_percentile || 50000,
        p99: data.landed_tip_99th_percentile || 100000,
      },
    };
  }

  /**
   * Get priority fee estimate from Jupiter
   */
  private async getJupiterEstimate(): Promise<PriorityFeeEstimate> {
    try {
      const response = await fetch('https://api.jup.ag/v6/price-fees', {
        headers: { 'Accept': 'application/json' },
      });
      
      if (!response.ok) throw new Error('Jupiter fee endpoint failed');
      
      const data = await response.json();
      
      return {
        min: data.min || 0,
        low: data.low || 1000,
        medium: data.medium || 5000,
        high: data.high || 20000,
        veryHigh: data.veryHigh || 50000,
        recommended: data.recommended || data.medium || 5000,
        timestamp: Date.now(),
        source: 'jupiter',
      };
    } catch (error) {
      console.warn('[PriorityFeeOracle] Jupiter estimate failed:', error);
      throw error;
    }
  }

  /**
   * Start periodic updates
   */
  private startPeriodicUpdates(): void {
    // Initial fetch
    this.getPriorityFees(true).catch(console.error);
    
    // Periodic updates
    this.updateInterval = setInterval(() => {
      this.getPriorityFees(true).catch(console.error);
    }, this.config.updateIntervalMs);
  }

  /**
   * Subscribe to priority fee updates
   */
  subscribe(callback: (estimate: PriorityFeeEstimate) => void): () => void {
    this.subscribers.add(callback);
    
    // Send current estimate immediately
    if (this.cachedEstimate) {
      callback(this.cachedEstimate);
    }
    
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(estimate: PriorityFeeEstimate): void {
    for (const callback of this.subscribers) {
      try {
        callback(estimate);
      } catch (error) {
        console.warn('[PriorityFeeOracle] Subscriber error:', error);
      }
    }
  }

  /**
   * Get fee for specific tier
   */
  async getFeeForTier(tier: 'min' | 'low' | 'medium' | 'high' | 'veryHigh' | 'recommended'): Promise<number> {
    const estimate = await this.getPriorityFees();
    return estimate[tier];
  }

  /**
   * Get fee for specific compute units and tier
   */
  async getFeeForComputeUnits(
    computeUnits: number,
    tier: 'min' | 'low' | 'medium' | 'high' | 'veryHigh' | 'recommended' = 'recommended'
  ): Promise<number> {
    const feePerCu = await this.getFeeForTier(tier);
    return Math.ceil(feePerCu * computeUnits / 1_000_000); // Convert to lamports
  }

  /**
   * Simulate transaction to get actual compute units needed
   */
  async simulateForComputeUnits(transaction: any): Promise<{ computeUnits: number; success: boolean; error?: string }> {
    try {
      const result = await this.connection.simulateTransaction(transaction, {
        replaceRecentBlockhash: true,
        commitment: 'confirmed',
      });

      if (result.value.err) {
        return {
          computeUnits: 200_000, // Default fallback
          success: false,
          error: JSON.stringify(result.value.err),
        };
      }

      return {
        computeUnits: result.value.unitsConsumed || 200_000,
        success: true,
      };
    } catch (error: any) {
      return {
        computeUnits: 200_000,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get recent blocks cache for analysis
   */
  getRecentBlocksCache(): BlockPriorityFeeData[] {
    return [...this.recentBlocksCache];
  }

  /**
   * Get fee distribution histogram
   */
  getFeeHistogram(): { bin: string; count: number }[] {
    const allFees = this.recentBlocksCache.flatMap(b => b.fees);
    if (allFees.length === 0) return [];

    const bins = [
      { min: 0, max: 1000, label: '0-1k' },
      { min: 1000, max: 5000, label: '1k-5k' },
      { min: 5000, max: 10000, label: '5k-10k' },
      { min: 10000, max: 25000, label: '10k-25k' },
      { min: 25000, max: 50000, label: '25k-50k' },
      { min: 50000, max: 100000, label: '50k-100k' },
      { min: 100000, max: Infinity, label: '100k+' },
    ];

    return bins.map(bin => ({
      bin: bin.label,
      count: allFees.filter(f => f >= bin.min && f < bin.max).length,
    }));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.subscribers.clear();
  }
}

// Singleton
let priorityFeeOracleInstance: PriorityFeeOracle | null = null;

export function getPriorityFeeOracle(config?: PriorityFeeConfig): PriorityFeeOracle {
  if (!priorityFeeOracleInstance) {
    priorityFeeOracleInstance = new PriorityFeeOracle(config);
  }
  return priorityFeeOracleInstance;
}

// React hook
export function usePriorityFeeOracle(config?: PriorityFeeConfig) {
  const oracle = getPriorityFeeOracle(config);
  const [estimate, setEstimate] = React.useState<PriorityFeeEstimate | null>(null);

  React.useEffect(() => {
    const unsubscribe = oracle.subscribe(setEstimate);
    oracle.getPriorityFees(true).catch(console.error);
    return unsubscribe;
  }, [oracle]);

  return {
    estimate,
    getFeeForTier: (tier: 'min' | 'low' | 'medium' | 'high' | 'veryHigh' | 'recommended') => 
      oracle.getFeeForTier(tier),
    getFeeForComputeUnits: (cu: number, tier?: 'min' | 'low' | 'medium' | 'high' | 'veryHigh' | 'recommended') => 
      oracle.getFeeForComputeUnits(cu, tier),
    getFeeHistogram: () => oracle.getFeeHistogram(),
    refresh: () => oracle.getPriorityFees(true),
  };
}

// Need React import
import React from 'react';

export type { PriorityFeeEstimate, BlockPriorityFeeData, PriorityFeeConfig };