/**
 * Verified Leaderboard System
 * Implements a verified PnL leaderboard with KYC-verified traders
 * Prevents fake screenshots by requiring on-chain verification
 */

interface LeaderboardConfig {
  minTradesForRanking: number; // Minimum trades to appear on leaderboard
  verificationRequired: boolean; // Require KYC for top positions
  maxLeaderboardSize: number; // Maximum entries to display
  updateIntervalMs: number; // How often to refresh (e.g., hourly)
}

const DEFAULT_CONFIG: LeaderboardConfig = {
  minTradesForRanking: 10,
  verificationRequired: true,
  maxLeaderboardSize: 100,
  updateIntervalMs: 60 * 60 * 1000, // Hourly
};

interface VerifiedTrader {
  wallet: string;
  username?: string; // Optional display name
  avatar?: string;
  isVerified: boolean; // KYC verified
  verificationLevel: 'none' | 'basic' | 'full'; // none, basic (Twitter), full (KYC)
  verifiedAt?: number;
  
  // PnL stats
  totalPnlUsd: number;
  totalPnlPercent: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  winRate: number; // 0-100
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWinUsd: number;
  avgLossUsd: number;
  maxDrawdownPercent: number;
  sharpeRatio?: number;
  
  // Time-based stats
  pnl24h: number;
  pnl7d: number;
  pnl30d: number;
  pnlAllTime: number;
  
  // Volume
  volume24h: number;
  volume7d: number;
  volume30d: number;
  volumeAllTime: number;
  
  // Risk metrics
  riskScore: number; // 0-100 (lower = safer)
  maxPositionSizeUsd: number;
  avgPositionSizeUsd: number;
  
  // Metadata
  firstTradeAt: number;
  lastTradeAt: number;
  tags: string[]; // e.g., 'sniper', 'swing', 'smart_money', 'whale'
  
  // Social
  followers: number;
  following: number;
  
  // Verification proof
  verificationProof?: {
    twitterHandle?: string;
    twitterVerified?: boolean;
    discordId?: string;
    kycProvider?: string;
    kycReference?: string;
  };
}

interface LeaderboardEntry {
  rank: number;
  trader: VerifiedTrader;
  // Calculated fields for display
  pnlPercent: number;
  pnlUsd: number;
  change24h: number; // Rank change from 24h ago
}

interface LeaderboardFilters {
  timeframe: '24h' | '7d' | '30d' | 'all';
  minTrades?: number;
  verifiedOnly?: boolean;
  tags?: string[];
  sortBy: 'pnl_usd' | 'pnl_percent' | 'win_rate' | 'volume' | 'sharpe';
  sortOrder: 'asc' | 'desc';
}

interface LeaderboardStats {
  totalTraders: number;
  verifiedTraders: number;
  totalVolume24h: number;
  totalVolumeAllTime: number;
  avgWinRate: number;
  topTrader: VerifiedTrader | null;
  lastUpdated: number;
}

// In-memory storage (in production, use database with scheduled jobs)
const traders = new Map<string, VerifiedTrader>();
let lastLeaderboardUpdate = 0;
let cachedLeaderboard: LeaderboardEntry[] = [];
let cachedStats: LeaderboardStats | null = null;
let config: LeaderboardConfig = { ...DEFAULT_CONFIG };

/**
 * Initialize or update a trader's data
 * In production, this would be called by an indexer processing on-chain data
 */
