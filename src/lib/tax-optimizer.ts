/**
 * Tax Lot Optimizer
 * HIFO/LIFO/FIFO selection, Wash Sale Detection, Form 8949 Export
 */

export interface TaxLot {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  costBasisPerToken: number; // USD per token
  totalCostBasis: number; // USD
  acquisitionDate: number; // Unix timestamp
  acquisitionPrice: number; // USD per token at acquisition
  method: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC';
  isLongTerm: boolean; // Held > 1 year
  washSaleRisk: boolean;
  adjustment?: number; // Wash sale adjustment
}

export interface SaleEvent {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  salePricePerToken: number; // USD per token
  saleDate: number; // Unix timestamp
  proceeds: number; // Total USD
  lotsUsed: TaxLot[]; // Which lots were sold
  realizedGainLoss: number; // USD
  shortTermGainLoss: number;
  longTermGainLoss: number;
  washSaleAdjustment: number;
}

export interface TaxOptimizationResult {
  recommendedMethod: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC';
  recommendedLots: TaxLot[];
  estimatedTaxSavings: number; // vs FIFO
  shortTermGainLoss: number;
  longTermGainLoss: number;
  totalGainLoss: number;
  washSaleRisk: boolean;
  alternativeMethods: {
    method: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC';
    totalGainLoss: number;
    taxEstimate: number;
    lotsUsed: TaxLot[];
  }[];
}

export interface Form8949Entry {
  description: string; // e.g., "100 SOL"
  dateAcquired: string; // MM/DD/YYYY
  dateSold: string; // MM/DD/YYYY
  proceeds: number;
  costBasis: number;
  adjustmentCode: string; // 'W' for wash sale
  adjustmentAmount: number;
  gainLoss: number;
  shortTerm: boolean;
}

export interface TaxSummary {
  taxYear: number;
  shortTermGains: number;
  shortTermLosses: number;
  longTermGains: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  totalGainLoss: number;
  washSaleAdjustments: number;
  form8949Entries: Form8949Entry[];
  estimatedTaxLiability: {
    federal: number;
    state: number;
    total: number;
  };
}

export interface WashSaleDetection {
  isWashSale: boolean;
  conflictingPurchase: {
    date: number;
    amount: number;
    price: number;
  } | null;
  disallowedLoss: number;
  replacementBasisAdjustment: number;
  explanation: string;
}

class TaxLotOptimizer {
  private taxLots: Map<string, TaxLot[]> = new Map(); // tokenMint -> lots[]
  private saleEvents: SaleEvent[] = [];
  private readonly WASH_SALE_WINDOW_DAYS = 30;
  private readonly LONG_TERM_HOLDING_DAYS = 365;

