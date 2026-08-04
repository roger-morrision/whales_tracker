/**
 * Historical Data Warehouse - TimescaleDB Integration
 * Stores OHLCV, trades, wallet activity for backtesting and analytics
 */

export interface OHLCV {
  tokenMint: string;
  tokenSymbol: string;
  timestamp: number; // Unix seconds (bucket start)
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeUsd: number;
  tradesCount: number;
  vwap: number;
}

export interface TradeRecord {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  signature: string;
  buyer: string;
  seller: string;
  amountToken: number;
  amountQuote: number;
  price: number;
  side: 'buy' | 'sell';
  dex: string;
  poolAddress: string;
  timestamp: number;
  slot: number;
}

export interface WalletActivityRecord {
  walletAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  type: 'buy' | 'sell' | 'transfer' | 'stake' | 'unstake';
  amount: number;
  amountUsd: number;
  price: number;
  signature: string;
  timestamp: number;
  pnlUsd?: number;
}

export interface QueryOptions {
  tokenMint?: string;
  tokenMints?: string[];
  interval?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  startTime?: number;
  endTime?: number;
  limit?: number;
  orderBy?: 'asc' | 'desc';
}

class TimescaleWarehouse {
  private pool: any = null; // Would be pg.Pool in production
  private isConnected = false;
  private writeBuffer: any[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    if (typeof window === 'undefined') {
      this.initializeConnection();
    }
  }

