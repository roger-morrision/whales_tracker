/**
 * Strategy Marketplace
 * Publish/subscribe snipe rules, DCA strategies, alerts
 */

export interface MarketplaceItem {
  id: string;
  type: 'snipe_rule' | 'dca_strategy' | 'alert_template' | 'workflow' | 'indicator' | 'portfolio_template';
  title: string;
  description: string;
  author: MarketplaceAuthor;
  version: string;
  price: number; // 0 for free, in USD cents
  currency: 'USD' | 'SOL' | 'USDC';
  revenueShare: number; // Percentage to platform (0-100)
  tags: string[];
  category: string;
  thumbnail?: string;
  screenshots: string[];
  downloads: number;
  rating: number;
  reviewCount: number;
  requirements: {
    minTier: 'free' | 'pro' | 'enterprise';
    permissions: string[];
    dependencies: string[];
  };
  content: MarketplaceItemContent;
  metadata: {
    createdAt: number;
    updatedAt: number;
    publishedAt?: number;
    status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'deprecated';
    moderationNotes?: string;
  };
}

export interface MarketplaceAuthor {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  verified: boolean;
  stats: {
    itemsPublished: number;
    totalDownloads: number;
    totalRevenue: number;
    averageRating: number;
  };
  socialLinks?: {
    twitter?: string;
    github?: string;
    website?: string;
  };
}

export interface MarketplaceItemContent {
  // For snipe rules
  snipeRule?: {
    conditions: any[];
    actions: any[];
    riskLimits: any;
  };
  // For DCA strategies
  dcaStrategy?: {
    token: string;
    amountPerInterval: number;
    interval: string;
    maxOrders: number;
    conditions?: any[];
  };
  // For alert templates
  alertTemplate?: {
    conditions: any[];
    channels: string[];
    template: string;
  };
  // For workflows
  workflow?: {
    nodes: any[];
    edges: any[];
    triggers: any[];
  };
  // For indicators
  indicator?: {
    code: string;
    inputs: any[];
    outputs: any[];
  };
  // For portfolio templates
  portfolioTemplate?: {
    allocations: { token: string; targetPct: number }[];
    rebalanceRules: any[];
  };
}

export interface MarketplaceReview {
  id: string;
  itemId: string;
  userId: string;
  username: string;
  rating: number; // 1-5
  title: string;
  content: string;
  verifiedPurchase: boolean;
  helpful: number;
  createdAt: number;
  updatedAt: number;
}

export interface MarketplacePurchase {
  id: string;
  itemId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  currency: string;
  platformFee: number;
  sellerEarnings: number;
  status: 'pending' | 'completed' | 'refunded' | 'disputed';
  transactionHash?: string;
  createdAt: number;
  completedAt?: number;
}

export interface MarketplaceSubscription {
  id: string;
  itemId: string;
  userId: string;
  tier: 'basic' | 'premium' | 'vip';
  price: number;
  interval: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

export interface MarketplaceStats {
  totalItems: number;
  totalUsers: number;
  totalRevenue: number;
  totalDownloads: number;
  topCategories: { category: string; count: number }[];
  topAuthors: { authorId: string; revenue: number }[];
  recentActivity: MarketplaceActivity[];
}

export interface MarketplaceActivity {
  type: 'purchase' | 'review' | 'publish' | 'update';
  itemId: string;
  itemTitle: string;
  userId: string;
  username: string;
  timestamp: number;
  metadata?: any;
}

class StrategyMarketplace {
  private items: Map<string, MarketplaceItem> = new Map();
  private reviews: Map<string, MarketplaceReview[]> = new Map();
  private purchases: Map<string, MarketplacePurchase[]> = new Map();
  private subscriptions: Map<string, MarketplaceSubscription[]> = new Map();
  private userLibrary: Map<string, Set<string>> = new Map(); // userId -> itemIds
  private subscribers: Set<(items: MarketplaceItem[]) => void> = new Set();
  private config: MarketplaceConfig;

