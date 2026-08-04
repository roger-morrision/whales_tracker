/**
 * Portfolio Analytics
 * Realized/Unrealized PnL, Risk Metrics, Tax Reporting
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getJupiterExecutor } from './jupiter-executor';

export interface PortfolioHolding {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  amount: number; // Raw amount (lamports for SOL)
  decimals: number;
  costBasisUsd: number; // Total USD spent to acquire
  avgCostPerToken: number; // USD per token
  currentPriceUsd: number;
  currentValueUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  realizedPnlUsd: number;
  realizedPnlPct: number;
  firstAcquiredAt: number;
  lastUpdatedAt: number;
  tags?: string[];
}

export interface TradeRecord {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  side: 'buy' | 'sell';
  amount: number; // Token amount
  priceUsd: number; // Price per token in USD
  usdValue: number; // Total USD value
  feeUsd: number;
  timestamp: number;
  signature?: string;
  orderType?: 'market' | 'limit' | 'dca' | 'stop-loss' | 'take-profit';
}

export interface PortfolioMetrics {
  totalValueUsd: number;
  totalCostBasisUsd: number;
  totalUnrealizedPnlUsd: number;
  totalUnrealizedPnlPct: number;
  totalRealizedPnlUsd: number;
  totalRealizedPnlPct: number;
  totalFeesPaidUsd: number;
  holdingsCount: number;
  topGainers: Array<{ symbol: string; pnlPct: number; pnlUsd: number }>;
  topLosers: Array<{ symbol: string; pnlPct: number; pnlUsd: number }>;
  sectorAllocation: Record<string, { valueUsd: number; percentage: number }>;
  riskMetrics: RiskMetrics;
}

export interface RiskMetrics {
  // Value at Risk (95% confidence, 1-day)
  var95_1d: number;
  var95_1dPct: number;
  
  // Maximum Drawdown
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  currentDrawdownUsd: number;
  currentDrawdownPct: number;
  
  // Volatility (30-day)
  volatility30d: number;
  volatility30dPct: number;
  
  // Sharpe Ratio (assuming 0% risk-free rate)
  sharpeRatio: number;
  
  // Beta (vs SOL)
  betaVsSol: number;
  
  // Concentration risk
  hhi: number; // Herfindahl-Hirschman Index
  largestPositionPct: number;
  top3PositionsPct: number;
  
  // Liquidity risk
  avgDaysToLiquidate: number;
  illiquidPositionsPct: number;
}

export interface TaxLot {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  costBasisUsd: number;
  costBasisPerToken: number;
  acquiredAt: number;
  soldAmount: number;
  soldAt?: number;
  soldPriceUsd?: number;
  realizedPnlUsd?: number;
  realizedPnlPct?: number;
  isClosed: boolean;
}

export interface TaxEvent {
  id: string;
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'airdrop' | 'staking_reward';
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  priceUsd: number;
  usdValue: number;
  feeUsd: number;
  costBasisUsd?: number; // For sells
  realizedPnlUsd?: number; // For sells
  realizedPnlPct?: number; // For sells
  holdingPeriodDays?: number; // For sells
  timestamp: number;
  signature?: string;
}

export interface Form8949Entry {
  description: string; // e.g., "100 SOL"
  dateAcquired: string; // MM/DD/YYYY
  dateSold: string; // MM/DD/YYYY
  proceedsUsd: number;
  costBasisUsd: number;
  gainLossUsd: number;
  gainLossPct: number;
  term: 'short' | 'long'; // Short-term (< 1 year) or long-term
  washSale: boolean;
  washSaleDisallowedLoss?: number;
}

export interface TaxSummary {
  taxYear: number;
  shortTermGainsUsd: number;
  shortTermLossesUsd: number;
  longTermGainsUsd: number;
  longTermLossesUsd: number;
  netShortTermUsd: number;
  netLongTermUsd: number;
  totalRealizedPnlUsd: number;
  totalFeesUsd: number;
  form8949Entries: Form8949Entry[];
  washSaleDetails: WashSaleDetail[];
}

export interface WashSaleDetail {
  tokenSymbol: string;
  disallowedLossUsd: number;
  replacementShares: number;
  replacementDate: string;
  originalSaleDate: string;
}

export interface PerformanceSnapshot {
  timestamp: number;
  totalValueUsd: number;
  totalCostBasisUsd: number;
  unrealizedPnlUsd: number;
  realizedPnlUsd: number;
  dailyReturnPct: number;
}

class PortfolioAnalytics {
  private connection: Connection;
  private executor = getJupiterExecutor();
  private holdings = new Map<string, PortfolioHolding>();
  private trades: TradeRecord[] = [];
  private taxLots = new Map<string, TaxLot[]>();
  private performanceHistory: PerformanceSnapshot[] = [];

  constructor(rpcEndpoint?: string) {
    this.connection = new Connection(
      rpcEndpoint || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
  }

  // Holdings management
  addHolding(holding: PortfolioHolding): void {
    const existing = this.holdings.get(holding.tokenMint);
    if (existing) {
      // Merge with existing holding (weighted average cost)
      const totalAmount = existing.amount + holding.amount;
      const totalCost = existing.costBasisUsd + holding.costBasisUsd;
      
      this.holdings.set(holding.tokenMint, {
        ...existing,
        amount: totalAmount,
        costBasisUsd: totalCost,
        avgCostPerToken: totalCost / (totalAmount / Math.pow(10, existing.decimals)),
        lastUpdatedAt: Date.now(),
      });
    } else {
      this.holdings.set(holding.tokenMint, holding);
    }
  }

  updateHoldingPrice(tokenMint: string, priceUsd: number): void {
    const holding = this.holdings.get(tokenMint);
    if (!holding) return;

    const amountTokens = holding.amount / Math.pow(10, holding.decimals);
    const currentValue = amountTokens * priceUsd;
    const unrealizedPnl = currentValue - holding.costBasisUsd;
    const unrealizedPnlPct = holding.costBasisUsd > 0 ? (unrealizedPnl / holding.costBasisUsd) * 100 : 0;

    this.holdings.set(tokenMint, {
      ...holding,
      currentPriceUsd: priceUsd,
      currentValueUsd: currentValue,
      unrealizedPnlUsd: unrealizedPnl,
      unrealizedPnlPct,
      lastUpdatedAt: Date.now(),
    });
  }

  removeHolding(tokenMint: string): boolean {
    return this.holdings.delete(tokenMint);
  }

  getHolding(tokenMint: string): PortfolioHolding | undefined {
    return this.holdings.get(tokenMint);
  }

  getAllHoldings(): PortfolioHolding[] {
    return Array.from(this.holdings.values());
  }

  // Trade recording
  recordTrade(trade: TradeRecord): void {
    this.trades.push(trade);
    
    // Update holdings based on trade
    if (trade.side === 'buy') {
      this.addHolding({
        tokenMint: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        tokenName: trade.tokenSymbol, // Would fetch real name
        amount: trade.side === 'buy' ? trade.amount : 0, // Will be merged
        decimals: 9, // Default, would fetch real value
        costBasisUsd: trade.usdValue + trade.feeUsd,
        avgCostPerToken: trade.priceUsd,
        currentPriceUsd: trade.priceUsd,
        currentValueUsd: trade.usdValue,
        unrealizedPnlUsd: 0,
        unrealizedPnlPct: 0,
        realizedPnlUsd: 0,
        realizedPnlPct: 0,
        firstAcquiredAt: trade.timestamp,
        lastUpdatedAt: trade.timestamp,
      });
    } else {
      // Sell - update tax lots and realized PnL
      this.processSellForTax(trade);
    }
    
    // Keep trades sorted by timestamp
    this.trades.sort((a, b) => a.timestamp - b.timestamp);
  }

  private processSellForTax(trade: TradeRecord): void {
    const lots = this.taxLots.get(trade.tokenMint) || [];
    let remainingToSell = trade.amount;
    
    // FIFO - sell oldest lots first
    const sortedLots = [...lots].sort((a, b) => a.acquiredAt - b.acquiredAt);
    
    for (const lot of sortedLots) {
      if (remainingToSell <= 0) break;
      if (lot.isClosed) continue;
      
      const available = lot.amount - lot.soldAmount;
      const sellFromLot = Math.min(available, remainingToSell);
      
      lot.soldAmount += sellFromLot;
      lot.soldAt = trade.timestamp;
      lot.soldPriceUsd = trade.priceUsd;
      lot.realizedPnlUsd = (trade.priceUsd - lot.costBasisPerToken) * sellFromLot;
      lot.realizedPnlPct = lot.costBasisPerToken > 0 
        ? (lot.realizedPnlUsd / (lot.costBasisPerToken * sellFromLot)) * 100 
        : 0;
      
      if (lot.soldAmount >= lot.amount) {
        lot.isClosed = true;
      }
      
      remainingToSell -= sellFromLot;
    }
    
    // Update holding
    const holding = this.holdings.get(trade.tokenMint);
    if (holding) {
      holding.amount -= trade.amount;
      holding.realizedPnlUsd += trade.usdValue - (trade.amount / Math.pow(10, holding.decimals)) * holding.avgCostPerToken;
      holding.lastUpdatedAt = trade.timestamp;
      
      if (holding.amount <= 0) {
        this.holdings.delete(trade.tokenMint);
      }
    }
    
    this.taxLots.set(trade.tokenMint, lots);
  }

  addTaxLot(lot: TaxLot): void {
    const lots = this.taxLots.get(lot.tokenMint) || [];
    lots.push(lot);
    this.taxLots.set(lot.tokenMint, lots);
  }

  // Portfolio metrics calculation
  calculateMetrics(): PortfolioMetrics {
    const holdings = this.getAllHoldings();
    
    const totalValueUsd = holdings.reduce((sum, h) => sum + h.currentValueUsd, 0);
    const totalCostBasisUsd = holdings.reduce((sum, h) => sum + h.costBasisUsd, 0);
    const totalUnrealizedPnlUsd = holdings.reduce((sum, h) => sum + h.unrealizedPnlUsd, 0);
    const totalUnrealizedPnlPct = totalCostBasisUsd > 0 
      ? (totalUnrealizedPnlUsd / totalCostBasisUsd) * 100 
      : 0;
    
    const totalRealizedPnlUsd = this.trades
      .filter(t => t.side === 'sell')
      .reduce((sum, t) => sum + (t.usdValue - t.feeUsd), 0) - 
      this.trades
        .filter(t => t.side === 'buy')
        .reduce((sum, t) => sum + t.usdValue + t.feeUsd, 0);
    
    const totalRealizedPnlPct = totalCostBasisUsd > 0 
      ? (totalRealizedPnlUsd / totalCostBasisUsd) * 100 
      : 0;
    
    const totalFeesPaidUsd = this.trades.reduce((sum, t) => sum + t.feeUsd, 0);

    // Top gainers/losers
    const sortedByPnl = [...holdings].sort((a, b) => b.unrealizedPnlPct - a.unrealizedPnlPct);
    const topGainers = sortedByPnl.slice(0, 5).map(h => ({
      symbol: h.tokenSymbol,
      pnlPct: h.unrealizedPnlPct,
      pnlUsd: h.unrealizedPnlUsd,
    }));
    const topLosers = sortedByPnl.slice(-5).reverse().map(h => ({
      symbol: h.tokenSymbol,
      pnlPct: h.unrealizedPnlPct,
      pnlUsd: h.unrealizedPnlUsd,
    }));

    // Sector allocation (simplified - would use real sector data)
    const sectorAllocation: Record<string, { valueUsd: number; percentage: number }> = {};
    for (const h of holdings) {
      const sector = this.getTokenSector(h.tokenSymbol);
      if (!sectorAllocation[sector]) {
        sectorAllocation[sector] = { valueUsd: 0, percentage: 0 };
      }
      sectorAllocation[sector].valueUsd += h.currentValueUsd;
    }
    for (const sector of Object.keys(sectorAllocation)) {
      sectorAllocation[sector].percentage = totalValueUsd > 0 
        ? (sectorAllocation[sector].valueUsd / totalValueUsd) * 100 
        : 0;
    }

    // Risk metrics
    const riskMetrics = this.calculateRiskMetrics();

    return {
      totalValueUsd,
      totalCostBasisUsd,
      totalUnrealizedPnlUsd,
      totalUnrealizedPnlPct,
      totalRealizedPnlUsd,
      totalRealizedPnlPct,
      totalFeesPaidUsd,
      holdingsCount: holdings.length,
      topGainers,
      topLosers,
      sectorAllocation,
      riskMetrics,
    };
  }

  private getTokenSector(symbol: string): string {
    // Simplified sector mapping
    const sectors: Record<string, string> = {
      'SOL': 'Layer 1',
      'BTC': 'Store of Value',
      'ETH': 'Smart Contract Platform',
      'USDC': 'Stablecoin',
      'USDT': 'Stablecoin',
      'BONK': 'Meme',
      'WIF': 'Meme',
      'JUP': 'DeFi',
      'RAY': 'DeFi',
      'ORCA': 'DeFi',
      'JTO': 'DeFi',
      'DRIFT': 'DeFi',
      'PYTH': 'Oracle',
      'RENDER': 'AI/Compute',
      'IO': 'DePIN',
      'HNT': 'DePIN',
    };
    return sectors[symbol] || 'Other';
  }

  private calculateRiskMetrics(): RiskMetrics {
    const holdings = this.getAllHoldings();
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValueUsd, 0);
    
    if (totalValue === 0) {
      return this.emptyRiskMetrics();
    }

    // Concentration risk (HHI)
    const weights = holdings.map(h => h.currentValueUsd / totalValue);
    const hhi = weights.reduce((sum, w) => sum + w * w, 0) * 10000; // Scale to 0-10000
    
    const sortedBySize = [...holdings].sort((a, b) => b.currentValueUsd - a.currentValueUsd);
    const largestPositionPct = sortedBySize[0] 
      ? (sortedBySize[0].currentValueUsd / totalValue) * 100 
      : 0;
    const top3PositionsPct = sortedBySize
      .slice(0, 3)
      .reduce((sum, h) => sum + (h.currentValueUsd / totalValue) * 100, 0);

    // Simplified VaR (would use historical returns in production)
    const var95_1d = totalValue * 0.05; // 5% daily VaR assumption
    const var95_1dPct = 5;

    // Drawdown calculation from performance history
    let peak = 0;
    let maxDrawdownUsd = 0;
    let maxDrawdownPct = 0;
    
    for (const snapshot of this.performanceHistory) {
      if (snapshot.totalValueUsd > peak) {
        peak = snapshot.totalValueUsd;
      }
      const drawdownUsd = peak - snapshot.totalValueUsd;
      const drawdownPct = peak > 0 ? (drawdownUsd / peak) * 100 : 0;
      if (drawdownUsd > maxDrawdownUsd) {
        maxDrawdownUsd = drawdownUsd;
        maxDrawdownPct = drawdownPct;
      }
    }
    
    const currentValue = holdings.reduce((sum, h) => sum + h.currentValueUsd, 0);
    const currentDrawdownUsd = peak - currentValue;
    const currentDrawdownPct = peak > 0 ? (currentDrawdownUsd / peak) * 100 : 0;

    // Simplified volatility (would use daily returns)
    const volatility30d = 0.03; // 3% daily vol assumption
    const volatility30dPct = 3;

    // Simplified Sharpe (assuming 10% annual return, 0% risk-free)
    const sharpeRatio = 10 / (volatility30d * Math.sqrt(252));

    // Beta vs SOL (simplified)
    const betaVsSol = 1.0;

    // Liquidity risk
    const liquidPositions = holdings.filter(h => h.currentValueUsd > 10000).length;
    const illiquidPositionsPct = holdings.length > 0 
      ? ((holdings.length - liquidPositions) / holdings.length) * 100 
      : 0;
    const avgDaysToLiquidate = 1; // Most Solana tokens are liquid

    return {
      var95_1d,
      var95_1dPct,
      maxDrawdownUsd,
      maxDrawdownPct,
      currentDrawdownUsd,
      currentDrawdownPct,
      volatility30d,
      volatility30dPct,
      sharpeRatio,
      betaVsSol,
      hhi,
      largestPositionPct,
      top3PositionsPct,
      avgDaysToLiquidate,
      illiquidPositionsPct,
    };
  }

  private emptyRiskMetrics(): RiskMetrics {
    return {
      var95_1d: 0,
      var95_1dPct: 0,
      maxDrawdownUsd: 0,
      maxDrawdownPct: 0,
      currentDrawdownUsd: 0,
      currentDrawdownPct: 0,
      volatility30d: 0,
      volatility30dPct: 0,
      sharpeRatio: 0,
      betaVsSol: 0,
      hhi: 0,
      largestPositionPct: 0,
      top3PositionsPct: 0,
      avgDaysToLiquidate: 0,
      illiquidPositionsPct: 0,
    };
  }

  // Performance tracking
  recordPerformanceSnapshot(): void {
    const metrics = this.calculateMetrics();
    const lastSnapshot = this.performanceHistory[this.performanceHistory.length - 1];
    
    let dailyReturnPct = 0;
    if (lastSnapshot && lastSnapshot.totalValueUsd > 0) {
      dailyReturnPct = ((metrics.totalValueUsd - lastSnapshot.totalValueUsd) / lastSnapshot.totalValueUsd) * 100;
    }

    this.performanceHistory.push({
      timestamp: Date.now(),
      totalValueUsd: metrics.totalValueUsd,
      totalCostBasisUsd: metrics.totalCostBasisUsd,
      unrealizedPnlUsd: metrics.totalUnrealizedPnlUsd,
      realizedPnlUsd: metrics.totalRealizedPnlUsd,
      dailyReturnPct,
    });

    // Keep last 365 days
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    this.performanceHistory = this.performanceHistory.filter(s => s.timestamp > cutoff);
  }

  getPerformanceHistory(): PerformanceSnapshot[] {
    return this.performanceHistory;
  }

  // Tax reporting
  generateTaxReport(taxYear: number): TaxSummary {
    const startOfYear = new Date(taxYear, 0, 1).getTime();
    const endOfYear = new Date(taxYear + 1, 0, 1).getTime();

    const yearTrades = this.trades.filter(t => t.timestamp >= startOfYear && t.timestamp < endOfYear);
    const sellTrades = yearTrades.filter(t => t.side === 'sell');

    const form8949Entries: Form8949Entry[] = [];
    const washSaleDetails: WashSaleDetail[] = [];

    // Process each sell trade for tax lots
    for (const trade of sellTrades) {
      const lots = this.taxLots.get(trade.tokenMint) || [];
      const soldLots = lots.filter(l => l.soldAt && l.soldAt >= startOfYear && l.soldAt < endOfYear);
      
      for (const lot of soldLots) {
        if (!lot.soldAt || !lot.soldPriceUsd || !lot.realizedPnlUsd) continue;

        const holdingPeriodDays = lot.soldAt ? 
          Math.floor((lot.soldAt - lot.acquiredAt) / (24 * 60 * 60 * 1000)) 
          : 0;
        
        const term = holdingPeriodDays <= 365 ? 'short' : 'long';
        const isWashSale = this.detectWashSale(lot, trade);

        const entry: Form8949Entry = {
          description: `${lot.amount / Math.pow(10, 9)} ${lot.tokenSymbol}`,
          dateAcquired: new Date(lot.acquiredAt).toLocaleDateString('en-US'),
          dateSold: new Date(lot.soldAt).toLocaleDateString('en-US'),
          proceedsUsd: lot.soldPriceUsd * (lot.amount / Math.pow(10, 9)),
          costBasisUsd: lot.costBasisUsd * (lot.soldAmount / lot.amount),
          gainLossUsd: lot.realizedPnlUsd,
          gainLossPct: lot.realizedPnlPct || 0,
          term,
          washSale: isWashSale,
        };

        form8949Entries.push(entry);

        if (isWashSale) {
          washSaleDetails.push({
            tokenSymbol: lot.tokenSymbol,
            disallowedLossUsd: lot.realizedPnlUsd < 0 ? Math.abs(lot.realizedPnlUsd) : 0,
            replacementShares: 0, // Would track replacement shares
            replacementDate: new Date().toLocaleDateString('en-US'),
            originalSaleDate: new Date(lot.soldAt).toLocaleDateString('en-US'),
          });
        }
      }
    }

    const shortTermGainsUsd = form8949Entries
      .filter(e => e.term === 'short' && e.gainLossUsd > 0)
      .reduce((sum, e) => sum + e.gainLossUsd, 0);
    const shortTermLossesUsd = form8949Entries
      .filter(e => e.term === 'short' && e.gainLossUsd < 0)
      .reduce((sum, e) => sum + e.gainLossUsd, 0);
    const longTermGainsUsd = form8949Entries
      .filter(e => e.term === 'long' && e.gainLossUsd > 0)
      .reduce((sum, e) => sum + e.gainLossUsd, 0);
    const longTermLossesUsd = form8949Entries
      .filter(e => e.term === 'long' && e.gainLossUsd < 0)
      .reduce((sum, e) => sum + e.gainLossUsd, 0);

    const totalFeesUsd = yearTrades.reduce((sum, t) => sum + t.feeUsd, 0);

    return {
      taxYear,
      shortTermGainsUsd,
      shortTermLossesUsd,
      longTermGainsUsd,
      longTermLossesUsd,
      netShortTermUsd: shortTermGainsUsd + shortTermLossesUsd,
      netLongTermUsd: longTermGainsUsd + longTermLossesUsd,
      totalRealizedPnlUsd: shortTermGainsUsd + shortTermLossesUsd + longTermGainsUsd + longTermLossesUsd,
      totalFeesUsd,
      form8949Entries,
      washSaleDetails,
    };
  }

  private detectWashSale(lot: TaxLot, trade: TradeRecord): boolean {
    // Simplified wash sale detection
    // In reality, would check for substantially identical positions bought 30 days before/after sale
    if (lot.realizedPnlUsd! >= 0) return false; // Only losses trigger wash sale
    
    const sellDate = new Date(trade.timestamp);
    const windowStart = new Date(sellDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(sellDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Check for buys of same token in the wash sale window
    const windowBuys = this.trades.filter(t => 
      t.tokenMint === lot.tokenMint &&
      t.side === 'buy' &&
      t.timestamp >= windowStart.getTime() &&
      t.timestamp <= windowEnd.getTime()
    );
    
    return windowBuys.length > 0;
  }

  // Export helpers
  exportToCSV(trades: TradeRecord[] = this.trades): string {
    const headers = [
      'Date', 'Type', 'Token', 'Amount', 'Price (USD)', 'Value (USD)', 
      'Fee (USD)', 'Signature', 'Order Type'
    ];
    
    const rows = trades.map(t => [
      new Date(t.timestamp).toISOString().split('T')[0],
      t.side.toUpperCase(),
      t.tokenSymbol,
      (t.amount / Math.pow(10, 9)).toFixed(8),
      t.priceUsd.toFixed(8),
      t.usdValue.toFixed(2),
      t.feeUsd.toFixed(4),
      t.signature || '',
      t.orderType || 'market',
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  exportForm8949CSV(summary: TaxSummary): string {
    const headers = [
      'Description', 'Date Acquired', 'Date Sold', 'Proceeds', 
      'Cost Basis', 'Gain/Loss', 'Term', 'Wash Sale'
    ];
    
    const rows = summary.form8949Entries.map(e => [
      e.description,
      e.dateAcquired,
      e.dateSold,
      e.proceedsUsd.toFixed(2),
      e.costBasisUsd.toFixed(2),
      e.gainLossUsd.toFixed(2),
      e.term,
      e.washSale ? 'Yes' : 'No',
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

// Singleton
let portfolioAnalyticsInstance: PortfolioAnalytics | null = null;

export function getPortfolioAnalytics(rpcEndpoint?: string): PortfolioAnalytics {
  if (!portfolioAnalyticsInstance) {
    portfolioAnalyticsInstance = new PortfolioAnalytics(rpcEndpoint);
  }
  return portfolioAnalyticsInstance;
}

// React hook
export function usePortfolioAnalytics() {
  const analytics = getPortfolioAnalytics();

  return {
    addHolding: (holding: PortfolioHolding) => analytics.addHolding(holding),
    updateHoldingPrice: (tokenMint: string, priceUsd: number) => analytics.updateHoldingPrice(tokenMint, priceUsd),
    removeHolding: (tokenMint: string) => analytics.removeHolding(tokenMint),
    getHolding: (tokenMint: string) => analytics.getHolding(tokenMint),
    getAllHoldings: () => analytics.getAllHoldings(),
    recordTrade: (trade: TradeRecord) => analytics.recordTrade(trade),
    calculateMetrics: () => analytics.calculateMetrics(),
    recordPerformanceSnapshot: () => analytics.recordPerformanceSnapshot(),
    getPerformanceHistory: () => analytics.getPerformanceHistory(),
    generateTaxReport: (taxYear: number) => analytics.generateTaxReport(taxYear),
    exportToCSV: (trades?: TradeRecord[]) => analytics.exportToCSV(trades),
    exportForm8949CSV: (summary: TaxSummary) => analytics.exportForm8949CSV(summary),
  };
}

export type { 
  PortfolioHolding, 
  TradeRecord, 
  PortfolioMetrics, 
  RiskMetrics, 
  TaxLot, 
  TaxEvent, 
  Form8949Entry, 
  TaxSummary, 
  WashSaleDetail,
  PerformanceSnapshot 
};