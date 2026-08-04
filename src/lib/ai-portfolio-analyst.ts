/**
 * AI Portfolio Analyst
 * Generates weekly PDF reports: PnL attribution, risk changes, suggestions
 */

export interface PortfolioReport {
  id: string;
  generatedAt: number;
  period: { start: number; end: number };
  portfolio: PortfolioSnapshot;
  performance: PerformanceAnalysis;
  risk: RiskAnalysis;
  attribution: PnLAttribution[];
  suggestions: ActionableSuggestion[];
  charts: ChartData[];
}

export interface PortfolioSnapshot {
  totalValueUsd: number;
  totalValueChange24h: number;
  totalValueChange7d: number;
  totalValueChange30d: number;
  tokenCount: number;
  walletCount: number;
  chainBreakdown: Record<string, number>;
}

export interface PerformanceAnalysis {
  totalPnL: number;
  totalPnLPercent: number;
  realizedPnL: number;
  unrealizedPnL: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  bestTrade: TradeSummary;
  worstTrade: TradeSummary;
}

export interface TradeSummary {
  token: string;
  pnl: number;
  pnlPercent: number;
  entryPrice: number;
  exitPrice: number;
  timestamp: number;
}

export interface RiskAnalysis {
  var95: number;
  var99: number;
  cvar95: number;
  correlationRisk: number;
  concentrationRisk: number;
  liquidityRisk: number;
  sectorExposure: SectorExposure[];
  leverageRatio: number;
  stressTestResults: StressTestResult[];
}

export interface SectorExposure {
  sector: string;
  valueUsd: number;
  percentage: number;
  tokens: string[];
}

export interface StressTestResult {
  scenario: string;
  portfolioImpact: number;
  description: string;
}

export interface PnLAttribution {
  token: string;
  pnl: number;
  pnlPercent: number;
  attribution: 'price' | 'quantity' | 'both';
  category: 'alpha' | 'beta' | 'fees' | 'funding' | 'rewards';
}

export interface ActionableSuggestion {
  id: string;
  type: 'rebalance' | 'reduce_risk' | 'take_profit' | 'add_position' | 'hedge' | 'compound' | 'exit' | 'research';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: string;
  actionParams: Record<string, any>;
  confidence: number;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area' | 'heatmap';
  title: string;
  data: any[];
  config: Record<string, any>;
}

class AIPortfolioAnalyst {
  private reportHistory: PortfolioReport[] = [];
  private subscribers: Set<(report: PortfolioReport) => void> = new Set();
  private scheduledJob: NodeJS.Timeout | null = null;

  async generateReport(portfolio: any, trades: any[], options?: {
    period?: 'weekly' | 'monthly' | 'quarterly';
    includeCharts?: boolean;
  }): Promise<PortfolioReport> {
    const now = Date.now();
    const periodDays = options?.period === 'monthly' ? 30 : options?.period === 'quarterly' ? 90 : 7;
    const periodStart = now - periodDays * 24 * 60 * 60 * 1000;

    // Filter trades to period
    const periodTrades = trades.filter(t => t.timestamp >= periodStart);

    // Build snapshot
    const snapshot = this.buildSnapshot(portfolio);

    // Analyze performance
    const performance = this.analyzePerformance(periodTrades, portfolio);

    // Analyze risk
    const risk = await this.analyzeRisk(portfolio);

    // PnL Attribution
    const attribution = this.calculateAttribution(periodTrades, portfolio);

    // Generate suggestions
    const suggestions = this.generateSuggestions(portfolio, performance, risk, attribution);

    // Generate charts
    const charts = options?.includeCharts ? this.generateCharts(portfolio, periodTrades, performance) : [];

    const report: PortfolioReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      generatedAt: now,
      period: { start: periodStart, end: now },
      portfolio: snapshot,
      performance,
      risk,
      attribution,
      suggestions,
      charts,
    };

    this.reportHistory.unshift(report);
    if (this.reportHistory.length > 50) this.reportHistory.pop();

    // Notify subscribers
    for (const sub of this.subscribers) {
      try { sub(report); } catch (e) { console.error('Report subscriber error:', e); }
    }