  constructor(config?: Partial<MarketplaceConfig>) {
    this.config = {
      platformFeePercent: 15,
      minPrice: 0,
      maxPrice: 100000, // $1000
      reviewCooldownHours: 24,
      autoApproveThreshold: 50, // downloads before auto-approve updates
      featuredRotationHours: 24,
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    // Load seed items
    this.loadSeedItems();
  }

  private loadSeedItems(): void {
    const seedItems: Omit<MarketplaceItem, 'id' | 'metadata'>[] = [
      {
        type: 'snipe_rule',
        title: 'Smart Money Sniper Pro',
        description: 'Auto-snipe when GMGN detects smart money accumulation on new launches. Includes risk scoring, trailing stops, and position sizing.',
        author: {
          id: 'author_whale_hunter',
          username: 'whale_hunter',
          displayName: 'Whale Hunter',
          verified: true,
          stats: { itemsPublished: 12, totalDownloads: 5420, totalRevenue: 125000, averageRating: 4.8 },
        },
        version: '2.1.0',
        price: 2999, // $29.99
        currency: 'USD',
        revenueShare: 15,
        tags: ['snipe', 'smart-money', 'auto-trade', 'launch'],
        category: 'Trading Bots',
        screenshots: ['/marketplace/sniper-pro-1.png', '/marketplace/sniper-pro-2.png'],
        downloads: 2341,
        rating: 4.9,
        reviewCount: 156,
        requirements: {
          minTier: 'pro',
          permissions: ['trading', 'market', 'alerts'],
          dependencies: [],
        },
        content: {
          snipeRule: {
            conditions: [
              { type: 'smart_money', operator: '>', value: 10000, source: 'gmgn' },
              { type: 'security_score', operator: '>', value: 70, source: 'gmgn' },
              { type: 'liquidity', operator: '>', value: 10000, source: 'dexscreener' },
            ],
            actions: [
              { type: 'buy', params: { amountUsd: 200, slippageBps: 500 } },
              { type: 'trailing_stop', params: { trailPercent: 15 } },
            ],
            riskLimits: { maxPositionUsd: 500, maxDailyLossUsd: 200, maxSlippageBps: 500 },
          },
        },
        metadata: {
          createdAt: Date.now() - 30 * 86400000,
          updatedAt: Date.now() - 2 * 86400000,
          publishedAt: Date.now() - 25 * 86400000,
          status: 'published',
        },
      },
      {
        type: 'dca_strategy',
        title: 'SOL Accumulation DCA',
        description: 'Daily DCA into SOL with RSI oversold boost. Automatically doubles position size when RSI < 30.',
        author: {
          id: 'author_long_term',
          username: 'long_term_hodl',
          displayName: 'Long Term HODL',
          verified: true,
          stats: { itemsPublished: 8, totalDownloads: 8900, totalRevenue: 45000, averageRating: 4.7 },
        },
        version: '1.3.0',
        price: 0, // Free
        currency: 'USD',
        revenueShare: 15,
        tags: ['dca', 'sol', 'accumulation', 'long-term'],
        category: 'Investment Strategies',
        screenshots: ['/marketplace/dca-sol-1.png'],
        downloads: 4521,
        rating: 4.8,
        reviewCount: 203,
        requirements: {
          minTier: 'free',
          permissions: ['trading', 'portfolio'],
          dependencies: [],
        },
        content: {
          dcaStrategy: {
            token: 'SOL',
            amountPerInterval: 50,
            interval: 'daily',
            maxOrders: 60,
            conditions: [
              { type: 'technical', indicator: 'rsi', operator: '<', value: 30, action: 'double_amount' },
            ],
          },
        },
        metadata: {
          createdAt: Date.now() - 60 * 86400000,
          updatedAt: Date.now() - 5 * 86400000,
          publishedAt: Date.now() - 55 * 86400000,
          status: 'published',
        },
      },
      {
        type: 'alert_template',
        title: 'Whale Alert Suite',
        description: 'Complete alert package: smart money entry/exit, whale trades, security drops, liquidity changes, and launch notifications.',
        author: {
          id: 'author_alert_master',
          username: 'alert_master',
          displayName: 'Alert Master',
          verified: true,
          stats: { itemsPublished: 5, totalDownloads: 12300, totalRevenue: 0, averageRating: 4.9 },
        },
        version: '3.0.0',
        price: 0,
        currency: 'USD',
        revenueShare: 15,
        tags: ['alerts', 'whale', 'smart-money', 'security', 'notifications'],
        category: 'Alerts & Notifications',
        screenshots: ['/marketplace/whale-alerts-1.png', '/marketplace/whale-alerts-2.png'],
        downloads: 8921,
        rating: 4.9,
        reviewCount: 312,
        requirements: {
          minTier: 'free',
          permissions: ['alerts', 'market'],
          dependencies: [],
        },
        content: {
          alertTemplate: {
            conditions: [
              { type: 'smart_money', operator: '>', value: 50000, message: 'Smart money buying {{token}}' },
              { type: 'smart_money', operator: '<', value: -50000, message: 'Smart money selling {{token}}' },
              { type: 'security_score', operator: '<', value: 60, message: 'Security warning for {{token}}' },
              { type: 'liquidity', operator: '<', value: -30, message: 'Liquidity dropping for {{token}}' },
              { type: 'new_launch', operator: '==', value: true, message: 'New launch: {{token}}' },
            ],
            channels: ['telegram', 'push', 'email'],
            template: '🔔 {{message}} | Price: ${{price}} | 24h: {{change24h}}%',
          },
        },
        metadata: {
          createdAt: Date.now() - 90 * 86400000,
          updatedAt: Date.now() - 1 * 86400000,
          publishedAt: Date.now() - 85 * 86400000,
          status: 'published',
        },
      },
      {
        type: 'workflow',
        title: 'Copy Trade Whale Portfolio',
        description: 'Mirror top 10 GMGN whales with dynamic position sizing. Includes risk filters, trailing stops, and automatic rebalancing.',
        author: {
          id: 'author_copy_trader',
          username: 'copy_trader_pro',
          displayName: 'Copy Trader Pro',
          verified: true,
          stats: { itemsPublished: 3, totalDownloads: 2100, totalRevenue: 89000, averageRating: 4.6 },
        },
        version: '1.0.0',
        price: 4999, // $49.99
        currency: 'USD',
        revenueShare: 15,
        tags: ['copy-trade', 'whale', 'portfolio', 'auto-trade'],
        category: 'Trading Bots',
        screenshots: ['/marketplace/copy-whale-1.png'],
        downloads: 892,
        rating: 4.7,
        reviewCount: 67,
        requirements: {
          minTier: 'pro',
          permissions: ['trading', 'portfolio', 'market', 'alerts'],
          dependencies: [],
        },
        content: {
          workflow: {
            nodes: [
              { id: 'trigger', type: 'trigger', config: { subtype: 'smart_money', walletTier: 'whale', minWinRate: 60 } },
              { id: 'filter', type: 'condition', config: { subtype: 'risk_score', operator: '>', value: 65 } },
              { id: 'size', type: 'transform', config: { subtype: 'calculate_size', method: 'risk_parity', maxRiskUsd: 100 } },
              { id: 'buy', type: 'action', config: { subtype: 'copy_trade', copySells: true, delayMs: 5000 } },
              { id: 'trail', type: 'action', config: { subtype: 'trailing_stop', trailPercent: 20 } },
            ],
            edges: [
              { source: 'trigger', target: 'filter' },
              { source: 'filter', target: 'size' },
              { source: 'size', target: 'buy' },
              { source: 'buy', target: 'trail' },
            ],
            triggers: [{ type: 'smart_money', config: { walletTier: 'whale', minWinRate: 60 } }],
          },
        },
        metadata: {
          createdAt: Date.now() - 15 * 86400000,
          updatedAt: Date.now() - 1 * 86400000,
          publishedAt: Date.now() - 10 * 86400000,
          status: 'published',
        },
      },
      {
        type: 'portfolio_template',
        title: 'DeFi Blue Chip Portfolio',
        description: 'Balanced DeFi allocation: 30% SOL, 20% JUP, 15% RAY, 15% ORCA, 10% JTO, 10% stablecoins. Monthly rebalance.',
        author: {
          id: 'author_defi_analyst',
          username: 'defi_analyst',
          displayName: 'DeFi Analyst',
          verified: true,
          stats: { itemsPublished: 6, totalDownloads: 3400, totalRevenue: 23000, averageRating: 4.5 },
        },
        version: '2.0.0',
        price: 1999, // $19.99
        currency: 'USD',
        revenueShare: 15,
        tags: ['portfolio', 'defi', 'rebalance', 'blue-chip'],
        category: 'Portfolio Templates',
        screenshots: ['/marketplace/defi-portfolio-1.png'],
        downloads: 1234,
        rating: 4.6,
        reviewCount: 89,
        requirements: {
          minTier: 'free',
          permissions: ['portfolio', 'trading'],
          dependencies: [],
        },
        content: {
          portfolioTemplate: {
            allocations: [
              { token: 'SOL', targetPct: 30 },
              { token: 'JUP', targetPct: 20 },
              { token: 'RAY', targetPct: 15 },
              { token: 'ORCA', targetPct: 15 },
              { token: 'JTO', targetPct: 10 },
              { token: 'USDC', targetPct: 10 },
            ],
            rebalanceRules: [
              { type: 'threshold', thresholdPct: 10, schedule: 'monthly' },
            ],
          },
        },
        metadata: {
          createdAt: Date.now() - 45 * 86400000,
          updatedAt: Date.now() - 3 * 86400000,
          publishedAt: Date.now() - 40 * 86400000,
          status: 'published',
        },
      },
    ];

    for (const item of seedItems) {
      this.publishItem(item);
    }
  }

  // Publish new item
  publishItem(item: Omit<MarketplaceItem, 'id' | 'metadata'>): MarketplaceItem {
    const newItem: MarketplaceItem = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        publishedAt: Date.now(),
        status: 'published',
      },
    };

