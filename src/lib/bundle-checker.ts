/**
 * Bundle/Insider Checker
 * Detects bundled launches, insider allocations, dev wallet movements, LP lock status
 * Provides rug probability scoring and safety analysis
 */

import { Connection, PublicKey, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import { getJupiterExecutor } from './jupiter-executor';

export interface BundleAnalysis {
  isBundled: boolean;
  confidence: number; // 0-100
  bundleSize: number;
  bundleWallets: BundleWallet[];
  insiderWallets: InsiderWallet[];
  devWalletAnalysis: DevWalletAnalysis;
  lpLockStatus: LPLockStatus;
  sniperActivity: SniperActivity;
  riskScore: number; // 0-100 (higher = riskier)
  riskFactors: RiskFactor[];
  recommendation: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'AVOID';
}

export interface BundleWallet {
  address: string;
  balance: number;
  percentage: number;
  isDevWallet: boolean;
  isSniper: boolean;
  firstTxTimestamp: number;
  txCount: number;
}

export interface InsiderWallet {
  address: string;
  label: string;
  percentage: number;
  entryPrice?: number;
  currentPnl?: number;
  isKnownInsider: boolean;
  linkedWallets: string[];
}

export interface DevWalletAnalysis {
  devWalletAddress: string;
  devBalance: number;
  devPercentage: number;
  hasSold: boolean;
  soldAmount: number;
  soldPercentage: number;
  avgSellPrice?: number;
  recentActivity: DevWalletTx[];
  isRugPullPattern: boolean;
}

export interface DevWalletTx {
  signature: string;
  timestamp: number;
  type: 'buy' | 'sell' | 'transfer';
  amount: number;
  price?: number;
  toAddress?: string;
}

export interface LPLockStatus {
  isLocked: boolean;
  lockProvider?: string; // 'streamflow', 'teamfinance', 'pinksale', 'custom'
  lockExpiry?: number;
  lockedPercentage: number;
  totalLpSupply: number;
  lockedLpAmount: number;
  lpTokenMint: string;
  lpTokenAccount: string;
  burnAddress?: string;
}

export interface SniperActivity {
  sniperCount: number;
  topSnipers: SniperWallet[];
  firstBlockSnipers: number;
  sniperVolumeUsd: number;
  sniperPercentage: number;
}

export interface SniperWallet {
  address: string;
  entryBlock: number;
  entryTimestamp: number;
  amountSol: number;
  amountTokens: number;
  currentPnl: number;
  isMevBot: boolean;
}

export interface RiskFactor {
  type: 'BUNDLED_LAUNCH' | 'INSIDER_ALLOCATION' | 'DEV_DUMPING' | 'LP_UNLOCKED' | 'SNIPER_HEAVY' | 'LOW_LIQUIDITY' | 'HONEYPOT' | 'MINT_AUTHORITY' | 'FREEZE_AUTHORITY' | 'CONTRACT_NOT_VERIFIED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence: any;
}

export interface TokenSafetyReport {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  bundleAnalysis: BundleAnalysis;
  securityScore: SecurityScore;
  holderAnalysis: HolderAnalysis;
  contractAnalysis: ContractAnalysis;
  liquidityAnalysis: LiquidityAnalysis;
  overallScore: number; // 0-100
  overallRating: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'AVOID';
  generatedAt: number;
}

export interface SecurityScore {
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  isMutable: boolean;
  isProxy: boolean;
  hasExternalCalls: boolean;
  score: number; // 0-100
}

export interface HolderAnalysis {
  totalHolders: number;
  top10Percentage: number;
  top50Percentage: number;
  devPercentage: number;
  sniperPercentage: number;
  insiderPercentage: number;
  distributionScore: number; // 0-100
}

export interface ContractAnalysis {
  isVerified: boolean;
  compilerVersion?: string;
  optimizationEnabled?: boolean;
  licenseType?: string;
  similarContracts: string[];
}

export interface LiquidityAnalysis {
  totalLiquidityUsd: number;
  lpLockedPercentage: number;
  lpLockExpiry?: number;
  poolType: 'raydium' | 'orca' | 'pump_fun' | 'other';
  priceImpact1k: number;
  priceImpact10k: number;
}

class BundleInsiderChecker {
  private connection: Connection;
  private cache = new Map<string, { data: TokenSafetyReport; timestamp: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private knownInsiders = new Map<string, InsiderWallet>();
  private knownSnipers = new Map<string, SniperWallet>();

  constructor(rpcEndpoint?: string) {
    this.connection = new Connection(
      rpcEndpoint || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    this.loadKnownEntities();
  }

  private loadKnownEntities(): void {
    // Load known insider/sniper wallets from database or API
    // For now, we'll populate with some known patterns
    this.knownInsiders.set('insider_pattern_1', {
      address: '',
      label: 'Common Insider Pattern',
      percentage: 0,
      isKnownInsider: true,
      linkedWallets: [],
    });
  }

  /**
   * Analyze token for bundle/insider activity
   */
  async analyzeToken(tokenMint: string): Promise<TokenSafetyReport> {
    const cacheKey = `safety:${tokenMint}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Fetch token data from multiple sources
      const [
        tokenInfo,
        securityInfo,
        holderInfo,
        tradeInfo,
        lpInfo,
      ] = await Promise.allSettled([
        this.fetchTokenInfo(tokenMint),
        this.fetchSecurityInfo(tokenMint),
        this.fetchHolderInfo(tokenMint),
        this.fetchRecentTrades(tokenMint),
        this.fetchLPInfo(tokenMint),
      ]);

      // Analyze bundle
      const bundleAnalysis = await this.analyzeBundle(
        tokenMint,
        tokenInfo.value,
        holderInfo.value,
        tradeInfo.value
      );

      // Analyze security
      const securityScore = this.analyzeSecurity(securityInfo.value);

      // Analyze holders
      const holderAnalysis = this.analyzeHolders(holderInfo.value, bundleAnalysis);

      // Analyze contract
      const contractAnalysis = await this.analyzeContract(tokenMint);

      // Analyze liquidity
      const liquidityAnalysis = this.analyzeLiquidity(lpInfo.value, tokenInfo.value);

      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        bundleAnalysis,
        securityScore,
        holderAnalysis,
        liquidityAnalysis
      );

      const overallRating = this.getRatingFromScore(overallScore);

      const report: TokenSafetyReport = {
        tokenMint,
        tokenSymbol: tokenInfo.value?.symbol || 'UNKNOWN',
        tokenName: tokenInfo.value?.name || 'Unknown Token',
        bundleAnalysis,
        securityScore,
        holderAnalysis,
        contractAnalysis,
        liquidityAnalysis,
        overallScore,
        overallRating,
        generatedAt: Date.now(),
      };

      this.cache.set(cacheKey, { data: report, timestamp: Date.now() });
      return report;
    } catch (error) {
      console.error('[BundleChecker] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze bundle launch patterns
   */
  private async analyzeBundle(
    tokenMint: string,
    tokenInfo: any,
    holderInfo: any,
    tradeInfo: any
  ): Promise<BundleAnalysis> {
    const riskFactors: RiskFactor[] = [];
    let riskScore = 0;

    // Get recent trades (first 100 trades after launch)
    const trades = tradeInfo.value || [];
    const earlyTrades = trades
      .filter((t: any) => t.timestamp && t.timestamp < (tokenInfo?.create_timestamp || Date.now()) + 3600) // First hour
      .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

    // Detect bundled wallets (multiple wallets buying in same block/transaction)
    const bundleWallets = this.detectBundledWallets(earlyTrades);
    const isBundled = bundleWallets.length > 3;
    
    if (isBundled) {
      riskFactors.push({
        type: 'BUNDLED_LAUNCH',
        severity: bundleWallets.length > 10 ? 'CRITICAL' : 'HIGH',
        description: `Detected ${bundleWallets.length} wallets buying in coordinated pattern within first hour`,
        evidence: { bundleWallets: bundleWallets.map(w => w.address) },
      });
      riskScore += Math.min(40, bundleWallets.length * 3);
    }

    // Detect insider wallets
    const insiderWallets = this.detectInsiderWallets(holderInfo.value || [], earlyTrades);
    if (insiderWallets.length > 0) {
      riskFactors.push({
        type: 'INSIDER_ALLOCATION',
        severity: insiderWallets.some(w => w.percentage > 5) ? 'HIGH' : 'MEDIUM',
        description: `Found ${insiderWallets.length} potential insider wallets with early allocations`,
        evidence: { insiderWallets: insiderWallets.map(w => ({ address: w.address, percentage: w.percentage })) },
      });
      riskScore += Math.min(30, insiderWallets.length * 5);
    }

    // Analyze dev wallet
    const devWalletAnalysis = this.analyzeDevWallet(tokenMint, holderInfo.value || [], earlyTrades);
    if (devWalletAnalysis.isRugPullPattern) {
      riskFactors.push({
        type: 'DEV_DUMPING',
        severity: 'CRITICAL',
        description: 'Dev wallet shows rug pull pattern: large sells early or transferring to new wallets',
        evidence: devWalletAnalysis,
      });
      riskScore += 50;
    }

    // LP Lock status
    const lpLockStatus = await this.checkLPLock(tokenMint);
    if (!lpLockStatus.isLocked) {
      riskFactors.push({
        type: 'LP_UNLOCKED',
        severity: 'HIGH',
        description: 'Liquidity pool is not locked - dev can pull liquidity at any time',
        evidence: lpLockStatus,
      });
      riskScore += 25;
    }

    // Sniper activity
    const sniperActivity = this.analyzeSniperActivity(earlyTrades, tokenInfo?.create_timestamp || 0);
    if (sniperActivity.sniperPercentage > 50) {
      riskFactors.push({
        type: 'SNIPER_HEAVY',
        severity: 'MEDIUM',
        description: `${sniperActivity.sniperPercentage.toFixed(1)}% of early volume from snipers`,
        evidence: sniperActivity,
      });
      riskScore += 15;
    }

    // Determine recommendation
    let recommendation: BundleAnalysis['recommendation'] = 'SAFE';
    if (riskScore >= 70) recommendation = 'AVOID';
    else if (riskScore >= 40) recommendation = 'HIGH_RISK';
    else if (riskScore >= 20) recommendation = 'CAUTION';

    return {
      isBundled,
      confidence: isBundled ? Math.min(95, 50 + bundleWallets.length * 3) : 10,
      bundleSize: bundleWallets.length,
      bundleWallets,
      insiderWallets,
      devWalletAnalysis,
      lpLockStatus,
      sniperActivity,
      riskScore: Math.min(100, riskScore),
      riskFactors,
      recommendation,
    };
  }

  /**
   * Detect bundled wallets (coordinated buying)
   */
  private detectBundledWallets(trades: any[]): BundleWallet[] {
    // Group trades by block/signature pattern
    const blockGroups = new Map<string, any[]>();
    
    for (const trade of trades) {
      const blockKey = trade.slot?.toString() || trade.blockhash?.slice(0, 8) || 'unknown';
      if (!blockGroups.has(blockKey)) blockGroups.set(blockKey, []);
      blockGroups.get(blockKey)!.push(trade);
    }

    // Find blocks with multiple buyers
    const bundledWallets: BundleWallet[] = [];
    
    for (const [block, blockTrades] of blockGroups.entries()) {
      if (blockTrades.length >= 3) {
        // Multiple buys in same block - potential bundle
        const buyers = new Map<string, { count: number; totalAmount: number; firstTx: number }>();
        
        for (const trade of blockTrades) {
          const buyer = trade.buyer || trade.user || trade.owner;
          if (buyer) {
            const existing = buyers.get(buyer) || { count: 0, totalAmount: 0, firstTx: trade.timestamp };
            existing.count++;
            existing.totalAmount += trade.amount_sol || trade.amount_usd || 0;
            existing.firstTx = Math.min(existing.firstTx, trade.timestamp);
            buyers.set(buyer, existing);
          }
        }

        // Convert to BundleWallet format
        for (const [address, data] of buyers.entries()) {
          bundledWallets.push({
            address,
            balance: data.totalAmount,
            percentage: 0, // Would calculate from total supply
            isDevWallet: false,
            isSniper: data.firstTx < (Date.now() / 1000) + 60, // Within first minute
            firstTxTimestamp: data.firstTx,
            txCount: data.count,
          });
        }
      }
    }

    return bundledWallets;
  }

  /**
   * Detect insider wallets
   */
  private detectInsiderWallets(holders: any[], trades: any[]): InsiderWallet[] {
    const insiders: InsiderWallet[] = [];
    const earlyBuyers = new Map<string, { timestamp: number; amount: number; price?: number }>();

    // Find wallets that bought very early (first few blocks)
    for (const trade of trades) {
      const buyer = trade.buyer || trade.user || trade.owner;
      if (buyer && trade.timestamp) {
        const existing = earlyBuyers.get(buyer);
        if (!existing || trade.timestamp < existing.timestamp) {
          earlyBuyers.set(buyer, {
            timestamp: trade.timestamp,
            amount: trade.amount_sol || trade.amount_usd || 0,
            price: trade.price,
          });
        }
      }
    }

    // Sort by timestamp and take earliest
    const sortedBuyers = Array.from(earlyBuyers.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 20);

    for (const [address, data] of sortedBuyers) {
      // Check if this wallet is linked to known insiders
      const isKnown = this.knownInsiders.has(address) || 
                      this.isLinkedToKnownInsider(address);
      
      // Check if wallet has unusually large percentage
      const holder = holders.find(h => h.address === address);
      const percentage = holder?.percentage || 0;

      if (percentage > 1 || isKnown || data.timestamp < (Date.now() / 1000) + 30) {
        insiders.push({
          address,
          label: isKnown ? 'Known Insider' : 'Early Buyer',
          percentage,
          entryPrice: data.price,
          isKnownInsider: isKnown,
          linkedWallets: this.findLinkedWallets(address, holders),
        });
      }
    }

    return insiders;
  }

  private isLinkedToKnownInsider(address: string): boolean {
    // Check if wallet has interacted with known insider wallets
    // This would require transaction history analysis
    return false;
  }

  private findLinkedWallets(address: string, holders: any[]): string[] {
    // Find wallets with similar transaction patterns
    return [];
  }

  /**
   * Analyze dev wallet behavior
   */
  private analyzeDevWallet(tokenMint: string, holders: any[], trades: any[]): DevWalletAnalysis {
    // Find dev wallet (usually creator or largest early holder)
    const devWallet = holders.find(h => h.is_dev || h.is_creator) || 
                      holders.reduce((max: any, h: any) => h.percentage > (max?.percentage || 0) ? h : max, null);

    if (!devWallet) {
      return {
        devWalletAddress: '',
        devBalance: 0,
        devPercentage: 0,
        hasSold: false,
        soldAmount: 0,
        soldPercentage: 0,
        recentActivity: [],
        isRugPullPattern: false,
      };
    }

    // Check dev wallet transactions
    const devTrades = trades.filter(t => 
      (t.seller || t.user || t.owner) === devWallet.address
    ).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const soldAmount = devTrades.reduce((sum, t) => sum + (t.amount_sol || t.amount_usd || 0), 0);
    const soldPercentage = devWallet.balance > 0 ? (soldAmount / devWallet.balance) * 100 : 0;
    const hasSold = soldAmount > 0;

    const recentActivity: DevWalletTx[] = devTrades.slice(0, 10).map(t => ({
      signature: t.signature || '',
      timestamp: t.timestamp || 0,
      type: 'sell' as const,
      amount: t.amount_sol || t.amount_usd || 0,
      price: t.price,
      toAddress: t.buyer,
    }));

    // Detect rug pull pattern
    const isRugPullPattern = 
      (hasSold && soldPercentage > 50 && devTrades[0] && devTrades[0].timestamp < (Date.now() / 1000) + 3600) || // Sold >50% within first hour
      (recentActivity.some(tx => tx.toAddress && this.isNewWallet(tx.toAddress))) || // Transferred to new wallets
      (devWallet.balance > 0 && soldPercentage > 80); // Sold most holdings

    return {
      devWalletAddress: devWallet.address,
      devBalance: devWallet.balance,
      devPercentage: devWallet.percentage,
      hasSold,
      soldAmount,
      soldPercentage,
      avgSellPrice: devTrades.length > 0 
        ? devTrades.reduce((sum, t) => sum + (t.price || 0), 0) / devTrades.length 
        : undefined,
      recentActivity,
      isRugPullPattern,
    };
  }

  private isNewWallet(address: string): boolean {
    // Check if wallet is newly created (few transactions)
    return false; // Would need transaction history
  }

  /**
   * Check LP lock status
   */
  private async checkLPLock(tokenMint: string): Promise<LPLockStatus> {
    // This would query LP lock providers (Streamflow, TeamFinance, PinkSale, etc.)
    // For now, return basic structure
    return {
      isLocked: false,
      lockedPercentage: 0,
      totalLpSupply: 0,
      lockedLpAmount: 0,
      lpTokenMint: '',
      lpTokenAccount: '',
    };
  }

  /**
   * Analyze sniper activity
   */
  private analyzeSniperActivity(trades: any[], launchTimestamp: number): SniperActivity {
    const firstBlock = launchTimestamp;
    const firstMinute = firstBlock + 60;
    const firstFiveMinutes = firstBlock + 300;

    const snipers = trades.filter(t => {
      const ts = t.timestamp || 0;
      return ts <= firstMinute && (t.buyer || t.user || t.owner);
    });

    const sniperWallets: SniperWallet[] = [];
    const sniperMap = new Map<string, { totalSol: number; totalTokens: number; firstBlock: number; count: number }>();

    for (const trade of snipers) {
      const buyer = trade.buyer || trade.user || trade.owner;
      if (!buyer) continue;
      
      const existing = sniperMap.get(buyer) || { totalSol: 0, totalTokens: 0, firstBlock: trade.slot || 0, count: 0 };
      existing.totalSol += trade.amount_sol || 0;
      existing.totalTokens += trade.amount_tokens || 0;
      existing.firstBlock = Math.min(existing.firstBlock, trade.slot || 0);
      existing.count++;
      sniperMap.set(buyer, existing);
    }

    for (const [address, data] of sniperMap.entries()) {
      sniperWallets.push({
        address,
        entryBlock: data.firstBlock,
        entryTimestamp: firstBlock,
        amountSol: data.totalSol,
        amountTokens: data.totalTokens,
        currentPnl: 0, // Would calculate from current price
        isMevBot: data.count > 1, // Multiple buys in first block = likely MEV bot
      });
    }

    const totalEarlyVolume = trades
      .filter(t => (t.timestamp || 0) <= firstFiveMinutes)
      .reduce((sum, t) => sum + (t.amount_usd || 0), 0);

    const sniperVolume = sniperWallets.reduce((sum, s) => sum + s.amountSol, 0);

    return {
      sniperCount: sniperWallets.length,
      topSnipers: sniperWallets
        .sort((a, b) => b.amountSol - a.amountSol)
        .slice(0, 10),
      firstBlockSnipers: sniperWallets.filter(s => s.entryBlock === firstBlock).length,
      sniperVolumeUsd: sniperVolume,
      sniperPercentage: totalEarlyVolume > 0 ? (sniperVolume / totalEarlyVolume) * 100 : 0,
    };
  }

  /**
   * Analyze security features
   */
  private analyzeSecurity(securityInfo: any): SecurityScore {
    return {
      mintAuthorityRevoked: securityInfo?.is_mint_authority_revoked || false,
      freezeAuthorityRevoked: securityInfo?.is_freeze_authority_revoked || false,
      isMutable: securityInfo?.is_mutable || false,
      isProxy: securityInfo?.is_proxy || false,
      hasExternalCalls: securityInfo?.has_external_calls || false,
      score: this.calculateSecurityScore(securityInfo),
    };
  }

  private calculateSecurityScore(securityInfo: any): number {
    let score = 100;
    if (!securityInfo?.is_mint_authority_revoked) score -= 30;
    if (!securityInfo?.is_freeze_authority_revoked) score -= 20;
    if (securityInfo?.is_mutable) score -= 15;
    if (securityInfo?.is_proxy) score -= 10;
    if (securityInfo?.has_external_calls) score -= 10;
    if (securityInfo?.is_honeypot) score -= 50;
    return Math.max(0, score);
  }

  /**
   * Analyze holder distribution
   */
  private analyzeHolders(holderInfo: any, bundleAnalysis: BundleAnalysis): HolderAnalysis {
    const holders = holderInfo?.holders || [];
    const totalHolders = holders.length;
    
    const top10 = holders.slice(0, 10).reduce((sum, h) => sum + (h.percentage || 0), 0);
    const top50 = holders.slice(0, 50).reduce((sum, h) => sum + (h.percentage || 0), 0);
    const devPercentage = holders.find(h => h.is_dev)?.percentage || 0;
    const sniperPercentage = bundleAnalysis.sniperActivity.sniperPercentage;
    const insiderPercentage = bundleAnalysis.insiderWallets.reduce((sum, w) => sum + w.percentage, 0);

    // Distribution score: lower concentration = higher score
    const distributionScore = Math.max(0, 100 - top10 * 2 - devPercentage * 3);

    return {
      totalHolders,
      top10Percentage: top10,
      top50Percentage: top50,
      devPercentage,
      sniperPercentage,
      insiderPercentage,
      distributionScore,
    };
  }

  /**
   * Analyze contract
   */
  private async analyzeContract(tokenMint: string): Promise<ContractAnalysis> {
    // Would query Solana program account for contract details
    return {
      isVerified: false,
      similarContracts: [],
    };
  }

  /**
   * Analyze liquidity
   */
  private analyzeLiquidity(lpInfo: any, tokenInfo: any): LiquidityAnalysis {
    return {
      totalLiquidityUsd: lpInfo?.liquidity_usd || tokenInfo?.liquidity || 0,
      lpLockedPercentage: lpInfo?.lp_locked_percentage || 0,
      lpLockExpiry: lpInfo?.lp_lock_expiry,
      poolType: tokenInfo?.pool_type || 'unknown',
      priceImpact1k: lpInfo?.price_impact_1k || 0,
      priceImpact10k: lpInfo?.price_impact_10k || 0,
    };
  }

  /**
   * Calculate overall safety score
   */
  private calculateOverallScore(
    bundleAnalysis: BundleAnalysis,
    securityScore: SecurityScore,
    holderAnalysis: HolderAnalysis,
    liquidityAnalysis: LiquidityAnalysis
  ): number {
    let score = 100;

    // Bundle risk
    score -= bundleAnalysis.riskScore * 0.4;

    // Security score
    score -= (100 - securityScore.score) * 0.3;

    // Holder distribution
    score -= (100 - holderAnalysis.distributionScore) * 0.15;

    // Liquidity
    if (liquidityAnalysis.totalLiquidityUsd < 10000) score -= 20;
    else if (liquidityAnalysis.totalLiquidityUsd < 50000) score -= 10;
    
    if (liquidityAnalysis.lpLockedPercentage < 50) score -= 15;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private getRatingFromScore(score: number): TokenSafetyReport['overallRating'] {
    if (score >= 80) return 'SAFE';
    if (score >= 60) return 'CAUTION';
    if (score >= 40) return 'HIGH_RISK';
    return 'AVOID';
  }

  // Mock fetch methods - would integrate with actual APIs
  private async fetchTokenInfo(tokenMint: string): Promise<any> {
    return { 
      status: 'fulfilled', 
      value: { 
        mint: tokenMint, 
        symbol: 'TEST', 
        name: 'Test Token',
        create_timestamp: Date.now() / 1000 - 3600,
        liquidity: 50000,
      } 
    };
  }

  private async fetchSecurityInfo(tokenMint: string): Promise<any> {
    return { 
      status: 'fulfilled', 
      value: { 
        is_mint_authority_revoked: true,
        is_freeze_authority_revoked: true,
        is_mutable: false,
        is_proxy: false,
      } 
    };
  }

  private async fetchHolderInfo(tokenMint: string): Promise<any> {
    return { 
      status: 'fulfilled', 
      value: { 
        holders: [
          { address: 'dev_wallet', percentage: 15, is_dev: true, balance: 1000000 },
          { address: 'holder1', percentage: 5, balance: 300000 },
          { address: 'holder2', percentage: 3, balance: 200000 },
        ] 
      } 
    };
  }

  private async fetchRecentTrades(tokenMint: string): Promise<any> {
    return { 
      status: 'fulfilled', 
      value: [] 
    };
  }

  private async fetchLPInfo(tokenMint: string): Promise<any> {
    return { 
      status: 'fulfilled', 
      value: { 
        liquidity_usd: 50000,
        lp_locked_percentage: 0,
        lp_lock_expiry: null,
      } 
    };
  }

  /**
   * Quick check for bundle launch (lightweight)
   */
  async quickBundleCheck(tokenMint: string): Promise<{ isBundled: boolean; confidence: number; bundleSize: number }> {
    const report = await this.analyzeToken(tokenMint);
    return {
      isBundled: report.bundleAnalysis.isBundled,
      confidence: report.bundleAnalysis.confidence,
      bundleSize: report.bundleAnalysis.bundleSize,
    };
  }

  /**
   * Get risk summary for UI
   */
  getRiskSummary(report: TokenSafetyReport): { label: string; value: string; color: string; severity: string }[] {
    const factors = report.bundleAnalysis.riskFactors;
    const summary = factors.map(f => ({
      label: f.type.replace(/_/g, ' '),
      value: f.description,
      color: f.severity === 'CRITICAL' ? 'text-destructive' : 
             f.severity === 'HIGH' ? 'text-bear' : 
             f.severity === 'MEDIUM' ? 'text-gold' : 'text-bull',
      severity: f.severity,
    }));

    return summary;
  }
}

// Singleton
let bundleCheckerInstance: BundleInsiderChecker | null = null;

export function getBundleChecker(rpcEndpoint?: string): BundleInsiderChecker {
  if (!bundleCheckerInstance) {
    bundleCheckerInstance = new BundleInsiderChecker(rpcEndpoint);
  }
  return bundleCheckerInstance;
}

// React hook
export function useBundleChecker() {
  const checker = getBundleChecker();
  const [report, setReport] = React.useState<TokenSafetyReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const analyze = React.useCallback(async (tokenMint: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await checker.analyzeToken(tokenMint);
      setReport(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [checker]);

  const quickCheck = React.useCallback(async (tokenMint: string) => {
    try {
      return await checker.quickBundleCheck(tokenMint);
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [checker]);

  return { report, loading, error, analyze, quickCheck };
}

import React from 'react';

export type { 
  BundleAnalysis, BundleWallet, InsiderWallet, DevWalletAnalysis, DevWalletTx,
  LPLockStatus, SniperActivity, SniperWallet, RiskFactor,
  TokenSafetyReport, SecurityScore, HolderAnalysis, ContractAnalysis, LiquidityAnalysis
};