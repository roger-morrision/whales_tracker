/**
 * Portfolio Risk Dashboard
 * VaR, Correlation Matrix, Sector Exposure, Drawdown Analysis
 */

export interface VaRResult {
  confidenceLevel: number; // e.g., 95, 99
  timeHorizon: number; // days
  varUsd: number; // Value at Risk in USD
  varPct: number; // Value at Risk as % of portfolio
  cvarUsd: number; // Conditional VaR (Expected Shortfall)
  cvarPct: number;
  method: 'historical' | 'parametric' | 'monte_carlo';
}

export interface CorrelationMatrix {
  tokens: string[];
  matrix: number[][]; // Correlation coefficients (-1 to 1)
  timestamp: number;
}

export interface SectorExposure {
  sector: string;
  valueUsd: number;
  weight: number; // % of portfolio
  tokens: string[];
  riskContribution: number;
}

export interface DrawdownAnalysis {
  maxDrawdown: number; // %
  maxDrawdownUsd: number;
  currentDrawdown: number; // %
  currentDrawdownUsd: number;
  peakValue: number;
  peakDate: number;
  valleyValue: number;
  valleyDate: number;
  recoveryDate?: number;
  drawdownPeriods: DrawdownPeriod[];
  underwaterChart: { timestamp: number; drawdown: number }[];
}

export interface DrawdownPeriod {
  startDate: number;
  endDate: number;
  peakValue: number;
  valleyValue: number;
  drawdownPct: number;
  durationDays: number;
  recoveryDate?: number;
}

export interface RiskMetrics {
  portfolioValue: number;
  var: VaRResult[];
  correlationMatrix: CorrelationMatrix;
  sectorExposure: SectorExposure[];
  drawdown: DrawdownAnalysis;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDailyLoss: number;
  maxDailyLossPct: number;
  volatility: number; // Annualized
  beta: number; // vs SOL or market
  alpha: number; // vs benchmark
  tailRatio: number; // 95th percentile / 5th percentile
  commonSenseRatio: number; // Avg positive / Avg negative
}

export interface StressTestScenario {
  name: string;
  description: string;
  shocks: { tokenMint: string; priceChangePct: number }[];
  portfolioImpact: number; // USD
  portfolioImpactPct: number;
  newPortfolioValue: number;
}

class PortfolioRiskEngine {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Calculate Value at Risk using historical simulation
   */
  async calculateVaR(
    portfolio: { tokenMint: string; tokenSymbol: string; amount: number; currentPrice: number }[],
    returnsHistory: Map<string, number[]>, // Daily returns per token
    confidenceLevels: number[] = [95, 99],
    timeHorizonDays: number = 1
  ): Promise<VaRResult[]> {
    const results: VaRResult[] = [];

    // Calculate portfolio daily returns
    const portfolioReturns = this.calculatePortfolioReturns(portfolio, returnsHistory);
    
    if (portfolioReturns.length < 30) {
      // Not enough data, use parametric approximation
      return this.calculateParametricVaR(portfolio, confidenceLevels, timeHorizonDays);
    }

    for (const cl of confidenceLevels) {
      const alpha = (100 - cl) / 100;
      
      // Scale returns for time horizon
      const scaledReturns = portfolioReturns.map(r => r * Math.sqrt(timeHorizonDays));
      scaledReturns.sort((a, b) => a - b);
      
      // Historical VaR
      const varIndex = Math.floor(alpha * scaledReturns.length);
      const varPct = Math.abs(scaledReturns[varIndex] || 0);
      const portfolioValue = portfolio.reduce((sum, p) => sum + p.amount * p.currentPrice, 0);
      const varUsd = portfolioValue * varPct;
      
      // Conditional VaR (Expected Shortfall)
      const tailReturns = scaledReturns.slice(0, varIndex + 1);
      const cvarPct = tailReturns.length > 0 
        ? Math.abs(tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length)
        : varPct;
      const cvarUsd = portfolioValue * cvarPct;

      results.push({
        confidenceLevel: cl,
        timeHorizon: timeHorizonDays,
        varUsd,
        varPct: varPct * 100,
        cvarUsd,
        cvarPct: cvarPct * 100,
        method: 'historical',
      });
    }

    return results;
  }

