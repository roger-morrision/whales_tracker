/**
 * Impermanent Loss Calculator
 * LP positions across Raydium, Orca, Meteora, Whirlpools
 */

export interface LpPosition {
  id: string;
  protocol: 'raydium' | 'orca' | 'meteora' | 'whirlpool' | 'lifinity' | 'phoenix';
  poolAddress: string;
  tokenA: { mint: string; symbol: string; amount: number; decimals: number };
  tokenB: { mint: string; symbol: string; amount: number; decimals: number };
  entryPriceRatio: number; // tokenA/tokenB at entry
  currentPriceRatio: number; // tokenA/tokenB current
  entryTimestamp: number;
  lpTokensAmount: number;
  totalLpTokens: number;
  feeTier: number; // basis points
  rewards?: { token: string; amount: number; apr: number }[];
}

export interface ILCalculationResult {
  positionId: string;
  impermanentLoss: number; // USD
  impermanentLossPct: number; // %
  currentValueUsd: number;
  hodlValueUsd: number; // Value if just held tokens
  feesEarnedUsd: number;
  rewardsEarnedUsd: number;
  netPnlUsd: number; // fees + rewards - IL
  netPnlPct: number;
  priceRatioChange: number; // %
  tokenAPriceChange: number; // %
  tokenBPriceChange: number; // %
  breakEvenPriceRatio: number; // Price ratio where IL = fees
  daysSinceEntry: number;
  annualizedReturn: number;
}

export interface PriceScenario {
  name: string;
  tokenAChange: number; // % change
  tokenBChange: number; // % change
  ilPct: number;
  ilUsd: number;
  netPnlUsd: number;
}

export interface PoolAnalytics {
  poolAddress: string;
  protocol: string;
  tokenA: string;
  tokenB: string;
  tvlUsd: number;
  volume24hUsd: number;
  feeApr: number;
  rewardApr: number;
  totalApr: number;
  priceCorrelation: number; // -1 to 1
  volatilityTokenA: number;
  volatilityTokenB: number;
  estimatedIlRisk: 'low' | 'medium' | 'high' | 'extreme';
}

class ImpermanentLossCalculator {
  /**
   * Calculate impermanent loss for a single position
   */
  calculateIL(position: LpPosition): ILCalculationResult {
    const { tokenA, tokenB, entryPriceRatio, currentPriceRatio, lpTokensAmount, totalLpTokens, feeTier } = position;
    
    // Price ratio change
    const priceRatioChange = ((currentPriceRatio - entryPriceRatio) / entryPriceRatio) * 100;
    
    // Get current token prices (would come from oracle)
    const tokenAPriceUsd = this.getTokenPrice(tokenA.mint);
    const tokenBPriceUsd = this.getTokenPrice(tokenB.mint);
    
    // Calculate token amounts at current prices (AMM formula)
    const k = tokenA.amount * tokenB.amount; // Constant product
    const currentTokenAAmount = Math.sqrt(k * currentPriceRatio);
    const currentTokenBAmount = k / currentTokenAAmount;
    
    // HODL value (what if we just held the original tokens)
    const hodlValueUsd = (tokenA.amount * tokenAPriceUsd) + (tokenB.amount * tokenBPriceUsd);
    
    // Current LP value (our share of pool)
    const share = lpTokensAmount / totalLpTokens;
    const currentPoolValueUsd = (currentTokenAAmount * tokenAPriceUsd) + (currentTokenBAmount * tokenBPriceUsd);
    const currentValueUsd = currentPoolValueUsd * share;
    
    // Impermanent loss
    const impermanentLoss = hodlValueUsd - currentValueUsd;
    const impermanentLossPct = hodlValueUsd > 0 ? (impermanentLoss / hodlValueUsd) * 100 : 0;
    
    // Fees earned (simplified estimation)
    const daysSinceEntry = (Date.now() - position.entryTimestamp) / (1000 * 60 * 60 * 24);
    const estimatedDailyVolume = this.estimateDailyVolume(position.protocol, position.poolAddress);
    const dailyFeesUsd = estimatedDailyVolume * (feeTier / 10000) * share;
    const feesEarnedUsd = dailyFeesUsd * daysSinceEntry;
    
    // Rewards earned
    const rewardsEarnedUsd = position.rewards?.reduce((sum, r) => {
      const rewardPrice = this.getTokenPrice(r.token);
      return sum + (r.amount * rewardPrice);
    }, 0) || 0;
    
    // Net PnL
    const netPnlUsd = feesEarnedUsd + rewardsEarnedUsd - impermanentLoss;
    const netPnlPct = hodlValueUsd > 0 ? (netPnlUsd / hodlValueUsd) * 100 : 0;
    
    // Token price changes
    const tokenAPriceChange = 0; // Would need historical data
    const tokenBPriceChange = 0;
    
    // Break-even price ratio (where IL = fees)
    const breakEvenPriceRatio = this.calculateBreakEvenRatio(position, feesEarnedUsd);
    
    // Annualized return
    const annualizedReturn = daysSinceEntry > 0 ? (netPnlPct / daysSinceEntry) * 365 : 0;

    return {
      positionId: position.id,
      impermanentLoss,
      impermanentLossPct,
      currentValueUsd,
      hodlValueUsd,
      feesEarnedUsd,
      rewardsEarnedUsd,
      netPnlUsd,
      netPnlPct,
      priceRatioChange,
      tokenAPriceChange,
      tokenBPriceChange,
      breakEvenPriceRatio,
      daysSinceEntry,
      annualizedReturn,
    };
  }