  /**
   * Add a new acquisition (buy)
   */
  addAcquisition(
    tokenMint: string,
    tokenSymbol: string,
    amount: number,
    costBasisPerToken: number,
    acquisitionDate: number = Date.now()
  ): TaxLot {
    const lot: TaxLot = {
      id: `lot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      tokenMint,
      tokenSymbol,
      amount,
      costBasisPerToken,
      totalCostBasis: amount * costBasisPerToken,
      acquisitionDate,
      acquisitionPrice: costBasisPerToken,
      method: 'SPECIFIC',
      isLongTerm: false,
      washSaleRisk: false,
    };

    if (!this.taxLots.has(tokenMint)) {
      this.taxLots.set(tokenMint, []);
    }
    this.taxLots.get(tokenMint)!.push(lot);
    
    // Sort by acquisition date
    this.taxLots.get(tokenMint)!.sort((a, b) => a.acquisitionDate - b.acquisitionDate);
    
    return lot;
  }

  /**
   * Process a sale and optimize lot selection
   */
  processSale(
    tokenMint: string,
    tokenSymbol: string,
    amount: number,
    salePricePerToken: number,
    saleDate: number = Date.now(),
    preferredMethod: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC' = 'HIFO'
  ): TaxOptimizationResult {
    const lots = this.taxLots.get(tokenMint) || [];
    const availableLots = lots.filter(l => l.amount > 0);
    
    if (availableLots.length === 0) {
      throw new Error(`No available lots for ${tokenSymbol}`);
    }

    const totalAvailable = availableLots.reduce((sum, l) => sum + l.amount, 0);
    if (totalAvailable < amount) {
      throw new Error(`Insufficient lots: have ${totalAvailable}, need ${amount}`);
    }

    // Calculate results for each method
    const methods: TaxOptimizationResult['alternativeMethods'] = [];
    
    for (const method of ['FIFO', 'LIFO', 'HIFO', 'SPECIFIC'] as const) {
      const result = this.calculateSaleResult(availableLots, amount, salePricePerToken, saleDate, method);
      methods.push({
        method,
        totalGainLoss: result.totalGainLoss,
        taxEstimate: this.estimateTax(result),
        lotsUsed: result.lotsUsed,
      });
    }

    // Find best method (minimize tax / maximize loss)
    const bestMethod = methods.reduce((best, current) => {
      // Prefer methods that generate losses or minimize gains
      if (current.totalGainLoss < 0 && best.totalGainLoss >= 0) return current;
      if (best.totalGainLoss < 0 && current.totalGainLoss >= 0) return best;
      // Both gains or both losses - minimize absolute gain
      return Math.abs(current.totalGainLoss) < Math.abs(best.totalGainLoss) ? current : best;
    });

    // Check wash sale risk
    const washSaleRisk = this.checkWashSaleRisk(tokenMint, saleDate, amount, salePricePerToken);

    // Execute the sale with best method
    const saleResult = this.executeSale(tokenMint, tokenSymbol, amount, salePricePerToken, saleDate, bestMethod.method);
    this.saleEvents.push(saleResult);

    return {
      recommendedMethod: bestMethod.method,
      recommendedLots: bestMethod.lotsUsed,
      estimatedTaxSavings: this.calculateTaxSavings(methods, bestMethod),
      shortTermGainLoss: saleResult.shortTermGainLoss,
      longTermGainLoss: saleResult.longTermGainLoss,
      totalGainLoss: saleResult.realizedGainLoss,
      washSaleRisk: washSaleRisk.isWashSale,
      alternativeMethods: methods,
    };
  }

  /**
   * Calculate sale result for a specific method
   */
  private calculateSaleResult(
    availableLots: TaxLot[],
    amount: number,
    salePricePerToken: number,
    saleDate: number,
    method: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC'
  ): {
    lotsUsed: TaxLot[];
    totalGainLoss: number;
    shortTermGainLoss: number;
    longTermGainLoss: number;
    washSaleAdjustment: number;
  } {
    let remainingAmount = amount;
    const lotsUsed: TaxLot[] = [];
    let shortTermGainLoss = 0;
    let longTermGainLoss = 0;
    let totalWashSaleAdjustment = 0;

    // Sort lots according to method
    let sortedLots = [...availableLots];
    switch (method) {
      case 'FIFO':
        sortedLots.sort((a, b) => a.acquisitionDate - b.acquisitionDate);
        break;
      case 'LIFO':
        sortedLots.sort((a, b) => b.acquisitionDate - a.acquisitionDate);
        break;
      case 'HIFO':
        sortedLots.sort((a, b) => b.costBasisPerToken - a.costBasisPerToken);
        break;
      case 'SPECIFIC':
        // For specific, we'd need user input - default to HIFO for optimization
        sortedLots.sort((a, b) => b.costBasisPerToken - a.costBasisPerToken);
        break;
    }

    for (const lot of sortedLots) {
      if (remainingAmount <= 0) break;
      
      const usedAmount = Math.min(lot.amount, remainingAmount);
      const gainLossPerToken = salePricePerToken - lot.costBasisPerToken;
      const gainLoss = usedAmount * gainLossPerToken;
      
      // Check holding period
      const holdingDays = (saleDate - lot.acquisitionDate) / (1000 * 60 * 60 * 24);
      const isLongTerm = holdingDays >= this.LONG_TERM_HOLDING_DAYS;
      
      if (isLongTerm) {
        longTermGainLoss += gainLoss;
      } else {
        shortTermGainLoss += gainLoss;
      }
      
      // Check wash sale for this lot
      const washSale = this.checkWashSaleForLot(lot, saleDate, salePricePerToken);
      if (washSale.isWashSale) {
        totalWashSaleAdjustment += washSale.disallowedLoss;
      }

      lotsUsed.push({
        ...lot,
        id: `${lot.id}_used_${usedAmount}`,
        amount: usedAmount,
        totalCostBasis: usedAmount * lot.costBasisPerToken,
      });
      
      remainingAmount -= usedAmount;
    }

    return {
      lotsUsed,
      totalGainLoss: shortTermGainLoss + longTermGainLoss,
      shortTermGainLoss,
      longTermGainLoss,
      washSaleAdjustment: totalWashSaleAdjustment,
    };
  }

  /**
   * Execute the sale (mutate lots)
   */
  private executeSale(
    tokenMint: string,
    tokenSymbol: string,
    amount: number,
    salePricePerToken: number,
    saleDate: number,
    method: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC'
  ): SaleEvent {
    const lots = this.taxLots.get(tokenMint) || [];
    const availableLots = lots.filter(l => l.amount > 0);
    
    const result = this.calculateSaleResult(availableLots, amount, salePricePerToken, saleDate, method);
    
    // Mutate original lots
    for (const usedLot of result.lotsUsed) {
      const originalLot = lots.find(l => l.id === usedLot.id.replace(/_used_.*/, ''));
      if (originalLot) {
        originalLot.amount -= usedLot.amount;
      }
    }

    const saleEvent: SaleEvent = {
      id: `sale_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      tokenMint,
      tokenSymbol,
      amount,
      salePricePerToken,
      saleDate,
      proceeds: amount * salePricePerToken,
      lotsUsed: result.lotsUsed,
      realizedGainLoss: result.totalGainLoss,
      shortTermGainLoss: result.shortTermGainLoss,
      longTermGainLoss: result.longTermGainLoss,
      washSaleAdjustment: result.washSaleAdjustment,
    };

    return saleEvent;
  }