  /**
   * Parametric VaR (assumes normal distribution)
   */
  private calculateParametricVaR(
    portfolio: { tokenMint: string; tokenSymbol: string; amount: number; currentPrice: number }[],
    confidenceLevels: number[],
    timeHorizonDays: number
  ): VaRResult[] {
    const results: VaRResult[] = [];
    const portfolioValue = portfolio.reduce((sum, p) => sum + p.amount * p.currentPrice, 0);
    
    // Estimate portfolio volatility from token volatilities (simplified)
    const weights = portfolio.map(p => (p.amount * p.currentPrice) / portfolioValue);
    const volatilities = portfolio.map(p => this.estimateTokenVolatility(p.tokenSymbol));
    
    // Simplified: assume zero correlation for conservative estimate
    const portfolioVol = Math.sqrt(
      weights.reduce((sum, w, i) => sum + w * w * volatilities[i] * volatilities[i], 0)
    );
    
    const dailyVol = portfolioVol / Math.sqrt(252);
    const horizonVol = dailyVol * Math.sqrt(timeHorizonDays);

    for (const cl of confidenceLevels) {
      const zScore = this.getZScore(cl / 100);
      const varPct = zScore * horizonVol;
      const varUsd = portfolioValue * varPct;
      const cvarUsd = varUsd * 1.3; // Approximation for normal distribution

      results.push({
        confidenceLevel: cl,
        timeHorizon: timeHorizonDays,
        varUsd,
        varPct: varPct * 100,
        cvarUsd,
        cvarPct: varPct * 130,
        method: 'parametric',
      });
    }

    return results;
  }