export function upsertTrader(data: Partial<VerifiedTrader> & { wallet: string }): VerifiedTrader {
  const normalizedWallet = data.wallet.toLowerCase();
  const existing = traders.get(normalizedWallet);
  
  const trader: VerifiedTrader = {
    wallet: normalizedWallet,
    username: data.username || existing?.username,
    avatar: data.avatar || existing?.avatar,
    isVerified: data.isVerified ?? existing?.isVerified ?? false,
    verificationLevel: data.verificationLevel || existing?.verificationLevel || 'none',
    verifiedAt: data.verifiedAt || existing?.verifiedAt,
    totalPnlUsd: data.totalPnlUsd ?? existing?.totalPnlUsd ?? 0,
    totalPnlPercent: data.totalPnlPercent ?? existing?.totalPnlPercent ?? 0,
    realizedPnlUsd: data.realizedPnlUsd ?? existing?.realizedPnlUsd ?? 0,
    unrealizedPnlUsd: data.unrealizedPnlUsd ?? existing?.unrealizedPnlUsd ?? 0,
    winRate: data.winRate ?? existing?.winRate ?? 0,
    totalTrades: data.totalTrades ?? existing?.totalTrades ?? 0,
    winningTrades: data.winningTrades ?? existing?.winningTrades ?? 0,
    losingTrades: data.losingTrades ?? existing?.losingTrades ?? 0,
    avgWinUsd: data.avgWinUsd ?? existing?.avgWinUsd ?? 0,
    avgLossUsd: data.avgLossUsd ?? existing?.avgLossUsd ?? 0,
    maxDrawdownPercent: data.maxDrawdownPercent ?? existing?.maxDrawdownPercent ?? 0,
    sharpeRatio: data.sharpeRatio ?? existing?.sharpeRatio,
    pnl24h: data.pnl24h ?? existing?.pnl24h ?? 0,
    pnl7d: data.pnl7d ?? existing?.pnl7d ?? 0,
    pnl30d: data.pnl30d ?? existing?.pnl30d ?? 0,
    pnlAllTime: data.pnlAllTime ?? existing?.pnlAllTime ?? 0,
    volume24h: data.volume24h ?? existing?.volume24h ?? 0,
    volume7d: data.volume7d ?? existing?.volume7d ?? 0,
    volume30d: data.volume30d ?? existing?.volume30d ?? 0,
    volumeAllTime: data.volumeAllTime ?? existing?.volumeAllTime ?? 0,
    riskScore: data.riskScore ?? existing?.riskScore ?? 50,
    maxPositionSizeUsd: data.maxPositionSizeUsd ?? existing?.maxPositionSizeUsd ?? 0,
    avgPositionSizeUsd: data.avgPositionSizeUsd ?? existing?.avgPositionSizeUsd ?? 0,
    firstTradeAt: data.firstTradeAt ?? existing?.firstTradeAt ?? Date.now(),
    lastTradeAt: data.lastTradeAt ?? existing?.lastTradeAt ?? Date.now(),
    tags: data.tags || existing?.tags || [],
    followers: data.followers ?? existing?.followers ?? 0,
    following: data.following ?? existing?.following ?? 0,
    verificationProof: data.verificationProof || existing?.verificationProof,
  };

  traders.set(normalizedWallet, trader);
  invalidateCache();
  return trader;
}

/**
 * Get a trader by wallet
 */
export function getTrader(wallet: string): VerifiedTrader | undefined {
  return traders.get(wallet.toLowerCase());
}

/**
 * Update trader verification status
 */
export function verifyTrader(
  wallet: string,
  level: 'basic' | 'full',
  proof: VerifiedTrader['verificationProof']
): VerifiedTrader | null {
  const normalizedWallet = wallet.toLowerCase();
  const trader = traders.get(normalizedWallet);
  
  if (!trader) return null;
  
  trader.isVerified = true;
  trader.verificationLevel = level;
  trader.verifiedAt = Date.now();
  trader.verificationProof = proof;
  
  traders.set(normalizedWallet, trader);
  invalidateCache();
  return trader;
}

/**
 * Invalidate cached leaderboard
 */
function invalidateCache(): void {
  cachedLeaderboard = [];
  cachedStats = null;
  lastLeaderboardUpdate = 0;
}

/**
 * Build the leaderboard with current data
 */
