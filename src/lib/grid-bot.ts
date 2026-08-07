/**
 * Grid Trading Bot
 * Implements a grid trading strategy for spot markets
 * Places buy and sell orders at regular intervals within a price range
 */

export interface GridLevel {
  price: number;
  buyOrderId: string | null;
  sellOrderId: string | null;
  filled: boolean; // true if either buy or sell order at this level has been filled
}

export interface GridBotConfig {
  base: string; // base asset (e.g., 'SOL')
  quote: string; // quote asset (e.g., 'USDC')
  lowerPrice: number; // lower bound of the grid
  upperPrice: number; // upper bound of the grid
  gridCount: number; // number of grids
  totalInvestment: number; // total amount in quote asset to invest
}

export interface GridBotState {
  config: GridBotConfig;
  gridSize: number; // price difference between each grid
  orderSize: number; // quantity of base asset per order
  levels: GridLevel[];
  currentPrice: number;
  isRunning: boolean;
  // Performance metrics
  totalBuyVolume: number; // total base bought
  totalSellVolume: number; // total base sold
  realizedProfit: number; // profit in quote asset
  feesPaid: number; // fees paid in quote asset
}

class GridBot {
  private config: GridBotConfig;
  private state: GridBotState;
  private priceUpdateCallback: ((price: number) => void) | null = null;

  constructor(config: GridBotConfig) {
    this.config = config;
    this.state = {
      config: config,
      gridSize: 0,
      orderSize: 0,
      levels: [],
      currentPrice: 0,
      isRunning: false,
      totalBuyVolume: 0,
      totalSellVolume: 0,
      realizedProfit: 0,
      feesPaid: 0,
    };
    this.initialize();
  }

  private initialize(): void {
    const { lowerPrice, upperPrice, gridCount, totalInvestment } = this.config;
    this.state.gridSize = (upperPrice - lowerPrice) / gridCount;
    // Simplified order size calculation: equal value per grid
    const avgPrice = (lowerPrice + upperPrice) / 2;
    this.state.orderSize = (totalInvestment / gridCount) / avgPrice; // base amount per order

    // Initialize grid levels
    this.state.levels = Array.from({ length: gridCount }, (_, i) => {
      const price = lowerPrice + i * this.state.gridSize;
      return {
        price,
        buyOrderId: null,
        sellOrderId: null,
        filled: false,
      };
    });

    // Set initial price (would be fetched from market in real implementation)
    this.state.currentPrice = (lowerPrice + upperPrice) / 2;
  }

  /**
   * Start the bot
   */
  start(): void {
    this.state.isRunning = true;
    // In a real implementation, we would:
    // 1. Fetch current price
    // 2. Place initial orders based on current price
    // 3. Subscribe to price updates
    this.placeInitialOrders();
  }

  /**
   * Stop the bot and cancel all orders
   */
  stop(): void {
    this.state.isRunning = false;
    // Cancel all open orders
    this.cancelAllOrders();
  }

  /**
   * Update the current price and check for order fills
   * This would be called by a price feed WebSocket
   */
  updatePrice(newPrice: number): void {
    if (!this.state.isRunning) return;

    this.state.currentPrice = newPrice;
    this.checkForFills(newPrice);
    // Notify any listeners (e.g., UI)
    if (this.priceUpdateCallback) {
      this.priceUpdateCallback(newPrice);
    }
  }

  /**
   * Set a callback for price updates (for UI updates)
   */
  onPriceUpdate(callback: (price: number) => void): void {
    this.priceUpdateCallback = callback;
  }

  /**
   * Place initial buy and sell orders based on current price
   */
  private placeInitialOrders(): void {
    // For each grid level, decide whether to place a buy or sell order
    // based on where the current price sits
    for (const level of this.state.levels) {
      if (this.state.currentPrice > level.price) {
        // Current price is above this grid -> we expect price to fall, so place a sell order
        // (we would have bought lower and now sell at this level)
        this.placeSellOrder(level.price);
      } else if (this.state.currentPrice < level.price) {
        // Current price is below this grid -> we expect price to rise, so place a buy order
        this.placeBuyOrder(level.price);
      }
      // If equal, we could do nothing or place both? We'll do nothing for now.
    }
  }