  /**
   * Check wash sale risk for a sale
   */
  checkWashSaleRisk(
    tokenMint: string,
    saleDate: number,
    amount: number,
    salePrice: number
  ): WashSaleDetection {
    const windowStart = saleDate - this.WASH_SALE_WINDOW_DAYS * 86400000;
    const windowEnd = saleDate + this.WASH_SALE_WINDOW_DAYS * 86400000;
    
    // Check for purchases of substantially identical asset in window
    const lots = this.taxLots.get(tokenMint) || [];
    
    for (const lot of lots) {
      if (lot.acquisitionDate >= windowStart && lot.acquisitionDate <= windowEnd) {
        // This is a simplified check - in reality, "substantially identical" is complex
        const holdingDays = (saleDate - lot.acquisitionDate) / (1000 * 60 * 60 * 24);
        
        if (holdingDays <= this.WASH_SALE_WINDOW_DAYS) {
          // Calculate disallowed loss
          const lossPerToken = lot.costBasisPerToken - salePrice;
          if (lossPerToken > 0) {
            const disallowedLoss = Math.min(amount, lot.amount) * lossPerToken;
            
            return {
              isWashSale: true,
              conflictingPurchase: {
                date: lot.acquisitionDate,
                amount: lot.amount,
                price: lot.acquisitionPrice,
              },
              disallowedLoss,
              replacementBasisAdjustment: disallowedLoss,
              explanation: `Wash sale detected: purchased ${lot.amount} ${lot.tokenSymbol} ${this.formatDate(lot.acquisitionDate)} within 30 days of sale at a loss`,
            };
          }
        }
      }
    }

    return {
      isWashSale: false,
      conflictingPurchase: null,
      disallowedLoss: 0,
      replacementBasisAdjustment: 0,
      explanation: 'No wash sale detected',
    };
  }

