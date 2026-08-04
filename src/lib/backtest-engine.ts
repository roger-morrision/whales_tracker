/**
 * Strategy Backtesting Engine
 * Historical simulation of snipe/trailing/DCA rules
 */

export interface BacktestConfig {
  startDate: number;
  endDate: number;
  initialCapital: number;
  fees: {
    swapFeeBps: number;
    gasFeeUsd: number;
    slippageBps: number;
  };
  dataSource: 'dexscreener' | 'gmgn' | 'jupiter' | 'custom';
  tokens?: string[]; // Limit to specific tokens
  maxConcurrentPositions: number;
  positionSizing: 'fixed_usd' | 'fixed_pct' | 'kelly' | 'risk_parity';
  riskPerTradePct: number;
}

export interface BacktestTrade {
  id: string;
  ruleId: string;
  tokenMint: string;
  tokenSymbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  amount: number;
  amountUsd: number;
  entryTime: number;
  exitTime?: number;
  pnl?: number;
  pnlPercent?: number;
  fees: number;
  slippage: number;
  status: 'open' | 'closed' | 'cancelled';
  trigger: string;
  metadata: Record<string, any>;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  metrics: BacktestMetrics;
  monthlyReturns: MonthlyReturn[];
  drawdowns: DrawdownPeriod[];
  tradeAnalysis: TradeAnalysis;
  rulePerformance: RulePerformance[];
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
  positions: number;
}

export interface MonthlyReturn {
  month: string; // YYYY-MM
  return: number;
  returnPct: number;
  trades: number;
  winRate: number;
}

export interface DrawdownPeriod {
  start: number;
  end: number;
  peak: number;
  trough: number;
  drawdown: number;
  drawdownPct: number;
  durationDays: number;
  recoveryDays?: number;
}

export interface TradeAnalysis {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  expectancy: number;
  avgHoldTime: number; // hours
  bestTrade: BacktestTrade;
  worstTrade: BacktestTrade;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
}

export interface RulePerformance {
  ruleId: string;
  ruleName: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPct: number;
  avgPnL: number;
  sharpeRatio: number;
  maxDrawdown: number;
  bestToken: string;
  worstToken: string;
}

export interface HistoricalDataPoint {
  tokenMint: string;
  tokenSymbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeUsd: number;
  // Additional data for smart money, etc.
  smartMoneyFlow?: number;
  rsi?: number;
  macd?: { macd: number; signal: number; histogram: number };
  securityScore?: number;
  liquidityUsd?: number;
}

class BacktestEngine {
  private dataCache: Map<string, HistoricalDataPoint[]> = new Map();
  private resultsCache: Map<string, BacktestResult> = new Map();

  async runBacktest(
    rules: ExecutableRule[],
    config: BacktestConfig,
    dataProvider: (tokenMint: string, start: number, end: number) => Promise<HistoricalDataPoint[]>
  ): Promise<BacktestResult> {
    const cacheKey = this.getCacheKey(rules, config);
    const cached = this.resultsCache.get(cacheKey);
    if (cached) return cached;

    // Load historical data for all tokens
    const tokens = config.tokens || this.extractTokensFromRules(rules);
    await this.loadHistoricalData(tokens, config.startDate, config.endDate, dataProvider);

    // Simulate
    const result = await this.simulate(rules, config);
    
    this.resultsCache.set(cacheKey, result);
    return result;
  }

  private async loadHistoricalData(
    tokens: string[],
    start: number,
    end: number,
    dataProvider: (tokenMint: string, start: number, end: number) => Promise<HistoricalDataPoint[]>
  ): Promise<void> {
    const promises = tokens.map(async (mint) => {
      if (!this.dataCache.has(mint)) {
        const data = await dataProvider(mint, start, end);
        this.dataCache.set(mint, data.sort((a, b) => a.timestamp - b.timestamp));
      }
    });
    await Promise.all(promises);
  }

  private extractTokensFromRules(rules: ExecutableRule[]): string[] {
    const tokens = new Set<string>();
    for (const rule of rules) {
      for (const action of rule.actions) {
        if (action.params.token) tokens.add(action.params.token);
        if (action.params.tokenMint) tokens.add(action.params.tokenMint);
      }
      for (const condition of rule.conditions) {
        if (condition.value && typeof condition.value === 'string' && condition.value.length > 20) {
          tokens.add(condition.value); // Might be a mint
        }
      }
    }
    return Array.from(tokens);
  }

