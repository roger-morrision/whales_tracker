/**
 * Social Copy Trading
 * Trader verification, copy trade marketplace, and social features
 */

import { getPortfolioAnalytics } from './portfolio-analytics';
import { getOrderManager } from './advanced-orders';

export interface VerifiedTrader {
  address: string;
  label: string;
  avatar?: string;
  verifiedAt: number;
  verificationMethod: 'signed_message' | 'kyc' | 'api_key';
  stats: TraderStats;
  socialLinks: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    website?: string;
  };
  isPublic: boolean;
  followers: number;
  following: number;
  tags: string[];
}

export interface TraderStats {
  totalPnLUsd: number;
  totalPnLPct: number;
  winRate: number;
  avgWinUsd: number;
  avgLossUsd: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  totalTrades: number;
  avgTradeSizeUsd: number;
  bestTradePct: number;
  worstTradePct: number;
  profitFactor: number;
  riskScore: number; // 0-100
  consistencyScore: number; // 0-100
  lastUpdated: number;
}

export interface CopyTradeConfig {
  id: string;
  traderAddress: string;
  traderLabel: string;
  copierAddress: string;
  enabled: boolean;
  createdAt: number;
  settings: CopyTradeSettings;
  performance: CopyTradePerformance;
}

export interface CopyTradeSettings {
  maxPerTradeUsd: number;
  dailyLimitUsd: number;
  totalAllocatedUsd: number;
  slippageBps: number;
  onlyBuy: boolean;
  onlySell: boolean;
  minTraderScore: number;
  maxConcurrentTrades: number;
  autoStopLossPct: number;
  autoTakeProfitPct: number;
  followTokenBlacklist: string[];
  followTokenWhitelist: string[];
  proportionalSizing: boolean; // Scale trade size proportionally
  fixedSizeUsd?: number; // Fixed size if not proportional
}

export interface CopyTradePerformance {
  totalCopiedTrades: number;
  successfulCopies: number;
  failedCopies: number;
  totalPnLUsd: number;
  totalPnLPct: number;
  totalFeesUsd: number;
  avgSlippageBps: number;
  maxDrawdownPct: number;
  bestCopyPct: number;
  worstCopyPct: number;
  lastCopyAt: number;
}

export interface SocialPost {
  id: string;
  authorAddress: string;
  authorLabel: string;
  authorAvatar?: string;
  content: string;
  tokenMint?: string;
  tokenSymbol?: string;
  type: 'analysis' | 'trade' | 'alert' | 'general';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  likes: number;
  comments: number;
  shares: number;
  createdAt: number;
  tags: string[];
}

export interface Comment {
  id: string;
  postId: string;
  authorAddress: string;
  authorLabel: string;
  content: string;
  likes: number;
  createdAt: number;
}

export interface Watchlist {
  id: string;
  ownerAddress: string;
  name: string;
  description: string;
  tokens: WatchlistToken[];
  isPublic: boolean;
  followers: number;
  createdAt: number;
  updatedAt: number;
}

export interface WatchlistToken {
  tokenMint: string;
  symbol: string;
  addedAt: number;
  note?: string;
  targetPrice?: number;
  stopLossPrice?: number;
}

export interface TraderRanking {
  trader: VerifiedTrader;
  rank: number;
  category: 'overall' | 'roi' | 'consistency' | 'volume' | 'risk_adjusted';
  period: '7d' | '30d' | '90d' | 'all';
}

class SocialCopyTrading {
  private verifiedTraders = new Map<string, VerifiedTrader>();
  private copyTrades = new Map<string, CopyTradeConfig>();
  private posts: SocialPost[] = [];
  private comments = new Map<string, Comment[]>();
  private watchlists = new Map<string, Watchlist>();
  private followers = new Map<string, Set<string>>(); // trader -> followers
  private following = new Map<string, Set<string>>(); // user -> following