  /**
   * Calculate correlation matrix
   */
  async calculateCorrelationMatrix(
    tokenMints: string[],
    returnsHistory: Map<string, number[]>
  ): Promise<CorrelationMatrix> {
    const n = tokenMints.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const returnsI = returnsHistory.get(tokenMints[i]) || [];
          const returnsJ = returnsHistory.get(tokenMints[j]) || [];
          const minLen = Math.min(returnsI.length, returnsJ.length);
          
          if (minLen > 10) {
            matrix[i][j] = this.pearsonCorrelation(
              returnsI.slice(-minLen),
              returnsJ.slice(-minLen)
            );
          } else {
            matrix[i][j] = 0;
          }
        }
      }
    }

    return {
      tokens: tokenMints,
      matrix,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate sector exposure
   */
  async calculateSectorExposure(
    portfolio: { tokenMint: string; tokenSymbol: string; amount: number; currentPrice: number; category?: string }[]
  ): Promise<SectorExposure[]> {
    const sectorMap = new Map<string, SectorExposure>();
    const totalValue = portfolio.reduce((sum, p) => sum + p.amount * p.currentPrice, 0);

    for (const position of portfolio) {
      const sector = position.category || this.getTokenSector(position.tokenSymbol);
      const valueUsd = position.amount * position.currentPrice;
      const weight = (valueUsd / totalValue) * 100;

      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, {
          sector,
          valueUsd: 0,
          weight: 0,
          tokens: [],
          riskContribution: 0,
        });
      }

      const existing = sectorMap.get(sector)!;
      existing.valueUsd += valueUsd;
      existing.weight += weight;
      if (!existing.tokens.includes(position.tokenSymbol)) {
        existing.tokens.push(position.tokenSymbol);
      }
    }

    // Calculate risk contribution (simplified: weight * volatility)
    for (const [sector, exposure] of sectorMap) {
      const avgVol = exposure.tokens.reduce((sum, t) => sum + this.estimateTokenVolatility(t), 0) / exposure.tokens.length;
      exposure.riskContribution = exposure.weight * avgVol;
    }

    return Array.from(sectorMap.values()).sort((a, b) => b.valueUsd - a.valueUsd);
  }

  /**
   * Calculate drawdown analysis
   */
  async calculateDrawdown(portfolioHistory: { timestamp: number; value: number }[]): Promise<DrawdownAnalysis> {
    if (portfolioHistory.length < 2) {
      return this.emptyDrawdown();
    }

    // Sort by timestamp
    const sorted = [...portfolioHistory].sort((a, b) => a.timestamp - b.timestamp);
    
    let peakValue = sorted[0].value;
    let peakDate = sorted[0].timestamp;
    let maxDrawdown = 0;
    let maxDrawdownUsd = 0;
    let valleyValue = peakValue;
    let valleyDate = peakDate;
    let currentDrawdown = 0;
    let currentDrawdownUsd = 0;
    
    const drawdownPeriods: DrawdownPeriod[] = [];
    let currentPeriodStart: number | null = null;
    let currentPeriodPeak = peakValue;
    let currentPeriodPeakDate = peakDate;

    for (const point of sorted) {
      if (point.value > peakValue) {
        // New peak
        peakValue = point.value;
        peakDate = point.timestamp;
        
        // End current drawdown period if any
        if (currentPeriodStart !== null) {
          drawdownPeriods.push({
            startDate: currentPeriodStart,
            endDate: point.timestamp,
            peakValue: currentPeriodPeak,
            valleyValue,
            drawdownPct: ((currentPeriodPeak - valleyValue) / currentPeriodPeak) * 100,
            durationDays: (point.timestamp - currentPeriodStart) / 86400000,
            recoveryDate: point.timestamp,
          });
          currentPeriodStart = null;
        }
        currentPeriodPeak = peakValue;
        currentPeriodPeakDate = peakDate;
      } else {
        // In drawdown
        const drawdownPct = ((peakValue - point.value) / peakValue) * 100;
        const drawdownUsd = peakValue - point.value;
        
        if (drawdownPct > maxDrawdown) {
          maxDrawdown = drawdownPct;
          maxDrawdownUsd = drawdownUsd;
          valleyValue = point.value;
          valleyDate = point.timestamp;
        }
        
        currentDrawdown = drawdownPct;
        currentDrawdownUsd = drawdownUsd;
        
        if (currentPeriodStart === null) {
          currentPeriodStart = currentPeriodPeakDate;
        }
      }
    }

    // Handle ongoing drawdown
    if (currentPeriodStart !== null) {
      drawdownPeriods.push({
        startDate: currentPeriodStart,
        endDate: valleyDate,
        peakValue: currentPeriodPeak,
        valleyValue,
        drawdownPct: maxDrawdown,
        durationDays: (valleyDate - currentPeriodStart) / 86400000,
      });
    }

    // Build underwater chart
    const underwaterChart = sorted.map(point => {
      const peak = Math.max(...sorted.slice(0, sorted.indexOf(point) + 1).map(p => p.value));
      return {
        timestamp: point.timestamp,
        drawdown: peak > 0 ? ((peak - point.value) / peak) * 100 : 0,
      };
    });

    return {
      maxDrawdown,
      maxDrawdownUsd,
      currentDrawdown,
      currentDrawdownUsd,
      peakValue,
      peakDate,
      valleyValue,
      valleyDate,
      drawdownPeriods,
      underwaterChart,
    };
  }

  /**
   * Calculate comprehensive risk metrics
   */
  async calculateRiskMetrics(
    portfolio: { tokenMint: string; tokenSymbol: string; amount: number; currentPrice: number; category?: string }[],
    returnsHistory: Map<string, number[]>,
    portfolioHistory: { timestamp: number; value: number }[],
    benchmarkReturns?: number[] // SOL returns
  ): Promise<RiskMetrics> {
    const portfolioValue = portfolio.reduce((sum, p) => sum + p.amount * p.currentPrice, 0);
    
    // VaR
    const varResults = await this.calculateVaR(portfolio, returnsHistory);
    
    // Correlation
    const tokenMints = portfolio.map(p => p.tokenMint);
    const correlationMatrix = await this.calculateCorrelationMatrix(tokenMints, returnsHistory);
    
    // Sector exposure
    const sectorExposure = await this.calculateSectorExposure(portfolio);
    
    // Drawdown
    const drawdown = await this.calculateDrawdown(portfolioHistory);
    
    // Returns for ratios
    const portfolioReturns = this.calculatePortfolioReturns(portfolio, returnsHistory);
    
    // Sharpe Ratio
    const sharpeRatio = this.calculateSharpeRatio(portfolioReturns);
    
    // Sortino Ratio
    const sortinoRatio = this.calculateSortinoRatio(portfolioReturns);
    
    // Calmar Ratio
    const calmarRatio = drawdown.maxDrawdown > 0 
      ? (this.annualizeReturn(portfolioReturns) / drawdown.maxDrawdown) 
      : 0;
    
    // Volatility
    const volatility = this.calculateVolatility(portfolioReturns) * Math.sqrt(252);
    
    // Max daily loss
    const maxDailyLoss = Math.min(...portfolioReturns) * portfolioValue;
    const maxDailyLossPct = Math.min(...portfolioReturns) * 100;
    
    // Beta vs benchmark
    const beta = benchmarkReturns && portfolioReturns.length === benchmarkReturns.length
      ? this.calculateBeta(portfolioReturns, benchmarkReturns)
      : 1;
    
    // Alpha vs benchmark
    const alpha = benchmarkReturns && portfolioReturns.length === benchmarkReturns.length
      ? this.calculateAlpha(portfolioReturns, benchmarkReturns)
      : 0;
    
    // Tail Ratio
    const tailRatio = this.calculateTailRatio(portfolioReturns);
    
    // Common Sense Ratio
    const commonSenseRatio = this.calculateCommonSenseRatio(portfolioReturns);

    return {
      portfolioValue,
      var: varResults,
      correlationMatrix,
      sectorExposure,
      drawdown,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDailyLoss,
      maxDailyLossPct,
      volatility,
      beta,
      alpha,
      tailRatio,
      commonSenseRatio,
    };
  }

  /**
   * Stress test portfolio
   */
  async runStressTests(
    portfolio: { tokenMint: string; tokenSymbol: string; amount: number; currentPrice: number }[],
    scenarios: { name: string; description: string; shocks: { tokenMint: string; priceChangePct: number }[] }[]
  ): Promise<StressTestScenario[]> {
    const portfolioValue = portfolio.reduce((sum, p) => sum + p.amount * p.currentPrice, 0);
    
    return scenarios.map(scenario => {
      let impact = 0;
      
      for (const shock of scenario.shocks) {
        const position = portfolio.find(p => p.tokenMint === shock.tokenMint);
        if (position) {
          const positionValue = position.amount * position.currentPrice;
          impact += positionValue * (shock.priceChangePct / 100);
        }
      }
      
      return {
        ...scenario,
        portfolioImpact: impact,
        portfolioImpactPct: (impact / portfolioValue) * 100,
        newPortfolioValue: portfolioValue + impact,
      };
    });
  }

  // ========== HELPER METHODS ==========

  private calculatePortfolioReturns(
    portfolio: { tokenMint: string; tokenSymbol: string; amount: number; currentPrice: number }[],
    returnsHistory: Map<string, number[]>
  ): number[] {
    const portfolioValue = portfolio.reduce((sum, p) => sum + p.amount * p.currentPrice, 0);
    const weights = portfolio.map(p => (p.amount * p.currentPrice) / portfolioValue);
    
    // Find common length
    const minLength = Math.min(...portfolio.map(p => returnsHistory.get(p.tokenMint)?.length || 0));
    if (minLength === 0) return [];
    
    const portfolioReturns: number[] = [];
    for (let i = 0; i < minLength; i++) {
      let portfolioReturn = 0;
      for (let j = 0; j < portfolio.length; j++) {
        const returns = returnsHistory.get(portfolio[j].tokenMint);
        if (returns && returns[i] !== undefined) {
          portfolioReturn += weights[j] * returns[i];
        }
      }
      portfolioReturns.push(portfolioReturn);
    }
    
    return portfolioReturns;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private getZScore(confidence: number): number {
    // Common z-scores
    const zScores: Record<number, number> = {
      0.90: 1.282,
      0.95: 1.645,
      0.975: 1.96,
      0.99: 2.326,
      0.995: 2.576,
    };
    return zScores[confidence] || 1.645;
  }

  private estimateTokenVolatility(symbol: string): number {
    const volMap: Record<string, number> = {
      'SOL': 0.65, 'BTC': 0.55, 'ETH': 0.60,
      'WIF': 1.20, 'BONK': 1.50, 'JUP': 0.80,
      'JTO': 0.90, 'PYTH': 0.85, 'DRIFT': 0.95,
      'IO': 0.85, 'RNDR': 0.80, 'POPCAT': 1.30,
      'HNT': 0.75, 'TNSR': 1.00, 'MNGO': 1.10,
      'MOON': 1.40, 'NEON': 0.90, 'RAY': 0.85,
    };
    return volMap[symbol] || 0.80;
  }

  private getTokenSector(symbol: string): string {
    const sectors: Record<string, string> = {
      'SOL': 'L1', 'BTC': 'L1', 'ETH': 'L1',
      'JUP': 'DeFi', 'JTO': 'DeFi', 'PYTH': 'DeFi', 'DRIFT': 'DeFi', 'RAY': 'DeFi',
      'IO': 'AI', 'RNDR': 'AI',
      'WIF': 'Meme', 'BONK': 'Meme', 'POPCAT': 'Meme', 'MOON': 'Meme',
      'HNT': 'DePIN', 'TNSR': 'NFT', 'MNGO': 'DeFi',
      'NEON': 'L2', 'JTO': 'DeFi',
    };
    return sectors[symbol] || 'Other';
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const std = Math.sqrt(returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length);
    return std === 0 ? 0 : (mean / std) * Math.sqrt(252);
  }

  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return Infinity;
    const downsideStd = Math.sqrt(downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / downsideReturns.length);
    return downsideStd === 0 ? 0 : (mean / downsideStd) * Math.sqrt(252);
  }

  private annualizeReturn(returns: number[]): number {
    if (returns.length === 0) return 0;
    const totalReturn = returns.reduce((prod, r) => prod * (1 + r), 1) - 1;
    const years = returns.length / 252;
    return years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : totalReturn;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    return Math.sqrt(returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1));
  }

  private calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
    const n = portfolioReturns.length;
    if (n === 0) return 1;
    
    const meanPort = portfolioReturns.reduce((a, b) => a + b, 0) / n;
    const meanBench = benchmarkReturns.reduce((a, b) => a + b, 0) / n;
    
    let covariance = 0;
    let benchVariance = 0;
    
    for (let i = 0; i < n; i++) {
      covariance += (portfolioReturns[i] - meanPort) * (benchmarkReturns[i] - meanBench);
      benchVariance += (benchmarkReturns[i] - meanBench) ** 2;
    }
    
    return benchVariance === 0 ? 1 : covariance / benchVariance;
  }

  private calculateAlpha(portfolioReturns: number[], benchmarkReturns: number[]): number {
    const beta = this.calculateBeta(portfolioReturns, benchmarkReturns);
    const meanPort = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
    const meanBench = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
    return (meanPort - beta * meanBench) * 252; // Annualized
  }

  private calculateTailRatio(returns: number[]): number {
    if (returns.length < 20) return 1;
    const sorted = [...returns].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(0.95 * sorted.length)];
    const p05 = sorted[Math.floor(0.05 * sorted.length)];
    return p05 === 0 ? 1 : p95 / Math.abs(p05);
  }

  private calculateCommonSenseRatio(returns: number[]): number {
    const positive = returns.filter(r => r > 0);
    const negative = returns.filter(r => r < 0);
    if (negative.length === 0) return Infinity;
    const avgPos = positive.reduce((a, b) => a + b, 0) / positive.length;
    const avgNeg = Math.abs(negative.reduce((a, b) => a + b, 0) / negative.length);
    return avgNeg === 0 ? Infinity : avgPos / avgNeg;
  }

  private emptyDrawdown(): DrawdownAnalysis {
    return {
      maxDrawdown: 0,
      maxDrawdownUsd: 0,
      currentDrawdown: 0,
      currentDrawdownUsd: 0,
      peakValue: 0,
      peakDate: Date.now(),
      valleyValue: 0,
      valleyDate: Date.now(),
      drawdownPeriods: [],
      underwaterChart: [],
    };
  }
}