  private async initializeConnection() {
    try {
      // In production:
      // const { Pool } = await import('pg');
      // this.pool = new Pool({
      //   host: process.env.TIMESCALE_HOST,
      //   port: parseInt(process.env.TIMESCALE_PORT || '5432'),
      //   database: process.env.TIMESCALE_DB,
      //   user: process.env.TIMESCALE_USER,
      //   password: process.env.TIMESCALE_PASSWORD,
      //   ssl: process.env.TIMESCALE_SSL === 'true',
      //   max: 20,
      // });
      // await this.pool.query('SELECT 1');
      // this.isConnected = true;
      // this.startFlushInterval();
      // this.createTables();
      
      // For now, mock connection
      this.isConnected = true;
      console.log('[TimescaleDB] Connected (mock mode)');
    } catch (error) {
      console.error('[TimescaleDB] Connection failed:', error);
      this.isConnected = false;
    }
  }

  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, this.FLUSH_INTERVAL_MS);
  }

  private async createTables() {
    // In production, run these as migrations
    const tables = [
      `CREATE TABLE IF NOT EXISTS ohlcv (
        token_mint TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        interval TEXT NOT NULL,
        open DOUBLE PRECISION NOT NULL,
        high DOUBLE PRECISION NOT NULL,
        low DOUBLE PRECISION NOT NULL,
        close DOUBLE PRECISION NOT NULL,
        volume DOUBLE PRECISION NOT NULL,
        volume_usd DOUBLE PRECISION NOT NULL,
        trades_count BIGINT NOT NULL,
        vwap DOUBLE PRECISION NOT NULL,
        PRIMARY KEY (token_mint, interval, timestamp)
      );`,
      `SELECT create_hypertable('ohlcv', 'timestamp', if_not_exists => TRUE);`,
      `CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_time ON ohlcv (token_symbol, timestamp DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_ohlcv_interval_time ON ohlcv (interval, timestamp DESC);`,

      `CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        token_mint TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        signature TEXT NOT NULL UNIQUE,
        buyer TEXT NOT NULL,
        seller TEXT NOT NULL,
        amount_token DOUBLE PRECISION NOT NULL,
        amount_quote DOUBLE PRECISION NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        side TEXT NOT NULL,
        dex TEXT NOT NULL,
        pool_address TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        slot BIGINT NOT NULL
      );`,
      `SELECT create_hypertable('trades', 'timestamp', if_not_exists => TRUE);`,
      `CREATE INDEX IF NOT EXISTS idx_trades_token_time ON trades (token_mint, timestamp DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_trades_buyer_time ON trades (buyer, timestamp DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_trades_seller_time ON trades (seller, timestamp DESC);`,

      `CREATE TABLE IF NOT EXISTS wallet_activity (
        wallet_address TEXT NOT NULL,
        token_mint TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        amount_usd DOUBLE PRECISION NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        signature TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        pnl_usd DOUBLE PRECISION,
        PRIMARY KEY (wallet_address, signature)
      );`,
      `SELECT create_hypertable('wallet_activity', 'timestamp', if_not_exists => TRUE);`,
      `CREATE INDEX IF NOT EXISTS idx_wallet_activity_wallet_time ON wallet_activity (wallet_address, timestamp DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_wallet_activity_token_time ON wallet_activity (token_mint, timestamp DESC);`,

      `CREATE TABLE IF NOT EXISTS token_metadata (
        token_mint TEXT PRIMARY KEY,
        token_symbol TEXT NOT NULL,
        token_name TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        total_supply DOUBLE PRECISION,
        creator_address TEXT,
        created_at BIGINT,
        is_renounced BOOLEAN,
        is_frozen BOOLEAN,
        updated_at BIGINT NOT NULL
      );`,
    ];

    // for (const sql of tables) {
    //   await this.pool.query(sql);
    // }
  }

  // ========== OHLCV METHODS ==========

  async insertOHLCV(data: OHLCV[]): Promise<void> {
    if (!this.isConnected || data.length === 0) return;
    
    this.writeBuffer.push({ type: 'ohlcv', data });
    if (this.writeBuffer.length >= this.BATCH_SIZE) {
      await this.flushBuffer();
    }
  }

  async queryOHLCV(options: QueryOptions): Promise<OHLCV[]> {
    if (!this.isConnected) return this.getMockOHLCV(options);
    
    // Build query
    let sql = `
      SELECT token_mint, token_symbol, timestamp, interval, open, high, low, close, 
             volume, volume_usd, trades_count, vwap
      FROM ohlcv
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options.tokenMint) {
      sql += ` AND token_mint = $${paramIndex++}`;
      params.push(options.tokenMint);
    } else if (options.tokenMints?.length) {
      sql += ` AND token_mint = ANY($${paramIndex++})`;
      params.push(options.tokenMints);
    }

    if (options.interval) {
      sql += ` AND interval = $${paramIndex++}`;
      params.push(options.interval);
    }

    if (options.startTime) {
      sql += ` AND timestamp >= $${paramIndex++}`;
      params.push(options.startTime);
    }

    if (options.endTime) {
      sql += ` AND timestamp <= $${paramIndex++}`;
      params.push(options.endTime);
    }

    sql += ` ORDER BY timestamp ${options.orderBy || 'DESC'}`;
    
    if (options.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    // const result = await this.pool.query(sql, params);
    // return result.rows.map(this.mapOHLCVRow);
    
    return this.getMockOHLCV(options);
  }

  async getLatestOHLCV(tokenMint: string, interval: string): Promise<OHLCV | null> {
    const results = await this.queryOHLCV({ tokenMint, interval, limit: 1, orderBy: 'DESC' });
    return results[0] || null;
  }

  async getOHLCVRange(
    tokenMint: string, 
    interval: string, 
    startTime: number, 
    endTime: number
  ): Promise<OHLCV[]> {
    return this.queryOHLCV({ tokenMint, interval, startTime, endTime, orderBy: 'ASC' });
  }

  // ========== TRADE METHODS ==========

  async insertTrades(trades: TradeRecord[]): Promise<void> {
    if (!this.isConnected || trades.length === 0) return;
    
    this.writeBuffer.push({ type: 'trades', data: trades });
    if (this.writeBuffer.length >= this.BATCH_SIZE) {
      await this.flushBuffer();
    }
  }

  async queryTrades(options: QueryOptions & { buyer?: string; seller?: string; side?: 'buy' | 'sell' }): Promise<TradeRecord[]> {
    if (!this.isConnected) return this.getMockTrades(options);
    
    // Similar query building...
    return this.getMockTrades(options);
  }

  async getTradesByWallet(walletAddress: string, limit: number = 100): Promise<TradeRecord[]> {
    return this.queryTrades({ limit });
  }

  async getTradesByToken(tokenMint: string, startTime: number, endTime: number): Promise<TradeRecord[]> {
    return this.queryTrades({ tokenMint, startTime, endTime, orderBy: 'ASC' });
  }

  // ========== WALLET ACTIVITY METHODS ==========

  async insertWalletActivity(activities: WalletActivityRecord[]): Promise<void> {
    if (!this.isConnected || activities.length === 0) return;
    
    this.writeBuffer.push({ type: 'wallet_activity', data: activities });
    if (this.writeBuffer.length >= this.BATCH_SIZE) {
      await this.flushBuffer();
    }
  }

  async queryWalletActivity(options: QueryOptions & { walletAddress?: string; type?: string }): Promise<WalletActivityRecord[]> {
    if (!this.isConnected) return this.getMockWalletActivity(options);
    return this.getMockWalletActivity(options);
  }

  async getWalletActivityByAddress(walletAddress: string, limit: number = 100): Promise<WalletActivityRecord[]> {
    return this.queryWalletActivity({ walletAddress, limit });
  }

  async getWalletPnL(walletAddress: string, startTime: number, endTime: number): Promise<{
    totalPnL: number;
    realizedPnL: number;
    unrealizedPnL: number;
    tradesCount: number;
    winRate: number;
  }> {
    // In production: complex SQL query
    return {
      totalPnL: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      tradesCount: 0,
      winRate: 0,
    };
  }

  // ========== TOKEN METADATA ==========

  async upsertTokenMetadata(metadata: {
    tokenMint: string;
    tokenSymbol: string;
    tokenName: string;
    decimals: number;
    totalSupply?: number;
    creatorAddress?: string;
    createdAt?: number;
    isRenounced?: boolean;
    isFrozen?: boolean;
  }): Promise<void> {
    if (!this.isConnected) return;
    // await this.pool.query(...)
  }

  async getTokenMetadata(tokenMint: string): Promise<any> {
    if (!this.isConnected) return null;
    // const result = await this.pool.query('SELECT * FROM token_metadata WHERE token_mint = $1', [tokenMint]);
    // return result.rows[0];
    return null;
  }

  // ========== ANALYTICS QUERIES ==========

  async getTokenStats(tokenMint: string, timeRangeHours: number = 24): Promise<{
    priceChangePct: number;
    volumeUsd: number;
    tradesCount: number;
    vwap: number;
    high: number;
    low: number;
    liquidityUsd?: number;
  }> {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - timeRangeHours * 3600;
    
    const ohlcv = await this.getOHLCVRange(tokenMint, '1h', startTime, endTime);
    
    if (ohlcv.length === 0) {
      return { priceChangePct: 0, volumeUsd: 0, tradesCount: 0, vwap: 0, high: 0, low: 0 };
    }

    const first = ohlcv[0];
    const last = ohlcv[ohlcv.length - 1];
    const priceChangePct = ((last.close - first.open) / first.open) * 100;
    const volumeUsd = ohlcv.reduce((sum, c) => sum + c.volumeUsd, 0);
    const tradesCount = ohlcv.reduce((sum, c) => sum + c.tradesCount, 0);
    const vwap = ohlcv.reduce((sum, c) => sum + c.vwap * c.volumeUsd, 0) / volumeUsd;
    const high = Math.max(...ohlcv.map(c => c.high));
    const low = Math.min(...ohlcv.map(c => c.low));

    return { priceChangePct, volumeUsd, tradesCount, vwap, high, low };
  }

  async getTopTokensByVolume(limit: number = 20, timeRangeHours: number = 24): Promise<Array<{
    tokenMint: string;
    tokenSymbol: string;
    volumeUsd: number;
    priceChangePct: number;
    tradesCount: number;
  }>> {
    // In production: complex aggregation query
    return [];
  }

  async getWalletLeaderboard(
    metric: 'volume' | 'pnl' | 'trades' | 'winrate',
    timeRangeHours: number = 24,
    limit: number = 50
  ): Promise<Array<{
    walletAddress: string;
    value: number;
    tokenCount: number;
  }>> {
    // In production: complex aggregation query
    return [];
  }

  // ========== BACKTESTING SUPPORT ==========

  async getBacktestData(
    tokenMint: string,
    startTime: number,
    endTime: number,
    interval: '1m' | '5m' | '15m' | '1h' = '15m'
  ): Promise<OHLCV[]> {
    return this.getOHLCVRange(tokenMint, interval, startTime, endTime);
  }

  async getMultiTokenBacktestData(
    tokenMints: string[],
    startTime: number,
    endTime: number,
    interval: '1m' | '5m' | '15m' | '1h' = '15m'
  ): Promise<Map<string, OHLCV[]>> {
    const result = new Map<string, OHLCV[]>();
    for (const mint of tokenMints) {
      result.set(mint, await this.getOHLCVRange(mint, interval, startTime, endTime));
    }
    return result;
  }

  // ========== BUFFER FLUSH ==========

  private async flushBuffer(): Promise<void> {
    if (this.writeBuffer.length === 0) return;
    
    const buffer = [...this.writeBuffer];
    this.writeBuffer = [];
    
    // Group by type
    const byType = new Map<string, any[]>();
    for (const item of buffer) {
      if (!byType.has(item.type)) byType.set(item.type, []);
      byType.get(item.type)!.push(...item.data);
    }
    
    // In production: batch insert for each type
    for (const [type, data] of byType) {
      // await this.batchInsert(type, data);
    }
  }

  // ========== MOCK DATA FOR DEVELOPMENT ==========

  private getMockOHLCV(options: QueryOptions): OHLCV[] {
    const results: OHLCV[] = [];
    const limit = options.limit || 100;
    const intervalSec = this.intervalToSeconds(options.interval || '1h');
    const endTime = options.endTime || Math.floor(Date.now() / 1000);
    const startTime = options.startTime || endTime - limit * intervalSec;
    
    const tokens = options.tokenMint ? [options.tokenMint] : 
      options.tokenMints || ['So11111111111111111111111111111111111111112'];
    
    for (const mint of tokens) {
      let price = mint === 'So11111111111111111111111111111111111111112' ? 72.97 : 0.142;
      const symbol = mint === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'WIF';
      
      for (let t = startTime; t <= endTime; t += intervalSec) {
        const volatility = 0.02;
        const change = (Math.random() - 0.5) * volatility * 2;
        price = Math.max(0.000001, price * (1 + change));
        
        const open = price;
        const high = price * (1 + Math.random() * 0.01);
        const low = price * (1 - Math.random() * 0.01);
        const close = low + Math.random() * (high - low);
        const volume = Math.random() * 1000000;
        const volumeUsd = volume * close;
        const tradesCount = Math.floor(Math.random() * 1000);
        const vwap = (open + high + low + close) / 4;
        
        results.push({
          tokenMint: mint,
          tokenSymbol: symbol,
          timestamp: t,
          interval: options.interval || '1h',
          open,
          high,
          low,
          close,
          volume,
          volumeUsd,
          tradesCount,
          vwap,
        });
      }
    }
    
    return results.slice(0, limit);
  }

  private getMockTrades(options: QueryOptions): TradeRecord[] {
    return [];
  }

  private getMockWalletActivity(options: QueryOptions): WalletActivityRecord[] {
    return [];
  }

  private intervalToSeconds(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    return map[interval] || 3600;
  }

  // ========== UTILITY ==========

  isHealthy(): boolean {
    return this.isConnected;
  }

  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushBuffer();
    // await this.pool?.end();
    this.isConnected = false;
  }
}

// Singleton
let warehouseInstance: TimescaleWarehouse | null = null;

export function getWarehouse(): TimescaleWarehouse {
  if (!warehouseInstance) {
    warehouseInstance = new TimescaleWarehouse();
  }
  return warehouseInstance;
}

// React hook
export function useWarehouse() {
  const warehouse = getWarehouse();
  
  return {
    queryOHLCV: (options: QueryOptions) => warehouse.queryOHLCV(options),
    queryTrades: (options: QueryOptions) => warehouse.queryTrades(options),
    queryWalletActivity: (options: QueryOptions) => warehouse.queryWalletActivity(options),
    getTokenStats: (tokenMint: string, timeRangeHours?: number) => warehouse.getTokenStats(tokenMint, timeRangeHours),
    getBacktestData: (tokenMint: string, startTime: number, endTime: number, interval?: '1m' | '5m' | '15m' | '1h') => 
      warehouse.getBacktestData(tokenMint, startTime, endTime, interval),
    isHealthy: () => warehouse.isHealthy(),
  };
}

export type { OHLCV, TradeRecord, WalletActivityRecord, QueryOptions };