  private async simulate(
    rules: ExecutableRule[],
    config: BacktestConfig
  ): Promise<BacktestResult> {
    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];
    const openPositions: Map<string, BacktestTrade> = new Map();
    let equity = config.initialCapital;
    let peakEquity = config.initialCapital;
    let currentDrawdown = 0;
    let drawdownStart = 0;
    const drawdowns: DrawdownPeriod[] = [];

    // Get all timestamps from data
    const allTimestamps = this.getAllTimestamps(config.startDate, config.endDate);

    for (const timestamp of allTimestamps) {
      // Update equity curve
      const unrealizedPnL = this.calculateUnrealizedPnL(openPositions, timestamp);
      const currentEquity = equity + unrealizedPnL;
      
      // Track drawdown
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
        if (currentDrawdown > 0) {
          drawdowns.push({
            start: drawdownStart,
            end: timestamp,
            peak: peakEquity,
            trough: peakEquity - currentDrawdown,
            drawdown: currentDrawdown,
            drawdownPct: (currentDrawdown / peakEquity) * 100,
            durationDays: (timestamp - drawdownStart) / (24 * 60 * 60 * 1000),
          });
          currentDrawdown = 0;
        }
      } else {
        currentDrawdown = peakEquity - currentEquity;
        if (drawdownStart === 0) drawdownStart = timestamp;
      }

      equityCurve.push({
        timestamp,
        equity: currentEquity,
        drawdown: currentDrawdown,
        positions: openPositions.size,
      });

      // Process each rule
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (openPositions.size >= config.maxConcurrentPositions) break;

        // Check conditions
        const shouldTrigger = await this.checkConditions(rule, timestamp, openPositions, config);
        
        if (shouldTrigger) {
          const newTrades = await this.executeRuleActions(rule, timestamp, config, equity, openPositions);
          trades.push(...newTrades);
        }

