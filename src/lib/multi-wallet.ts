/**
 * Multi-Wallet Portfolio View
 * Aggregate across connected wallets + watch-only addresses
 */

export interface WalletConnection {
  id: string;
  label: string;
  address: string;
  type: 'connected' | 'watch-only' | 'hardware' | 'imported';
  provider?: 'phantom' | 'solflare' | 'backpack' | 'ledger' | 'trezor';
  chain: 'solana' | 'ethereum' | 'base' | 'arbitrum' | 'polygon';
  isActive: boolean;
  lastSynced: number;
  balanceUsd: number;
  tokens: WalletTokenBalance[];
  nfts?: WalletNftBalance[];
  defiPositions?: WalletDefiPosition[];
}

export interface WalletTokenBalance {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  isVerified: boolean;
  logoUrl?: string;
}

export interface WalletNftBalance {
  mint: string;
  collection: string;
  name: string;
  imageUrl: string;
  floorPriceUsd: number;
  estimatedValueUsd: number;
}

export interface WalletDefiPosition {
  protocol: string;
  type: 'lending' | 'borrowing' | 'staking' | 'lp' | 'vault';
  tokenSymbol: string;
  amount: number;
  valueUsd: number;
  apy: number;
  healthFactor?: number;
}

export interface AggregatedPortfolio {
  totalValueUsd: number;
  totalValueByChain: Record<string, number>;
  totalValueByWallet: Record<string, number>;
  tokenBalances: AggregatedTokenBalance[];
  nftBalances: AggregatedNftBalance[];
  defiPositions: AggregatedDefiPosition[];
  walletDetails: WalletConnection[];
  lastUpdated: number;
  syncStatus: 'synced' | 'syncing' | 'error' | 'partial';
}

export interface AggregatedTokenBalance {
  mint: string;
  symbol: string;
  name: string;
  totalAmount: number;
  totalValueUsd: number;
  priceUsd: number;
  byWallet: { walletId: string; walletLabel: string; amount: number; valueUsd: number }[];
  byChain: { chain: string; amount: number; valueUsd: number }[];
  allocationPct: number;
  priceChange24h: number;
}

export interface AggregatedNftBalance {
  collection: string;
  totalCount: number;
  totalValueUsd: number;
  floorPriceUsd: number;
  byWallet: { walletId: string; walletLabel: string; count: number; valueUsd: number }[];
}

export interface AggregatedDefiPosition {
  protocol: string;
  type: string;
  tokenSymbol: string;
  totalAmount: number;
  totalValueUsd: number;
  weightedApy: number;
  byWallet: { walletId: string; walletLabel: string; amount: number; valueUsd: number; apy: number }[];
}

export interface WalletGroup {
  id: string;
  name: string;
  description: string;
  walletIds: string[];
  color: string;
  isDefault: boolean;
}

class MultiWalletManager {
  private wallets: Map<string, WalletConnection> = new Map();
  private groups: Map<string, WalletGroup> = new Map();
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 30000;
  private syncListeners: Set<(portfolio: AggregatedPortfolio) => void> = new Set();
  private isSyncing = false;

  /**
   * Add a wallet connection
   */
  addWallet(wallet: WalletConnection): void {
    this.wallets.set(wallet.id, wallet);
    this.notifyUpdate();
  }

  /**
   * Remove a wallet
   */
  removeWallet(walletId: string): void {
    this.wallets.delete(walletId);
    // Remove from groups
    for (const group of this.groups.values()) {
      group.walletIds = group.walletIds.filter(id => id !== walletId);
    }
    this.notifyUpdate();
  }

  /**
   * Update wallet data (called after sync)
   */
  updateWallet(walletId: string, updates: Partial<WalletConnection>): void {
    const wallet = this.wallets.get(walletId);
    if (wallet) {
      this.wallets.set(walletId, { ...wallet, ...updates });
      this.notifyUpdate();
    }
  }

  /**
   * Get wallet by ID
   */
  getWallet(walletId: string): WalletConnection | undefined {
    return this.wallets.get(walletId);
  }