  /**
   * Place a buy order at the given price
   * In a real implementation, this would call an exchange API
   */
  private placeBuyOrder(price: number): void {
    // Simulate placing an order
    console.log(`Placing BUY order for ${this.state.orderSize} ${this.config.base} at ${this.config.quote} ${price}`);
    // In reality, we would:
    // 1. Call exchange API to place a limit buy order
    // 2. Store the order ID in the level
    // For now, we'll just mark that we have an order
    // We'll need a way to track order IDs - simplified here
  }

  /**
   * Place a sell order at the given price
   */
  private placeSellOrder(price: number): void {
    console.log(`Placing SELL order for ${this.state.orderSize} ${this.config.base} at ${this.config.quote} ${price}`);
  }

  /**
   * Cancel all open orders
   */
  private cancelAllOrders(): void {
    console.log('Cancelling all open orders');
    // In reality, we would cancel all orders via exchange API
    // and reset order IDs in the levels
  }

  /**
   * Check if any orders have been filled based on the current price
   * This is a simplification - in reality, we'd get fill events from the exchange
   */
  private checkForFills(currentPrice: number): void {
    for (const level of this.state.levels) {
      // Check if buy order should be filled (price <= buy price)
      if (!level.filled && level.buyOrderId && currentPrice <= level.price) {
        this.handleBuyFill(level, currentPrice);
      }
      // Check if sell order should be filled (price >= sell price)
      if (!level.filled && level.sellOrderId && currentPrice >= level.price) {
        this.handleSellFill(level, currentPrice);
      }
    }
  }

  /**
   * Handle a buy order fill
   */
  private handleBuyFill(level: Level, fillPrice: number): void {
    console.log(`BUY order filled at ${fillPrice} for level at ${level.price}`);
    // Update state
    level.filled = true;
    this.state.totalBuyVolume += this.state.orderSize;
    // In a real system, we would also deduct fees
    this.state.feesPaid += this.state.orderSize * fillPrice * 0.001; // 0.1% fee example

    // After a buy fills, we place a sell order at the same grid level (to take profit)
    // But only if we haven't already placed a sell order at this level
    if (!level.sellOrderId) {
      this.placeSellOrder(level.price);
      // Note: in a real grid, after a buy fills, we place a sell order at the same level
      // and then when that sells, we place a buy again at the same level, etc.
    }
  }

  /**
   * Handle a sell order fill
   */
  private handleSellFill(level: Level, fillPrice: number): void {
    console.log(`SELL order filled at ${fillPrice} for level at ${level.price}`);
    // Update state
    level.filled = true;
    this.state.totalSellVolume += this.state.orderSize;
    // Calculate profit: we bought at some lower price and sold at fillPrice
    // For simplicity, we assume we bought at the lower grid level (not accurate)
    // A real implementation would track the actual buy price for each unit
    const approximateBuyPrice = level.price - this.state.gridSize / 2; // rough estimate
    const profit = (fillPrice - approximateBuyPrice) * this.state.orderSize;
    this.state.realizedProfit += profit;
    this.state.feesPaid += this.state.orderSize * fillPrice * 0.001; // 0.1% fee

    // After a sell fills, we place a buy order at the same grid level
    if (!level.buyOrderId) {
      this.placeBuyOrder(level.price);
    }
  }

  /**
   * Get current state (for UI or logging)
   */
  getState(): GridBotState {
    return { ...this.state };
  }

  /**
   * Get performance metrics
   */
  getPerformance(): {
    totalBuyVolume: number;
    totalSellVolume: number;
    realizedProfit: number;
    feesPaid: number;
    netProfit: number;
    roi: number; // return on investment
  } {
    const netProfit = this.state.realizedProfit - this.state.feesPaid;
    const roi = this.state.totalInvestment > 0 ? (netProfit / this.state.totalInvestment) * 100 : 0;
    return {
      totalBuyVolume: this.state.totalBuyVolume,
      totalSellVolume: this.state.totalSellVolume,
      realizedProfit: this.state.realizedProfit,
      feesPaid: this.state.feesPaid,
      netProfit,
      roi,
    };
  }
}

// Singleton instance for the app (in reality, we might have multiple bots)
let gridBotInstance: GridBot | null = null;

/**
 * Get or create a grid bot instance
 * @param config - Configuration for the grid bot
 * @returns GridBot instance
 */
export function getGridBot(config?: GridBotConfig): GridBot {
  if (!gridBotInstance && config) {
    gridBotInstance = new GridBot(config);
  }
  if (!gridBotInstance) {
    throw new Error('Grid bot not initialized. Please provide a config.');
  }
  return gridBotInstance;
}

export type { GridBotConfig, GridBotState, GridLevel };