        // Check exit conditions for open positions from this rule
        const exits = this.checkExitConditions(rule, timestamp, openPositions, config);
        trades.push(...exits);
      }
    }

    // Close any remaining open positions at end
    for (const [, position] of openPositions) {
      const lastTimestamp = allTimestamps[allTimestamps.length - 1];
      const exitPrice = this.getPriceAt(position.tokenMint, lastTimestamp);
      if (exitPrice) {
        trades.push(this.closePosition(position, exitPrice, lastTimestamp, config));
        equity += position.pnl || 0;
      }
    }

    // Calculate metrics
    const metrics = this.calculateMetrics(trades, equityCurve, config.initialCapital);
    const monthlyReturns = this.calculateMonthlyReturns(trades, config.initialCapital);
    const tradeAnalysis = this.analyzeTrades(trades);
    const rulePerformance = this.analyzeRulePerformance(trades, rules);

    return {
      config,
      trades,
      equityCurve,
      metrics,
      monthlyReturns,
      drawdowns,
      tradeAnalysis,
      rulePerformance,
    };
  }

  private getAllTimestamps(start: number, end: number): number[] {
    // Get unique timestamps from all cached data
    const timestamps = new Set<number>();
    for (const data of this.dataCache.values()) {
      for (const point of data) {
        if (point.timestamp >= start && point.timestamp <= end) {
          timestamps.add(point.timestamp);
        }
      }
    }
    return Array.from(timestamps).sort((a, b) => a - b);
  }

  private getPriceAt(tokenMint: string, timestamp: number): number | null {
    const data = this.dataCache.get(tokenMint);
    if (!data) return null;
    
    // Find closest data point
    let closest: HistoricalDataPoint | null = null;
    let minDiff = Infinity;
    
    for (const point of data) {
      const diff = Math.abs(point.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
    
    return closest?.close || null;
  }

  private calculateUnrealizedPnL(openPositions: Map<string, BacktestTrade>, timestamp: number): number {
    let total = 0;
    for (const [, position] of openPositions) {
      const currentPrice = this.getPriceAt(position.tokenMint, timestamp);
      if (currentPrice) {
        const pnl = (currentPrice - position.entryPrice) * position.amount;
        total += pnl;
      }
    }
    return total;
  }

  private async checkConditions(
    rule: ExecutableRule,
    timestamp: number,
    openPositions: Map<string, BacktestTrade>,
    config: BacktestConfig
  ): Promise<boolean> {
    for (const condition of rule.conditions) {
      const satisfied = this.evaluateCondition(condition, timestamp, openPositions, config);
      if (!satisfied) return false;
    }
    return true;
  }

  private evaluateCondition(
    condition: ExecutableCondition,
    timestamp: number,
    openPositions: Map<string, BacktestTrade>,
    config: BacktestConfig
  ): boolean {
    // In production, this would fetch real data from the source
    // For backtesting, we use cached historical data
    
    const tokenMint = condition.value && typeof condition.value === 'string' && condition.value.length > 20
      ? condition.value
      : null;

    if (!tokenMint) return false;

    const price = this.getPriceAt(tokenMint, timestamp);
    if (!price) return false;

    const data = this.dataCache.get(tokenMint);
    const currentPoint = data?.find(d => d.timestamp === timestamp);
    
    let value: number;
    
    switch (condition.type) {
      case 'price':
        value = price;
        break;
      case 'volume':
        value = currentPoint?.volumeUsd || 0;
        break;
      case 'smart_money':
        value = currentPoint?.smartMoneyFlow || 0;
        break;
      case 'technical':
        if (condition.value && typeof condition.value === 'object' && 'indicator' in condition.value) {
          const ind = (condition.value as any).indicator;
          if (ind === 'rsi') value = currentPoint?.rsi || 50;
          else if (ind === 'macd') value = currentPoint?.macd?.histogram || 0;
          else value = 0;
        } else {
          value = price;
        }
        break;
      case 'security':
        value = currentPoint?.securityScore || 100;
        break;
      case 'liquidity':
        value = currentPoint?.liquidityUsd || 0;
        break;
      default:
        return false;
    }

    const targetValue = typeof condition.value === 'number' ? condition.value : 0;
    
    switch (condition.operator) {
      case '>': return value > targetValue;
      case '<': return value < targetValue;
      case '>=': return value >= targetValue;
      case '<=': return value <= targetValue;
      case '==': return value === targetValue;
      case 'crosses_above': 
        // Would need previous value
        return value > targetValue;
      case 'crosses_below':
        return value < targetValue;
      default:
        return false;
    }
  }

  private async executeRuleActions(
    rule: ExecutableRule,
    timestamp: number,
    config: BacktestConfig,
    equity: number,
    openPositions: Map<string, BacktestTrade>
  ): Promise<BacktestTrade[]> {
    const trades: BacktestTrade[] = [];

    for (const action of rule.actions) {
      if (action.type === 'buy') {
        const tokenMint = action.params.tokenMint || action.params.token;
        const price = this.getPriceAt(tokenMint, timestamp);
        if (!price) continue;

        let amountUsd: number;
        if (action.params.amount && action.params.currency === 'USD') {
          amountUsd = action.params.amount;
        } else if (action.params.amount && action.params.currency === '%') {
          amountUsd = equity * (action.params.amount / 100);
        } else {
          amountUsd = config.initialCapital * (config.riskPerTradePct / 100);
        }

        // Apply slippage
        const slippage = config.fees.slippageBps / 10000;
        const executedPrice = price * (1 + slippage);
        const amount = amountUsd / executedPrice;
        const fees = amountUsd * (config.fees.swapFeeBps / 10000) + config.fees.gasFeeUsd;

        if (amountUsd + fees > equity) continue; // Not enough capital

        const trade: BacktestTrade = {
          id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          ruleId: rule.id,
          tokenMint,
          tokenSymbol: action.params.token || 'UNKNOWN',
          side: 'buy',
          entryPrice: executedPrice,
          amount,
          amountUsd,
          entryTime: timestamp,
          fees,
          slippage: slippage * 10000,
          status: 'open',
          trigger: rule.name,
          metadata: { action: 'buy', ruleType: rule.type },
        };

        openPositions.set(trade.id, trade);
        trades.push(trade);
        equity -= amountUsd + fees;
      }
    }

    return trades;
  }

  private checkExitConditions(
    rule: ExecutableRule,
    timestamp: number,
    openPositions: Map<string, BacktestTrade>,
    config: BacktestConfig
  ): BacktestTrade[] {
    const exits: BacktestTrade[] = [];

    for (const [tradeId, position] of openPositions) {
      // Only check exits for trades from this rule
      if (position.ruleId !== rule.id) continue;

      let shouldExit = false;
      let exitReason = '';

      // Check trailing stop
      if (rule.type === 'trailing_stop' || rule.actions.some(a => a.type === 'update_trailing')) {
        const trailPct = rule.actions.find(a => a.type === 'update_trailing')?.params.trailPercent || 15;
        const currentPrice = this.getPriceAt(position.tokenMint, timestamp);
        if (currentPrice) {
          const peakPrice = Math.max(position.entryPrice, currentPrice); // Simplified
          const drawdown = (peakPrice - currentPrice) / peakPrice * 100;
          if (drawdown >= trailPct) {
            shouldExit = true;
            exitReason = `trailing_stop_${trailPct}pct`;
          }
        }
      }

      // Check take profit
      const tpAction = rule.actions.find(a => a.params.price && a.params.type === 'target');
      if (tpAction) {
        const currentPrice = this.getPriceAt(position.tokenMint, timestamp);
        if (currentPrice && currentPrice >= tpAction.params.price) {
          shouldExit = true;
          exitReason = 'take_profit';
        }
      }

      // Check stop loss
      const slAction = rule.actions.find(a => a.params.price && a.params.type === 'stop');
      if (slAction) {
        const currentPrice = this.getPriceAt(position.tokenMint, timestamp);
        if (currentPrice && currentPrice <= slAction.params.price) {
          shouldExit = true;
          exitReason = 'stop_loss';
        }
      }

      // Time-based exit for DCA
      if (rule.type === 'dca') {
        const maxHold = 30 * 24 * 60 * 60 * 1000; // 30 days
        if (timestamp - position.entryTime > maxHold) {
          shouldExit = true;
          exitReason = 'max_hold_time';
        }
      }

      if (shouldExit) {
        const currentPrice = this.getPriceAt(position.tokenMint, timestamp);
        if (currentPrice) {
          exits.push(this.closePosition(position, currentPrice, timestamp, config, exitReason));
          openPositions.delete(tradeId);
        }
      }
    }

    return exits;
  }

  private closePosition(
    position: BacktestTrade,
    exitPrice: number,
    exitTime: number,
    config: BacktestConfig,
    reason: string = 'manual'
  ): BacktestTrade {
    // Apply slippage on exit
    const slippage = config.fees.slippageBps / 10000;
    const executedPrice = exitPrice * (1 - slippage);
    const amountUsd = position.amount * executedPrice;
    const fees = amountUsd * (config.fees.swapFeeBps / 10000) + config.fees.gasFeeUsd;
    const pnl = amountUsd - position.amountUsd - position.fees - fees;
    const pnlPercent = (pnl / position.amountUsd) * 100;

    return {
      ...position,
      exitPrice: executedPrice,
      exitTime,
      pnl,
      pnlPercent,
      fees: position.fees + fees,
      slippage: position.slippage + slippage * 10000,
      status: 'closed',
      metadata: { ...position.metadata, exitReason: reason },
    };
  }

  private calculateMetrics(
    trades: BacktestTrade[],
    equityCurve: EquityPoint[],
    initialCapital: number
  ): BacktestResult['metrics'] {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined);
    const finalEquity = equityCurve[equityCurve.length - 1]?.equity || initialCapital;
    const totalReturn = finalEquity - initialCapital;
    const totalReturnPct = (totalReturn / initialCapital) * 100;

    const winTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const lossTrades = closedTrades.filter(t => (t.pnl || 0) <= 0);
    const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;

    const grossProfit = winTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(lossTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    // Sharpe ratio from equity curve
    const returns = equityCurve.slice(1).map((point, i) => {
      const prev = equityCurve[i].equity;
      return prev > 0 ? (point.equity - prev) / prev : 0;
    });
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252 * 24 * 12) : 0; // Assuming 5-min bars

    // Max drawdown
    let peak = initialCapital;
    let maxDD = 0;
    for (const point of equityCurve) {
      if (point.equity > peak) peak = point.equity;
      const dd = peak - point.equity;
      if (dd > maxDD) maxDD = dd;
    }
    const maxDrawdownPct = peak > 0 ? (maxDD / peak) * 100 : 0;

    // Calmar
    const calmarRatio = maxDrawdownPct > 0 ? totalReturnPct / maxDrawdownPct : 0;

    return {
      totalReturn,
      totalReturnPct,
      annualizedReturn: totalReturnPct * (365 / ((equityCurve[equityCurve.length - 1]?.timestamp || Date.now()) - equityCurve[0]?.timestamp) / (24 * 60 * 60 * 1000)),
      sharpeRatio,
      sortinoRatio: sharpeRatio * 1.2, // Approximation
      calmarRatio,
      maxDrawdown: maxDD,
      maxDrawdownPct,
      winRate,
      profitFactor,
      totalTrades: closedTrades.length,
      avgTradePnL: closedTrades.length > 0 ? closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / closedTrades.length : 0,
      totalFees: trades.reduce((sum, t) => sum + t.fees, 0),
      totalSlippage: trades.reduce((sum, t) => sum + t.amountUsd * (t.slippage / 10000), 0),
    };
  }

  private calculateMonthlyReturns(trades: BacktestTrade[], initialCapital: number): MonthlyReturn[] {
    const monthlyMap = new Map<string, { pnl: number; trades: number; wins: number }>();
    
    for (const trade of trades) {
      if (trade.status !== 'closed' || trade.pnl === undefined) continue;
      
      const date = new Date(trade.exitTime || trade.entryTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const entry = monthlyMap.get(monthKey) || { pnl: 0, trades: 0, wins: 0 };
      entry.pnl += trade.pnl;
      entry.trades += 1;
      if (trade.pnl > 0) entry.wins += 1;
      monthlyMap.set(monthKey, entry);
    }

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        return: data.pnl,
        returnPct: initialCapital > 0 ? (data.pnl / initialCapital) * 100 : 0,
        trades: data.trades,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private analyzeTrades(trades: BacktestTrade[]): TradeAnalysis {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined);
    
    if (closedTrades.length === 0) {
      return {
        totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0,
        avgWin: 0, avgLoss: 0, avgWinPct: 0, avgLossPct: 0,
        profitFactor: 0, expectancy: 0, avgHoldTime: 0,
        bestTrade: null as any, worstTrade: null as any,
        largestWin: 0, largestLoss: 0, consecutiveWins: 0, consecutiveLosses: 0,
        sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0,
      };
    }

    const wins = closedTrades.filter(t => t.pnl! > 0);
    const losses = closedTrades.filter(t => t.pnl! <= 0);

    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl!, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl!, 0) / losses.length : 0;
    const avgWinPct = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / wins.length : 0;
    const avgLossPct = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / losses.length : 0;

    const grossProfit = wins.reduce((sum, t) => sum + t.pnl!, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    const expectancy = (wins.length / closedTrades.length) * avgWin + (losses.length / closedTrades.length) * avgLoss;

    const holdTimes = closedTrades.map(t => (t.exitTime! - t.entryTime) / (1000 * 60 * 60)); // hours
    const avgHoldTime = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;

    const bestTrade = closedTrades.reduce((best, t) => t.pnl! > best.pnl! ? t : best, closedTrades[0]);
    const worstTrade = closedTrades.reduce((worst, t) => t.pnl! < worst.pnl! ? t : worst, closedTrades[0]);

    // Consecutive wins/losses
    let consecutiveWins = 0, maxConsecutiveWins = 0;
    let consecutiveLosses = 0, maxConsecutiveLosses = 0;
    
    for (const trade of closedTrades) {
      if (trade.pnl! > 0) {
        consecutiveWins++;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
        consecutiveLosses = 0;
      } else {
        consecutiveLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
        consecutiveWins = 0;
      }
    }

    return {
      totalTrades: closedTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: (wins.length / closedTrades.length) * 100,
      avgWin,
      avgLoss,
      avgWinPct,
      avgLossPct,
      profitFactor,
      expectancy,
      avgHoldTime,
      bestTrade,
      worstTrade,
      largestWin: bestTrade.pnl!,
      largestLoss: worstTrade.pnl!,
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
      sharpeRatio: 0, // Would need equity curve
      sortinoRatio: 0,
      calmarRatio: 0,
    };
  }

  private analyzeRulePerformance(trades: BacktestTrade[], rules: ExecutableRule[]): RulePerformance[] {
    const ruleMap = new Map<string, BacktestTrade[]>();
    
    for (const trade of trades) {
      if (trade.status !== 'closed') continue;
      if (!ruleMap.has(trade.ruleId)) ruleMap.set(trade.ruleId, []);
      ruleMap.get(trade.ruleId)!.push(trade);
    }

    return Array.from(ruleMap.entries()).map(([ruleId, ruleTrades]) => {
      const rule = rules.find(r => r.id === ruleId);
      const wins = ruleTrades.filter(t => t.pnl! > 0);
      const totalPnL = ruleTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const totalInvested = ruleTrades.reduce((sum, t) => sum + t.amountUsd, 0);
      
      const tokenPnL = new Map<string, number>();
      for (const trade of ruleTrades) {
        tokenPnL.set(trade.tokenSymbol, (tokenPnL.get(trade.tokenSymbol) || 0) + (trade.pnl || 0));
      }
      const bestToken = Array.from(tokenPnL.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      const worstToken = Array.from(tokenPnL.entries()).sort((a, b) => a[1] - b[1])[0]?.[0] || '';

      return {
        ruleId,
        ruleName: rule?.name || 'Unknown',
        totalTrades: ruleTrades.length,
        winRate: ruleTrades.length > 0 ? (wins.length / ruleTrades.length) * 100 : 0,
        totalPnL,
        totalPnLPct: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
        avgPnL: ruleTrades.length > 0 ? totalPnL / ruleTrades.length : 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        bestToken,
        worstToken,
      };
    });
  }

  private getCacheKey(rules: ExecutableRule[], config: BacktestConfig): string {
    const ruleIds = rules.map(r => r.id).sort().join(',');
    return `${ruleIds}_${config.startDate}_${config.endDate}_${config.initialCapital}`;
  }

  clearCache(): void {
    this.dataCache.clear();
    this.resultsCache.clear();
  }
}

// Types for executable rules (simplified from nl-to-rule)
export interface ExecutableRule {
  id: string;
  name: string;
  type: 'snipe' | 'trailing_stop' | 'dca' | 'copy_trade' | 'alert' | 'rebalance';
  enabled: boolean;
  priority: number;
  conditions: ExecutableCondition[];
  actions: ExecutableAction[];
  riskLimits: RiskLimits;
  metadata: Record<string, any>;
}

export interface ExecutableCondition {
  type: string;
  operator: string;
  value: number | string | object;
  timeframe?: string;
  source: 'gmgn' | 'dexscreener' | 'jupiter' | 'price_feed' | 'custom';
}

export interface ExecutableAction {
  type: 'buy' | 'sell' | 'alert' | 'notify' | 'execute_dca' | 'update_trailing' | 'copy_trade';
  params: Record<string, any>;
  maxRetries: number;
  retryDelayMs: number;
}

export interface RiskLimits {
  maxPositionUsd: number;
  maxDailyLossUsd: number;
  maxSlippageBps: number;
  requireConfirmation: boolean;
  allowedTokens?: string[];
  blockedTokens?: string[];
}

// Singleton
let backtestEngineInstance: BacktestEngine | null = null;

export function getBacktestEngine(): BacktestEngine {
  if (!backtestEngineInstance) {
    backtestEngineInstance = new BacktestEngine();
  }
  return backtestEngineInstance;
}

// React hook
export function useBacktestEngine() {
  const engine = getBacktestEngine();
  
  return {
    runBacktest: (rules: ExecutableRule[], config: BacktestConfig, dataProvider: any) => 
      engine.runBacktest(rules, config, dataProvider),
    clearCache: () => engine.clearCache(),
  };
}

export type { BacktestConfig, BacktestTrade, BacktestResult, EquityPoint, MonthlyReturn, DrawdownPeriod, TradeAnalysis, RulePerformance, HistoricalDataPoint };