function buildLeaderboard(filters: LeaderboardFilters): LeaderboardEntry[] {
  let entries = Array.from(traders.values());
  
  // Filter by minimum trades
  const minTrades = filters.minTrades ?? config.minTradesForRanking;
  entries = entries.filter(t => t.totalTrades >= minTrades);
  
  // Filter by verification
  if (filters.verifiedOnly ?? config.verificationRequired) {
    entries = entries.filter(t => t.isVerified);
  }
  
  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    entries = entries.filter(t => filters.tags!.some(tag => t.tags.includes(tag)));
  }
  
  // Select PnL field based on timeframe
  const getPnlField = (trader: VerifiedTrader) => {
    switch (filters.timeframe) {
      case '24h': return trader.pnl24h;
      case '7d': return trader.pnl7d;
      case '30d': return trader.pnl30d;
      case 'all': default: return trader.totalPnlUsd;
    }
  };
  
  const getPnlPercentField = (trader: VerifiedTrader) => {
    // For timeframe-specific percentages, we'd need more data
    // For now, use total percentage
    return trader.totalPnlPercent;
  };
  
  // Sort
  entries.sort((a, b) => {
    let aVal: number, bVal: number;
    
    switch (filters.sortBy) {
      case 'pnl_usd':
        aVal = getPnlField(a);
        bVal = getPnlField(b);
        break;
      case 'pnl_percent':
        aVal = getPnlPercentField(a);
        bVal = getPnlPercentField(b);
        break;
      case 'win_rate':
        aVal = a.winRate;
        bVal = b.winRate;
        break;
      case 'volume':
        switch (filters.timeframe) {
          case '24h': aVal = a.volume24h; bVal = b.volume24h; break;
          case '7d': aVal = a.volume7d; bVal = b.volume7d; break;
          case '30d': aVal = a.volume30d; bVal = b.volume30d; break;
          default: aVal = a.volumeAllTime; bVal = b.volumeAllTime;
        }
        break;
      case 'sharpe':
        aVal = a.sharpeRatio ?? 0;
        bVal = b.sharpeRatio ?? 0;
        break;
      default:
        aVal = getPnlField(a);
        bVal = getPnlField(b);
    }
    
    if (filters.sortOrder === 'asc') {
      return aVal - bVal;
    }
    return bVal - aVal;
  });
  
  // Limit size
  entries = entries.slice(0, config.maxLeaderboardSize);
  
  // Add rank
  return entries.map((trader, index) => ({
    rank: index + 1,
    trader,
    pnlUsd: getPnlField(trader),
    pnlPercent: getPnlPercentField(trader),
    change24h: 0, // Would need historical rank data
  }));
}

/**
 * Get the leaderboard with optional filters
 */
export function getLeaderboard(filters: Partial<LeaderboardFilters> = {}): LeaderboardEntry[] {
  const defaultFilters: LeaderboardFilters = {
    timeframe: 'all',
    minTrades: config.minTradesForRanking,
    verifiedOnly: config.verificationRequired,
    sortBy: 'pnl_usd',
    sortOrder: 'desc',
    ...filters,
  };
  
  // Use cache if available and filters match default
  const isDefaultFilters = 
    filters.timeframe === 'all' &&
    !filters.minTrades &&
    filters.verifiedOnly === config.verificationRequired &&
    !filters.tags &&
    filters.sortBy === 'pnl_usd' &&
    filters.sortOrder === 'desc';
  
  if (isDefaultFilters && cachedLeaderboard.length > 0) {
    return cachedLeaderboard;
  }
  
  const leaderboard = buildLeaderboard(defaultFilters);
  
  if (isDefaultFilters) {
    cachedLeaderboard = leaderboard;
    lastLeaderboardUpdate = Date.now();
  }
  
  return leaderboard;
}

/**
 * Get leaderboard statistics
 */
