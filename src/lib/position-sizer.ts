/**
 * Position Sizing Calculator
 * Kelly Criterion, Risk Parity, Volatility Targeting
 */

export interface PositionSizeInput {
  portfolioValue: number;
  riskPerTrade: number; // Percentage (e.g., 2 = 2%)
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice?: number;
  winRate?: number; // Historical win rate (0-1)
  avgWinLossRatio?: number; // Average win / average loss
  volatility?: number; // Annualized volatility (0-1)
  correlation?: number; // Correlation with portfolio (0-1)
  maxPositionPct?: number; // Maximum position as % of portfolio
  kellyFraction?: number; // Kelly fraction (0-1, default 0.5 for half-Kelly)
}

export interface PositionSizeResult {
  positionSizeUsd: number;
  positionSizeTokens: number;
  riskUsd: number;
  riskPct: number;
  shares: number;
  stopLossDistance: number; // %
  takeProfitDistance?: number; // %
  riskRewardRatio?: number;
  kellyPct?: number;
  volatilityAdjustedSize?: number;
  correlationAdjustedSize?: number;
  finalSizeUsd: number;
  finalSizeTokens: number;
  warnings: string[];
}

export interface PortfolioPosition {
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  valueUsd: number;
  weight: number; // % of portfolio
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

export interface RiskParityAllocation {
  tokenMint: string;
  tokenSymbol: string;
  targetWeight: number;
  currentWeight: number;
  volatility: number;
  correlation: number;
  riskContribution: number;
  targetRiskContribution: number;
  adjustment: number; // Buy/sell amount
}

class PositionSizer {
  private readonly DEFAULT_KELLY_FRACTION = 0.5;
  private readonly DEFAULT_MAX_POSITION_PCT = 20;
  private readonly MIN_POSITION_USD = 10;

  /**
   * Calculate position size using multiple methods
   */
  calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
    const warnings: string[] = [];
    const {
      portfolioValue,
      riskPerTrade,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      winRate,
      avgWinLossRatio,
      volatility,
      correlation,
      maxPositionPct = this.DEFAULT_MAX_POSITION_PCT,
      kellyFraction = this.DEFAULT_KELLY_FRACTION,
    } = input;

    // Validate inputs
    if (portfolioValue <= 0) {
      warnings.push('Portfolio value must be positive');
      return this.emptyResult();
    }
    if (entryPrice <= 0 || stopLossPrice <= 0) {
      warnings.push('Entry and stop loss prices must be positive');
      return this.emptyResult();
    }
    if (stopLossPrice >= entryPrice) {
      warnings.push('Stop loss must be below entry price for long positions');
      return this.emptyResult();
    }

    // Basic risk calculation
    const stopLossDistance = ((entryPrice - stopLossPrice) / entryPrice) * 100;
    const takeProfitDistance = takeProfitPrice 
      ? ((takeProfitPrice - entryPrice) / entryPrice) * 100 
      : undefined;
    const riskRewardRatio = takeProfitDistance ? takeProfitDistance / stopLossDistance : undefined;

    // Method 1: Fixed Risk Percentage
    const riskUsd = portfolioValue * (riskPerTrade / 100);
    const positionSizeUsdFixed = riskUsd / (stopLossDistance / 100);
    const positionSizeTokensFixed = positionSizeUsdFixed / entryPrice;

    // Method 2: Kelly Criterion (if win rate provided)
    let kellyPct: number | undefined;
    let kellySizeUsd: number | undefined;
    
    if (winRate !== undefined && avgWinLossRatio !== undefined && winRate > 0 && avgWinLossRatio > 0) {
      // Kelly % = (Win% * AvgWin - Loss% * AvgLoss) / AvgWin
      // Simplified: Kelly % = WinRate - (1 - WinRate) / AvgWinLossRatio
      const kelly = winRate - (1 - winRate) / avgWinLossRatio;
      kellyPct = Math.max(0, kelly * kellyFraction * 100); // Apply fraction and convert to %
      kellySizeUsd = portfolioValue * (kellyPct / 100);
    }

