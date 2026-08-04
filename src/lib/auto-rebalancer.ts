/**
 * Automated Rebalancing
 * Threshold-based + calendar-based, gas-aware execution
 */

export interface RebalanceRule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'threshold' | 'calendar' | 'hybrid';
  targetAllocations: TargetAllocation[];
  thresholdPct: number; // Deviation from target to trigger rebalance
  calendarSchedule?: CalendarSchedule;
  minTradeUsd: number; // Minimum trade size
  maxTradeUsd: number; // Maximum trade size per token
  maxSlippageBps: number;
  gasBudgetUsd: number; // Max gas per rebalance
  useLimitOrders: boolean;
  excludeTokens: string[]; // Token mints to exclude
  onlyRebalanceIf: 'always' | 'profitable' | 'net_positive';
  createdAt: number;
  lastExecuted?: number;
  executionCount: number;
}

export interface TargetAllocation {
  tokenMint: string;
  tokenSymbol: string;
  targetWeight: number; // % of portfolio
  minWeight?: number;
  maxWeight?: number;
  driftTolerance?: number; // Custom threshold for this token
}

export interface CalendarSchedule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  hour: number; // 0-23 UTC
  minute: number; // 0-59
  timezone: string; // e.g., 'America/New_York'
}

export interface RebalancePlan {
  ruleId: string;
  triggeredAt: number;
  triggerType: 'threshold' | 'calendar' | 'manual';
  currentAllocations: CurrentAllocation[];
  targetAllocations: TargetAllocation[];
  trades: RebalanceTrade[];
  estimatedGasUsd: number;
  estimatedSlippageUsd: number;
  netBenefitUsd: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  executedTrades: ExecutedTrade[];
  error?: string;
}

export interface CurrentAllocation {
  tokenMint: string;
  tokenSymbol: string;
  currentAmount: number;
  currentValueUsd: number;
  currentWeight: number;
  targetWeight: number;
  deviation: number; // %
  needsRebalance: boolean;
}

export interface RebalanceTrade {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  side: 'buy' | 'sell';
  amount: number;
  amountUsd: number;
  estimatedPrice: number;
  minPrice?: number; // For limit orders
  maxSlippageBps: number;
  route?: string; // DEX route
  priority: number; // Execute sells first
}

export interface ExecutedTrade {
  tradeId: string;
  signature: string;
  actualAmount: number;
  actualPrice: number;
  actualValueUsd: number;
  feeUsd: number;
  slippageBps: number;
  timestamp: number;
  status: 'success' | 'partial' | 'failed';
}

export interface RebalanceResult {
  plan: RebalancePlan;
  success: boolean;
  executedValueUsd: number;
  totalFeesUsd: number;
  totalSlippageUsd: number;
  finalAllocations: CurrentAllocation[];
  executionTimeMs: number;
}

export interface GasEstimate {
  tokenMint: string;
  estimatedGasUsd: number;
  estimatedGasLamports: number;
  priorityFeeLamports: number;
  baseFeeLamports: number;
  confidence: number;
}

class AutoRebalancer {
  private rules: Map<string, RebalanceRule> = new Map();
  private executionHistory: RebalancePlan[] = [];
  private executionListeners: Set<(result: RebalanceResult) => void> = new Set();
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Add a rebalance rule
   */
  addRule(rule: RebalanceRule): void {
    this.validateRule(rule);
    this.rules.set(rule.id, rule);
    this.rescheduleRule(rule);
  }