  // Verification
  async verifyTrader(
    address: string,
    signature: string,
    message: string,
    method: 'signed_message' | 'kyc' | 'api_key' = 'signed_message'
  ): Promise<{ success: boolean; trader?: VerifiedTrader; error?: string }> {
    // In production, verify the signature matches the address
    // For now, we'll simulate
    const trader = this.verifiedTraders.get(address);
    
    if (trader) {
      return { success: false, error: 'Trader already verified' };
    }

    // Calculate stats from portfolio
    const analytics = getPortfolioAnalytics();
    const portfolio = analytics.getAllHoldings();
    const trades = []; // Would fetch from trade history

    const stats = this.calculateStats(portfolio, trades);

    const newTrader: VerifiedTrader = {
      address,
      label: `Trader ${address.slice(0, 6)}`,
      verifiedAt: Date.now(),
      verificationMethod: method,
      stats,
      socialLinks: {},
      isPublic: true,
      followers: 0,
      following: 0,
      tags: [],
    };

    this.verifiedTraders.set(address, newTrader);
    this.followers.set(address, new Set());
    this.following.set(address, new Set());

    return { success: true, trader: newTrader };
  }

  private calculateStats(portfolio: any[], trades: any[]): TraderStats {
    // Simplified stats calculation
    const totalPnLUsd = portfolio.reduce((sum, h) => sum + h.unrealizedPnlUsd, 0);
    const totalValue = portfolio.reduce((sum, h) => sum + h.currentValueUsd, 0);
    const totalPnLPct = totalValue > 0 ? (totalPnLUsd / (totalValue - totalPnLUsd)) * 100 : 0;

    return {
      totalPnLUsd,
      totalPnLPct,
      winRate: 65, // Placeholder
      avgWinUsd: 500,
      avgLossUsd: -300,
      maxDrawdownPct: 15,
      sharpeRatio: 1.8,
      totalTrades: trades.length,
      avgTradeSizeUsd: 1000,
      bestTradePct: 150,
      worstTradePct: -40,
      profitFactor: 2.1,
      riskScore: 35,
      consistencyScore: 78,
      lastUpdated: Date.now(),
    };
  }

  getVerifiedTrader(address: string): VerifiedTrader | undefined {
    return this.verifiedTraders.get(address);
  }

  getAllVerifiedTraders(): VerifiedTrader[] {
    return Array.from(this.verifiedTraders.values()).filter(t => t.isPublic);
  }

  // Copy Trading
  createCopyTrade(config: Omit<CopyTradeConfig, 'id' | 'createdAt' | 'performance'>): CopyTradeConfig {
    const copyTrade: CopyTradeConfig = {
      ...config,
      id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      performance: {
        totalCopiedTrades: 0,
        successfulCopies: 0,
        failedCopies: 0,
        totalPnLUsd: 0,
        totalPnLPct: 0,
        totalFeesUsd: 0,
        avgSlippageBps: 0,
        maxDrawdownPct: 0,
        bestCopyPct: 0,
        worstCopyPct: 0,
        lastCopyAt: 0,
      },
    };

    this.copyTrades.set(copyTrade.id, copyTrade);
    return copyTrade;
  }

  getCopyTrade(id: string): CopyTradeConfig | undefined {
    return this.copyTrades.get(id);
  }

  getCopyTradesForCopier(copierAddress: string): CopyTradeConfig[] {
    return Array.from(this.copyTrades.values()).filter(c => c.copierAddress === copierAddress);
  }

  getCopyTradesForTrader(traderAddress: string): CopyTradeConfig[] {
    return Array.from(this.copyTrades.values()).filter(c => c.traderAddress === traderAddress);
  }

  updateCopyTrade(id: string, updates: Partial<CopyTradeConfig>): boolean {
    const ct = this.copyTrades.get(id);
    if (!ct) return false;

    this.copyTrades.set(id, { ...ct, ...updates });
    return true;
  }

  deleteCopyTrade(id: string): boolean {
    return this.copyTrades.delete(id);
  }