export function getLeaderboardStats(): LeaderboardStats {
  if (cachedStats) return cachedStats;
  
  const allTraders = Array.from(traders.values());
  const verifiedTraders = allTraders.filter(t => t.isVerified);
  
  const totalVolume24h = allTraders.reduce((sum, t) => sum + t.volume24h, 0);
  const totalVolumeAllTime = allTraders.reduce((sum, t) => sum + t.volumeAllTime, 0);
  const avgWinRate = allTraders.length > 0
    ? allTraders.reduce((sum, t) => sum + t.winRate, 0) / allTraders.length
    : 0;
  
  const topTrader = allTraders.length > 0
    ? allTraders.reduce((max, t) => t.totalPnlUsd > max.totalPnlUsd ? t : max, allTraders[0])
    : null;
  
  cachedStats = {
    totalTraders: allTraders.length,
    verifiedTraders: verifiedTraders.length,
    totalVolume24h,
    totalVolumeAllTime,
    avgWinRate,
    topTrader,
    lastUpdated: Date.now(),
  };
  
  return cachedStats;
}

/**
 * Get a trader's rank on the leaderboard
 */
export function getTraderRank(wallet: string, filters: Partial<LeaderboardFilters> = {}): number | null {
  const leaderboard = getLeaderboard(filters);
  const entry = leaderboard.find(e => e.trader.wallet === wallet.toLowerCase());
  return entry?.rank ?? null;
}

/**
 * Search traders by username or wallet
 */