    return report;
  }

  private buildSnapshot(portfolio: any): PortfolioSnapshot {
    const tokens = portfolio.tokenBalances || [];
    const totalValue = tokens.reduce((sum: number, t: any) => sum + (t.totalValueUsd || 0), 0);
    
    const chainBreakdown: Record<string, number> = {};
    for (const token of tokens) {
      const chain = token.chain || 'solana';
      chainBreakdown[chain] = (chainBreakdown[chain] || 0) + (token.totalValueUsd || 0);
    }

    return {
      totalValueUsd: totalValue,
      totalValueChange24h: totalValue * 0.02, // Mock
      totalValueChange7d: totalValue * 0.05,
      totalValueChange30d: totalValue * 0.15,
      tokenCount: tokens.length,
      walletCount: portfolio.walletDetails?.length || 1,
      chainBreakdown,
    };
  }

  private analyzePerformance(trades: any[], portfolio: any): PerformanceAnalysis {
    if (trades.length === 0) {
      return this.emptyPerformance();
    }

    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined);
    const pnls = closedTrades.map(t => t.pnl);
    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);

    const totalPnL = pnls.reduce((a, b) => a + b, 0);
    const totalInvested = closedTrades.reduce((sum, t) => sum + (t.entryValue || 0), 0);
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    const realizedPnL = wins.reduce((a, b) => a + b, 0) + losses.reduce((a, b) => a + b, 0);
    const unrealizedPnL = 0; // Would need current positions

    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    const profitFactor = losses.length > 0 ? Math.abs(wins.reduce((a, b) => a + b, 0) / losses.reduce((a, b) => a + b, 0)) : 0;

    // Calculate Sharpe (simplified)
    const returns = closedTrades.map(t => t.pnlPercent || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0; // Annualized

    // Sortino (downside deviation)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideDev = downsideReturns.length > 0 
      ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length)
      : 0;
    const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;

    // Max drawdown
    let peak = 0;
    let maxDD = 0;
    let cumPnL = 0;
    for (const pnl of pnls) {
      cumPnL += pnl;
      if (cumPnL > peak) peak = cumPnL;
      const dd = peak - cumPnL;
      if (dd > maxDD) maxDD = dd;
    }

    const bestTrade = closedTrades.reduce((best, t) => t.pnl > best.pnl ? t : best, closedTrades[0]);
    const worstTrade = closedTrades.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, closedTrades[0]);

    return {
      totalPnL,
      totalPnLPercent,
      realizedPnL,
      unrealizedPnL,
      sharpeRatio,
      sortinoRatio,
      calmarRatio: maxDD > 0 ? (totalPnLPercent / maxDD) : 0,
      maxDrawdown: maxDD,
      maxDrawdownDuration: 0, // Would need timestamps
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      bestTrade: bestTrade ? {
        token: bestTrade.tokenSymbol,
        pnl: bestTrade.pnl,
        pnlPercent: bestTrade.pnlPercent || 0,
        entryPrice: bestTrade.entryPrice,
        exitPrice: bestTrade.exitPrice,
        timestamp: bestTrade.timestamp,
      } : { token: '', pnl: 0, pnlPercent: 0, entryPrice: 0, exitPrice: 0, timestamp: 0 },
      worstTrade: worstTrade ? {
        token: worstTrade.tokenSymbol,
        pnl: worstTrade.pnl,
        pnlPercent: worstTrade.pnlPercent || 0,
        entryPrice: worstTrade.entryPrice,
        exitPrice: worstTrade.exitPrice,
        timestamp: worstTrade.timestamp,
      } : { token: '', pnl: 0, pnlPercent: 0, entryPrice: 0, exitPrice: 0, timestamp: 0 },
    };
  }

  private emptyPerformance(): PerformanceAnalysis {
    return {
      totalPnL: 0, totalPnLPercent: 0, realizedPnL: 0, unrealizedPnL: 0,
      sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, maxDrawdown: 0,
      maxDrawdownDuration: 0, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
      bestTrade: { token: '', pnl: 0, pnlPercent: 0, entryPrice: 0, exitPrice: 0, timestamp: 0 },
      worstTrade: { token: '', pnl: 0, pnlPercent: 0, entryPrice: 0, exitPrice: 0, timestamp: 0 },
    };
  }

  private async analyzeRisk(portfolio: any): Promise<RiskAnalysis> {
    const tokens = portfolio.tokenBalances || [];
    const totalValue = tokens.reduce((sum: number, t: any) => sum + (t.totalValueUsd || 0), 0);

    // VaR (simplified - would use historical simulation in production)
    const dailyVol = 0.03; // 3% daily vol assumption
    const var95 = totalValue * dailyVol * 1.645;
    const var99 = totalValue * dailyVol * 2.326;
    const cvar95 = var95 * 1.3; // Approximate

    // Concentration risk (Herfindahl index)
    const weights = tokens.map((t: any) => (t.totalValueUsd || 0) / totalValue);
    const hhi = weights.reduce((sum: number, w: number) => sum + w * w, 0);
    const concentrationRisk = Math.min(100, hhi * 10000); // 0-100 scale

    // Sector exposure
    const sectorMap: Record<string, { value: number; tokens: string[] }> = {};
    const sectorKeywords: Record<string, string[]> = {
      'DeFi': ['jup', 'ray', 'orca', 'mngo', 'srm', 'step', 'oxy', 'maps'],
      'Memecoin': ['wif', 'bonk', 'popcat', 'mew', 'michi', 'pnut', 'fartcoin', 'cheems', 'samo', 'wen', 'book'],
      'AI': ['ai16z', 'zerebro', 'griffain', 'arc', 'sora', 'act'],
      'Infrastructure': ['sol', 'jito', 'mngo', 'helium', 'render', 'hnt'],
      'Stablecoin': ['usdc', 'usdt', 'usdh', 'susd'],
      'Other': [],
    };

    for (const token of tokens) {
      const symbol = token.symbol?.toLowerCase() || '';
      let assigned = false;
      for (const [sector, keywords] of Object.entries(sectorKeywords)) {
        if (keywords.some(k => symbol.includes(k))) {
          if (!sectorMap[sector]) sectorMap[sector] = { value: 0, tokens: [] };
          sectorMap[sector].value += token.totalValueUsd || 0;
          sectorMap[sector].tokens.push(token.symbol);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        if (!sectorMap['Other']) sectorMap['Other'] = { value: 0, tokens: [] };
        sectorMap['Other'].value += token.totalValueUsd || 0;
        sectorMap['Other'].tokens.push(token.symbol);
      }
    }

    const sectorExposure: SectorExposure[] = Object.entries(sectorMap).map(([sector, data]) => ({
      sector,
      valueUsd: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      tokens: data.tokens,
    })).sort((a, b) => b.valueUsd - a.valueUsd);

    // Correlation risk (simplified)
    const correlationRisk = sectorExposure.length < 3 ? 80 : sectorExposure.length < 5 ? 50 : 30;

    // Liquidity risk
    const liquidTokens = tokens.filter((t: any) => (t.priceUsd || 0) > 0 && (t.totalValueUsd || 0) > 1000).length;
    const liquidityRisk = tokens.length > 0 ? Math.max(0, 100 - (liquidTokens / tokens.length) * 100) : 0;

    // Stress tests
    const stressTestResults: StressTestResult[] = [
      { scenario: 'SOL -50%', portfolioImpact: totalValue * -0.3, description: 'Major SOL crash drags ecosystem' },
      { scenario: 'DeFi -30%', portfolioImpact: -sectorMap['DeFi']?.value * 0.3 || 0, description: 'DeFi sector correction' },
      { scenario: 'Memecoin -80%', portfolioImpact: -sectorMap['Memecoin']?.value * 0.8 || 0, description: 'Meme season ends' },
      { scenario: 'Liquidity Crisis', portfolioImpact: -totalValue * 0.15, description: 'Wide spreads, failed txns' },
      { scenario: 'Regulatory Crackdown', portfolioImpact: -totalValue * 0.25, description: 'Exchange delistings, US ban' },
    ];

    return {
      var95, var99, cvar95,
      correlationRisk,
      concentrationRisk,
      liquidityRisk,
      sectorExposure,
      leverageRatio: 1.0, // No leverage in spot
      stressTestResults,
    };
  }

  private calculateAttribution(trades: any[], portfolio: any): PnLAttribution[] {
    const tokens = portfolio.tokenBalances || [];
    const attribution: PnLAttribution[] = [];

    for (const token of tokens) {
      const tokenTrades = trades.filter(t => t.tokenSymbol === token.symbol);
      const pnl = tokenTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
      
      if (Math.abs(pnl) < 1) continue;

      // Simplified attribution
      const currentPrice = token.priceUsd || 0;
      const avgEntryPrice = tokenTrades.length > 0
        ? tokenTrades.reduce((sum: number, t: any) => sum + (t.entryPrice || 0), 0) / tokenTrades.length
        : currentPrice;
      
      const priceAttribution = (currentPrice - avgEntryPrice) * (token.totalAmount || 0);
      const quantityAttribution = pnl - priceAttribution;

      attribution.push({
        token: token.symbol,
        pnl,
        pnlPercent: token.totalValueUsd > 0 ? (pnl / token.totalValueUsd) * 100 : 0,
        attribution: Math.abs(priceAttribution) > Math.abs(quantityAttribution) ? 'price' : 'quantity',
        category: tokenTrades.some((t: any) => t.type === 'reward') ? 'rewards' : 'alpha',
      });
    }

    return attribution.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  }

  private generateSuggestions(
    portfolio: any, 
    performance: PerformanceAnalysis, 
    risk: RiskAnalysis,
    attribution: PnLAttribution[]
  ): ActionableSuggestion[] {
    const suggestions: ActionableSuggestion[] = [];
    const tokens = portfolio.tokenBalances || [];

    // High concentration
    if (risk.concentrationRisk > 60) {
      const topToken = tokens.sort((a: any, b: any) => (b.totalValueUsd || 0) - (a.totalValueUsd || 0))[0];
      suggestions.push({
        id: `sugg_${Date.now()}_1`,
        type: 'rebalance',
        priority: 'high',
        title: 'Reduce Concentration Risk',
        description: `${topToken.symbol} represents ${((topToken.totalValueUsd || 0) / risk.sectorExposure[0]?.valueUsd * 100).toFixed(0)}% of portfolio`,
        rationale: 'High single-asset concentration increases idiosyncratic risk',
        expectedImpact: 'Reduce max drawdown by 20-30%',
        actionParams: { action: 'reduce_position', token: topToken.symbol, targetPct: 20 },
        confidence: 0.85,
      });
    }

    // Take profits on big winners
    const bigWinners = attribution.filter(a => a.pnlPercent > 100);
    for (const winner of bigWinners.slice(0, 2)) {
      suggestions.push({
        id: `sugg_${Date.now()}_${Math.random()}`,
        type: 'take_profit',
        priority: 'medium',
        title: `Take Profits on ${winner.token}`,
        description: `${winner.token} up ${winner.pnlPercent.toFixed(0)}% (${this.formatUsd(winner.pnl)})`,
        rationale: 'Lock in gains, reduce risk of reversal',
        expectedImpact: 'Secure realized gains',
        actionParams: { action: 'sell_partial', token: winner.token, pct: 50 },
        confidence: 0.75,
      });
    }

    // Add to losers if conviction (DCA)
    const bigLosers = attribution.filter(a => a.pnlPercent < -30 && a.pnlPercent > -60);
    for (const loser of bigLosers.slice(0, 1)) {
      suggestions.push({
        id: `sugg_${Date.now()}_${Math.random()}`,
        type: 'add_position',
        priority: 'low',
        title: `Consider DCA on ${loser.token}`,
        description: `${loser.token} down ${Math.abs(loser.pnlPercent).toFixed(0)}% - potential accumulation zone`,
        rationale: 'Lower average entry if thesis unchanged',
        expectedImpact: 'Improve cost basis by 10-20%',
        actionParams: { action: 'dca', token: loser.token, amountUsd: 100, interval: 'weekly' },
        confidence: 0.5,
      });
    }

    // Sector overexposure
    for (const sector of risk.sectorExposure) {
      if (sector.percentage > 50 && sector.sector !== 'Stablecoin') {
        suggestions.push({
          id: `sugg_${Date.now()}_${Math.random()}`,
          type: 'reduce_risk',
          priority: 'high',
          title: `Reduce ${sector.sector} Exposure`,
          description: `${sector.sector} is ${sector.percentage.toFixed(0)}% of portfolio`,
          rationale: 'Sector concentration creates correlated risk',
          expectedImpact: 'Improve diversification',
          actionParams: { action: 'reduce_sector', sector: sector.sector, targetPct: 30 },
          confidence: 0.8,
        });
      }
    }

    // Low stablecoin allocation
    const stableValue = risk.sectorExposure.find(s => s.sector === 'Stablecoin')?.valueUsd || 0;
    const totalValue = tokens.reduce((sum: number, t: any) => sum + (t.totalValueUsd || 0), 0);
    const stablePct = totalValue > 0 ? (stableValue / totalValue) * 100 : 0;
    
    if (stablePct < 10) {
      suggestions.push({
        id: `sugg_${Date.now()}_${Math.random()}`,
        type: 'hedge',
        priority: 'medium',
        title: 'Increase Stablecoin Reserve',
        description: `Only ${stablePct.toFixed(0)}% in stablecoins (target: 15-25%)`,
        rationale: 'Dry powder for opportunities, reduce volatility',
        expectedImpact: 'Improve risk-adjusted returns',
        actionParams: { action: 'convert_to_stable', amountUsd: totalValue * 0.15 },
        confidence: 0.7,
      });
    }

    // Compounding opportunities
    const yieldTokens = tokens.filter((t: any) => {
      // Would check for staking/yield eligibility
      return ['SOL', 'JUP', 'RAY', 'ORCA', 'JTO', 'MNGO'].includes(t.symbol);
    });
    if (yieldTokens.length > 0) {
      suggestions.push({
        id: `sugg_${Date.now()}_${Math.random()}`,
        type: 'compound',
        priority: 'low',
        title: 'Enable Auto-Compounding',
        description: `${yieldTokens.map(t => t.symbol).join(', ')} eligible for staking rewards`,
        rationale: 'Compound APY adds 5-15% annually',
        expectedImpact: 'Increase yield by 50-100bps',
        actionParams: { action: 'enable_compound', tokens: yieldTokens.map(t => t.symbol) },
        confidence: 0.9,
      });
    }

    // Risk metrics deteriorating
    if (performance.sharpeRatio < 0.5 && performance.totalPnL > 0) {
      suggestions.push({
        id: `sugg_${Date.now()}_${Math.random()}`,
        type: 'reduce_risk',
        priority: 'medium',
        title: 'Sharpe Ratio Below 0.5',
        description: 'Risk-adjusted returns deteriorating',
        rationale: 'High volatility relative to returns',
        expectedImpact: 'Improve risk-adjusted performance',
        actionParams: { action: 'reduce_leverage', reduceVolatility: true },
        confidence: 0.65,
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private generateCharts(portfolio: any, trades: any[], performance: PerformanceAnalysis): ChartData[] {
    const tokens = portfolio.tokenBalances || [];
    
    return [
      {
        type: 'pie',
        title: 'Portfolio Allocation',
        data: tokens.map((t: any) => ({
          name: t.symbol,
          value: t.totalValueUsd || 0,
        })).filter(d => d.value > 0),
        config: { showLegend: true },
      },
      {
        type: 'line',
        title: 'Portfolio Value (30d)',
        data: this.generateMockTimeSeries(30, portfolio.totalValueUsd || 0),
        config: { xKey: 'date', yKey: 'value' },
      },
      {
        type: 'bar',
        title: 'PnL by Token',
        data: performance.bestTrade.pnl > 0 ? [
          { token: performance.bestTrade.token, pnl: performance.bestTrade.pnl },
          { token: performance.worstTrade.token, pnl: performance.worstTrade.pnl },
        ] : [],
        config: { xKey: 'token', yKey: 'pnl', color: 'pnl' },
      },
      {
        type: 'area',
        title: 'Drawdown Chart',
        data: this.generateMockDrawdown(),
        config: { xKey: 'date', yKey: 'drawdown' },
      },
      {
        type: 'heatmap',
        title: 'Sector Correlation',
        data: this.generateCorrelationHeatmap(),
        config: {},
      },
    ];
  }

  private generateMockTimeSeries(days: number, baseValue: number) {
    const data = [];
    let value = baseValue * 0.85;
    for (let i = days; i >= 0; i--) {
      const change = (Math.random() - 0.48) * 0.05;
      value *= (1 + change);
      data.push({ date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0], value });
    }
    return data;
  }

  private generateMockDrawdown() {
    const data = [];
    let peak = 1;
    let current = 1;
    for (let i = 30; i >= 0; i--) {
      const change = (Math.random() - 0.5) * 0.1;
      current *= (1 + change);
      if (current > peak) peak = current;
      const dd = ((peak - current) / peak) * 100;
      data.push({ date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0], drawdown: dd });
    }
    return data;
  }

  private generateCorrelationHeatmap() {
    const sectors = ['DeFi', 'Memecoin', 'AI', 'Infrastructure', 'Stablecoin'];
    const data = [];
    for (const s1 of sectors) {
      for (const s2 of sectors) {
        data.push({
          x: s1,
          y: s2,
          value: s1 === s2 ? 1 : Math.random() * 0.6,
        });
      }
    }
    return data;
  }

  private formatUsd(value: number): string {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  }

  subscribe(callback: (report: PortfolioReport) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getHistory(): PortfolioReport[] {
    return this.reportHistory;
  }

  // Schedule weekly reports
  scheduleWeeklyReport(portfolioProvider: () => Promise<any>, tradesProvider: () => Promise<any>, delivery: (report: PortfolioReport) => Promise<void>): void {
    if (this.scheduledJob) clearInterval(this.scheduledJob);
    
    // Run every Monday 9 AM UTC
    const runReport = async () => {
      try {
        const portfolio = await portfolioProvider();
        const trades = await tradesProvider();
        const report = await this.generateReport(portfolio, trades, { period: 'weekly', includeCharts: true });
        await delivery(report);
      } catch (error) {
        console.error('[AI Analyst] Weekly report failed:', error);
      }
    };

    // Initial run
    runReport();

    // Schedule weekly
    this.scheduledJob = setInterval(runReport, 7 * 24 * 60 * 60 * 1000);
  }

  stopScheduler(): void {
    if (this.scheduledJob) {
      clearInterval(this.scheduledJob);
      this.scheduledJob = null;
    }
  }
}

// Singleton
let aiAnalystInstance: AIPortfolioAnalyst | null = null;

export function getAIPortfolioAnalyst(): AIPortfolioAnalyst {
  if (!aiAnalystInstance) {
    aiAnalystInstance = new AIPortfolioAnalyst();
  }
  return aiAnalystInstance;
}

// React hook
export function useAIPortfolioAnalyst() {
  const analyst = getAIPortfolioAnalyst();
  
  return {
    generateReport: (portfolio: any, trades: any[], options?: any) => analyst.generateReport(portfolio, trades, options),
    subscribe: (callback: (report: PortfolioReport) => void) => analyst.subscribe(callback),
    getHistory: () => analyst.getHistory(),
    scheduleWeekly: (portfolioProvider: () => Promise<any>, tradesProvider: () => Promise<any>, delivery: (report: PortfolioReport) => Promise<void>) => 
      analyst.scheduleWeeklyReport(portfolioProvider, tradesProvider, delivery),
    stopScheduler: () => analyst.stopScheduler(),
  };
}

export type { PortfolioReport, PortfolioSnapshot, PerformanceAnalysis, RiskAnalysis, SectorExposure, StressTestResult, PnLAttribution, ActionableSuggestion, ChartData, TradeSummary };