  /**
   * Calculate IL for multiple price scenarios
   */
  calculateScenarios(position: LpPosition): PriceScenario[] {
    const scenarios = [
      { name: 'Current', tokenAChange: 0, tokenBChange: 0 },
      { name: 'Token A +50%', tokenAChange: 50, tokenBChange: 0 },
      { name: 'Token A -50%', tokenAChange: -50, tokenBChange: 0 },
      { name: 'Token B +50%', tokenAChange: 0, tokenBChange: 50 },
      { name: 'Token B -50%', tokenAChange: 0, tokenBChange: -50 },
      { name: 'Both +50%', tokenAChange: 50, tokenBChange: 50 },
      { name: 'Both -50%', tokenAChange: -50, tokenBChange: -50 },
      { name: 'A +100% / B -50%', tokenAChange: 100, tokenBChange: -50 },
      { name: 'A -50% / B +100%', tokenAChange: -50, tokenBChange: 100 },
      { name: 'Divergence 2x', tokenAChange: 100, tokenBChange: 0 },
      { name: 'Divergence 5x', tokenAChange: 400, tokenBChange: 0 },
    ];

    return scenarios.map(s => {
      const newPriceRatio = position.entryPriceRatio * 
        (1 + s.tokenAChange / 100) / (1 + s.tokenBChange / 100);
      
      const ilResult = this.calculateIL({
        ...position,
        currentPriceRatio: newPriceRatio,
      });

      return {
        name: s.name,
        tokenAChange: s.tokenAChange,
        tokenBChange: s.tokenBChange,
        ilPct: ilResult.impermanentLossPct,
        ilUsd: ilResult.impermanentLoss,
        netPnlUsd: ilResult.netPnlUsd,
      };
    });
  }

  /**
   * Analyze pool for IL risk
   */
  async analyzePool(poolAddress: string, protocol: LpPosition['protocol']): Promise<PoolAnalytics> {
    // In production, fetch from protocol APIs
    // For now, return mock data with risk assessment
    
    const baseAnalytics: PoolAnalytics = {
      poolAddress,
      protocol,
      tokenA: 'SOL',
      tokenB: 'USDC',
      tvlUsd: 1000000,
      volume24hUsd: 500000,
      feeApr: 15,
      rewardApr: 5,
      totalApr: 20,
      priceCorrelation: 0.3,
      volatilityTokenA: 0.65,
      volatilityTokenB: 0.02,
      estimatedIlRisk: 'medium',
    };

    // Adjust risk based on correlation and volatility
    const volProduct = baseAnalytics.volatilityTokenA * baseAnalytics.volatilityTokenB;
    const correlation = baseAnalytics.priceCorrelation;
    
    // High divergence risk = low correlation + high volatility
    const divergenceRisk = (1 - correlation) * volProduct * 100;
    
    if (divergenceRisk > 5) baseAnalytics.estimatedIlRisk = 'extreme';
    else if (divergenceRisk > 2) baseAnalytics.estimatedIlRisk = 'high';
    else if (divergenceRisk > 0.5) baseAnalytics.estimatedIlRisk = 'medium';
    else baseAnalytics.estimatedIlRisk = 'low';

    return baseAnalytics;
  }

