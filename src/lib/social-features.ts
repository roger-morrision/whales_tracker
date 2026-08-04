/**
 * Social Features
 * Copy-trade leaderboards, shared watchlists, trade comments
 */

export interface SocialUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  verified: boolean;
  stats: {
    followers: number;
    following: number;
    totalPnL: number;
    winRate: number;
    totalTrades: number;
    sharpeRatio: number;
    maxDrawdown: number;
    avgHoldTime: number;
  };
  preferences: {
    showPnL: boolean;
    showPositions: boolean;
    allowCopyTrade: boolean;
    notifications: {
      newFollower: boolean;
      tradeCopied: boolean;
      mention: boolean;
      comment: boolean;
    };
  };
  createdAt: number;
  lastActive: number;
}

export interface FollowRelation {
  followerId: string;
  followingId: string;
  createdAt: number;
  notifications: boolean;
}

export interface TradePost {
  id: string;
  authorId: string;
  type: 'trade' | 'analysis' | 'alert' | 'strategy' | 'question';
  content: string;
  tokenMint?: string;
  tokenSymbol?: string;
  tradeData?: {
    side: 'buy' | 'sell';
    amount: number;
    price: number;
    pnl?: number;
    pnlPercent?: number;
  };
  attachments?: {
    type: 'image' | 'chart' | 'link';
    url: string;
    title?: string;
  }[];
  tags: string[];
  visibility: 'public' | 'followers' | 'private';
  likes: number;
  comments: number;
  shares: number;
  createdAt: number;
  updatedAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentId?: string; // For replies
  likes: number;
  createdAt: number;
  updatedAt: number;
}

export interface Like {
  userId: string;
  targetId: string; // post or comment
  targetType: 'post' | 'comment';
  createdAt: number;
}

export interface Watchlist {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  tokens: WatchlistToken[];
  collaborators: WatchlistCollaborator[];
  isPublic: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WatchlistToken {
  mint: string;
  symbol: string;
  name: string;
  addedAt: number;
  addedBy: string;
  notes?: string;
  targetPrice?: number;
  stopLoss?: number;
}

export interface WatchlistCollaborator {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: number;
}

export interface CopyTradeSubscription {
  id: string;
  subscriberId: string;
  leaderId: string;
  config: {
    maxPositionUsd: number;
    copySells: boolean;
    copyBuys: boolean;
    delayMs: number;
    riskMultiplier: number; // 0.5 = half size, 2 = double
    allowedTokens?: string[];
    blockedTokens?: string[];
    stopLossPct?: number;
    takeProfitPct?: number;
  };
  status: 'active' | 'paused' | 'stopped';
  stats: {
    totalCopied: number;
    totalPnL: number;
    winRate: number;
    avgPnL: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  rank: number;
  metric: 'pnl' | 'win_rate' | 'sharpe' | 'followers' | 'copied_volume';
  value: number;
  change24h: number;
  badge?: string;
}

export interface SocialNotification {
  id: string;
  userId: string;
  type: 'follow' | 'like' | 'comment' | 'mention' | 'trade_copied' | 'leaderboard_change' | 'watchlist_invite';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: number;
}

class SocialFeaturesManager {
  private users: Map<string, SocialUser> = new Map();
  private follows: Map<string, FollowRelation[]> = new Map(); // followerId -> follows
  private followers: Map<string, FollowRelation[]> = new Map(); // followingId -> followers
  private posts: Map<string, TradePost> = new Map();
  private comments: Map<string, Comment[]> = new Map(); // postId -> comments
  private likes: Map<string, Like[]> = new Map(); // targetId -> likes
  private watchlists: Map<string, Watchlist> = new Map();
  private userWatchlists: Map<string, Set<string>> = new Map(); // userId -> watchlistIds
  private copySubscriptions: Map<string, CopyTradeSubscription[]> = new Map(); // subscriberId -> subscriptions
  private notifications: Map<string, SocialNotification[]> = new Map(); // userId -> notifications
  private subscribers: Set<() => void> = new Set();
  private currentUserId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    this.loadCurrentUser();
    this.loadSeedData();
  }