  private checkWashSaleForLot(lot: TaxLot, saleDate: number, salePrice: number): WashSaleDetection {
    const lossPerToken = lot.costBasisPerToken - salePrice;
    if (lossPerToken <= 0) return { isWashSale: false, conflictingPurchase: null, disallowedLoss: 0, replacementBasisAdjustment: 0, explanation: '' };
    
    const holdingDays = (saleDate - lot.acquisitionDate) / (1000 * 60 * 60 * 24);
    if (holdingDays <= this.WASH_SALE_WINDOW_DAYS && holdingDays >= -this.WASH_SALE_WINDOW_DAYS) {
      return {
        isWashSale: true,
        conflictingPurchase: { date: lot.acquisitionDate, amount: lot.amount, price: lot.acquisitionPrice },
        disallowedLoss: lot.amount * lossPerToken,
        replacementBasisAdjustment: lot.amount * lossPerToken,
        explanation: 'Wash sale on this lot',
      };
    }
    
    return { isWashSale: false, conflictingPurchase: null, disallowedLoss: 0, replacementBasisAdjustment: 0, explanation: '' };
  }

  /**
   * Generate Form 8949 entries
   */
  generateForm8949(taxYear: number): Form8949Entry[] {
    const entries: Form8949Entry[] = [];
    
    for (const sale of this.saleEvents) {
      const saleYear = new Date(sale.saleDate).getFullYear();
      if (saleYear !== taxYear) continue;
      
      for (const lot of sale.lotsUsed) {
        const holdingDays = (sale.saleDate - lot.acquisitionDate) / (1000 * 60 * 60 * 24);
        const isLongTerm = holdingDays >= this.LONG_TERM_HOLDING_DAYS;
        
        const gainLoss = lot.amount * (sale.salePricePerToken - lot.costBasisPerToken);
        const washSale = this.checkWashSaleForLot(lot, sale.saleDate, sale.salePricePerToken);
        
        entries.push({
          description: `${lot.amount} ${lot.tokenSymbol}`,
          dateAcquired: this.formatDate(lot.acquisitionDate),
          dateSold: this.formatDate(sale.saleDate),
          proceeds: lot.amount * sale.salePricePerToken,
          costBasis: lot.totalCostBasis,
          adjustmentCode: washSale.isWashSale ? 'W' : '',
          adjustmentAmount: washSale.disallowedLoss,
          gainLoss,
          shortTerm: !isLongTerm,
        });
      }
    }
    
    return entries;
  }

  /**
   * Generate tax summary
   */
  generateTaxSummary(taxYear: number): TaxSummary {
    const entries = this.generateForm8949(taxYear);
    
    let shortTermGains = 0;
    let shortTermLosses = 0;
    let longTermGains = 0;
    let longTermLosses = 0;
    let washSaleAdjustments = 0;
    
    for (const entry of entries) {
      if (entry.gainLoss >= 0) {
        if (entry.shortTerm) shortTermGains += entry.gainLoss;
        else longTermGains += entry.gainLoss;
      } else {
        if (entry.shortTerm) shortTermLosses += Math.abs(entry.gainLoss);
        else longTermLosses += Math.abs(entry.gainLoss);
      }
      washSaleAdjustments += entry.adjustmentAmount;
    }
    
    const netShortTerm = shortTermGains - shortTermLosses;
    const netLongTerm = longTermGains - longTermLosses;
    const totalGainLoss = netShortTerm + netLongTerm;
    
    // Estimate tax (simplified 2024 brackets)
    const federalRateShort = 0.37; // Top marginal
    const federalRateLong = 0.20; // Long-term capital gains
    const stateRate = 0.05; // Average state
    
    const federalTax = Math.max(0, netShortTerm * federalRateShort + netLongTerm * federalRateLong);
    const stateTax = Math.max(0, totalGainLoss * stateRate);
    
    return {
      taxYear,
      shortTermGains,
      shortTermLosses,
      longTermGains,
      longTermLosses,
      netShortTerm,
      netLongTerm,
      totalGainLoss,
      washSaleAdjustments,
      form8949Entries: entries,
      estimatedTaxLiability: {
        federal: federalTax,
        state: stateTax,
        total: federalTax + stateTax,
      },
    };
  }