  /**
   * Get all wallets
   */
  getAllWallets(): WalletConnection[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Get active wallets
   */
  getActiveWallets(): WalletConnection[] {
    return Array.from(this.wallets.values()).filter(w => w.isActive);
  }

  /**
   * Create wallet group
   */
  createGroup(group: WalletGroup): void {
    this.groups.set(group.id, group);
  }

  /**
   * Get all groups
   */
  getGroups(): WalletGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get aggregated portfolio
   */
  async getAggregatedPortfolio(): Promise<AggregatedPortfolio> {
    const activeWallets = this.getActiveWallets();
    
    if (activeWallets.length === 0) {
      return this.emptyPortfolio();
    }

    // Fetch prices for all tokens
    await this.fetchPrices(activeWallets);

    // Aggregate tokens
    const tokenMap = new Map<string, AggregatedTokenBalance>();
    const nftMap = new Map<string, AggregatedNftBalance>();
    const defiMap = new Map<string, AggregatedDefiPosition>();
    let totalValueUsd = 0;
    const byChain: Record<string, number> = {};
    const byWallet: Record<string, number> = {};

    for (const wallet of activeWallets) {
      let walletValue = 0;

      // Aggregate tokens
      for (const token of wallet.tokens) {
        walletValue += token.valueUsd;
        
        if (!tokenMap.has(token.mint)) {
          tokenMap.set(token.mint, {
            mint: token.mint,
            symbol: token.symbol,
            name: token.name,
            totalAmount: 0,
            totalValueUsd: 0,
            priceUsd: token.priceUsd,
            byWallet: [],
            byChain: [],
            allocationPct: 0,
            priceChange24h: 0,
          });
        }
        
        const agg = tokenMap.get(token.mint)!;
        agg.totalAmount += token.amount;
        agg.totalValueUsd += token.valueUsd;
        agg.byWallet.push({
          walletId: wallet.id,
          walletLabel: wallet.label,
          amount: token.amount,
          valueUsd: token.valueUsd,
        });
        
        const chainEntry = agg.byChain.find(c => c.chain === wallet.chain);
        if (chainEntry) {
          chainEntry.amount += token.amount;
          chainEntry.valueUsd += token.valueUsd;
        } else {
          agg.byChain.push({ chain: wallet.chain, amount: token.amount, valueUsd: token.valueUsd });
        }
      }

      // Aggregate NFTs
      if (wallet.nfts) {
        for (const nft of wallet.nfts) {
          walletValue += nft.estimatedValueUsd;
          
          if (!nftMap.has(nft.collection)) {
            nftMap.set(nft.collection, {
              collection: nft.collection,
              totalCount: 0,
              totalValueUsd: 0,
              floorPriceUsd: nft.floorPriceUsd,
              byWallet: [],
            });
          }
          
          const agg = nftMap.get(nft.collection)!;
          agg.totalCount += 1;
          agg.totalValueUsd += nft.estimatedValueUsd;
          agg.byWallet.push({
            walletId: wallet.id,
            walletLabel: wallet.label,
            count: 1,
            valueUsd: nft.estimatedValueUsd,
          });
        }
      }

      // Aggregate DeFi positions
      if (wallet.defiPositions) {
        for (const pos of wallet.defiPositions) {
          walletValue += pos.valueUsd;
          
          const key = `${pos.protocol}-${pos.type}-${pos.tokenSymbol}`;
          
          if (!defiMap.has(key)) {
            defiMap.set(key, {
              protocol: pos.protocol,
              type: pos.type,
              tokenSymbol: pos.tokenSymbol,
              totalAmount: 0,
              totalValueUsd: 0,
              weightedApy: 0,
              byWallet: [],
            });
          }
          
          const agg = defiMap.get(key)!;
          agg.totalAmount += pos.amount;
          agg.totalValueUsd += pos.valueUsd;
          agg.byWallet.push({
            walletId: wallet.id,
            walletLabel: wallet.label,
            amount: pos.amount,
            valueUsd: pos.valueUsd,
            apy: pos.apy,
          });
          
          // Recalculate weighted APY
          const totalVal = agg.byWallet.reduce((sum, w) => sum + w.valueUsd, 0);
          agg.weightedApy = agg.byWallet.reduce((sum, w) => sum + w.apy * (w.valueUsd / totalVal), 0);
        }
      }

      totalValueUsd += walletValue;
      byWallet[wallet.id] = walletValue;
      byChain[wallet.chain] = (byChain[wallet.chain] || 0) + walletValue;
    }

    // Calculate allocations
    for (const token of tokenMap.values()) {
      token.allocationPct = totalValueUsd > 0 ? (token.totalValueUsd / totalValueUsd) * 100 : 0;
    }

    // Sort tokens by value
    const sortedTokens = Array.from(tokenMap.values()).sort((a, b) => b.totalValueUsd - a.totalValueUsd);

    return {
      totalValueUsd,
      totalValueByChain: byChain,
      totalValueByWallet: byWallet,
      tokenBalances: sortedTokens,
      nftBalances: Array.from(nftMap.values()).sort((a, b) => b.totalValueUsd - a.totalValueUsd),
      defiPositions: Array.from(defiMap.values()).sort((a, b) => b.totalValueUsd - a.totalValueUsd),
      walletDetails: activeWallets,
      lastUpdated: Date.now(),
      syncStatus: 'synced',
    };
  }

  /**
   * Subscribe to portfolio updates
   */
  subscribe(callback: (portfolio: AggregatedPortfolio) => void): () => void {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Sync all wallets
   */
  async syncAll(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const activeWallets = this.getActiveWallets();
    
    for (const wallet of activeWallets) {
      try {
        await this.syncWallet(wallet);
      } catch (error) {
        console.error(`Failed to sync wallet ${wallet.label}:`, error);
        this.updateWallet(wallet.id, { 
          lastSynced: Date.now(),
          balanceUsd: 0,
          tokens: [],
        });
      }
    }

    this.isSyncing = false;
    this.notifyUpdate();
  }

  /**
   * Sync a single wallet
   */
  private async syncWallet(wallet: WalletConnection): Promise<void> {
    // In production, this would:
    // 1. Fetch SOL balance via RPC
    // 2. Fetch SPL token accounts
    // 3. Fetch NFTs via Helius/Metaplex
    // 4. Fetch DeFi positions via protocol APIs
    // 5. Update wallet in store
    
    // Mock implementation
    const mockTokens: WalletTokenBalance[] = [
      { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', amount: 10, decimals: 9, priceUsd: 72.97, valueUsd: 729.70, isVerified: true },
      { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', amount: 1000, decimals: 6, priceUsd: 0.142, valueUsd: 142, isVerified: true },
    ];

    this.updateWallet(wallet.id, {
      lastSynced: Date.now(),
      balanceUsd: mockTokens.reduce((sum, t) => sum + t.valueUsd, 0),
      tokens: mockTokens,
    });
  }

  /**
   * Fetch prices for all tokens in wallets
   */
  private async fetchPrices(wallets: WalletConnection[]): Promise<void> {
    const mints = new Set<string>();
    
    for (const wallet of wallets) {
      for (const token of wallet.tokens) {
        mints.add(token.mint);
      }
    }

    const now = Date.now();
    const staleMints = Array.from(mints).filter(mint => {
      const cached = this.priceCache.get(mint);
      return !cached || now - cached.timestamp > this.PRICE_CACHE_TTL;
    });

    if (staleMints.length > 0) {
      // In production, batch fetch from price API
      for (const mint of staleMints) {
        this.priceCache.set(mint, { price: this.getMockPrice(mint), timestamp: now });
      }
    }
  }

  private getMockPrice(mint: string): number {
    const prices: Record<string, number> = {
      'So11111111111111111111111111111111111111112': 72.97,
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 0.142,
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK': 0.842,
      '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 0.000024,
    };
    return prices[mint] || 1;
  }

  private notifyUpdate(): void {
    this.getAggregatedPortfolio().then(portfolio => {
      for (const listener of this.syncListeners) {
        try {
          listener(portfolio);
        } catch (error) {
          console.error('Portfolio listener error:', error);
        }
      }
    });
  }

  private emptyPortfolio(): AggregatedPortfolio {
    return {
      totalValueUsd: 0,
      totalValueByChain: {},
      totalValueByWallet: {},
      tokenBalances: [],
      nftBalances: [],
      defiPositions: [],
      walletDetails: [],
      lastUpdated: Date.now(),
      syncStatus: 'synced',
    };
  }
}

// Singleton
let multiWalletManagerInstance: MultiWalletManager | null = null;

export function getMultiWalletManager(): MultiWalletManager {
  if (!multiWalletManagerInstance) {
    multiWalletManagerInstance = new MultiWalletManager();
  }
  return multiWalletManagerInstance;
}

// React hook
export function useMultiWallet() {
  const manager = getMultiWalletManager();
  
  return {
    addWallet: (wallet: WalletConnection) => manager.addWallet(wallet),
    removeWallet: (id: string) => manager.removeWallet(id),
    updateWallet: (id: string, updates: Partial<WalletConnection>) => manager.updateWallet(id, updates),
    getWallet: (id: string) => manager.getWallet(id),
    getAllWallets: () => manager.getAllWallets(),
    getActiveWallets: () => manager.getActiveWallets(),
    createGroup: (group: WalletGroup) => manager.createGroup(group),
    getGroups: () => manager.getGroups(),
    getAggregatedPortfolio: () => manager.getAggregatedPortfolio(),
    subscribe: (callback: (portfolio: AggregatedPortfolio) => void) => manager.subscribe(callback),
    syncAll: () => manager.syncAll(),
  };
}

export type { WalletConnection, WalletTokenBalance, WalletNftBalance, WalletDefiPosition, AggregatedPortfolio, AggregatedTokenBalance, AggregatedNftBalance, AggregatedDefiPosition, WalletGroup };