// Singleton
let riskEngineInstance: PortfolioRiskEngine | null = null;

export function getRiskEngine(): PortfolioRiskEngine {
  if (!riskEngineInstance) {
    riskEngineInstance = new PortfolioRiskEngine();
  }
  return riskEngineInstance;
}

// React hook
export function useRiskEngine() {
  const engine = getRiskEngine();
  
  return {
    calculateVaR: (portfolio: any, returns: Map<string, number[]>, cl?: number[], horizon?: number) => 
      engine.calculateVaR(portfolio, returns, cl, horizon),
    calculateCorrelationMatrix: (tokens: string[], returns: Map<string, number[]>) => 
      engine.calculateCorrelationMatrix(tokens, returns),
    calculateSectorExposure: (portfolio: any) => 
      engine.calculateSectorExposure(portfolio),
    calculateDrawdown: (history: { timestamp: number; value: number }[]) => 
      engine.calculateDrawdown(history),
    calculateRiskMetrics: (portfolio: any, returns: Map<string, number[]>, history: any[], benchmark?: number[]) => 
      engine.calculateRiskMetrics(portfolio, returns, history, benchmark),
    runStressTests: (portfolio: any, scenarios: any[]) => 
      engine.runStressTests(portfolio, scenarios),
  };
}

export type { VaRResult, CorrelationMatrix, SectorExposure, DrawdownAnalysis, DrawdownPeriod, RiskMetrics, StressTestScenario };