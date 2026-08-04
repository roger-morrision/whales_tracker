/**
 * Advanced Order Types
 * Limit orders, DCA strategies, Stop-loss/Take-profit with Jupiter integration
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { getJupiterExecutor, JupiterQuoteParams } from './jupiter-executor';

export type OrderType = 'limit' | 'dca' | 'stop-loss' | 'take-profit' | 'trailing-stop';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'active' | 'filled' | 'cancelled' | 'expired' | 'failed';

export interface BaseOrder {
  id: string;
  type: OrderType;
  side: OrderSide;
  tokenMint: string;
  tokenSymbol: string;
  createdAt: number;
  updatedAt: number;
  status: OrderStatus;
  userPublicKey: string;
}

export interface LimitOrder extends BaseOrder {
  type: 'limit';
  targetPrice: number; // Price in USDC per token
  amount: number; // Amount in token units
  slippageBps: number;
  expiresAt?: number;
  filledAmount: number;
  filledAt?: number;
}

export interface DCAOrder extends BaseOrder {
  type: 'dca';
  totalAmount: number; // Total USDC to spend
  amountPerOrder: number; // USDC per execution
  intervalMs: number; // Milliseconds between orders
  maxOrders: number;
  slippageBps: number;
  executedOrders: number;
  nextExecutionAt: number;
  executions: DCAExecution[];
}

export interface DCAExecution {
  timestamp: number;
  amount: number; // USDC spent
  tokenAmount: number;
  price: number;
  signature?: string;
  status: 'pending' | 'filled' | 'failed';
}

export interface StopLossOrder extends BaseOrder {
  type: 'stop-loss' | 'take-profit';
  triggerPrice: number; // Price that triggers the order
  amount: number; // Token amount to sell/buy
  slippageBps: number;
  triggeredAt?: number;
  executedAt?: number;
  executionSignature?: string;
}

export interface TrailingStopOrder extends BaseOrder {
  type: 'trailing-stop';
  trailPercent: number; // Percentage to trail from peak
  amount: number; // Token amount
  slippageBps: number;
  peakPrice: number;
  triggerPrice: number; // Current trigger price (peak * (1 - trailPercent))
  triggeredAt?: number;
  executedAt?: number;
}

export type AdvancedOrder = LimitOrder | DCAOrder | StopLossOrder | TrailingStopOrder;

export interface OrderExecutionResult {
  orderId: string;
  success: boolean;
  signature?: string;
  filledAmount?: number;
  avgPrice?: number;
  fee?: number;
  error?: string;
  timestamp: number;
}

// Order store interface
export interface OrderStore {
  orders: Map<string, AdvancedOrder>;
  addOrder: (order: AdvancedOrder) => void;
  updateOrder: (id: string, updates: Partial<AdvancedOrder>) => void;
  removeOrder: (id: string) => void;
  getOrder: (id: string) => AdvancedOrder | undefined;
  getActiveOrders: (userPublicKey: string) => AdvancedOrder[];
  getOrdersByToken: (tokenMint: string) => AdvancedOrder[];
}

class AdvancedOrderManager {
  private connection: Connection;
  private executor = getJupiterExecutor();
  private orders = new Map<string, AdvancedOrder>();
  private executionIntervals = new Map<string, NodeJS.Timeout>();
  private priceCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(rpcEndpoint?: string) {
    this.connection = new Connection(
      rpcEndpoint || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
  }

  // Order management
  addOrder(order: AdvancedOrder): void {
    this.orders.set(order.id, order);
    this.scheduleOrderCheck(order);
  }

  updateOrder(id: string, updates: Partial<AdvancedOrder>): void {
    const order = this.orders.get(id);
    if (!order) return;
    
    const updated = { ...order, ...updates, updatedAt: Date.now() };
    this.orders.set(id, updated);
    this.scheduleOrderCheck(updated);
  }

  removeOrder(id: string): boolean {
    const order = this.orders.get(id);
    if (!order) return false;
    
    // Clear any scheduled checks
    const interval = this.executionIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.executionIntervals.delete(id);
    }
    
    this.orders.delete(id);
    return true;
  }

  getOrder(id: string): AdvancedOrder | undefined {
    return this.orders.get(id);
  }

  getActiveOrders(userPublicKey: string): AdvancedOrder[] {
    return Array.from(this.orders.values()).filter(
      o => o.userPublicKey === userPublicKey && 
           (o.status === 'pending' || o.status === 'active')
    );
  }

  getOrdersByToken(tokenMint: string): AdvancedOrder[] {
    return Array.from(this.orders.values()).filter(
      o => o.tokenMint === tokenMint
    );
  }

  // Start price monitoring for all active orders
  startMonitoring(getCurrentPrice: (mint: string) => number | undefined): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    this.priceCheckInterval = setInterval(() => {
      this.checkAllOrders(getCurrentPrice);
    }, 5000); // Check every 5 seconds
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
      this.priceCheckInterval = null;
    }
  }

  private checkAllOrders(getCurrentPrice: (mint: string) => number | undefined): void {
    for (const order of this.orders.values()) {
      if (order.status !== 'pending' && order.status !== 'active') continue;
      
      const currentPrice = getCurrentPrice(order.tokenMint);
      if (currentPrice === undefined) continue;
      
      this.checkOrder(order, currentPrice);
    }
  }

  private async checkOrder(order: AdvancedOrder, currentPrice: number): Promise<void> {
    switch (order.type) {
      case 'limit':
        await this.checkLimitOrder(order as LimitOrder, currentPrice);
        break;
      case 'dca':
        await this.checkDCAOrder(order as DCAOrder, currentPrice);
        break;
      case 'stop-loss':
      case 'take-profit':
        await this.checkStopOrder(order as StopLossOrder, currentPrice);
        break;
      case 'trailing-stop':
        await this.checkTrailingStop(order as TrailingStopOrder, currentPrice);
        break;
    }
  }

  private async checkLimitOrder(order: LimitOrder, currentPrice: number): Promise<void> {
    const shouldExecute = order.side === 'buy' 
      ? currentPrice <= order.targetPrice
      : currentPrice >= order.targetPrice;

    if (shouldExecute) {
      await this.executeLimitOrder(order);
    }
  }

  private async executeLimitOrder(order: LimitOrder): Promise<OrderExecutionResult> {
    // Mark as active
    this.updateOrder(order.id, { status: 'active' });

    try {
      // Get quote from Jupiter
      const quoteParams: JupiterQuoteParams = {
        inputMint: order.side === 'buy' ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' : order.tokenMint,
        outputMint: order.side === 'buy' ? order.tokenMint : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: order.side === 'buy' 
          ? Math.floor((order.amount * order.targetPrice) * 1e6) // USDC amount
          : Math.floor(order.amount * 1e9), // Token amount in lamports
        slippageBps: order.slippageBps,
      };

      const quote = await this.executor.getQuote(quoteParams);
      if (!quote) {
        throw new Error('Failed to get quote');
      }

      // Note: Actual execution requires wallet signing
      // This would be triggered via a callback to the UI
      this.updateOrder(order.id, { 
        status: 'filled',
        filledAmount: order.amount,
        filledAt: Date.now(),
      });

      return {
        orderId: order.id,
        success: true,
        filledAmount: order.amount,
        avgPrice: order.targetPrice,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      this.updateOrder(order.id, { status: 'failed' });
      return {
        orderId: order.id,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  private async checkDCAOrder(order: DCAOrder, currentPrice: number): Promise<void> {
    if (order.executedOrders >= order.maxOrders) {
      this.updateOrder(order.id, { status: 'filled' });
      return;
    }

    if (Date.now() >= order.nextExecutionAt) {
      await this.executeDCAOrder(order);
    }
  }

  private async executeDCAOrder(order: DCAOrder): Promise<OrderExecutionResult> {
    this.updateOrder(order.id, { status: 'active' });

    try {
      const quoteParams: JupiterQuoteParams = {
        inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        outputMint: order.tokenMint,
        amount: Math.floor(order.amountPerOrder * 1e6),
        slippageBps: order.slippageBps,
      };

      const quote = await this.executor.getQuote(quoteParams);
      if (!quote) {
        throw new Error('Failed to get quote');
      }

      // Record execution
      const execution: DCAExecution = {
        timestamp: Date.now(),
        amount: order.amountPerOrder,
        tokenAmount: parseFloat(quote.outAmount) / 1e9,
        price: currentPrice,
        status: 'pending',
      };

      const updatedExecutions = [...order.executions, execution];
      this.updateOrder(order.id, {
        executions: updatedExecutions,
        executedOrders: order.executedOrders + 1,
        nextExecutionAt: Date.now() + order.intervalMs,
      });

      return {
        orderId: order.id,
        success: true,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      const execution: DCAExecution = {
        timestamp: Date.now(),
        amount: order.amountPerOrder,
        tokenAmount: 0,
        price: currentPrice,
        status: 'failed',
      };

      const updatedExecutions = [...order.executions, execution];
      this.updateOrder(order.id, {
        executions: updatedExecutions,
      });

      return {
        orderId: order.id,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  private async checkStopOrder(order: StopLossOrder, currentPrice: number): Promise<void> {
    const shouldTrigger = order.type === 'stop-loss'
      ? currentPrice <= order.triggerPrice
      : currentPrice >= order.triggerPrice;

    if (shouldTrigger && !order.triggeredAt) {
      await this.executeStopOrder(order);
    }
  }

  private async executeStopOrder(order: StopLossOrder): Promise<OrderExecutionResult> {
    this.updateOrder(order.id, { 
      status: 'active',
      triggeredAt: Date.now(),
    });

    try {
      const quoteParams: JupiterQuoteParams = {
        inputMint: order.side === 'buy' ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' : order.tokenMint,
        outputMint: order.side === 'buy' ? order.tokenMint : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: order.side === 'buy'
          ? Math.floor((order.amount * order.triggerPrice) * 1e6)
          : Math.floor(order.amount * 1e9),
        slippageBps: order.slippageBps,
      };

      const quote = await this.executor.getQuote(quoteParams);
      if (!quote) {
        throw new Error('Failed to get quote');
      }

      this.updateOrder(order.id, {
        status: 'filled',
        executedAt: Date.now(),
      });

      return {
        orderId: order.id,
        success: true,
        filledAmount: order.amount,
        avgPrice: order.triggerPrice,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      this.updateOrder(order.id, { status: 'failed' });
      return {
        orderId: order.id,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  private async checkTrailingStop(order: TrailingStopOrder, currentPrice: number): Promise<void> {
    // Update peak price if current price is higher
    if (currentPrice > order.peakPrice) {
      const newPeak = currentPrice;
      const newTrigger = newPeak * (1 - order.trailPercent / 100);
      
      this.updateOrder(order.id, {
        peakPrice: newPeak,
        triggerPrice: newTrigger,
      });
      
      return; // Don't execute on peak update
    }

    // Check if trigger price hit
    if (currentPrice <= order.triggerPrice && !order.triggeredAt) {
      await this.executeTrailingStop(order);
    }
  }

  private async executeTrailingStop(order: TrailingStopOrder): Promise<OrderExecutionResult> {
    this.updateOrder(order.id, {
      status: 'active',
      triggeredAt: Date.now(),
    });

    try {
      const quoteParams: JupiterQuoteParams = {
        inputMint: order.tokenMint,
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        amount: Math.floor(order.amount * 1e9),
        slippageBps: order.slippageBps,
      };

      const quote = await this.executor.getQuote(quoteParams);
      if (!quote) {
        throw new Error('Failed to get quote');
      }

      this.updateOrder(order.id, {
        status: 'filled',
        executedAt: Date.now(),
      });

      return {
        orderId: order.id,
        success: true,
        filledAmount: order.amount,
        avgPrice: order.triggerPrice,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      this.updateOrder(order.id, { status: 'failed' });
      return {
        orderId: order.id,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  private scheduleOrderCheck(order: AdvancedOrder): void {
    // Clear existing interval
    const existing = this.executionIntervals.get(order.id);
    if (existing) {
      clearInterval(existing);
    }

    // Set up interval based on order type
    let intervalMs = 5000;
    
    if (order.type === 'dca') {
      const dcaOrder = order as DCAOrder;
      intervalMs = Math.min(dcaOrder.intervalMs, 60000);
    }

    const interval = setInterval(() => {
      // This will be called by the monitoring system
    }, intervalMs);

    this.executionIntervals.set(order.id, interval);
  }

  // Create order helpers
  static createLimitOrder(params: {
    userPublicKey: string;
    tokenMint: string;
    tokenSymbol: string;
    side: OrderSide;
    targetPrice: number;
    amount: number;
    slippageBps: number;
    expiresAt?: number;
  }): LimitOrder {
    return {
      id: `limit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'limit',
      side: params.side,
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      targetPrice: params.targetPrice,
      amount: params.amount,
      slippageBps: params.slippageBps,
      expiresAt: params.expiresAt,
      filledAmount: 0,
      status: 'pending',
      userPublicKey: params.userPublicKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  static createDCAOrder(params: {
    userPublicKey: string;
    tokenMint: string;
    tokenSymbol: string;
    side: OrderSide;
    totalAmount: number;
    amountPerOrder: number;
    intervalMs: number;
    maxOrders: number;
    slippageBps: number;
  }): DCAOrder {
    return {
      id: `dca_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'dca',
      side: params.side,
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      totalAmount: params.totalAmount,
      amountPerOrder: params.amountPerOrder,
      intervalMs: params.intervalMs,
      maxOrders: params.maxOrders,
      slippageBps: params.slippageBps,
      executedOrders: 0,
      nextExecutionAt: Date.now() + params.intervalMs,
      executions: [],
      status: 'pending',
      userPublicKey: params.userPublicKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  static createStopLossOrder(params: {
    userPublicKey: string;
    tokenMint: string;
    tokenSymbol: string;
    side: OrderSide;
    triggerPrice: number;
    amount: number;
    slippageBps: number;
  }): StopLossOrder {
    return {
      id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'stop-loss',
      side: params.side,
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      triggerPrice: params.triggerPrice,
      amount: params.amount,
      slippageBps: params.slippageBps,
      status: 'pending',
      userPublicKey: params.userPublicKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  static createTakeProfitOrder(params: {
    userPublicKey: string;
    tokenMint: string;
    tokenSymbol: string;
    side: OrderSide;
    triggerPrice: number;
    amount: number;
    slippageBps: number;
  }): StopLossOrder {
    return {
      id: `tp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'take-profit',
      side: params.side,
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      triggerPrice: params.triggerPrice,
      amount: params.amount,
      slippageBps: params.slippageBps,
      status: 'pending',
      userPublicKey: params.userPublicKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  static createTrailingStopOrder(params: {
    userPublicKey: string;
    tokenMint: string;
    tokenSymbol: string;
    trailPercent: number;
    amount: number;
    slippageBps: number;
    initialPrice: number;
  }): TrailingStopOrder {
    const triggerPrice = params.initialPrice * (1 - params.trailPercent / 100);
    
    return {
      id: `ts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'trailing-stop',
      side: 'sell', // Trailing stops are always sell orders
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      trailPercent: params.trailPercent,
      amount: params.amount,
      slippageBps: params.slippageBps,
      peakPrice: params.initialPrice,
      triggerPrice,
      status: 'pending',
      userPublicKey: params.userPublicKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

// Singleton
let orderManagerInstance: AdvancedOrderManager | null = null;

export function getOrderManager(rpcEndpoint?: string): AdvancedOrderManager {
  if (!orderManagerInstance) {
    orderManagerInstance = new AdvancedOrderManager(rpcEndpoint);
  }
  return orderManagerInstance;
}

// React hook
export function useAdvancedOrders() {
  const manager = getOrderManager();

  return {
    addOrder: (order: AdvancedOrder) => manager.addOrder(order),
    updateOrder: (id: string, updates: Partial<AdvancedOrder>) => manager.updateOrder(id, updates),
    removeOrder: (id: string) => manager.removeOrder(id),
    getOrder: (id: string) => manager.getOrder(id),
    getActiveOrders: (userPublicKey: string) => manager.getActiveOrders(userPublicKey),
    getOrdersByToken: (tokenMint: string) => manager.getOrdersByToken(tokenMint),
    startMonitoring: (getCurrentPrice: (mint: string) => number | undefined) => 
      manager.startMonitoring(getCurrentPrice),
    stopMonitoring: () => manager.stopMonitoring(),
    createLimitOrder: AdvancedOrderManager.createLimitOrder,
    createDCAOrder: AdvancedOrderManager.createDCAOrder,
    createStopLossOrder: AdvancedOrderManager.createStopLossOrder,
    createTakeProfitOrder: AdvancedOrderManager.createTakeProfitOrder,
    createTrailingStopOrder: AdvancedOrderManager.createTrailingStopOrder,
  };
}

export type { AdvancedOrder, LimitOrder, DCAOrder, StopLossOrder, TrailingStopOrder, OrderExecutionResult };