  /**
   * Compare multiple positions
   */
  comparePositions(positions: LpPosition[]): ILCalculationResult[] {
    return positions.map(p => this.calculateIL(p));
  }

  /**
   * Get optimal rebalance points
   */
  getRebalancePoints(position: LpPosition): { 
    upperThreshold: number; 
    lowerThreshold: number; 
    currentRatio: number;
    recommendation: 'hold' | 'rebalance' | 'exit';
  } {
    const result = this.calculateIL(position);
    
    // Rebalance when IL exceeds fees earned
    const ilThreshold = result.feesEarnedUsd / result.hodlValueUsd * 100;
    
    // Calculate price ratios at threshold
    // IL ≈ (sqrt(priceRatio) - 1)^2 / (2 * sqrt(priceRatio)) for 50/50 pools
    // Simplified: rebalance when price ratio changes > 20%
    const upperThreshold = position.entryPriceRatio * 1.2;
    const lowerThreshold = position.entryPriceRatio * 0.833;
    
    let recommendation: 'hold' | 'rebalance' | 'exit' = 'hold';
    if (position.currentPriceRatio > upperThreshold || position.currentPriceRatio < lowerThreshold) {
      recommendation = result.netPnlUsd > 0 ? 'rebalance' : 'exit';
    }

    return {
      upperThreshold,
      lowerThreshold,
      currentRatio: position.currentPriceRatio,
      recommendation,
    };
  }

  // ========== PRIVATE METHODS ==========

  private calculateBreakEvenRatio(position: LpPosition, feesEarnedUsd: number): number {
    // Find price ratio where IL = fees earned
    const hodlValue = position.tokenA.amount * this.getTokenPrice(position.tokenA.mint) + 
                      position.tokenB.amount * this.getTokenPrice(position.tokenB.mint);
    const targetILPct = (feesEarnedUsd / hodlValue) * 100;
    
    // For 50/50 pool: IL% ≈ 2 * sqrt(r) / (1 + r) - 1 where r = priceRatio / entryPriceRatio
    // Solve for r when IL% = targetILPct
    // This is a simplified approximation
    const r = Math.pow(1 + targetILPct / 100, 2);
    return position.entryPriceRatio * r;
  }

  private getTokenPrice(mint: string): number {
    // In production, fetch from price oracle
    const prices: Record<string, number> = {
      'So11111111111111111111111111111111111111112': 72.97,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTt1v1': 1.0, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0, // USDT
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 0.142, // WIF
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK': 0.842, // JUP
      '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 0.000024, // BONK
    };
    return prices[mint] || 1;
  }

  private estimateDailyVolume(protocol: string, poolAddress: string): number {
    // In production, fetch from protocol analytics
    const estimates: Record<string, number> = {
      'raydium': 500000,
      'orca': 300000,
      'meteora': 200000,
      'whirlpool': 400000,
      'lifinity': 100000,
      'phoenix': 50000,
    };
    return estimates[protocol] || 100000;
  }
}

// Singleton
let ilCalculatorInstance: ImpermanentLossCalculator | null = null;

export function getILCalculator(): ImpermanentLossCalculator {
  if (!ilCalculatorInstance) {
    ilCalculatorInstance = new ImpermanentLossCalculator();
  }
  return ilCalculatorInstance;
}

// React hook
export function useILCalculator() {
  const calculator = getILCalculator();
  
  return {
    calculateIL: (position: LpPosition) => calculator.calculateIL(position),
    calculateScenarios: (position: LpPosition) => calculator.calculateScenarios(position),
    analyzePool: (poolAddress: string, protocol: LpPosition['protocol']) => 
      calculator.analyzePool(poolAddress, protocol),
    comparePositions: (positions: LpPosition[]) => calculator.comparePositions(positions),
    getRebalancePoints: (position: LpPosition) => calculator.getRebalancePoints(position),
  };
}

export type { LpPosition, ILCalculationResult, PriceScenario, PoolAnalytics };