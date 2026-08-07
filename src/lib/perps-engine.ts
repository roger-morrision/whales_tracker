import { PerpsPosition, PerpsOrder, PerpsMarket, PerpsAccount } from '@/types/perps';

// Mock data for development
const MARKETS: Record<string, PerpsMarket> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    markPrice: 60000,
    indexPrice: 60000,
    fundingRate: 0.0001,
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    makerFee: 0.0002,
    takerFee: 0.0004,
    minOrderSize: 0.001,
    stepSize: 0.001,
    maxLeverage: 50,
    maintenanceMarginRatio: 0.005, // 0.5%
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    markPrice: 3000,
    indexPrice: 3000,
    fundingRate: 0.0001,
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
    makerFee: 0.0002,
    takerFee: 0.0004,
    minOrderSize: 0.01,
    stepSize: 0.01,
    maxLeverage: 50,
    maintenanceMarginRatio: 0.005,
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    markPrice: 100,
    indexPrice: 100,
    fundingRate: 0.0001,
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
    makerFee: 0.0002,
    takerFee: 0.0004,
    minOrderSize: 0.1,
    stepSize: 0.1,
    maxLeverage: 20,
    maintenanceMarginRatio: 0.01, // 1%
  },
};

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class PerpsEngine {
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private account: PerpsAccount | null = null;
  private positions: Map<string, PerpsPosition> = new Map();
  private orders: Map<string, PerpsOrder> = new Map();

  constructor(apiKey?: string, apiSecret?: string) {
    this.apiKey = apiKey ?? null;
    this.apiSecret = apiSecret ?? null;
    // In a real app, we would load the account from the API
    // For now, we'll initialize with a mock account
    this.account = {
      accountId: 'demo_account',
      username: 'demo_user',
      usdcBalance: 10000,
      marginUsed: 0,
      marginAvailable: 10000,
      unrealizedPnl: 0,
      marginRatio: 0,
    };
  }

  // Set API credentials (would be called from login)
  setCredentials(apiKey: string, apiSecret: string): void {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  // Clear credentials (logout)
  clearCredentials(): void {
    this.apiKey = null;
    this.apiSecret = null;
    this.account = null;
    this.positions.clear();
    this.orders.clear();
  }

  // Get markets
  async getMarkets(): Promise<Record<string, PerpsMarket>> {
    await delay(100);
    return MARKETS;
  }

  // Get account info
  async getAccount(): Promise<PerpsAccount | null> {
    await delay(100);
    // In demo mode, we return the mock account
    if (!this.apiKey) {
      return this.account;
    }
    // In real mode, we would call the API
    // For now, we'll return mock data
    return this.account;
  }

  // Get positions
  async getPositions(): Promise<PerpsPosition[]> {
    await delay(100);
    if (!this.apiKey) {
      return Array.from(this.positions.values());
    }
    // Real API call would go here
    return Array.from(this.positions.values());
  }

  // Open a position
  async openPosition(params: {
    symbol: string;
    side: 'long' | 'short';
    size: number; // in contracts
    leverage: number;
    price?: number; // if undefined, market order
    reduceOnly?: boolean;
  }): Promise<{ success: boolean; positionId?: string; error?: string }> {
    await delay(500);

    if (!this.account) {
      return { success: false, error: 'Account not initialized' };
    }

    const market = MARKETS[params.symbol];
    if (!market) {
      return { success: false, error: 'Invalid symbol' };
    }

    // Check if we have enough margin
    const price = params.price ?? market.markPrice;
    const notional = params.size * price;
    const requiredMargin = notional / params.leverage;
    if (requiredMargin > this.account.marginAvailable) {
      return { success: false, error: 'Insufficient margin' };
    }

    // Create position
    const positionId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const position: PerpsPosition = {
      id: positionId,
      symbol: params.symbol,
      side: params.side,
      size: params.size,
      entryPrice: price,
      markPrice: market.markPrice,
      leverage: params.leverage,
      liquidationPrice: this.calculateLiquidationPrice(params.side, params.size, price, params.leverage, market.maintenanceMarginRatio),
      unrealizedPnl: 0,
      marginUsed: requiredMargin,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.positions.set(positionId, position);

    // Update account
    this.account.marginUsed += requiredMargin;
    this.account.marginAvailable -= requiredMargin;

    // In real mode, we would send the order to the exchange
    // For now, we simulate success
    return { success: true, positionId };
  }

  // Close a position (partially or fully)
  async closePosition(params: {
    positionId: string;
    size?: number; // if undefined, close entire position
    price?: number; // if undefined, market order
  }): Promise<{ success: boolean; error?: string }> {
    await delay(500);

    const position = this.positions.get(params.positionId);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    const closeSize = params.size ?? position.size;
    if (closeSize > position.size) {
      return { success: false, error: 'Close size exceeds position size' };
    }

    // Calculate PnL for the closed portion
    const price = params.price ?? position.markPrice;
    const priceDiff = position.side === 'long' ? price - position.entryPrice : position.entryPrice - price;
    const pnl = priceDiff * closeSize;

    // Update position
    if (closeSize === position.size) {
      // Full close
      this.positions.delete(positionId);
    } else {
      // Partial close
      position.size -= closeSize;
      position.marginUsed = (position.size * position.entryPrice) / position.leverage;
      position.updatedAt = Date.now();
    }

    // Update account
    this.account.marginUsed -= (position.entryPrice * closeSize) / position.leverage;
    this.account.marginAvailable += (position.entryPrice * closeSize) / position.leverage;
    this.account.unrealizedPnl += pnl;

    return { success: true };
  }

  // Add margin to a position
  async addMargin(params: {
    positionId: string;
    amount: number; // in USDC
  }): Promise<{ success: boolean; error?: string }> {
    await delay(100);

    const position = this.positions.get(params.positionId);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    if (params.amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    if (params.amount > this.account.marginAvailable) {
      return { success: false, error: 'Insufficient available margin' };
    }

    position.marginUsed += params.amount;
    position.leverage = (position.size * position.markPrice) / position.marginUsed;
    position.liquidationPrice = this.calculateLiquidationPrice(
      position.side,
      position.size,
      position.entryPrice,
      position.leverage,
      MARKETS[position.symbol].maintenanceMarginRatio
    );
    position.updatedAt = Date.now();

    this.account.marginAvailable -= params.amount;
    this.account.marginUsed += params.amount;

    return { success: true };
  }

  // Remove margin from a position
  async removeMargin(params: {
    positionId: string;
    amount: number; // in USDC
  }): Promise<{ success: boolean; error?: string }> {
    await delay(100);

    const position = this.positions.get(params.positionId);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    if (params.amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    const currentMarginUsed = position.marginUsed;
    if (params.amount >= currentMarginUsed) {
      return { success: false, error: 'Cannot remove all or more margin than currently used' };
    }

    position.marginUsed -= params.amount;
    position.leverage = (position.size * position.markPrice) / position.marginUsed;
    position.liquidationPrice = this.calculateLiquidationPrice(
      position.side,
      position.size,
      position.entryPrice,
      position.leverage,
      MARKETS[position.symbol].maintenanceMarginRatio
    );
    position.updatedAt = Date.now();

    this.account.marginAvailable += params.amount;
    this.account.marginUsed -= params.amount;

    return { success: true };
  }

  // Set stop loss and take profit for a position
  async setSLTP(params: {
    positionId: string;
    stopLoss?: number; // price
    takeProfit?: number; // price
  }): Promise<{ success: boolean; error?: string }> {
    await delay(100);

    const position = this.positions.get(params.positionId);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    if (params.stopLoss !== undefined) {
      if (position.side === 'long' && params.stopLoss >= position.entryPrice) {
        return { success: false, error: 'Stop loss must be below entry price for long position' };
      }
      if (position.side === 'short' && params.stopLoss <= position.entryPrice) {
        return { success: false, error: 'Stop loss must be above entry price for short position' };
      }
      position.stopLoss = params.stopLoss;
    }

    if (params.takeProfit !== undefined) {
      if (position.side === 'long' && params.takeProfit <= position.entryPrice) {
        return { success: false, error: 'Take profit must be above entry price for long position' };
      }
      if (position.side === 'short' && params.takeProfit >= position.entryPrice) {
        return { success: false, error: 'Take profit must be below entry price for short position' };
      }
      position.takeProfit = params.takeProfit;
    }

    position.updatedAt = Date.now();
    return { success: true };
  }

  // Calculate liquidation price
  private calculateLiquidationPrice(side: 'long' | 'short', size: number, entryPrice: number, leverage: number, maintMarginRatio: number): number {
    const liquidationMultiplier = 1 - (1 / leverage) + maintMarginRatio;
    if (side === 'long') {
      return entryPrice * liquidationMultiplier;
    } else {
      return entryPrice / liquidationMultiplier;
    }
  }

  // Update mark prices (would be called by a websocket in real app)
  async updateMarkPrices(prices: Record<string, number>): Promise<void> {
    for (const [symbol, price] of Object.entries(prices)) {
      const market = MARKETS[symbol];
      if (market) {
        market.markPrice = price;
      }
      // Update PnL for all positions of this symbol
      for (const position of this.positions.values()) {
        if (position.symbol === symbol) {
          position.markPrice = price;
          const priceDiff = position.side === 'long' ? price - position.entryPrice : position.entryPrice - price;
          position.unrealizedPnl = priceDiff * position.size;
          position.updatedAt = Date.now();
        }
      }
    }
    // Update account unrealized PnL
    let totalUnrealizedPnl = 0;
    for (const position of this.positions.values()) {
      totalUnrealizedPnl += position.unrealizedPnl;
    }
    this.account.unrealizedPnl = totalUnrealizedPnl;
  }

  // Get position by ID
  getPosition(positionId: string): PerpsPosition | null {
    return this.positions.get(positionId) ?? null;
  }

  // Get open orders
  getOrders(): { [orderId: string]: PerpsOrder } {
    const obj: { [orderId: string]: PerpsOrder } = {};
    for (const [id, order] of this.orders) {
      obj[id] = order;
    }
    return obj;
  }

  // Cancel an order
  async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    await delay(100);
    if (this.orders.delete(orderId)) {
      return { success: true };
    }
    return { success: false, error: 'Order not found' };
  }
}

// Export a singleton instance
let perpsEngineInstance: PerpsEngine | null = null;

export function getPerpsEngine(apiKey?: string, apiSecret?: string): PerpsEngine {
  if (!perpsEngineInstance) {
    perpsEngineInstance = new PerpsEngine(apiKey, apiSecret);
  }
  return perpsEngineInstance;
}

// Types (these should ideally be in a separate types file, but we'll keep them here for simplicity)
export interface PerpsPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnl: number;
  marginUsed: number;
  createdAt: number;
  updatedAt: number;
}

export interface PerpsOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell'; // for opening/closing positions
  type: 'limit' | 'market' | 'stop' | 'stop_limit';
  price: number;
  triggerPrice?: number;
  size: number;
  filledSize: number;
  status: 'open' | 'filled' | 'cancelled' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

export interface PerpsMarket {
  symbol: string;
  name: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number; // per 8 hours
  nextFundingTime: number;
  makerFee: number;
  takerFee: number;
  minOrderSize: number;
  stepSize: number;
  maxLeverage: number;
  maintenanceMarginRatio: number; // e.g., 0.005 for 0.5%
}

export interface PerpsAccount {
  accountId: string;
  username: string;
  usdcBalance: number;
  marginUsed: number;
  marginAvailable: number;
  unrealizedPnl: number;
  marginRatio: number; // marginUsed / (marginUsed + marginAvailable)
}