  async executeCopyTrade(
    copyTradeId: string,
    traderTrade: { side: 'buy' | 'sell'; tokenMint: string; amountUsd: number; priceUsd: number }
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    const copyTrade = this.copyTrades.get(copyTradeId);
    if (!copyTrade || !copyTrade.enabled) {
      return { success: false, error: 'Copy trade not found or disabled' };
    }

    // Check limits
    if (copyTrade.performance.totalPnLUsd <= -copyTrade.settings.dailyLimitUsd) {
      return { success: false, error: 'Daily loss limit reached' };
    }

    if (copyTrade.settings.totalAllocatedUsd <= 0) {
      return { success: false, error: 'No allocation remaining' };
    }

    // Calculate copy size
    let copySizeUsd = traderTrade.amountUsd;
    if (copyTrade.settings.proportionalSizing) {
      // Scale by allocation ratio
      const ratio = copyTrade.settings.totalAllocatedUsd / 100000; // Assuming trader has 100k
      copySizeUsd = Math.min(traderTrade.amountUsd * ratio, copyTrade.settings.maxPerTradeUsd);
    } else if (copyTrade.settings.fixedSizeUsd) {
      copySizeUsd = copyTrade.settings.fixedSizeUsd;
    }

    copySizeUsd = Math.min(copySizeUsd, copyTrade.settings.maxPerTradeUsd);

    // Check token filters
    if (copyTrade.settings.followTokenWhitelist.length > 0 &&
        !copyTrade.settings.followTokenWhitelist.includes(traderTrade.tokenMint)) {
      return { success: false, error: 'Token not in whitelist' };
    }

    if (copyTrade.settings.followTokenBlacklist.includes(traderTrade.tokenMint)) {
      return { success: false, error: 'Token blacklisted' };
    }

    // Execute via order manager
    const orders = getOrderManager();
    // Would create and execute order here
    // For now, simulate
    const success = true;

    // Update performance
    copyTrade.performance.totalCopiedTrades++;
    if (success) {
      copyTrade.performance.successfulCopies++;
      copyTrade.performance.lastCopyAt = Date.now();
    } else {
      copyTrade.performance.failedCopies++;
    }

    return { success };
  }

  // Social Features
  createPost(post: Omit<SocialPost, 'id' | 'likes' | 'comments' | 'shares' | 'createdAt'>): SocialPost {
    const newPost: SocialPost = {
      ...post,
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: Date.now(),
    };
    this.posts.unshift(newPost);
    return newPost;
  }

  getPosts(limit = 20, offset = 0): SocialPost[] {
    return this.posts.slice(offset, offset + limit);
  }

  likePost(postId: string, userAddress: string): boolean {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return false;
    post.likes++;
    return true;
  }

  addComment(comment: Omit<Comment, 'id' | 'likes' | 'createdAt'>): Comment {
    const newComment: Comment = {
      ...comment,
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      likes: 0,
      createdAt: Date.now(),
    };
    const comments = this.comments.get(comment.postId) || [];
    comments.push(newComment);
    this.comments.set(comment.postId, comments);
    return newComment;
  }

  getComments(postId: string): Comment[] {
    return this.comments.get(postId) || [];
  }

  // Follow/Unfollow
  followTrader(userAddress: string, traderAddress: string): boolean {
    const trader = this.verifiedTraders.get(traderAddress);
    if (!trader) return false;

    let userFollowing = this.following.get(userAddress);
    if (!userFollowing) {
      userFollowing = new Set();
      this.following.set(userAddress, userFollowing);
    }

    if (userFollowing.has(traderAddress)) return false;

    userFollowing.add(traderAddress);

    let traderFollowers = this.followers.get(traderAddress);
    if (!traderFollowers) {
      traderFollowers = new Set();
      this.followers.set(traderAddress, traderFollowers);
    }
    traderFollowers.add(userAddress);
    trader.followers++;

    return true;
  }