export function searchTraders(query: string, limit = 10): VerifiedTrader[] {
  const lowerQuery = query.toLowerCase();
  return Array.from(traders.values())
    .filter(t => 
      t.wallet.includes(lowerQuery) ||
      t.username?.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
    .slice(0, limit);
}

/**
 * Get top traders by various metrics
 */
export function getTopTraders(
  metric: 'pnl' | 'winrate' | 'volume' | 'sharpe',
  timeframe: '24h' | '7d' | '30d' | 'all' = 'all',
  limit = 10
): VerifiedTrader[] {
  let entries = Array.from(traders.values())
    .filter(t => t.totalTrades >= config.minTradesForRanking && t.isVerified);
  
  const getMetricValue = (trader: VerifiedTrader) => {
    switch (metric) {
      case 'pnl':
        switch (timeframe) {
          case '24h': return trader.pnl24h;
          case '7d': return trader.pnl7d;
          case '30d': return trader.pnl30d;
          default: return trader.totalPnlUsd;
        }
      case 'winrate':
        return trader.winRate;
      case 'volume':
        switch (timeframe) {
          case '24h': return trader.volume24h;
          case '7d': return trader.volume7d;
          case '30d': return trader.volume30d;
          default: return trader.volumeAllTime;
        }
      case 'sharpe':
        return trader.sharpeRatio ?? 0;
      default:
        return trader.totalPnlUsd;
    }
  };
  
  entries.sort((a, b) => getMetricValue(b) - getMetricValue(a));
  return entries.slice(0, limit);
}

/**
 * Update leaderboard configuration
 */
export function updateLeaderboardConfig(newConfig: Partial<LeaderboardConfig>): void {
  config = { ...config, ...newConfig };
  invalidateCache();
}

/**
 * Get current leaderboard configuration
 */
export function getLeaderboardConfig(): LeaderboardConfig {
  return { ...config };
}

/**
 * Simulate adding trade data for a trader (for testing/demo)
 * In production, this would be called by an indexer
 */
export function addTradeResult(
  wallet: string,
  pnlUsd: number,
  pnlPercent: number,
  isWin: boolean,
  positionSizeUsd: number
): VerifiedTrader | null {
  const normalizedWallet = wallet.toLowerCase();
  const trader = traders.get(normalizedWallet);
  
  if (!trader) return null;
  
  // Update PnL
  trader.totalPnlUsd += pnlUsd;
  trader.totalPnlPercent = trader.totalPnlUsd / Math.max(1, trader.volumeAllTime) * 100; // Rough calc
  trader.realizedPnlUsd += pnlUsd;
  
  // Update trades
  trader.totalTrades++;
  if (isWin) {
    trader.winningTrades++;
    trader.avgWinUsd = (trader.avgWinUsd * (trader.winningTrades - 1) + pnlUsd) / trader.winningTrades;
  } else {
    trader.losingTrades++;
    trader.avgLossUsd = (trader.avgLossUsd * (trader.losingTrades - 1) + Math.abs(pnlUsd)) / trader.losingTrades;
  }
  
  // Update win rate
  trader.winRate = (trader.winningTrades / trader.totalTrades) * 100;
  
  // Update volume
  trader.volumeAllTime += positionSizeUsd;
  trader.volume24h += positionSizeUsd;
  trader.volume7d += positionSizeUsd;
  trader.volume30d += positionSizeUsd;
  
  // Update position sizes
  trader.maxPositionSizeUsd = Math.max(trader.maxPositionSizeUsd, positionSizeUsd);
  trader.avgPositionSizeUsd = trader.volumeAllTime / trader.totalTrades;
  
  // Update time-based PnL
  trader.pnl24h += pnlUsd;
  trader.pnl7d += pnlUsd;
  trader.pnl30d += pnlUsd;
  trader.pnlAllTime += pnlUsd;
  
  trader.lastTradeAt = Date.now();
  
  traders.set(normalizedWallet, trader);
  invalidateCache();
  
  return trader;
}

/**
 * Reset all data (for testing)
 */
export function resetLeaderboard(): void {
  traders.clear();
  cachedLeaderboard = [];
  cachedStats = null;
  lastLeaderboardUpdate = 0;
  config = { ...DEFAULT_CONFIG };
}

/**
 * Seed with demo data for testing
 */
export function seedDemoData(): void {
  const demoTraders: Array<Partial<VerifiedTrader> & { wallet: string }> = [
    {
      wallet: 'DemoWhale111111111111111111111111111111111111',
      username: 'WhaleHunter',
      isVerified: true,
      verificationLevel: 'full',
      totalPnlUsd: 2_450_000,
      totalPnlPercent: 847,
      winRate: 72.5,
      totalTrades: 1247,
      winningTrades: 904,
      losingTrades: 343,
      avgWinUsd: 3200,
      avgLossUsd: 1100,
      maxDrawdownPercent: 12.3,
      sharpeRatio: 2.8,
      pnl24h: 15_200,
      pnl7d: 87_400,
      pnl30d: 320_000,
      pnlAllTime: 2_450_000,
      volume24h: 450_000,
      volume7d: 2_100_000,
      volume30d: 8_500_000,
      volumeAllTime: 45_000_000,
      riskScore: 25,
      maxPositionSizeUsd: 120_000,
      avgPositionSizeUsd: 36_000,
      firstTradeAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
      lastTradeAt: Date.now() - 2 * 60 * 60 * 1000,
      tags: ['whale', 'smart_money', 'swing'],
      followers: 12_400,
      following: 23,
    },
    {
      wallet: 'SniperKing222222222222222222222222222222222222',
      username: 'SniperKing',
      isVerified: true,
      verificationLevel: 'basic',
      totalPnlUsd: 1_890_000,
      totalPnlPercent: 1250,
      winRate: 68.2,
      totalTrades: 3421,
      winningTrades: 2333,
      losingTrades: 1088,
      avgWinUsd: 1200,
      avgLossUsd: 400,
      maxDrawdownPercent: 8.7,
      sharpeRatio: 3.1,
      pnl24h: 8_700,
      pnl7d: 45_200,
      pnl30d: 180_000,
      pnlAllTime: 1_890_000,
      volume24h: 320_000,
      volume7d: 1_800_000,
      volume30d: 6_200_000,
      volumeAllTime: 32_000_000,
      riskScore: 30,
      maxPositionSizeUsd: 50_000,
      avgPositionSizeUsd: 9_300,
      firstTradeAt: Date.now() - 180 * 24 * 60 * 60 * 1000,
      lastTradeAt: Date.now() - 15 * 60 * 1000,
      tags: ['sniper', 'pump_fun', 'high_freq'],
      followers: 8_900,
      following: 156,
    },
    {
      wallet: 'AlphaSeeker33333333333333333333333333333333333',
      username: 'AlphaSeeker',
      isVerified: false,
      verificationLevel: 'none',
      totalPnlUsd: 980_000,
      totalPnlPercent: 567,
      winRate: 61.8,
      totalTrades: 892,
      winningTrades: 551,
      losingTrades: 341,
      avgWinUsd: 2800,
      avgLossUsd: 1400,
      maxDrawdownPercent: 18.5,
      sharpeRatio: 1.9,
      pnl24h: -2_300,
      pnl7d: 12_400,
      pnl30d: 67_000,
      pnlAllTime: 980_000,
      volume24h: 180_000,
      volume7d: 950_000,
      volume30d: 3_800_000,
      volumeAllTime: 18_000_000,
      riskScore: 42,
      maxPositionSizeUsd: 85_000,
      avgPositionSizeUsd: 20_000,
      firstTradeAt: Date.now() - 240 * 24 * 60 * 60 * 1000,
      lastTradeAt: Date.now() - 4 * 60 * 60 * 1000,
      tags: ['defi', 'yield_farming', 'research'],
      followers: 4_200,
      following: 89,
    },
    {
      wallet: 'DeFiYield4444444444444444444444444444444444444',
      username: 'DeFiYieldMaster',
      isVerified: true,
      verificationLevel: 'full',
      totalPnlUsd: 756_000,
      totalPnlPercent: 342,
      winRate: 78.9,
      totalTrades: 456,
      winningTrades: 360,
      losingTrades: 96,
      avgWinUsd: 2100,
      avgLossUsd: 800,
      maxDrawdownPercent: 5.2,
      sharpeRatio: 2.4,
      pnl24h: 4_100,
      pnl7d: 28_900,
      pnl30d: 95_000,
      pnlAllTime: 756_000,
      volume24h: 120_000,
      volume7d: 680_000,
      volume30d: 2_400_000,
      volumeAllTime: 12_000_000,
      riskScore: 18,
      maxPositionSizeUsd: 40_000,
      avgPositionSizeUsd: 26_000,
      firstTradeAt: Date.now() - 400 * 24 * 60 * 60 * 1000,
      lastTradeAt: Date.now() - 6 * 60 * 60 * 1000,
      tags: ['defi', 'lending', 'stablecoin'],
      followers: 6_100,
      following: 45,
    },
    {
      wallet: 'NewTrader5555555555555555555555555555555555555',
      username: 'NewTrader',
      isVerified: false,
      verificationLevel: 'none',
      totalPnlUsd: 12_500,
      totalPnlPercent: 23.4,
      winRate: 54.2,
      totalTrades: 87,
      winningTrades: 47,
      losingTrades: 40,
      avgWinUsd: 420,
      avgLossUsd: 280,
      maxDrawdownPercent: 35.8,
      sharpeRatio: 0.8,
      pnl24h: -450,
      pnl7d: 1_200,
      pnl30d: 4_500,
      pnlAllTime: 12_500,
      volume24h: 15_000,
      volume7d: 85_000,
      volume30d: 320_000,
      volumeAllTime: 850_000,
      riskScore: 68,
      maxPositionSizeUsd: 12_000,
      avgPositionSizeUsd: 9_700,
      firstTradeAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      lastTradeAt: Date.now() - 30 * 60 * 1000,
      tags: ['beginner', 'learning'],
      followers: 42,
      following: 120,
    },
  ];
  
  for (const t of demoTraders) {
    upsertTrader(t);
  }
}

// Export types
export type { LeaderboardConfig, VerifiedTrader, LeaderboardEntry, LeaderboardFilters, LeaderboardStats };