  /**
   * Export to CSV for tax software
   */
  exportToCSV(taxYear: number): string {
    const entries = this.generateForm8949(taxYear);
    
    const headers = [
      'Description',
      'Date Acquired',
      'Date Sold',
      'Proceeds',
      'Cost Basis',
      'Adjustment Code',
      'Adjustment Amount',
      'Gain/Loss',
      'Short/Long Term',
    ];
    
    const rows = entries.map(e => [
      e.description,
      e.dateAcquired,
      e.dateSold,
      e.proceeds.toFixed(2),
      e.costBasis.toFixed(2),
      e.adjustmentCode,
      e.adjustmentAmount.toFixed(2),
      e.gainLoss.toFixed(2),
      e.shortTerm ? 'Short' : 'Long',
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Get current tax lots for a token
   */
  getTaxLots(tokenMint: string): TaxLot[] {
    return this.taxLots.get(tokenMint)?.filter(l => l.amount > 0) || [];
  }

  /**
   * Get all sale events
   */
  getSaleEvents(): SaleEvent[] {
    return [...this.saleEvents];
  }

  // ========== HELPER METHODS ==========

  private estimateTax(result: { totalGainLoss: number; shortTermGainLoss: number; longTermGainLoss: number }): number {
    const federalRateShort = 0.37;
    const federalRateLong = 0.20;
    const stateRate = 0.05;
    
    return Math.max(0, 
      result.shortTermGainLoss * federalRateShort + 
      result.longTermGainLoss * federalRateLong
    ) + Math.max(0, result.totalGainLoss * stateRate);
  }

  private calculateTaxSavings(
    methods: { method: string; taxEstimate: number }[],
    best: { method: string; taxEstimate: number }
  ): number {
    const fifoMethod = methods.find(m => m.method === 'FIFO');
    if (!fifoMethod) return 0;
    return Math.max(0, fifoMethod.taxEstimate - best.taxEstimate);
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
  }
}

// Singleton
let taxOptimizerInstance: TaxLotOptimizer | null = null;

export function getTaxOptimizer(): TaxLotOptimizer {
  if (!taxOptimizerInstance) {
    taxOptimizerInstance = new TaxLotOptimizer();
  }
  return taxOptimizerInstance;
}

// React hook
export function useTaxOptimizer() {
  const optimizer = getTaxOptimizer();
  
  return {
    addAcquisition: (mint: string, symbol: string, amount: number, costBasis: number, date?: number) => 
      optimizer.addAcquisition(mint, symbol, amount, costBasis, date),
    processSale: (mint: string, symbol: string, amount: number, price: number, date?: number, method?: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC') => 
      optimizer.processSale(mint, symbol, amount, price, date, method),
    generateForm8949: (year: number) => optimizer.generateForm8949(year),
    generateTaxSummary: (year: number) => optimizer.generateTaxSummary(year),
    exportToCSV: (year: number) => optimizer.exportToCSV(year),
    getTaxLots: (mint: string) => optimizer.getTaxLots(mint),
    getSaleEvents: () => optimizer.getSaleEvents(),
  };
}

export type { TaxLot, SaleEvent, TaxOptimizationResult, Form8949Entry, TaxSummary, WashSaleDetection };