  unfollowTrader(userAddress: string, traderAddress: string): boolean {
    const userFollowing = this.following.get(userAddress);
    if (!userFollowing?.has(traderAddress)) return false;

    userFollowing.delete(traderAddress);

    const traderFollowers = this.followers.get(traderAddress);
    if (traderFollowers) {
      traderFollowers.delete(userAddress);
      const trader = this.verifiedTraders.get(traderAddress);
      if (trader) trader.followers = Math.max(0, trader.followers - 1);
    }

    return true;
  }

  isFollowing(userAddress: string, traderAddress: string): boolean {
    return this.following.get(userAddress)?.has(traderAddress) || false;
  }

  getFollowers(traderAddress: string): string[] {
    return Array.from(this.followers.get(traderAddress) || []);
  }

  getFollowing(userAddress: string): string[] {
    return Array.from(this.following.get(userAddress) || []);
  }

  // Rankings
  getTraderRankings(
    category: 'overall' | 'roi' | 'consistency' | 'volume' | 'risk_adjusted' = 'overall',
    period: '7d' | '30d' | '90d' | 'all' = '30d',
    limit = 20
  ): TraderRanking[] {
    const traders = this.getAllVerifiedTraders();
    
    let sorted: VerifiedTrader[];
    switch (category) {
      case 'roi':
        sorted = [...traders].sort((a, b) => b.stats.totalPnLPct - a.stats.totalPnLPct);
        break;
      case 'consistency':
        sorted = [...traders].sort((a, b) => b.stats.consistencyScore - a.stats.consistencyScore);
        break;
      case 'volume':
        sorted = [...traders].sort((a, b) => b.stats.totalTrades - a.stats.totalTrades);
        break;
      case 'risk_adjusted':
        sorted = [...traders].sort((a, b) => b.stats.sharpeRatio - a.stats.sharpeRatio);
        break;
      default:
        // Overall: weighted score
        sorted = [...traders].sort((a, b) => {
          const scoreA = a.stats.totalPnLPct * 0.4 + a.stats.consistencyScore * 0.3 + a.stats.sharpeRatio * 20 * 0.3;
          const scoreB = b.stats.totalPnLPct * 0.4 + b.stats.consistencyScore * 0.3 + b.stats.sharpeRatio * 20 * 0.3;
          return scoreB - scoreA;
        });
    }

    return sorted.slice(0, limit).map((trader, i) => ({
      trader,
      rank: i + 1,
      category,
      period,
    }));
  }