    this.items.set(newItem.id, newItem);
    this.notifySubscribers();
    return newItem;
  }

  // Submit for review
  submitForReview(item: Omit<MarketplaceItem, 'id' | 'metadata'>): MarketplaceItem {
    const newItem: MarketplaceItem = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'pending_review',
      },
    };

    this.items.set(newItem.id, newItem);
    this.notifySubscribers();
    return newItem;
  }

  // Update item
  updateItem(itemId: string, updates: Partial<MarketplaceItem>): MarketplaceItem | null {
    const item = this.items.get(itemId);
    if (!item) return null;

    const updated = {
      ...item,
      ...updates,
      metadata: {
        ...item.metadata,
        updatedAt: Date.now(),
      },
    };

    this.items.set(itemId, updated);
    this.notifySubscribers();
    return updated;
  }

  // Get items with filters
  getItems(filters?: {
    type?: MarketplaceItem['type'];
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    tags?: string[];
    authorId?: string;
    status?: MarketplaceItem['metadata']['status'];
    sortBy?: 'newest' | 'popular' | 'rating' | 'price_low' | 'price_high';
    limit?: number;
    offset?: number;
  }): MarketplaceItem[] {
    let items = Array.from(this.items.values());

    if (filters) {
      if (filters.type) items = items.filter(i => i.type === filters.type);
      if (filters.category) items = items.filter(i => i.category === filters.category);
      if (filters.minPrice !== undefined) items = items.filter(i => i.price >= filters.minPrice!);
      if (filters.maxPrice !== undefined) items = items.filter(i => i.price <= filters.maxPrice!);
      if (filters.tags) items = items.filter(i => filters.tags!.some(t => i.tags.includes(t)));
      if (filters.authorId) items = items.filter(i => i.author.id === filters.authorId);
      if (filters.status) items = items.filter(i => i.metadata.status === filters.status);
      else items = items.filter(i => i.metadata.status === 'published'); // Default to published

      // Sort
      const sortBy = filters.sortBy || 'newest';
      switch (sortBy) {
        case 'popular': items.sort((a, b) => b.downloads - a.downloads); break;
        case 'rating': items.sort((a, b) => b.rating - a.rating); break;
        case 'price_low': items.sort((a, b) => a.price - b.price); break;
        case 'price_high': items.sort((a, b) => b.price - a.price); break;
        case 'newest':
        default: items.sort((a, b) => b.metadata.publishedAt! - a.metadata.publishedAt!); break;
      }

      // Pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      items = items.slice(offset, offset + limit);
    }

    return items;
  }

  getItem(itemId: string): MarketplaceItem | undefined {
    return this.items.get(itemId);
  }

  // Purchase item
  async purchaseItem(itemId: string, buyerId: string): Promise<MarketplacePurchase> {
    const item = this.items.get(itemId);
    if (!item) throw new Error('Item not found');
    if (item.metadata.status !== 'published') throw new Error('Item not available');

    // Check if already owned
    const library = this.userLibrary.get(buyerId) || new Set();
    if (library.has(itemId)) throw new Error('Already owned');

    const platformFee = Math.round(item.price * (this.config.platformFeePercent / 100));
    const sellerEarnings = item.price - platformFee;

    const purchase: MarketplacePurchase = {
      id: `pur_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      itemId,
      buyerId,
      sellerId: item.author.id,
      price: item.price,
      currency: item.currency,
      platformFee,
      sellerEarnings,
      status: 'completed',
      createdAt: Date.now(),
      completedAt: Date.now(),
    };

    // Add to library
    library.add(itemId);
    this.userLibrary.set(buyerId, library);

    // Update download count
    item.downloads++;
    this.items.set(itemId, item);

    // Store purchase
    const userPurchases = this.purchases.get(buyerId) || [];
    userPurchases.push(purchase);
    this.purchases.set(buyerId, userPurchases);

    const sellerPurchases = this.purchases.get(item.author.id) || [];
    sellerPurchases.push(purchase);
    this.purchases.set(item.author.id, sellerPurchases);

    this.notifySubscribers();
    return purchase;
  }

  // Get user library
  getUserLibrary(userId: string): MarketplaceItem[] {
    const itemIds = this.userLibrary.get(userId) || new Set();
    return Array.from(itemIds)
      .map(id => this.items.get(id))
      .filter((i): i is MarketplaceItem => i !== undefined);
  }

  // Reviews
  addReview(review: Omit<MarketplaceReview, 'id' | 'createdAt' | 'updatedAt' | 'helpful'>): MarketplaceReview {
    const item = this.items.get(review.itemId);
    if (!item) throw new Error('Item not found');

    // Check if user purchased
    const library = this.userLibrary.get(review.userId) || new Set();
    const verifiedPurchase = library.has(review.itemId);

    // Check cooldown
    const existingReviews = this.reviews.get(review.itemId) || [];
    const userReview = existingReviews.find(r => r.userId === review.userId);
    if (userReview && Date.now() - userReview.updatedAt < this.config.reviewCooldownHours * 3600000) {
      throw new Error('Review cooldown active');
    }

    const newReview: MarketplaceReview = {
      ...review,
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      verifiedPurchase,
      helpful: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    existingReviews.push(newReview);
    this.reviews.set(review.itemId, existingReviews);

    // Update item rating
    const allRatings = existingReviews.map(r => r.rating);
    item.rating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
    item.reviewCount = allRatings.length;
    this.items.set(item.id, item);

    this.notifySubscribers();
    return newReview;
  }

  getReviews(itemId: string, filters?: { sortBy?: 'newest' | 'helpful' | 'rating'; limit?: number }): MarketplaceReview[] {
    let reviews = this.reviews.get(itemId) || [];
    
    const sortBy = filters?.sortBy || 'newest';
    switch (sortBy) {
      case 'helpful': reviews.sort((a, b) => b.helpful - a.helpful); break;
      case 'rating': reviews.sort((a, b) => b.rating - a.rating); break;
      case 'newest':
      default: reviews.sort((a, b) => b.createdAt - a.createdAt); break;
    }

    return reviews.slice(0, filters?.limit || 20);
  }

  // Subscriptions
  subscribeToItem(subscription: Omit<MarketplaceSubscription, 'id' | 'status' | 'currentPeriodEnd'>): MarketplaceSubscription {
    const newSub: MarketplaceSubscription = {
      ...subscription,
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: 'active',
      currentPeriodEnd: Date.now() + (subscription.interval === 'monthly' ? 30 : 365) * 86400000,
    };

    const userSubs = this.subscriptions.get(subscription.userId) || [];
    userSubs.push(newSub);
    this.subscriptions.set(subscription.userId, userSubs);

    return newSub;
  }

  getUserSubscriptions(userId: string): MarketplaceSubscription[] {
    return this.subscriptions.get(userId) || [];
  }

  // Stats
  getStats(): MarketplaceStats {
    const publishedItems = Array.from(this.items.values()).filter(i => i.metadata.status === 'published');
    
    const categoryCounts = new Map<string, number>();
    const authorRevenue = new Map<string, number>();
    let totalRevenue = 0;
    let totalDownloads = 0;

    for (const item of publishedItems) {
      categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
      authorRevenue.set(item.author.id, (authorRevenue.get(item.author.id) || 0) + item.downloads * item.price * (1 - this.config.platformFeePercent / 100));
      totalRevenue += item.downloads * item.price * (1 - this.config.platformFeePercent / 100);
      totalDownloads += item.downloads;
    }

    return {
      totalItems: publishedItems.length,
      totalUsers: this.userLibrary.size,
      totalRevenue,
      totalDownloads,
      topCategories: Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topAuthors: Array.from(authorRevenue.entries())
        .map(([authorId, revenue]) => ({ authorId, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      recentActivity: [], // Would track in production
    };
  }

  // Search
  search(query: string, filters?: any): MarketplaceItem[] {
    const lowerQuery = query.toLowerCase();
    return this.getItems(filters).filter(item => 
      item.title.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
      item.author.username.toLowerCase().includes(lowerQuery)
    );
  }

  // Featured items
  getFeatured(limit: number = 6): MarketplaceItem[] {
    return this.getItems({ 
      status: 'published', 
      sortBy: 'popular', 
      limit: limit * 3 
    }).slice(0, limit);
  }

  // Categories
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const item of this.items.values()) {
      if (item.metadata.status === 'published') {
        categories.add(item.category);
      }
    }
    return Array.from(categories).sort();
  }

  // Subscriptions
  onItemsChange(callback: (items: MarketplaceItem[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const items = Array.from(this.items.values()).filter(i => i.metadata.status === 'published');
    for (const sub of this.subscribers) {
      try { sub(items); } catch (e) { console.error('[Marketplace] Subscriber error:', e); }
    }
  }
}

export interface MarketplaceConfig {
  platformFeePercent: number;
  minPrice: number;
  maxPrice: number;
  reviewCooldownHours: number;
  autoApproveThreshold: number;
  featuredRotationHours: number;
}

// Singleton
let marketplaceInstance: StrategyMarketplace | null = null;

export function getStrategyMarketplace(config?: Partial<MarketplaceConfig>): StrategyMarketplace {
  if (!marketplaceInstance) {
    marketplaceInstance = new StrategyMarketplace(config);
  }
  return marketplaceInstance;
}

// React hook
export function useStrategyMarketplace(config?: Partial<MarketplaceConfig>) {
  const marketplace = getStrategyMarketplace(config);
  
  return {
    publishItem: (item: any) => marketplace.publishItem(item),
    submitForReview: (item: any) => marketplace.submitForReview(item),
    updateItem: (id: string, updates: any) => marketplace.updateItem(id, updates),
    getItems: (filters?: any) => marketplace.getItems(filters),
    getItem: (id: string) => marketplace.getItem(id),
    purchaseItem: (itemId: string, buyerId: string) => marketplace.purchaseItem(itemId, buyerId),
    getUserLibrary: (userId: string) => marketplace.getUserLibrary(userId),
    addReview: (review: any) => marketplace.addReview(review),
    getReviews: (itemId: string, filters?: any) => marketplace.getReviews(itemId, filters),
    subscribeToItem: (sub: any) => marketplace.subscribeToItem(sub),
    getUserSubscriptions: (userId: string) => marketplace.getUserSubscriptions(userId),
    getStats: () => marketplace.getStats(),
    search: (query: string, filters?: any) => marketplace.search(query, filters),
    getFeatured: (limit?: number) => marketplace.getFeatured(limit),
    getCategories: () => marketplace.getCategories(),
    onItemsChange: (callback: (items: MarketplaceItem[]) => void) => marketplace.onItemsChange(callback),
  };
}

export type { MarketplaceItem, MarketplaceAuthor, MarketplaceItemContent, MarketplaceReview, MarketplacePurchase, MarketplaceSubscription, MarketplaceStats, MarketplaceActivity };