    // Method 3: Volatility Targeting
    let volatilityAdjustedSize: number | undefined;
    if (volatility !== undefined && volatility > 0) {
      // Target portfolio volatility (e.g., 15% annual)
      const targetVol = 0.15;
      const volScalar = targetVol / volatility;
      volatilityAdjustedSize = portfolioValue * volScalar * (riskPerTrade / 100) / (stopLossDistance / 100);
    }

    // Method 4: Correlation Adjustment
    let correlationAdjustedSize: number | undefined;
    if (correlation !== undefined) {
      // Reduce size for highly correlated positions
      const correlationFactor = 1 - Math.abs(correlation) * 0.5;
      correlationAdjustedSize = positionSizeUsdFixed * correlationFactor;
    }

    // Apply maximum position constraint
    const maxPositionUsd = portfolioValue * (maxPositionPct / 100);
    
    // Determine final size (most conservative)
    let finalSizeUsd = positionSizeUsdFixed;
    const methods = [
      { name: 'Fixed Risk', size: positionSizeUsdFixed },
      ...(kellySizeUsd ? [{ name: 'Kelly', size: kellySizeUsd }] : []),
      ...(volatilityAdjustedSize ? [{ name: 'Vol Target', size: volatilityAdjustedSize }] : []),
      ...(correlationAdjustedSize ? [{ name: 'Correlation Adj', size: correlationAdjustedSize }] : []),
    ];

    // Use the minimum of all methods (most conservative)
    finalSizeUsd = Math.min(...methods.map(m => m.size), maxPositionUsd);

    // Ensure minimum position
    if (finalSizeUsd < this.MIN_POSITION_USD) {
      warnings.push(`Position size below minimum ($${this.MIN_POSITION_USD})`);
      finalSizeUsd = this.MIN_POSITION_USD;
    }

    // Cap at max position
    if (finalSizeUsd > maxPositionUsd) {
      warnings.push(`Position capped at max ${maxPositionPct}% of portfolio`);
      finalSizeUsd = maxPositionUsd;
    }

    const finalSizeTokens = finalSizeUsd / entryPrice;
    const finalRiskUsd = finalSizeUsd * (stopLossDistance / 100);
    const finalRiskPct = (finalRiskUsd / portfolioValue) * 100;

    // Warnings
    if (stopLossDistance > 20) warnings.push('Wide stop loss (>20%) - consider tighter risk');
    if (riskRewardRatio && riskRewardRatio < 1.5) warnings.push('Poor risk/reward ratio (<1.5:1)');
    if (kellyPct && kellyPct > maxPositionPct) warnings.push('Kelly size exceeds max position limit');

    return {
      positionSizeUsd: positionSizeUsdFixed,
      positionSizeTokens: positionSizeTokensFixed,
      riskUsd,
      riskPct: riskPerTrade,
      shares: positionSizeTokensFixed,
      stopLossDistance,
      takeProfitDistance,
      riskRewardRatio,
      kellyPct,
      volatilityAdjustedSize,
      correlationAdjustedSize,
      finalSizeUsd,
      finalSizeTokens,
      warnings,
    };
  }

  /**
   * Risk Parity Allocation
   * Allocate capital so each position contributes equal risk
   */
  calculateRiskParity(
    positions: PortfolioPosition[],
    targetRiskContribution: number = 1 // Equal risk budget per position
  ): RiskParityAllocation[] {
    if (positions.length === 0) return [];

    // Estimate volatilities (in production, use historical data)
    const volatilities = positions.map(p => this.estimateVolatility(p.tokenSymbol));
    
    // Calculate inverse volatility weights
    const invVols = volatilities.map(v => 1 / Math.max(v, 0.01));
    const totalInvVol = invVols.reduce((a, b) => a + b, 0);
    const targetWeights = invVols.map(v => v / totalInvVol);

    // Calculate current weights
    const totalValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);
    const currentWeights = positions.map(p => p.valueUsd / totalValue);