  // Watchlists
  createWatchlist(watchlist: Omit<Watchlist, 'id' | 'createdAt' | 'updatedAt' | 'followers'>): Watchlist {
    const newWatchlist: Watchlist = {
      ...watchlist,
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      followers: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.watchlists.set(newWatchlist.id, newWatchlist);
    return newWatchlist;
  }

  getWatchlist(id: string): Watchlist | undefined {
    return this.watchlists.get(id);
  }

  getPublicWatchlists(): Watchlist[] {
    return Array.from(this.watchlists.values()).filter(w => w.isPublic);
  }

  updateWatchlist(id: string, updates: Partial<Watchlist>): boolean {
    const wl = this.watchlists.get(id);
    if (!wl) return false;
    this.watchlists.set(id, { ...wl, ...updates, updatedAt: Date.now() });
    return true;
  }

  // Search
  searchTraders(query: string): VerifiedTrader[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllVerifiedTraders().filter(t =>
      t.address.toLowerCase().includes(lowerQuery) ||
      t.label.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  searchPosts(query: string): SocialPost[] {
    const lowerQuery = query.toLowerCase();
    return this.posts.filter(p =>
      p.content.toLowerCase().includes(lowerQuery) ||
      p.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      p.tokenSymbol?.toLowerCase().includes(lowerQuery)
    );
  }
}

// Singleton
let socialCopyTradingInstance: SocialCopyTrading | null = null;

export function getSocialCopyTrading(): SocialCopyTrading {
  if (!socialCopyTradingInstance) {
    socialCopyTradingInstance = new SocialCopyTrading();
  }
  return socialCopyTradingInstance;
}

// React hook
export function useSocialCopyTrading() {
  const social = getSocialCopyTrading();
  const [traders, setTraders] = React.useState<VerifiedTrader[]>([]);
  const [rankings, setRankings] = React.useState<TraderRanking[]>([]);
  const [posts, setPosts] = React.useState<SocialPost[]>([]);
  const [copyTrades, setCopyTrades] = React.useState<CopyTradeConfig[]>([]);

  React.useEffect(() => {
    // Defer state initialization to avoid synchronous setState in effect
    const initializeState = async () => {
      setTraders(social.getAllVerifiedTraders());
      setRankings(social.getTraderRankings());
      setPosts(social.getPosts());
    };
    
    setTimeout(initializeState, 0);
  }, [social]);

  return {
    // Traders
    getVerifiedTrader: (address: string) => social.getVerifiedTrader(address),
    getAllTraders: () => social.getAllVerifiedTraders(),
    searchTraders: (query: string) => social.searchTraders(query),
    verifyTrader: (address: string, signature: string, message: string, method?: 'signed_message' | 'kyc' | 'api_key') =>
      social.verifyTrader(address, signature, message, method),
    getRankings: (category?: 'overall' | 'roi' | 'consistency' | 'volume' | 'risk_adjusted', period?: '7d' | '30d' | '90d' | 'all', limit?: number) =>
      social.getTraderRankings(category, period, limit),

    // Copy Trading
    createCopyTrade: (config: Omit<CopyTradeConfig, 'id' | 'createdAt' | 'performance'>) => social.createCopyTrade(config),
    getCopyTrade: (id: string) => social.getCopyTrade(id),
    getCopyTradesForCopier: (copierAddress: string) => social.getCopyTradesForCopier(copierAddress),
    getCopyTradesForTrader: (traderAddress: string) => social.getCopyTradesForTrader(traderAddress),
    updateCopyTrade: (id: string, updates: Partial<CopyTradeConfig>) => social.updateCopyTrade(id, updates),
    deleteCopyTrade: (id: string) => social.deleteCopyTrade(id),
    executeCopyTrade: (copyTradeId: string, traderTrade: { side: 'buy' | 'sell'; tokenMint: string; amountUsd: number; priceUsd: number }) =>
      social.executeCopyTrade(copyTradeId, traderTrade),

    // Social
    createPost: (post: Omit<SocialPost, 'id' | 'likes' | 'comments' | 'shares' | 'createdAt'>) => social.createPost(post),
    getPosts: (limit?: number, offset?: number) => social.getPosts(limit, offset),
    likePost: (postId: string, userAddress: string) => social.likePost(postId, userAddress),
    addComment: (comment: Omit<Comment, 'id' | 'likes' | 'createdAt'>) => social.addComment(comment),
    getComments: (postId: string) => social.getComments(postId),
    searchPosts: (query: string) => social.searchPosts(query),

    // Follow
    followTrader: (userAddress: string, traderAddress: string) => social.followTrader(userAddress, traderAddress),
    unfollowTrader: (userAddress: string, traderAddress: string) => social.unfollowTrader(userAddress, traderAddress),
    isFollowing: (userAddress: string, traderAddress: string) => social.isFollowing(userAddress, traderAddress),
    getFollowers: (traderAddress: string) => social.getFollowers(traderAddress),
    getFollowing: (userAddress: string) => social.getFollowing(userAddress),

    // Watchlists
    createWatchlist: (wl: Omit<Watchlist, 'id' | 'createdAt' | 'updatedAt' | 'followers'>) => social.createWatchlist(wl),
    getWatchlist: (id: string) => social.getWatchlist(id),
    getPublicWatchlists: () => social.getPublicWatchlists(),
    updateWatchlist: (id: string, updates: Partial<Watchlist>) => social.updateWatchlist(id, updates),
  };
}

import React from 'react';

export type {
  VerifiedTrader,
  TraderStats,
  CopyTradeConfig,
  CopyTradeSettings,
  CopyTradePerformance,
  SocialPost,
  Comment,
  Watchlist,
  WatchlistToken,
  TraderRanking,
};