  private loadCurrentUser(): void {
    // In production, get from auth
    this.currentUserId = 'current_user';
    this.ensureUser(this.currentUserId);
  }

  private ensureUser(userId: string): SocialUser {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        id: userId,
        username: `user_${userId.slice(-6)}`,
        displayName: `User ${userId.slice(-6)}`,
        verified: false,
        stats: {
          followers: 0,
          following: 0,
          totalPnL: 0,
          winRate: 0,
          totalTrades: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          avgHoldTime: 0,
        },
        preferences: {
          showPnL: true,
          showPositions: true,
          allowCopyTrade: true,
          notifications: {
            newFollower: true,
            tradeCopied: true,
            mention: true,
            comment: true,
          },
        },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });
    }
    return this.users.get(userId)!;
  }

  private loadSeedData(): void {
    // Seed some demo users
    const demoUsers = [
      { id: 'whale_hunter', username: 'whale_hunter', displayName: 'Whale Hunter', verified: true, pnl: 125000, winRate: 72, sharpe: 2.1 },
      { id: 'defi_analyst', username: 'defi_analyst', displayName: 'DeFi Analyst', verified: true, pnl: 89000, winRate: 68, sharpe: 1.8 },
      { id: 'copy_trader_pro', username: 'copy_trader_pro', displayName: 'Copy Trader Pro', verified: true, pnl: 67000, winRate: 65, sharpe: 1.5 },
      { id: 'sniper_king', username: 'sniper_king', displayName: 'Sniper King', verified: true, pnl: 234000, winRate: 58, sharpe: 2.5 },
      { id: 'yield_farmer', username: 'yield_farmer', displayName: 'Yield Farmer', verified: true, pnl: 45000, winRate: 75, sharpe: 1.2 },
    ];

    for (const u of demoUsers) {
      const user = this.ensureUser(u.id);
      user.username = u.username;
      user.displayName = u.displayName;
      user.verified = u.verified;
      user.stats.totalPnL = u.pnl;
      user.stats.winRate = u.winRate;
      user.stats.sharpeRatio = u.sharpe;
      user.stats.followers = Math.floor(Math.random() * 5000) + 500;
    }

    // Seed follow relationships
    this.follow(this.currentUserId!, 'whale_hunter');
    this.follow(this.currentUserId!, 'defi_analyst');

    // Seed posts
    this.createPost({
      authorId: 'whale_hunter',
      type: 'trade',
      content: 'Just sniped $WIF at launch. Smart money entered 2 min before. Setting 15% trailing stop. 🎯',
      tokenSymbol: 'WIF',
      tradeData: { side: 'buy', amount: 50000, price: 0.00012, pnl: 12500, pnlPercent: 25 },
      tags: ['snipe', 'smart-money', 'wif'],
    });

    this.createPost({
      authorId: 'defi_analyst',
      type: 'analysis',
      content: 'JUP showing strong accumulation on 4h timeframe. RSI at 42, MACD bullish cross forming. Target $1.20.',
      tokenSymbol: 'JUP',
      tags: ['analysis', 'jup', 'technical'],
    });

    // Seed watchlists
    this.createWatchlist({
      name: 'DeFi Blue Chips',
      description: 'Core DeFi holdings for long-term',
      ownerId: this.currentUserId!,
      tokens: [
        { mint: 'SOL', symbol: 'SOL', name: 'Solana', addedAt: Date.now(), addedBy: this.currentUserId! },
        { mint: 'JUP', symbol: 'JUP', name: 'Jupiter', addedAt: Date.now(), addedBy: this.currentUserId!, targetPrice: 1.5 },
        { mint: 'RAY', symbol: 'RAY', name: 'Raydium', addedAt: Date.now(), addedBy: this.currentUserId!, targetPrice: 3.0 },
      ],
      isPublic: true,
    });
  }

  // User management
  getCurrentUser(): SocialUser | null {
    return this.currentUserId ? this.users.get(this.currentUserId) || null : null;
  }

  getUser(userId: string): SocialUser | undefined {
    return this.users.get(userId);
  }

  updateUser(userId: string, updates: Partial<SocialUser>): SocialUser | null {
    const user = this.users.get(userId);
    if (!user) return null;
    
    const updated = { ...user, ...updates, lastActive: Date.now() };
    this.users.set(userId, updated);
    return updated;
  }

  // Follow system
  follow(followerId: string, followingId: string): FollowRelation | null {
    if (followerId === followingId) return null;
    
    const existing = this.follows.get(followerId)?.find(f => f.followingId === followingId);
    if (existing) return existing;

    const relation: FollowRelation = {
      followerId,
      followingId,
      createdAt: Date.now(),
      notifications: true,
    };

    if (!this.follows.has(followerId)) this.follows.set(followerId, []);
    this.follows.get(followerId)!.push(relation);

    if (!this.followers.has(followingId)) this.followers.set(followingId, []);
    this.followers.get(followingId)!.push(relation);

    // Update stats
    const follower = this.ensureUser(followerId);
    const following = this.ensureUser(followingId);
    follower.stats.following++;
    following.stats.followers++;

    // Notify
    this.addNotification(followingId, {
      type: 'follow',
      title: 'New Follower',
      message: `${follower.displayName} started following you`,
      data: { followerId },
    });

    return relation;
  }

  unfollow(followerId: string, followingId: string): boolean {
    const followerFollows = this.follows.get(followerId);
    const followingFollowers = this.followers.get(followingId);
    
    if (!followerFollows || !followingFollowers) return false;

    const followerIndex = followerFollows.findIndex(f => f.followingId === followingId);
    const followingIndex = followingFollowers.findIndex(f => f.followerId === followerId);
    
    if (followerIndex === -1 || followingIndex === -1) return false;

    followerFollows.splice(followerIndex, 1);
    followingFollowers.splice(followingIndex, 1);

    // Update stats
    const follower = this.users.get(followerId);
    const following = this.users.get(followingId);
    if (follower) follower.stats.following--;
    if (following) following.stats.followers--;

    return true;
  }

  isFollowing(followerId: string, followingId: string): boolean {
    return this.follows.get(followerId)?.some(f => f.followingId === followingId) || false;
  }

  getFollowers(userId: string): FollowRelation[] {
    return this.followers.get(userId) || [];
  }

  getFollowing(userId: string): FollowRelation[] {
    return this.follows.get(userId) || [];
  }

  getFollowerCount(userId: string): number {
    return this.followers.get(userId)?.length || 0;
  }

  getFollowingCount(userId: string): number {
    return this.follows.get(userId)?.length || 0;
  }

  // Posts
  createPost(post: Omit<TradePost, 'id' | 'likes' | 'comments' | 'shares' | 'createdAt' | 'updatedAt'>): TradePost {
    const newPost: TradePost = {
      ...post,
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.posts.set(newPost.id, newPost);
    this.comments.set(newPost.id, []);
    this.likes.set(newPost.id, []);

    // Notify followers
    const followers = this.getFollowers(post.authorId);
    for (const follower of followers) {
      this.addNotification(follower.followerId, {
        type: 'mention',
        title: 'New Post',
        message: `${this.ensureUser(post.authorId).displayName} posted: ${post.content.slice(0, 50)}...`,
        data: { postId: newPost.id },
      });
    }

    return newPost;
  }

  getPost(postId: string): TradePost | undefined {
    return this.posts.get(postId);
  }

  getPosts(filters?: {
    authorId?: string;
    type?: TradePost['type'];
    tokenSymbol?: string;
    limit?: number;
    offset?: number;
  }): TradePost[] {
    let posts = Array.from(this.posts.values());

    if (filters) {
      if (filters.authorId) posts = posts.filter(p => p.authorId === filters.authorId);
      if (filters.type) posts = posts.filter(p => p.type === filters.type);
      if (filters.tokenSymbol) posts = posts.filter(p => p.tokenSymbol === filters.tokenSymbol);
    }

    posts.sort((a, b) => b.createdAt - a.createdAt);
    
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 20;
    return posts.slice(offset, offset + limit);
  }

  getFeed(userId: string, limit: number = 20): TradePost[] {
    const following = this.getFollowing(userId).map(f => f.followingId);
    following.push(userId); // Include own posts
    
    return this.getPosts({ authorId: following[0] }) // Simplified - would filter by all following
      .slice(0, limit);
  }

  likePost(userId: string, postId: string): boolean {
    const post = this.posts.get(postId);
    if (!post) return false;

    const existing = this.likes.get(postId)?.find(l => l.userId === userId && l.targetType === 'post');
    if (existing) return false;

    const like: Like = {
      userId,
      targetId: postId,
      targetType: 'post',
      createdAt: Date.now(),
    };

    if (!this.likes.has(postId)) this.likes.set(postId, []);
    this.likes.get(postId)!.push(like);
    post.likes++;

    // Notify author
    if (post.authorId !== userId) {
      this.addNotification(post.authorId, {
        type: 'like',
        title: 'New Like',
        message: `${this.ensureUser(userId).displayName} liked your post`,
        data: { postId },
      });
    }

    return true;
  }

  unlikePost(userId: string, postId: string): boolean {
    const likes = this.likes.get(postId);
    if (!likes) return false;

    const index = likes.findIndex(l => l.userId === userId && l.targetType === 'post');
    if (index === -1) return false;

    likes.splice(index, 1);
    const post = this.posts.get(postId);
    if (post) post.likes--;

    return true;
  }

  // Comments
  addComment(comment: Omit<Comment, 'id' | 'likes' | 'createdAt' | 'updatedAt'>): Comment {
    const post = this.posts.get(comment.postId);
    if (!post) throw new Error('Post not found');

    const newComment: Comment = {
      ...comment,
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      likes: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!this.comments.has(comment.postId)) this.comments.set(comment.postId, []);
    this.comments.get(comment.postId)!.push(newComment);
    post.comments++;

    // Notify post author
    if (post.authorId !== comment.authorId) {
      this.addNotification(post.authorId, {
        type: 'comment',
        title: 'New Comment',
        message: `${this.ensureUser(comment.authorId).displayName} commented on your post`,
        data: { postId: comment.postId, commentId: newComment.id },
      });
    }

    // Notify parent comment author if reply
    if (comment.parentId) {
      const parentComment = this.comments.get(comment.postId)?.find(c => c.id === comment.parentId);
      if (parentComment && parentComment.authorId !== comment.authorId) {
        this.addNotification(parentComment.authorId, {
          type: 'comment',
          title: 'Reply to your comment',
          message: `${this.ensureUser(comment.authorId).displayName} replied to your comment`,
          data: { postId: comment.postId, commentId: newComment.id },
        });
      }
    }

    return newComment;
  }

  getComments(postId: string): Comment[] {
    return this.comments.get(postId) || [];
  }

  // Watchlists
  createWatchlist(watchlist: Omit<Watchlist, 'id' | 'collaborators' | 'createdAt' | 'updatedAt'>): Watchlist {
    const newWatchlist: Watchlist = {
      ...watchlist,
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      collaborators: [{ userId: watchlist.ownerId, role: 'owner', addedAt: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.watchlists.set(newWatchlist.id, newWatchlist);

    if (!this.userWatchlists.has(watchlist.ownerId)) this.userWatchlists.set(watchlist.ownerId, new Set());
    this.userWatchlists.get(watchlist.ownerId)!.add(newWatchlist.id);

    return newWatchlist;
  }

  getWatchlist(watchlistId: string): Watchlist | undefined {
    return this.watchlists.get(watchlistId);
  }

  getUserWatchlists(userId: string): Watchlist[] {
    const ids = this.userWatchlists.get(userId) || new Set();
    return Array.from(ids).map(id => this.watchlists.get(id)).filter((w): w is Watchlist => w !== undefined);
  }

  addTokenToWatchlist(watchlistId: string, token: Omit<WatchlistToken, 'addedAt' | 'addedBy'>, userId: string): WatchlistToken | null {
    const watchlist = this.watchlists.get(watchlistId);
    if (!watchlist) return null;

    // Check permissions
    const collaborator = watchlist.collaborators.find(c => c.userId === userId);
    if (!collaborator || collaborator.role === 'viewer') return null;

    const newToken: WatchlistToken = {
      ...token,
      addedAt: Date.now(),
      addedBy: userId,
    };

    watchlist.tokens.push(newToken);
    watchlist.updatedAt = Date.now();

    return newToken;
  }

  removeTokenFromWatchlist(watchlistId: string, mint: string, userId: string): boolean {
    const watchlist = this.watchlists.get(watchlistId);
    if (!watchlist) return false;

    const collaborator = watchlist.collaborators.find(c => c.userId === userId);
    if (!collaborator || collaborator.role === 'viewer') return false;

    const index = watchlist.tokens.findIndex(t => t.mint === mint);
    if (index === -1) return false;

    watchlist.tokens.splice(index, 1);
    watchlist.updatedAt = Date.now();
    return true;
  }

  // Copy trading
  subscribeToLeader(subscription: Omit<CopyTradeSubscription, 'id' | 'stats' | 'createdAt' | 'updatedAt'>): CopyTradeSubscription {
    const newSub: CopyTradeSubscription = {
      ...subscription,
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      stats: {
        totalCopied: 0,
        totalPnL: 0,
        winRate: 0,
        avgPnL: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!this.copySubscriptions.has(subscription.subscriberId)) {
      this.copySubscriptions.set(subscription.subscriberId, []);
    }
    this.copySubscriptions.get(subscription.subscriberId)!.push(newSub);

    // Notify leader
    this.addNotification(subscription.leaderId, {
      type: 'trade_copied',
      title: 'New Copier',
      message: `${this.ensureUser(subscription.subscriberId).displayName} started copying your trades`,
      data: { subscriptionId: newSub.id },
    });

    return newSub;
  }

  getCopySubscriptions(userId: string): CopyTradeSubscription[] {
    return this.copySubscriptions.get(userId) || [];
  }

  getLeaderSubscriptions(leaderId: string): CopyTradeSubscription[] {
    const allSubs: CopyTradeSubscription[] = [];
    for (const subs of this.copySubscriptions.values()) {
      allSubs.push(...subs.filter(s => s.leaderId === leaderId));
    }
    return allSubs;
  }

  // Leaderboards
  getLeaderboard(metric: LeaderboardEntry['metric'], limit: number = 100): LeaderboardEntry[] {
    const users = Array.from(this.users.values())
      .filter(u => u.stats.totalTrades > 10) // Min trades
      .sort((a, b) => {
        let valA: number, valB: number;
        switch (metric) {
          case 'pnl': valA = a.stats.totalPnL; valB = b.stats.totalPnL; break;
          case 'win_rate': valA = a.stats.winRate; valB = b.stats.winRate; break;
          case 'sharpe': valA = a.stats.sharpeRatio; valB = b.stats.sharpeRatio; break;
          case 'followers': valA = a.stats.followers; valB = b.stats.followers; break;
          case 'copied_volume': 
            const aSubs = this.getLeaderSubscriptions(a.id);
            const bSubs = this.getLeaderSubscriptions(b.id);
            valA = aSubs.reduce((sum, s) => sum + s.config.maxPositionUsd, 0);
            valB = bSubs.reduce((sum, s) => sum + s.config.maxPositionUsd, 0);
            break;
        }
        return valB - valA;
      })
      .slice(0, limit)
      .map((user, index) => ({
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        rank: index + 1,
        metric,
        value: metric === 'pnl' ? user.stats.totalPnL : 
               metric === 'win_rate' ? user.stats.winRate :
               metric === 'sharpe' ? user.stats.sharpeRatio :
               metric === 'followers' ? user.stats.followers : 0,
        change24h: (Math.random() - 0.5) * 10, // Mock
        badge: index < 3 ? ['🥇', '🥈', '🥉'][index] : index < 10 ? '🏅' : undefined,
      }));

    return users;
  }

  // Notifications
  private addNotification(userId: string, notification: Omit<SocialNotification, 'id' | 'userId' | 'read' | 'createdAt'>): void {
    const newNotification: SocialNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      read: false,
      createdAt: Date.now(),
    };

    if (!this.notifications.has(userId)) this.notifications.set(userId, []);
    this.notifications.get(userId)!.unshift(newNotification);

    // Keep last 100
    const userNotifs = this.notifications.get(userId)!;
    if (userNotifs.length > 100) userNotifs.splice(100);
  }

  getNotifications(userId: string, unreadOnly: boolean = false): SocialNotification[] {
    let notifications = this.notifications.get(userId) || [];
    if (unreadOnly) notifications = notifications.filter(n => !n.read);
    return notifications;
  }

  markNotificationRead(userId: string, notificationId: string): boolean {
    const notifications = this.notifications.get(userId);
    if (!notifications) return false;

    const notif = notifications.find(n => n.id === notificationId);
    if (!notif) return false;

    notif.read = true;
    return true;
  }

  markAllNotificationsRead(userId: string): void {
    const notifications = this.notifications.get(userId);
    if (notifications) {
      notifications.forEach(n => n.read = true);
    }
  }

  // Subscriptions
  onDataChange(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try { sub(); } catch (e) { console.error('[Social] Subscriber error:', e); }
    }
  }
}

// Singleton
let socialFeaturesInstance: SocialFeaturesManager | null = null;

export function getSocialFeaturesManager(): SocialFeaturesManager {
  if (!socialFeaturesInstance) {
    socialFeaturesInstance = new SocialFeaturesManager();
  }
  return socialFeaturesInstance;
}

// React hook
export function useSocialFeatures() {
  const manager = getSocialFeaturesManager();
  
  return {
    getCurrentUser: () => manager.getCurrentUser(),
    getUser: (id: string) => manager.getUser(id),
    updateUser: (id: string, updates: any) => manager.updateUser(id, updates),
    follow: (followerId: string, followingId: string) => manager.follow(followerId, followingId),
    unfollow: (followerId: string, followingId: string) => manager.unfollow(followerId, followingId),
    isFollowing: (followerId: string, followingId: string) => manager.isFollowing(followerId, followingId),
    getFollowers: (userId: string) => manager.getFollowers(userId),
    getFollowing: (userId: string) => manager.getFollowing(userId),
    createPost: (post: any) => manager.createPost(post),
    getPost: (id: string) => manager.getPost(id),
    getPosts: (filters?: any) => manager.getPosts(filters),
    getFeed: (userId: string, limit?: number) => manager.getFeed(userId, limit),
    likePost: (userId: string, postId: string) => manager.likePost(userId, postId),
    unlikePost: (userId: string, postId: string) => manager.unlikePost(userId, postId),
    addComment: (comment: any) => manager.addComment(comment),
    getComments: (postId: string) => manager.getComments(postId),
    createWatchlist: (wl: any) => manager.createWatchlist(wl),
    getWatchlist: (id: string) => manager.getWatchlist(id),
    getUserWatchlists: (userId: string) => manager.getUserWatchlists(userId),
    addTokenToWatchlist: (wlId: string, token: any, userId: string) => manager.addTokenToWatchlist(wlId, token, userId),
    removeTokenFromWatchlist: (wlId: string, mint: string, userId: string) => manager.removeTokenFromWatchlist(wlId, mint, userId),
    subscribeToLeader: (sub: any) => manager.subscribeToLeader(sub),
    getCopySubscriptions: (userId: string) => manager.getCopySubscriptions(userId),
    getLeaderSubscriptions: (leaderId: string) => manager.getLeaderSubscriptions(leaderId),
    getLeaderboard: (metric: any, limit?: number) => manager.getLeaderboard(metric, limit),
    getNotifications: (userId: string, unreadOnly?: boolean) => manager.getNotifications(userId, unreadOnly),
    markNotificationRead: (userId: string, notifId: string) => manager.markNotificationRead(userId, notifId),
    markAllNotificationsRead: (userId: string) => manager.markAllNotificationsRead(userId),
    onDataChange: (callback: () => void) => manager.onDataChange(callback),
  };
}

export type { SocialUser, FollowRelation, TradePost, Comment, Like, Watchlist, WatchlistToken, WatchlistCollaborator, CopyTradeSubscription, LeaderboardEntry, SocialNotification };