  /**
   * Update a rule
   */
  updateRule(ruleId: string, updates: Partial<RebalanceRule>): void {
    const rule = this.rules.get(ruleId);
    if (!rule) throw new Error(`Rule ${ruleId} not found`);
    
    const updated = { ...rule, ...updates };
    this.validateRule(updated);
    this.rules.set(ruleId, updated);
    this.rescheduleRule(updated);
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.clearRuleSchedule(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): RebalanceRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific rule
   */
  getRule(ruleId: string): RebalanceRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Manually trigger rebalance
   */
  async triggerRebalance(ruleId: string, portfolio: any): Promise<RebalanceResult> {
    const rule = this.rules.get(ruleId);
    if (!rule) throw new Error(`Rule ${ruleId} not found`);

    const plan = await this.generateRebalancePlan(rule, portfolio, 'manual');
    return this.executeRebalancePlan(plan);
  }

  /**
   * Check all threshold rules and trigger if needed
   */
  async checkThresholdRules(portfolio: any): Promise<RebalanceResult[]> {
    const results: RebalanceResult[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.type === 'calendar') continue;

      const plan = await this.generateRebalancePlan(rule, portfolio, 'threshold');
      
      if (plan.trades.length > 0 && this.shouldExecute(plan, rule)) {
        const result = await this.executeRebalancePlan(plan);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Start the scheduler
   */
  startScheduler(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Check every minute for calendar triggers
    this.schedulerInterval = setInterval(() => {
      this.checkCalendarTriggers();
    }, 60000);

    // Schedule each calendar rule
    for (const rule of this.rules.values()) {
      if (rule.enabled && rule.type !== 'threshold' && rule.calendarSchedule) {
        this.scheduleCalendarRule(rule);
      }
    }
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.isRunning = false;
  }

  /**
   * Subscribe to execution results
   */
  subscribe(callback: (result: RebalanceResult) => void): () => void {
    this.executionListeners.add(callback);
    return () => this.executionListeners.delete(callback);
  }

  /**
   * Get execution history
   */
  getHistory(limit: number = 50): RebalancePlan[] {
    return this.executionHistory
      .sort((a, b) => b.triggeredAt - a.triggeredAt)
      .slice(0, limit);
  }

  /**
   * Estimate gas for rebalance
   */
  async estimateGas(plan: RebalancePlan): Promise<GasEstimate[]> {
    const estimates: GasEstimate[] = [];

    for (const trade of plan.trades) {
      // In production, use RPC to simulate transaction
      const estimate: GasEstimate = {
        tokenMint: trade.tokenMint,
        estimatedGasUsd: trade.amountUsd * 0.0001, // ~0.01% of trade value
        estimatedGasLamports: 5000,
        priorityFeeLamports: 1000,
        baseFeeLamports: 5000,
        confidence: 0.8,
      };
      estimates.push(estimate);
    }

    return estimates;
  }

  // ========== PRIVATE METHODS ==========

  private validateRule(rule: RebalanceRule): void {
    if (!rule.id || !rule.name) {
      throw new Error('Rule must have id and name');
    }

    const totalWeight = rule.targetAllocations.reduce((sum, a) => sum + a.targetWeight, 0);
    if (Math.abs(totalWeight - 100) > 0.1) {
      throw new Error(`Target allocations must sum to 100%, got ${totalWeight}%`);
    }

    if (rule.thresholdPct <= 0) {
      throw new Error('Threshold must be positive');
    }

    if (rule.type !== 'threshold' && !rule.calendarSchedule) {
      throw new Error('Calendar rules must have calendarSchedule');
    }
  }

  private async generateRebalancePlan(
    rule: RebalanceRule,
    portfolio: any,
    triggerType: 'threshold' | 'calendar' | 'manual'
  ): Promise<RebalancePlan> {
    const currentAllocations = this.calculateCurrentAllocations(portfolio, rule.targetAllocations);
    const trades = this.calculateTrades(currentAllocations, rule);
    
    // Estimate costs
    const estimatedGasUsd = trades.reduce((sum, t) => sum + t.amountUsd * 0.0001, 0);
    const estimatedSlippageUsd = trades.reduce((sum, t) => sum + t.amountUsd * (t.maxSlippageBps / 10000), 0);
    const netBenefitUsd = this.calculateNetBenefit(currentAllocations, trades, rule);

    const plan: RebalancePlan = {
      ruleId: rule.id,
      triggeredAt: Date.now(),
      triggerType,
      currentAllocations,
      targetAllocations: rule.targetAllocations,
      trades,
      estimatedGasUsd,
      estimatedSlippageUsd,
      netBenefitUsd,
      status: 'pending',
      executedTrades: [],
    };

    return plan;
  }

  private calculateCurrentAllocations(
    portfolio: any,
    targets: TargetAllocation[]
  ): CurrentAllocation[] {
    const totalValue = portfolio.totalValueUsd || 0;
    const allocations: CurrentAllocation[] = [];

    for (const target of targets) {
      const holding = portfolio.tokenBalances?.find(
        (t: any) => t.mint === target.tokenMint
      );
      
      const currentValueUsd = holding?.totalValueUsd || 0;
      const currentWeight = totalValue > 0 ? (currentValueUsd / totalValue) * 100 : 0;
      const deviation = currentWeight - target.targetWeight;

      allocations.push({
        tokenMint: target.tokenMint,
        tokenSymbol: target.tokenSymbol,
        currentAmount: holding?.totalAmount || 0,
        currentValueUsd,
        currentWeight,
        targetWeight: target.targetWeight,
        deviation,
        needsRebalance: Math.abs(deviation) > (target.driftTolerance || target.targetWeight * 0.1), // 10% relative or custom
      });
    }

    return allocations;
  }

  private calculateTrades(
    allocations: CurrentAllocation[],
    rule: RebalanceRule
  ): RebalanceTrade[] {
    const trades: RebalanceTrade[] = [];
    const totalValue = allocations.reduce((sum, a) => sum + a.currentValueUsd, 0);

    // Sort by priority: sells first (to free up capital), then buys
    const sorted = [...allocations].sort((a, b) => {
      if (a.deviation > 0 && b.deviation < 0) return -1; // Sell before buy
      if (a.deviation < 0 && b.deviation > 0) return 1;
      return Math.abs(b.deviation) - Math.abs(a.deviation); // Largest deviation first
    });

    for (const alloc of sorted) {
      const deviationUsd = totalValue * (alloc.deviation / 100);
      const absDeviationUsd = Math.abs(deviationUsd);

      // Check minimum trade size
      if (absDeviationUsd < rule.minTradeUsd) continue;

      // Cap at max trade size
      const tradeUsd = Math.min(absDeviationUsd, rule.maxTradeUsd);

      if (tradeUsd < rule.minTradeUsd) continue;

      const side = deviationUsd > 0 ? 'sell' : 'buy';
      const estimatedPrice = this.getTokenPrice(alloc.tokenMint);
      const amount = tradeUsd / estimatedPrice;

      trades.push({
        id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        tokenMint: alloc.tokenMint,
        tokenSymbol: alloc.tokenSymbol,
        side,
        amount,
        amountUsd: tradeUsd,
        estimatedPrice,
        maxSlippageBps: rule.maxSlippageBps,
        priority: side === 'sell' ? 1 : 2,
      });
    }

    return trades;
  }

  private calculateNetBenefit(
    allocations: CurrentAllocation[],
    trades: RebalanceTrade[],
    rule: RebalanceRule
  ): number {
    // Simplified: benefit = reduction in tracking error - costs
    const currentTrackingError = allocations.reduce(
      (sum, a) => sum + Math.abs(a.deviation), 0
    );
    
    const estimatedCosts = trades.reduce(
      (sum, t) => sum + t.amountUsd * (rule.maxSlippageBps / 10000) + t.amountUsd * 0.0001, 0
    );
    
    // Expected tracking error after rebalance (assume perfect)
    const expectedTrackingError = 0;
    
    return (currentTrackingError - expectedTrackingError) * (allocations.reduce((s, a) => s + a.currentValueUsd, 0) / 100) - estimatedCosts;
  }

  private shouldExecute(plan: RebalancePlan, rule: RebalanceRule): boolean {
    // Don't execute if net benefit is negative
    if (plan.netBenefitUsd < 0) return false;
    
    // Don't execute if only profitable mode and not profitable
    if (rule.onlyRebalanceIf === 'profitable' && plan.netBenefitUsd <= 0) return false;
    
    // Don't execute if gas budget exceeded
    if (plan.estimatedGasUsd > rule.gasBudgetUsd) return false;
    
    // Don't execute if no trades
    if (plan.trades.length === 0) return false;

    return true;
  }

  private async executeRebalancePlan(plan: RebalancePlan): Promise<RebalanceResult> {
    const startTime = Date.now();
    plan.status = 'executing';
    const executedTrades: ExecutedTrade[] = [];
    let executedValueUsd = 0;
    let totalFeesUsd = 0;
    let totalSlippageUsd = 0;

    try {
      // Execute trades in priority order
      for (const trade of plan.trades) {
        const executed = await this.executeTrade(trade, plan.ruleId);
        
        if (executed) {
          executedTrades.push(executed);
          executedValueUsd += executed.actualValueUsd;
          totalFeesUsd += executed.feeUsd;
          totalSlippageUsd += executed.actualValueUsd * (executed.slippageBps / 10000);
        }
      }

      // Update rule last executed
      const rule = this.rules.get(plan.ruleId);
      if (rule) {
        rule.lastExecuted = Date.now();
        rule.executionCount += 1;
      }

      plan.status = 'completed';
      plan.executedTrades = executedTrades;

      // Calculate final allocations
      const finalAllocations = this.calculateFinalAllocations(plan);

      const result: RebalanceResult = {
        plan,
        success: true,
        executedValueUsd,
        totalFeesUsd,
        totalSlippageUsd,
        finalAllocations,
        executionTimeMs: Date.now() - startTime,
      };

      // Notify listeners
      for (const listener of this.executionListeners) {
        try {
          listener(result);
        } catch (error) {
          console.error('Rebalance listener error:', error);
        }
      }

      // Save to history
      this.executionHistory.push(plan);
      if (this.executionHistory.length > 100) {
        this.executionHistory.shift();
      }

      return result;
    } catch (error) {
      plan.status = 'failed';
      plan.error = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        plan,
        success: false,
        executedValueUsd: 0,
        totalFeesUsd: 0,
        totalSlippageUsd: 0,
        finalAllocations: [],
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private async executeTrade(trade: RebalanceTrade, ruleId: string): Promise<ExecutedTrade | null> {
    // In production, this would:
    // 1. Build transaction via Jupiter/Raydium/Orca
    // 2. Sign with wallet
    // 3. Submit and confirm
    // 4. Return actual results
    
    // Mock execution
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    
    const slippage = Math.random() * (trade.maxSlippageBps / 10000) * 0.5; // 0-50% of max
    const actualPrice = trade.estimatedPrice * (trade.side === 'buy' ? (1 + slippage) : (1 - slippage));
    const actualValueUsd = trade.amount * actualPrice;
    const feeUsd = trade.amountUsd * 0.0001; // ~0.01%
    
    return {
      tradeId: trade.id,
      signature: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 16)}`,
      actualAmount: trade.amount,
      actualPrice,
      actualValueUsd,
      feeUsd,
      slippageBps: slippage * 10000,
      timestamp: Date.now(),
      status: 'success',
    };
  }

  private calculateFinalAllocations(plan: RebalancePlan): CurrentAllocation[] {
    // In production, refetch portfolio after execution
    // For now, return target allocations
    return plan.targetAllocations.map(t => ({
      tokenMint: t.tokenMint,
      tokenSymbol: t.tokenSymbol,
      currentAmount: 0,
      currentValueUsd: 0,
      currentWeight: t.targetWeight,
      targetWeight: t.targetWeight,
      deviation: 0,
      needsRebalance: false,
    }));
  }

  private checkCalendarTriggers(): void {
    const now = new Date();
    
    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.type === 'threshold' || !rule.calendarSchedule) continue;
      
      if (this.isTimeMatch(now, rule.calendarSchedule)) {
        // Trigger in background (would need portfolio data)
        console.log(`[AutoRebalancer] Calendar trigger for rule: ${rule.name}`);
      }
    }
  }

  private isTimeMatch(date: Date, schedule: CalendarSchedule): boolean {
    // Convert to schedule timezone
    const utcHour = date.getUTCHours();
    const utcMinute = date.getUTCMinutes();
    const utcDay = date.getUTCDay();
    const utcDate = date.getUTCDate();
    
    if (utcHour !== schedule.hour || utcMinute !== schedule.minute) return false;
    
    switch (schedule.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        return utcDay === (schedule.dayOfWeek ?? 0);
      case 'biweekly':
        return utcDay === (schedule.dayOfWeek ?? 0) && Math.floor(utcDate / 14) % 2 === 0;
      case 'monthly':
        return utcDate === (schedule.dayOfMonth ?? 1);
      case 'quarterly':
        return utcDate === (schedule.dayOfMonth ?? 1) && [1, 4, 7, 10].includes(date.getUTCMonth() + 1);
      default:
        return false;
    }
  }

  private scheduleCalendarRule(rule: RebalanceRule): void {
    // In production, use a proper job scheduler
    // For now, the checkCalendarTriggers interval handles it
  }

  private rescheduleRule(rule: RebalanceRule): void {
    this.clearRuleSchedule(rule.id);
    if (rule.enabled && rule.type !== 'threshold' && rule.calendarSchedule) {
      this.scheduleCalendarRule(rule);
    }
  }

  private clearRuleSchedule(ruleId: string): void {
    // Clear any scheduled jobs for this rule
  }

  private getTokenPrice(mint: string): number {
    const prices: Record<string, number> = {
      'So11111111111111111111111111111111111111112': 72.97,
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 0.142,
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK': 0.842,
      '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 0.000024,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTt1v1': 1.0,
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0,
    };
    return prices[mint] || 1;
  }
}

// Singleton
let autoRebalancerInstance: AutoRebalancer | null = null;

export function getAutoRebalancer(): AutoRebalancer {
  if (!autoRebalancerInstance) {
    autoRebalancerInstance = new AutoRebalancer();
  }
  return autoRebalancerInstance;
}

// React hook
export function useAutoRebalancer() {
  const rebalancer = getAutoRebalancer();
  
  return {
    addRule: (rule: RebalanceRule) => rebalancer.addRule(rule),
    updateRule: (id: string, updates: Partial<RebalanceRule>) => rebalancer.updateRule(id, updates),
    removeRule: (id: string) => rebalancer.removeRule(id),
    getRules: () => rebalancer.getRules(),
    getRule: (id: string) => rebalancer.getRule(id),
    triggerRebalance: (id: string, portfolio: any) => rebalancer.triggerRebalance(id, portfolio),
    checkThresholdRules: (portfolio: any) => rebalancer.checkThresholdRules(portfolio),
    startScheduler: () => rebalancer.startScheduler(),
    stopScheduler: () => rebalancer.stopScheduler(),
    subscribe: (callback: (result: RebalanceResult) => void) => rebalancer.subscribe(callback),
    getHistory: (limit?: number) => rebalancer.getHistory(limit),
    estimateGas: (plan: RebalancePlan) => rebalancer.estimateGas(plan),
  };
}

export type { RebalanceRule, TargetAllocation, CalendarSchedule, RebalancePlan, CurrentAllocation, RebalanceTrade, ExecutedTrade, RebalanceResult, GasEstimate };