    // Calculate risk contributions
    const allocations: RiskParityAllocation[] = positions.map((p, i) => {
      const targetWeight = targetWeights[i];
      const currentWeight = currentWeights[i];
      const volatility = volatilities[i];
      const riskContribution = currentWeight * volatility;
      const targetRisk = targetWeight * volatility;
      const adjustment = (targetWeight - currentWeight) * totalValue;

      return {
        tokenMint: p.tokenMint,
        tokenSymbol: p.tokenSymbol,
        targetWeight: targetWeight * 100,
        currentWeight: currentWeight * 100,
        volatility: volatility * 100,
        correlation: 0, // Would need correlation matrix
        riskContribution: riskContribution * 100,
        targetRiskContribution: targetRisk * 100,
        adjustment,
      };
    });

    return allocations;
  }

  /**
   * Volatility targeting for entire portfolio
   */
  calculateVolatilityTarget(
    portfolioValue: number,
    targetVolatility: number, // e.g., 0.15 for 15%
    currentPortfolioVol: number,
    leverage: number = 1
  ): { targetExposure: number; leverageAdjustment: number } {
    if (currentPortfolioVol <= 0) {
      return { targetExposure: portfolioValue, leverageAdjustment: 1 };
    }

    const targetExposure = portfolioValue * (targetVolatility / currentPortfolioVol) * leverage;
    const leverageAdjustment = targetExposure / portfolioValue;

    return {
      targetExposure: Math.min(targetExposure, portfolioValue * 2), // Cap at 2x
      leverageAdjustment: Math.min(leverageAdjustment, 2),
    };
  }

  /**
   * Optimal f (Kelly for multiple outcomes)
   */
  calculateOptimalF(
    outcomes: Array<{ profit: number; probability: number }>
  ): number {
    // Find f that maximizes geometric mean
    let bestF = 0;
    let bestG = -Infinity;

    for (let f = 0.01; f <= 1; f += 0.01) {
      let g = 0;
      for (const o of outcomes) {
        const hpr = 1 + f * o.profit; // Holding period return
        if (hpr <= 0) { g = -Infinity; break; }
        g += o.probability * Math.log(hpr);
      }
      if (g > bestG) {
        bestG = g;
        bestF = f;
      }
    }

    return bestF;
  }

  private estimateVolatility(symbol: string): number {
    // Simplified volatility estimates (annualized)
    const volMap: Record<string, number> = {
      'SOL': 0.65,
      'BTC': 0.55,
      'ETH': 0.60,
      'WIF': 1.20,
      'BONK': 1.50,
      'JUP': 0.80,
      'JTO': 0.90,
      'PYTH': 0.85,
      'DRIFT': 0.95,
      'IO': 0.85,
      'RNDR': 0.80,
      'POPCAT': 1.30,
      'HNT': 0.75,
      'TNSR': 1.00,
      'MNGO': 1.10,
      'MOON': 1.40,
      'NEON': 0.90,
      'RAY': 0.85,
    };
    return volMap[symbol] || 0.80; // Default 80%
  }

  private emptyResult(): PositionSizeResult {
    return {
      positionSizeUsd: 0,
      positionSizeTokens: 0,
      riskUsd: 0,
      riskPct: 0,
      shares: 0,
      stopLossDistance: 0,
      finalSizeUsd: 0,
      finalSizeTokens: 0,
      warnings: ['Invalid input parameters'],
    };
  }
}

// Singleton
let positionSizerInstance: PositionSizer | null = null;

export function getPositionSizer(): PositionSizer {
  if (!positionSizerInstance) {
    positionSizerInstance = new PositionSizer();
  }
  return positionSizerInstance;
}

// React hook
export function usePositionSizer() {
  const sizer = getPositionSizer();
  
  return {
    calculateSize: (input: PositionSizeInput) => sizer.calculatePositionSize(input),
    calculateRiskParity: (positions: PortfolioPosition[]) => sizer.calculateRiskParity(positions),
    calculateVolTarget: (portfolioValue: number, targetVol: number, currentVol: number) => 
      sizer.calculateVolatilityTarget(portfolioValue, targetVol, currentVol),
    calculateOptimalF: (outcomes: Array<{ profit: number; probability: number }>) => 
      sizer.calculateOptimalF(outcomes),
  };
}

export type { PositionSizeInput, PositionSizeResult, PortfolioPosition, RiskParityAllocation };