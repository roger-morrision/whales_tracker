// Moby global client state — Zustand store
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  TOKENS,
  TRADERS,
  SIGNALS,
  WHALE_FLOWS,
  PORTFOLIO,
  fmtUsd,
  fmtPrice,
  type Token,
  type Trader,
  type SmartSignal,
  type WhaleFlow,
  nextPriceTick,
} from "./moby-data";

export type TabKey = "discover" | "whales" | "signals" | "portfolio" | "profile";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  pending?: boolean;
  suggestedTokens?: string[]; // token ids
}

export interface ToastLike {
  id: string;
  title: string;
  description?: string;
  type: "info" | "success" | "warn" | "alert";
}

// Toast notifications (transient popups)
export interface ToastItem {
  id: string;
  ts: number;
  title: string;
  description?: string;
  type: "info" | "success" | "warn" | "alert";
  actionLabel?: string;
  actionId?: string; // token id or trader id for action
  // Quick-buy secondary action — opens trade modal pre-filled
  quickBuyLabel?: string; // e.g. "Buy 0.1 SOL"
  quickBuyTokenId?: string;
  quickBuyAmountUsd?: number;
}

// ===== NEW types =====
export type Chain = "SOL" | "ETH" | "BASE" | "BTC";
export type Category = "DeFi" | "Meme" | "AI" | "L1" | "L2" | "Gaming" | "DePIN" | "RWA" | "NFT" | "Stablecoin";

export interface ScreenerFilters {
  chains: Chain[];
  categories: Category[];
  minLiquidity: number; // USD
  minSmartMoneyHolders: number;
  maxAgeHours: number; // 0 = no limit
  minVolume24h: number;
  sortBy: "trending" | "gainers" | "newest" | "smartMoney" | "volume" | "liquidity";
  search: string;
}

export const DEFAULT_SCREENER_FILTERS: ScreenerFilters = {
  chains: [],
  categories: [],
  minLiquidity: 0,
  minSmartMoneyHolders: 0,
  maxAgeHours: 0,
  minVolume24h: 0,
  sortBy: "trending",
  search: "",
};

export interface CustomAlert {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  condition: "price_above" | "price_below" | "smart_money_inflow" | "smart_money_outflow" | "new_whale_buy";
  threshold: number; // USD value or price
  channels: ("push" | "email" | "telegram")[];
  createdAt: number;
  active: boolean;
  triggered: boolean;
}

export interface AppSettings {
  defaultSlippage: number; // percent
  defaultGas: "slow" | "standard" | "fast";
  priorityFee: number; // micro-lamports
  showHiddenTokens: boolean;
  hideSmallBalances: boolean;
  smallBalanceThreshold: number;
  notifications: {
    smartMoneyEntry: boolean;
    whaleAccumulation: boolean;
    priceAlerts: boolean;
    newTokenLaunch: boolean;
    portfolioMilestones: boolean;
    weeklyDigest: boolean;
  };
  privacy: {
    hideBalances: boolean;
    blockTransactionTracking: boolean;
  };
  display: {
    currency: "USD" | "EUR" | "JPY" | "CNY";
    theme: "dark" | "system";
    compactMode: boolean;
    showSparklines: boolean;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultSlippage: 1.0,
  defaultGas: "fast",
  priorityFee: 0.001,
  showHiddenTokens: false,
  hideSmallBalances: true,
  smallBalanceThreshold: 10,
  notifications: {
    smartMoneyEntry: true,
    whaleAccumulation: true,
    priceAlerts: true,
    newTokenLaunch: true,
    portfolioMilestones: true,
    weeklyDigest: false,
  },
  privacy: {
    hideBalances: false,
    blockTransactionTracking: false,
  },
  display: {
    currency: "USD",
    theme: "dark",
    compactMode: false,
    showSparklines: true,
  },
};

// ===== Enhancement: Portfolio / Trade / Achievement / Watchlist Alert types =====
export interface PortfolioHolding {
  tokenId: string;
  amount: number; // token amount
  costUsd: number; // total cost basis in USD
}

export interface TradeRecord {
  id: string;
  ts: number;
  tokenId: string;
  tokenSymbol: string;
  side: "BUY" | "SELL";
  usdAmount: number;
  tokenAmount: number;
  price: number;
  txHash?: string;
}

export interface AchievementState {
  id: string;
  unlocked: boolean;
  unlockedAt?: number;
  progress: number; // 0..1
}

export interface WatchlistAlertConfig {
  priceAbove?: number;
  priceBelow?: number;
  smartMoneyEntry?: boolean;
  move10?: boolean;
}

// ===== Enhancement #13: Snipe-bot rule type =====
export interface SnipeRule {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
  conditions: {
    maxDevHoldPct: number;        // reject if dev holds more than X%
    minLiquidityUsd: number;      // require at least $X liquidity
    maxAgeMinutes: number;        // only snipe tokens launched <Xm ago
    minSmartMoneyHolders: number; // require at least X smart-money holders
    renouncedOnly: boolean;       // require mint authority revoked
    maxRugRatio: number;          // 0-1, reject if rug_ratio > X
  };
  actions: {
    buyUsd: number;               // buy $X worth
    slippagePct: number;
    autoTakeProfitPct: number;    // auto-sell if price rises X%
    autoStopLossPct: number;      // auto-sell if price drops X%
    autoExecute: boolean;         // if true, auto-fire the buy on match; if false, only push toast
  };
  stats: {
    triggered: number;
    filled: number;
    pnl: number;
  };
}

// ===== Enhancement #12: Trailing stop type =====
export interface TrailingStopConfig {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  trailPct: number;             // % below peak to trigger sell (e.g. 10 = sell if price drops 10% from peak)
  buyUsd: number;               // notional to sell
  peakPrice: number;            // highest price seen since trailing-stop was created
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  triggeredPrice?: number;
  minHoldMs?: number;           // minimum hold time before stop can trigger (default 30s)
}

// Default portfolio holdings seeded from the static PORTFOLIO cryptoHoldings.
// These get mutated by trades; if no trades have happened, this matches the
// previous static display exactly.
function initialPortfolioHoldings(): PortfolioHolding[] {
  return (PORTFOLIO.cryptoHoldings || []).map((h) => ({
    tokenId: h.tokenId,
    amount: h.amount,
    costUsd: h.amount * (h.avgCost ?? 0),
  }));
}

const DEFAULT_ACHIEVEMENTS: AchievementState[] = [
  { id: "first_trade", unlocked: false, progress: 0 },
  { id: "first_save", unlocked: false, progress: 0 },
  { id: "first_alert", unlocked: false, progress: 0 },
  { id: "first_follow", unlocked: false, progress: 0 },
  { id: "ten_trades", unlocked: false, progress: 0 },
  { id: "whale_spotter", unlocked: false, progress: 0 },
  { id: "early_adopter", unlocked: true, progress: 1, unlockedAt: Date.now() },
  { id: "portfolio_10k", unlocked: false, progress: 0 },
  { id: "portfolio_100k", unlocked: false, progress: 0 },
  { id: "diversified", unlocked: false, progress: 0 },
];

const ACHIEVEMENT_LABELS: Record<string, string> = {
  first_trade: "First Trade — Welcome aboard!",
  first_save: "First Signal Saved — Building your playbook",
  first_alert: "First Alert — You'll never miss a move",
  first_follow: "First Follow — Tracking smart money",
  ten_trades: "Ten Trades — Getting into the rhythm",
  whale_spotter: "Whale Spotter — Spotted 5 whale flows",
  early_adopter: "Early Adopter — Joined Moby early",
  portfolio_10k: "Portfolio $10K — Crossing five figures",
  portfolio_100k: "Portfolio $100K — Six-figure milestone",
  diversified: "Diversified — Holding 5+ tokens",
};

function achievementLabel(id: string): string {
  return ACHIEVEMENT_LABELS[id] ?? `Achievement: ${id}`;
}

interface MobyState {
  // navigation
  activeTab: TabKey;
  setActiveTab: (t: TabKey) => void;

  // ===== Enhancement #18: Chain switcher =====
  selectedChain: "sol" | "base" | "eth" | "bsc";
  setSelectedChain: (chain: "sol" | "base" | "eth" | "bsc") => void;

  // live prices keyed by token id
  prices: Record<string, { price: number; prev: number; ts: number }>;
  tickPrices: () => void;
  setPrice: (id: string, price: number) => void;

  // selected token (opens detail sheet)
  selectedTokenId: string | null;
  openToken: (id: string | null) => void;
  // External token (not in static TOKENS) — stores full token data for in-app viewing
  externalTokenData: any | null;
  viewExternalToken: (data: any) => void;
  clearExternalToken: () => void;

  // selected trader (opens trader sheet)
  selectedTraderId: string | null;
  openTrader: (id: string | null) => void;
  // Track unique traders viewed (for "whale_spotter" achievement)
  viewedTraders: string[];
  markTraderViewed: (id: string) => void;

  // ===== Enhancement: Followed wallets (for per-wallet push alerts) =====
  followedWallets: string[]; // wallet addresses (capped at 10)
  toggleFollowWallet: (address: string, label?: string) => void;
  followedWalletLabels: Record<string, string>; // address -> label
  lastSeenWalletTx: Record<string, string>; // address -> last seen tx hash (for "new tx" detection)

  // watchlist (token ids)
  watchlist: string[];
  toggleWatch: (id: string) => void;

  // followed traders
  followedTraders: string[];
  toggleFollow: (id: string) => void;

  // signal dismissal / save
  savedSignals: string[];
  dismissedSignals: string[];
  toggleSaveSignal: (id: string) => void;
  dismissSignal: (id: string) => void;

  // AI copilot
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  chat: ChatMessage[];
  sendChat: (content: string) => void;
  clearChat: () => void;

  // search modal
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // notifications panel
  notifOpen: boolean;
  setNotifOpen: (open: boolean) => void;

  // toasts / live alerts feed
  alerts: ToastLike[];
  pushAlert: (a: Omit<ToastLike, "id">) => void;
  dismissAlert: (id: string) => void;

  // live data feeds
  signals: SmartSignal[];
  flows: WhaleFlow[];

  // refresh feeds (simulated)
  refreshFeeds: () => void;

  // ===== NEW: Wallet connect =====
  walletOpen: boolean;
  setWalletOpen: (open: boolean) => void;
  wallet: { connected: boolean; address: string; label: string; balanceUsd: number } | null;
  connectWallet: (label: string, address?: string) => void;
  disconnectWallet: () => void;

  // ===== NEW: Token screener =====
  screenerOpen: boolean;
  setScreenerOpen: (open: boolean) => void;
  screenerFilters: ScreenerFilters;
  setScreenerFilters: (f: Partial<ScreenerFilters>) => void;
  resetScreenerFilters: () => void;

  // ===== NEW: Trade / swap modal =====
  tradeOpen: boolean;
  tradeTokenId: string | null;
  tradeSide: "BUY" | "SELL";
  tradePrefillUsd: number | null; // pre-fill amount (consumed by TradeModal on open)
  openTrade: (tokenId: string, side: "BUY" | "SELL", prefillUsd?: number) => void;
  closeTrade: () => void;

  // ===== NEW: Tax calculator =====
  taxOpen: boolean;
  setTaxOpen: (open: boolean) => void;

  // ===== NEW: Custom alert creator =====
  alertCreatorOpen: boolean;
  alertCreatorTokenId: string | null;
  openAlertCreator: (tokenId: string | null) => void;
  closeAlertCreator: () => void;
  customAlerts: CustomAlert[];
  addCustomAlert: (a: Omit<CustomAlert, "id" | "createdAt">) => void;
  removeCustomAlert: (id: string) => void;
  triggerCustomAlert: (id: string) => void;

  // ===== NEW: Settings =====
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;

  // ===== NEW: Onboarding =====
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;

  // ===== NEW: Token comparison =====
  compareOpen: boolean;
  compareIds: string[];
  setCompareOpen: (open: boolean) => void;
  toggleCompareId: (id: string) => void;
  clearCompare: () => void;

  // ===== BATCH 3: Copy trading =====
  copyTradeOpen: boolean;
  setCopyTradeOpen: (open: boolean) => void;
  copyTrades: CopyTradeConfig[];
  addCopyTrade: (c: Omit<CopyTradeConfig, "id" | "createdAt">) => void;
  removeCopyTrade: (id: string) => void;
  toggleCopyTrade: (id: string) => void;
  updateCopyTrade: (id: string, patch: Partial<CopyTradeConfig>) => void;
  executeCopyTrade: (input: {
    copyTradeId: string;
    tokenId: string;
    tokenSymbol: string;
    side: "BUY" | "SELL";
    usdAmount: number;
    price: number;
  }) => boolean;

  // ===== BATCH 3: Limit orders =====
  limitOrdersOpen: boolean;
  setLimitOrdersOpen: (open: boolean) => void;
  limitOrders: LimitOrder[];
  addLimitOrder: (o: Omit<LimitOrder, "id" | "createdAt">) => void;
  cancelLimitOrder: (id: string) => void;

  // ===== BATCH 3: DCA scheduler =====
  dcaOpen: boolean;
  setDcaOpen: (open: boolean) => void;
  dcaStrategies: DcaStrategy[];
  addDcaStrategy: (s: Omit<DcaStrategy, "id" | "createdAt" | "nextRun" | "totalInvested" | "runs">) => void;
  removeDcaStrategy: (id: string) => void;
  toggleDcaStrategy: (id: string) => void;

  // ===== BATCH 3: Wallet activity =====
  walletActivityOpen: boolean;
  setWalletActivityOpen: (open: boolean) => void;

  // ===== BATCH 3: Solana stats =====
  solanaStatsOpen: boolean;
  setSolanaStatsOpen: (open: boolean) => void;

  // ===== BATCH 3: PNL leaderboard =====
  pnlLeaderboardOpen: boolean;
  setPnlLeaderboardOpen: (open: boolean) => void;

  // ===== BATCH 3: Social sentiment =====
  socialOpen: boolean;
  setSocialOpen: (open: boolean) => void;

  // ===== BATCH 3: Rebalancing =====
  rebalanceOpen: boolean;
  setRebalanceOpen: (open: boolean) => void;

  // ===== BATCH 3: Referral =====
  referralOpen: boolean;
  setReferralOpen: (open: boolean) => void;

  // ===== BATCH 3: Achievements detail =====
  achievementsOpen: boolean;
  setAchievementsOpen: (open: boolean) => void;

  // ===== BATCH 4: Perpetuals =====
  perpsOpen: boolean;
  setPerpsOpen: (open: boolean) => void;
  selectedPerpId: string | null;
  openPerp: (id: string | null) => void;

  // ===== BATCH 4: NFT detail =====
  nftDetailOpen: boolean;
  setNftDetailOpen: (open: boolean) => void;
  selectedNftId: string | null;
  openNft: (id: string | null) => void;

  // ===== BATCH 4: Launch scanner =====
  launchScannerOpen: boolean;
  setLaunchScannerOpen: (open: boolean) => void;

  // ===== BATCH 4: Bridge =====
  bridgeOpen: boolean;
  setBridgeOpen: (open: boolean) => void;

  // ===== BATCH 4: Staking =====
  stakingOpen: boolean;
  setStakingOpen: (open: boolean) => void;

  // ===== BATCH 4: Gas optimizer =====
  gasOptimizerOpen: boolean;
  setGasOptimizerOpen: (open: boolean) => void;

  // ===== BATCH 4: Airdrop center =====
  airdropOpen: boolean;
  setAirdropOpen: (open: boolean) => void;
  claimedAirdrops: string[];
  claimAirdrop: (id: string) => void;

  // ===== BATCH 4: Toast notifications =====
  toasts: ToastItem[];
  pushToast: (t: Omit<ToastItem, "id" | "ts">) => void;
  dismissToast: (id: string) => void;

  // ===== BATCH 5: Full-screen chart =====
  chartOpen: boolean;
  chartTokenId: string | null;
  openChart: (tokenId: string) => void;
  closeChart: () => void;

  // ===== BATCH 5: Narrative detail =====
  narrativeDetailOpen: boolean;
  selectedNarrativeId: string | null;
  openNarrative: (id: string | null) => void;
  setNarrativeDetailOpen: (open: boolean) => void;

  // ===== BATCH 5: Smart money map =====
  smartMoneyMapOpen: boolean;
  setSmartMoneyMapOpen: (open: boolean) => void;

  // ===== BATCH 5: Push notifications =====
  pushPermission: "default" | "granted" | "denied";
  requestPushPermission: () => void;
  setPushPermission: (p: "default" | "granted" | "denied") => void;

  // ===== BATCH 6: Portfolio analytics =====
  analyticsOpen: boolean;
  setAnalyticsOpen: (open: boolean) => void;

  // ===== BATCH 6: Yield farming =====
  yieldOpen: boolean;
  setYieldOpen: (open: boolean) => void;

  // ===== BATCH 6: Token unlocks =====
  unlocksOpen: boolean;
  setUnlocksOpen: (open: boolean) => void;

  // ===== BATCH 6: Governance =====
  governanceOpen: boolean;
  setGovernanceOpen: (open: boolean) => void;
  votedProposals: Record<string, "for" | "against" | "abstain">;
  vote: (proposalId: string, vote: "for" | "against" | "abstain") => void;

  // ===== BATCH 6: DeFi positions =====
  defiOpen: boolean;
  setDefiOpen: (open: boolean) => void;

  // ===== BATCH 6: Market calendar =====
  calendarOpen: boolean;
  setCalendarOpen: (open: boolean) => void;

  // ===== BATCH 6: Transaction simulator =====
  simulatorOpen: boolean;
  setSimulatorOpen: (open: boolean) => void;

  // ===== BATCH 6: Multi-wallet manager =====
  multiWalletOpen: boolean;
  setMultiWalletOpen: (open: boolean) => void;
  activeWalletId: string;
  setActiveWalletId: (id: string) => void;

  // ===== BATCH 6: Watchlist performance =====
  watchlistPerfOpen: boolean;
  setWatchlistPerfOpen: (open: boolean) => void;

  // ===== BATCH 6: Theme toggle =====
  theme: "dark" | "light";
  toggleTheme: () => void;

  // ===== BATCH 7: Token security audit =====
  securityAuditOpen: boolean;
  securityAuditTokenId: string | null;
  openSecurityAudit: (tokenId: string) => void;
  setSecurityAuditOpen: (open: boolean) => void;

  // ===== BATCH 7: Tokenized stocks =====
  stocksOpen: boolean;
  setStocksOpen: (open: boolean) => void;

  // ===== BATCH 7: Wallet PnL tracker =====
  walletPnlOpen: boolean;
  walletPnlAddress: string;
  setWalletPnlOpen: (open: boolean) => void;
  setWalletPnlAddress: (addr: string) => void;

  // ===== BATCH 7: Snipe bot =====
  snipeBotOpen: boolean;
  setSnipeBotOpen: (open: boolean) => void;

  // ===== BATCH 7: Price prediction =====
  predictionOpen: boolean;
  predictionTokenId: string | null;
  openPrediction: (tokenId: string) => void;
  setPredictionOpen: (open: boolean) => void;

  // ===== BATCH 7: Liquidity depth =====
  liquidityDepthOpen: boolean;
  liquidityDepthTokenId: string | null;
  openLiquidityDepth: (tokenId: string) => void;
  setLiquidityDepthOpen: (open: boolean) => void;

  // ===== BATCH 7: Trading journal =====
  journalOpen: boolean;
  setJournalOpen: (open: boolean) => void;

  // ===== BATCH 7: DeFi health monitor =====
  defiHealthOpen: boolean;
  setDefiHealthOpen: (open: boolean) => void;

  // ===== BATCH 7: Tax loss harvesting =====
  harvestOpen: boolean;
  setHarvestOpen: (open: boolean) => void;

  // ===== BATCH 8: Trailing stops =====
  trailingStopsOpen: boolean;
  setTrailingStopsOpen: (open: boolean) => void;

  // ===== BATCH 8: Hot wallets =====
  hotWalletsOpen: boolean;
  setHotWalletsOpen: (open: boolean) => void;

  // ===== BATCH 8: Token migrations =====
  migrationsOpen: boolean;
  setMigrationsOpen: (open: boolean) => void;

  // ===== BATCH 8: MEV protection info =====
  mevInfoOpen: boolean;
  setMevInfoOpen: (open: boolean) => void;

  // ===== BATCH 8: Wallet import =====
  walletImportOpen: boolean;
  setWalletImportOpen: (open: boolean) => void;

  // ===== BATCH 8: Watchlist alerts =====
  watchlistAlertsOpen: boolean;
  setWatchlistAlertsOpen: (open: boolean) => void;

  // Recently viewed tokens
  recentlyViewed: string[];
  addRecentlyViewed: (id: string) => void;

  // ===== BATCH 9: Pump.fun explorer =====
  pumpFunOpen: boolean;
  setPumpFunOpen: (open: boolean) => void;

  // ===== Enhancement: Discover "More" panels modal =====
  discoverMoreOpen: boolean;
  setDiscoverMoreOpen: (open: boolean) => void;

  // ===== Enhancement: Token list modal (for "View all" buttons) =====
  tokenListOpen: boolean;
  tokenListConfig: { title: string; endpoint: string } | null;
  openTokenList: (config: { title: string; endpoint: string }) => void;
  setTokenListOpen: (open: boolean) => void;

  // ===== Enhancement: Wallet detail sheet (for clicking wallets/holders/traders) =====
  walletDetailOpen: boolean;
  walletDetailAddress: string | null;
  walletDetailLabel: string;
  openWalletDetail: (address: string, label?: string) => void;
  setWalletDetailOpen: (open: boolean) => void;

  // ===== Enhancement: Portfolio holdings (persisted, mutated by trades) =====
  portfolioHoldings: PortfolioHolding[];
  applyTrade: (input: {
    tokenId: string;
    side: "BUY" | "SELL";
    usdAmount: number;
    tokenAmount: number;
    price: number;
  }) => void;

  // ===== Enhancement: Trade history (persisted) =====
  tradeHistory: TradeRecord[];
  recordTrade: (trade: Omit<TradeRecord, "id" | "ts">) => void;

  // ===== Enhancement: Achievements (persisted, unlocked by activity) =====
  achievements: AchievementState[];
  unlockAchievement: (id: string) => void;
  isAchievementUnlocked: (id: string) => boolean;

  // ===== Enhancement: Per-token watchlist alerts (persisted) =====
  watchlistAlerts: Record<string, WatchlistAlertConfig>;
  setWatchlistAlert: (tokenId: string, cfg: Partial<WatchlistAlertConfig>) => void;
  removeWatchlistAlert: (tokenId: string) => void;

  // ===== Enhancement #13: Snipe-bot rules (persisted) =====
  snipeRules: SnipeRule[];
  addSnipeRule: (rule: Omit<SnipeRule, "id" | "createdAt" | "stats" | "enabled">) => void;
  updateSnipeRule: (id: string, patch: Partial<SnipeRule>) => void;
  removeSnipeRule: (id: string) => void;
  toggleSnipeRule: (id: string) => void;
  recordSnipeTrigger: (id: string, filled: boolean, pnlUsd: number) => void;

  // ===== Enhancement #12: Trailing stops (persisted) =====
  trailingStops: TrailingStopConfig[];
  addTrailingStop: (cfg: Omit<TrailingStopConfig, "id" | "createdAt" | "peakPrice" | "triggered">) => void;
  removeTrailingStop: (id: string) => void;
  updateTrailingPeak: (tokenId: string, price: number) => void;
  fireTrailingStop: (id: string) => void;

  // ===== Enhancement: Global Share modal (store-driven) =====
  shareOpen: boolean;
  shareData: { title: string; description: string; url?: string };
  openShare: (data: { title: string; description: string; url?: string }) => void;
  setShareOpen: (open: boolean) => void;
}

// ===== BATCH 3 types =====
export interface CopyTradeConfig {
  id: string;
  traderId: string;
  traderHandle: string;
  traderGlyph: string;
  traderColor: string;
  enabled: boolean;
  maxPerTradeUsd: number;
  dailyLimitUsd: number;
  totalAllocatedUsd: number;
  totalCopiedUsd: number;
  tradesCopied: number;
  slippage: number;
  onlyBuy: boolean;
  minTraderScore: number;
  createdAt: number;
  // Dedup: track the last mirrored trade so we don't double-execute
  lastMirroredTxHash?: string;
  lastMirroredAt?: number;
}

export interface LimitOrder {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  side: "BUY" | "SELL";
  targetPrice: number;
  amountUsd: number;
  expiry: "1d" | "7d" | "30d" | "90d" | "gtc";
  status: "open" | "filled" | "cancelled" | "expired";
  createdAt: number;
  filledAt?: number;
  fillPrice?: number;
}

export interface DcaStrategy {
  id: string;
  name: string;
  tokenIds: string[];
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  amountUsd: number;
  enabled: boolean;
  totalInvested: number;
  runs: number;
  nextRun: number; // timestamp
  createdAt: number;
}

const initialPrices: Record<string, { price: number; prev: number; ts: number }> = {};
TOKENS.forEach((t) => {
  initialPrices[t.id] = { price: t.price, prev: t.price, ts: 0 };
});

// Use a fixed timestamp for the initial chat message — avoids SSR/CSR hydration mismatch.
// Once the user interacts, ts is updated to Date.now() on the client only.
const initialChat: ChatMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content:
      "Hey — I'm Moby, your on-chain copilot. Ask me to analyze a token, validate a trade idea, or summarize what smart money is doing right now.",
    ts: 0,
    suggestedTokens: ["wif", "jup", "io"],
  },
];

let chatIdCounter = 0;
function nextChatId(): string {
  chatIdCounter += 1;
  return `c-${chatIdCounter}`;
}

// Very small heuristic "AI" response generator (client-side, deterministic-ish).
function generateAssistantReply(userText: string): { content: string; suggestedTokens?: string[] } {
  const lower = userText.toLowerCase();
  // Try to find a token mentioned in the user message.
  const matched = TOKENS.find(
    (t) =>
      lower.includes(`$${t.symbol.toLowerCase()}`) ||
      lower.includes(t.symbol.toLowerCase()) ||
      lower.includes(t.name.toLowerCase())
  );

  if (matched) {
    const bull = matched.change24h >= 0;
    const inflowAbs = Math.abs(matched.smartMoneyInflow24h);
    const inflowStr =
      inflowAbs >= 1_000_000
        ? `$${(inflowAbs / 1_000_000).toFixed(2)}M`
        : `$${(inflowAbs / 1000).toFixed(0)}K`;
    const smart =
      matched.smartMoneyInflow24h >= 0
        ? `Smart money has net ${bull ? "accumulated" : "distributed"} ${inflowStr} over the last 24h across ${matched.smartMoneyHolders} tracked wallets.`
        : `Smart money has net distributed ${inflowStr} over the last 24h.`;
    return {
      content: `${matched.name} (${matched.symbol}) is trading at $${matched.price.toFixed(
        matched.price < 1 ? 4 : 2
      )}, ${bull ? "up" : "down"} ${Math.abs(matched.change24h).toFixed(2)}% in 24h. ${smart} ${
        matched.smartMoneyHolders >= 100
          ? "That's a healthy concentration of smart money."
          : "Smart money concentration is low — proceed with caution."
      } Liquidity: $${(matched.liquidity / 1_000_000).toFixed(1)}M. Volume 24h: $${(
          matched.volume24h / 1_000_000
        ).toFixed(0)}M.`,
      suggestedTokens: [matched.id],
    };
  }

  if (lower.includes("portfolio")) {
    return {
      content:
        "Your portfolio is up 4.2% in the last 24h, led by WIF (+14.3%) and BONK (+22.1%). Your largest concentration is SOL at 32% — consider trimming if you want to reduce L1 beta. You have 3 untracked smart-money alerts waiting in your Signals tab.",
    };
  }
  if (lower.includes("smart money") || lower.includes("whale")) {
    return {
      content:
        "Over the last hour, smart money has been accumulating WIF, MNGO, and IO. The strongest signal is on MNGO — 7 wallets clustered in within 60 minutes for $1.24M inflow. Want me to open the MNGO detail?",
      suggestedTokens: ["mngo", "wif", "io"],
    };
  }
  if (lower.includes("trend") || lower.includes("narrative")) {
    return {
      content:
        "Top narrative today is Cat Coins (+64%), driven by MOON launching 18h ago. Meme Season (+28%) and AI Agents (+12%) are also strong. DePIN is flat.",
      suggestedTokens: ["moon", "popcat", "io"],
    };
  }
  if (lower.includes("tax")) {
    return {
      content:
        "I can help estimate your crypto taxes. Based on your realized activity this year, you have ~$18.4K in short-term gains and $4.2K in long-term gains. Want me to break it down by chain?",
    };
  }
  return {
    content:
      "I can analyze tokens, summarize smart money flow, validate trade ideas, check your portfolio, or estimate taxes. Try asking about a specific token like $WIF or $JUP, or just say \"what's smart money doing?\"",
    suggestedTokens: ["wif", "jup", "io"],
  };
}

export const useMoby = create<MobyState>()(
  persist(
    (set, get) => ({
  activeTab: "discover",
  setActiveTab: (t) => set({ activeTab: t }),

  // ===== Enhancement #18: Chain switcher =====
  selectedChain: "sol",
  setSelectedChain: (chain) => {
    set({ selectedChain: chain });
    get().pushToast({
      title: `Switched to ${chain.toUpperCase()}`,
      description: chain === "sol"
        ? "Solana chain — pump.fun, Raydium, Orca"
        : chain === "base"
        ? "Base chain — Aerodrome, Uniswap V3"
        : chain === "eth"
        ? "Ethereum mainnet — Uniswap, Sushi"
        : "BSC — PancakeSwap, Four.meme",
      type: "info",
    });
  },

  prices: initialPrices,
  tickPrices: () => {
    const cur = get().prices;
    const next: typeof cur = {};
    Object.keys(cur).forEach((id) => {
      const p = cur[id];
      const np = nextPriceTick(p.price, 0.003);
      next[id] = { price: np, prev: p.price, ts: Date.now() };
    });
    set({ prices: next });
  },
  setPrice: (id, price) =>
    set((s) => ({
      prices: {
        ...s.prices,
        [id]: { price, prev: s.prices[id]?.price ?? price, ts: Date.now() },
      },
    })),

  selectedTokenId: null,
  openToken: (id) => set((s) => ({
    selectedTokenId: id,
    recentlyViewed: id ? [id, ...s.recentlyViewed.filter((x) => x !== id)].slice(0, 10) : s.recentlyViewed,
    externalTokenData: id ? null : s.externalTokenData,
  })),
  // ===== Enhancement: External token viewing (for DexScreener tokens not in static list) =====
  externalTokenData: null,
  viewExternalToken: (data) => set({
    externalTokenData: data,
    selectedTokenId: `ext_${data.address}`,
  }),
  clearExternalToken: () => set({ externalTokenData: null, selectedTokenId: null }),

  selectedTraderId: null,
  openTrader: (id) => {
    set({ selectedTraderId: id });
    if (id) {
      get().markTraderViewed(id);
    }
  },
  viewedTraders: [],
  markTraderViewed: (id) => {
    let becameNew = false;
    set((s) => {
      if (s.viewedTraders.includes(id)) return {};
      becameNew = true;
      const next = [...s.viewedTraders, id].slice(-100);
      // Update whale_spotter progress
      const progress = Math.min(1, next.length / 5);
      return {
        viewedTraders: next,
        achievements: s.achievements.map((a) =>
          a.id === "whale_spotter" && !a.unlocked
            ? progress >= 1
              ? { ...a, unlocked: true, unlockedAt: Date.now(), progress: 1 }
              : { ...a, progress }
            : a
        ),
      };
    });
    if (becameNew && get().viewedTraders.length >= 5) {
      get().unlockAchievement("whale_spotter");
    }
  },

  // ===== Enhancement: Followed wallets (per-wallet push alerts) =====
  followedWallets: [],
  followedWalletLabels: {},
  lastSeenWalletTx: {},
  toggleFollowWallet: (address, label) => {
    set((s) => {
      const isFollowing = s.followedWallets.includes(address);
      if (isFollowing) {
        // Unfollow — remove from list, labels, and lastSeen
        const newLabels = { ...s.followedWalletLabels };
        delete newLabels[address];
        const newLastSeen = { ...s.lastSeenWalletTx };
        delete newLastSeen[address];
        return {
          followedWallets: s.followedWallets.filter((w) => w !== address),
          followedWalletLabels: newLabels,
          lastSeenWalletTx: newLastSeen,
        };
      }
      // Follow — cap at 10
      if (s.followedWallets.length >= 10) {
        return {}; // at limit
      }
      return {
        followedWallets: [...s.followedWallets, address],
        followedWalletLabels: { ...s.followedWalletLabels, [address]: label || "Wallet" },
      };
    });
    const isNowFollowing = get().followedWallets.includes(address);
    if (isNowFollowing) {
      get().pushAlert({
        title: "Following wallet",
        description: "You'll get a push alert when this wallet makes a trade.",
        type: "info",
      });
    }
  },

  watchlist: ["wif", "jup", "io", "mngo"],
  toggleWatch: (id) =>
    set((s) => ({
      watchlist: s.watchlist.includes(id)
        ? s.watchlist.filter((w) => w !== id)
        : [...s.watchlist, id],
    })),

  followedTraders: TRADERS.filter((t) => t.following).map((t) => t.id),
  toggleFollow: (id) => {
    let becameFollowing = false;
    set((s) => {
      const isFollowing = s.followedTraders.includes(id);
      becameFollowing = !isFollowing;
      return {
        followedTraders: isFollowing
          ? s.followedTraders.filter((w) => w !== id)
          : [...s.followedTraders, id],
      };
    });
    if (becameFollowing) {
      get().unlockAchievement("first_follow");
      get().pushAlert({
        title: "Following trader",
        description: "You'll see their activity in your feeds.",
        type: "info",
      });
    }
  },

  savedSignals: [],
  dismissedSignals: [],
  toggleSaveSignal: (id) => {
    let becameSaved = false;
    set((s) => {
      const isSaved = s.savedSignals.includes(id);
      becameSaved = !isSaved;
      return {
        savedSignals: isSaved
          ? s.savedSignals.filter((x) => x !== id)
          : [...s.savedSignals, id],
      };
    });
    if (becameSaved) {
      get().unlockAchievement("first_save");
    }
  },
  dismissSignal: (id) =>
    set((s) => ({ dismissedSignals: [...s.dismissedSignals, id].slice(-200) })),

  copilotOpen: false,
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  chat: initialChat,
  sendChat: (content) => {
    const userMsg: ChatMessage = {
      id: nextChatId(),
      role: "user",
      content,
      ts: typeof window === "undefined" ? 0 : Date.now(),
    };
    const pendingId = nextChatId();
    const pending: ChatMessage = {
      id: pendingId,
      role: "assistant",
      content: "",
      ts: typeof window === "undefined" ? 0 : Date.now(),
      pending: true,
    };
    set((s) => ({ chat: [...s.chat, userMsg, pending] }));

    // Try real LLM API first, fall back to heuristic
    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: get().chat
              .filter((m) => !m.pending && m.content)
              .slice(-6) // Last 6 messages for context
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json();
        set((s) => ({
          chat: s.chat.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  pending: false,
                  content: data.content,
                  suggestedTokens: data.suggestedTokens,
                  ts: Date.now(),
                }
              : m
          ),
        }));
      } catch {
        // Fallback to heuristic
        const reply = generateAssistantReply(content);
        set((s) => ({
          chat: s.chat.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  pending: false,
                  content: reply.content,
                  suggestedTokens: reply.suggestedTokens,
                  ts: Date.now(),
                }
              : m
          ),
        }));
      }
    })();
  },
  clearChat: () => set({ chat: initialChat }),

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  notifOpen: false,
  setNotifOpen: (open) => set({ notifOpen: open }),

  alerts: [
    {
      id: "a1",
      title: "Smart money entered MNGO",
      description: "7 wallets accumulated $1.24M in the last hour",
      type: "alert",
    },
    {
      id: "a2",
      title: "WIF +14% in 24h",
      description: "Your position is up $11.2K",
      type: "success",
    },
    {
      id: "a3",
      title: "New token: MOON",
      description: "3 smart wallets bought within 12 minutes of launch",
      type: "alert",
    },
  ],
  pushAlert: (a) =>
    set((s) => ({
      alerts: [{ ...a, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...s.alerts].slice(0, 50),
    })),
  dismissAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((x) => x.id !== id) })),

  signals: SIGNALS,
  flows: WHALE_FLOWS,

  refreshFeeds: () => {
    // Shuffle flows and signals timestamps to simulate "new" live activity.
    const flows = [...get().flows].map((f, i) => ({
      ...f,
      id: `wf-${Date.now()}-${i}`,
      agoSeconds: Math.max(8, Math.floor(Math.random() * 60)),
    }));
    const sig = [...get().signals];
    // Move the first signal to the back and bump its timestamp.
    if (sig.length > 0) {
      const [first, ...rest] = sig;
      const bumped: SmartSignal = {
        ...first,
        id: `s-${Date.now()}`,
        agoSeconds: Math.max(5, Math.floor(Math.random() * 30)),
      };
      set({
        flows: [flows[0], ...get().flows.slice(0, 8)],
        signals: [...rest, bumped],
        alerts: [
          {
            id: `a-${Date.now()}`,
            title: `New ${bumped.type.replace(/_/g, " ").toLowerCase()} on ${bumped.tokenSymbol}`,
            description: `${bumped.smartWalletsCount} smart wallets · $${(
              bumped.usdInflow / 1000
            ).toFixed(0)}K inflow`,
            type: "alert",
          },
          ...get().alerts,
        ],
      });
    }
  },

  // ===== NEW: Wallet connect =====
  walletOpen: false,
  setWalletOpen: (open) => set({ walletOpen: open }),
  wallet: null,
  connectWallet: (label, address) => {
    const addr =
      address ||
      `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
    set({
      wallet: { connected: true, address: addr, label, balanceUsd: 0 },
      walletOpen: false,
    });
    get().pushAlert({
      title: "Wallet connected",
      description: `${label} connected successfully`,
      type: "success",
    });
  },
  disconnectWallet: () => {
    set({ wallet: null });
    get().pushAlert({
      title: "Wallet disconnected",
      type: "info",
    });
  },

  // ===== NEW: Token screener =====
  screenerOpen: false,
  setScreenerOpen: (open) => set({ screenerOpen: open }),
  screenerFilters: DEFAULT_SCREENER_FILTERS,
  setScreenerFilters: (f) =>
    set((s) => ({ screenerFilters: { ...s.screenerFilters, ...f } })),
  resetScreenerFilters: () => set({ screenerFilters: DEFAULT_SCREENER_FILTERS }),

  // ===== NEW: Trade / swap =====
  tradeOpen: false,
  tradeTokenId: null,
  tradeSide: "BUY",
  tradePrefillUsd: null,
  openTrade: (tokenId, side, prefillUsd) =>
    set({ tradeOpen: true, tradeTokenId: tokenId, tradeSide: side, tradePrefillUsd: prefillUsd ?? null }),
  closeTrade: () => set({ tradeOpen: false, tradePrefillUsd: null }),

  // ===== NEW: Tax calculator =====
  taxOpen: false,
  setTaxOpen: (open) => set({ taxOpen: open }),

  // ===== NEW: Custom alert creator =====
  alertCreatorOpen: false,
  alertCreatorTokenId: null,
  openAlertCreator: (tokenId) => set({ alertCreatorOpen: true, alertCreatorTokenId: tokenId }),
  closeAlertCreator: () => set({ alertCreatorOpen: false }),
  customAlerts: [
    {
      id: "ca-1",
      tokenId: "wif",
      tokenSymbol: "WIF",
      condition: "price_above",
      threshold: 3.5,
      channels: ["push"],
      createdAt: 0,
      active: true,
      triggered: false,
    },
    {
      id: "ca-2",
      tokenId: "sol",
      tokenSymbol: "SOL",
      condition: "smart_money_inflow",
      threshold: 5_000_000,
      channels: ["push", "telegram"],
      createdAt: 0,
      active: true,
      triggered: false,
    },
  ],
  addCustomAlert: (a) =>
    set((s) => ({
      customAlerts: [
        { ...a, id: `ca-${Date.now()}`, createdAt: Date.now() },
        ...s.customAlerts,
      ],
      alertCreatorOpen: false,
      alerts: [
        {
          id: `a-${Date.now()}`,
          title: "Alert created",
          description: `${a.tokenSymbol} ${a.condition.replace(/_/g, " ")} ${a.threshold}`,
          type: "success",
        },
        ...s.alerts,
      ],
    })),
  removeCustomAlert: (id) =>
    set((s) => ({ customAlerts: s.customAlerts.filter((x) => x.id !== id) })),
  triggerCustomAlert: (id) => {
    const alert = get().customAlerts.find((a) => a.id === id);
    if (!alert || alert.triggered || !alert.active) return;
    set((s) => ({
      customAlerts: s.customAlerts.map((a) =>
        a.id === id ? { ...a, triggered: true } : a
      ),
    }));
    const condLabel = alert.condition === "price_above" ? "crossed above" :
                      alert.condition === "price_below" ? "dropped below" :
                      alert.condition === "smart_money_inflow" ? "smart money inflow detected" :
                      alert.condition === "smart_money_outflow" ? "smart money outflow detected" :
                      "new whale buy detected";
    get().pushToast({
      title: `🔔 Alert: ${alert.tokenSymbol} ${condLabel}`,
      description: `Threshold: ${fmtUsd(alert.threshold, { compact: true })} · Channels: ${alert.channels.join(", ")}`,
      type: "alert",
      actionLabel: `View ${alert.tokenSymbol}`,
      actionId: alert.tokenId,
    });
    // Fire browser notification if permission granted
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(`🔔 ${alert.tokenSymbol} ${condLabel}`, {
          body: `Threshold: ${fmtUsd(alert.threshold, { compact: true })}`,
          icon: "/logo.svg",
          tag: alert.id,
        });
      } catch {
        // ignore
      }
    }
  },

  // ===== NEW: Settings =====
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  settings: DEFAULT_SETTINGS,
  setSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),

  // ===== NEW: Onboarding =====
  onboarded: false,
  setOnboarded: (v) => set({ onboarded: v }),

  // ===== NEW: Token comparison =====
  compareOpen: false,
  compareIds: [],
  setCompareOpen: (open) => set({ compareOpen: open }),
  toggleCompareId: (id) =>
    set((s) => ({
      compareIds: s.compareIds.includes(id)
        ? s.compareIds.filter((x) => x !== id)
        : s.compareIds.length >= 3
        ? [...s.compareIds.slice(1), id]
        : [...s.compareIds, id],
    })),
  clearCompare: () => set({ compareIds: [] }),

  // ===== BATCH 3: Copy trading =====
  copyTradeOpen: false,
  setCopyTradeOpen: (open) => set({ copyTradeOpen: open }),
  copyTrades: [
    {
      id: "ct-1",
      traderId: "t1",
      traderHandle: "0xMoby",
      traderGlyph: "M",
      traderColor: "from-[#14F195] to-[#9945FF]",
      enabled: true,
      maxPerTradeUsd: 500,
      dailyLimitUsd: 2000,
      totalAllocatedUsd: 10_000,
      totalCopiedUsd: 4_280,
      tradesCopied: 18,
      slippage: 1.5,
      onlyBuy: false,
      minTraderScore: 85,
      createdAt: 0,
    },
  ],
  addCopyTrade: (c) =>
    set((s) => ({
      copyTrades: [...s.copyTrades, { ...c, id: `ct-${Date.now()}`, createdAt: Date.now() }],
      copyTradeOpen: false,
    })),
  removeCopyTrade: (id) =>
    set((s) => ({ copyTrades: s.copyTrades.filter((x) => x.id !== id) })),
  toggleCopyTrade: (id) =>
    set((s) => ({
      copyTrades: s.copyTrades.map((x) =>
        x.id === id ? { ...x, enabled: !x.enabled } : x
      ),
    })),
  updateCopyTrade: (id, patch) =>
    set((s) => ({
      copyTrades: s.copyTrades.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),
  // ===== Enhancement #24: Copy-trade real execution =====
  // Mirrors a smart-money trade: applies the trade to portfolio + records history.
  // Respects maxPerTradeUsd cap. Returns true if executed, false if skipped.
  executeCopyTrade: (input: {
    copyTradeId: string;
    tokenId: string;
    tokenSymbol: string;
    side: "BUY" | "SELL";
    usdAmount: number;
    price: number;
  }) => {
    const cfg = get().copyTrades.find((c) => c.id === input.copyTradeId && c.enabled);
    if (!cfg) return false;
    // Cap at maxPerTradeUsd
    const actualUsd = Math.min(input.usdAmount, cfg.maxPerTradeUsd);
    if (actualUsd < 1) return false;
    // Apply the trade
    get().applyTrade({
      tokenId: input.tokenId,
      side: input.side,
      usdAmount: actualUsd,
      tokenAmount: actualUsd / Math.max(0.000001, input.price),
      price: input.price,
    });
    get().recordTrade({
      tokenId: input.tokenId,
      tokenSymbol: input.tokenSymbol,
      side: input.side,
      usdAmount: actualUsd,
      tokenAmount: actualUsd / Math.max(0.000001, input.price),
      price: input.price,
      txHash: `copy_${input.copyTradeId}_${Date.now()}`,
    });
    // Update copy-trade stats
    set((s) => ({
      copyTrades: s.copyTrades.map((c) =>
        c.id === input.copyTradeId
          ? {
              ...c,
              totalCopiedUsd: c.totalCopiedUsd + actualUsd,
              tradesCopied: c.tradesCopied + 1,
            }
          : c
      ),
    }));
    get().pushToast({
      title: `📋 Copied trade: ${input.tokenSymbol}`,
      description: `${input.side} ${fmtUsd(actualUsd)} at ${fmtPrice(input.price)} · via ${cfg.traderHandle}`,
      type: "success",
      actionLabel: `View ${input.tokenSymbol}`,
      actionId: input.tokenId,
    });
    return true;
  },

  // ===== BATCH 3: Limit orders =====
  limitOrdersOpen: false,
  setLimitOrdersOpen: (open) => set({ limitOrdersOpen: open }),
  limitOrders: [
    {
      id: "lo-1",
      tokenId: "wif",
      tokenSymbol: "WIF",
      side: "BUY",
      targetPrice: 2.4,
      amountUsd: 1000,
      expiry: "7d",
      status: "open",
      createdAt: 0,
    },
    {
      id: "lo-2",
      tokenId: "sol",
      tokenSymbol: "SOL",
      side: "SELL",
      targetPrice: 220,
      amountUsd: 2500,
      expiry: "30d",
      status: "open",
      createdAt: 0,
    },
    {
      id: "lo-3",
      tokenId: "jup",
      tokenSymbol: "JUP",
      side: "BUY",
      targetPrice: 0.7,
      amountUsd: 500,
      expiry: "gtc",
      status: "filled",
      createdAt: 0,
      filledAt: 0,
      fillPrice: 0.68,
    },
  ],
  addLimitOrder: (o) =>
    set((s) => ({
      limitOrders: [
        { ...o, id: `lo-${Date.now()}`, createdAt: Date.now() },
        ...s.limitOrders,
      ],
    })),
  cancelLimitOrder: (id) =>
    set((s) => ({
      limitOrders: s.limitOrders.map((x) =>
        x.id === id && x.status === "open" ? { ...x, status: "cancelled" } : x
      ),
    })),

  // ===== BATCH 3: DCA scheduler =====
  dcaOpen: false,
  setDcaOpen: (open) => set({ dcaOpen: open }),
  dcaStrategies: [
    {
      id: "dca-1",
      name: "Weekly SOL stack",
      tokenIds: ["sol"],
      frequency: "weekly",
      amountUsd: 200,
      enabled: true,
      totalInvested: 4_200,
      runs: 21,
      nextRun: 0,
      createdAt: 0,
    },
    {
      id: "dca-2",
      name: "AI Infrastructure",
      tokenIds: ["io", "rndr"],
      frequency: "biweekly",
      amountUsd: 300,
      enabled: false,
      totalInvested: 1_800,
      runs: 6,
      nextRun: 0,
      createdAt: 0,
    },
  ],
  addDcaStrategy: (s) =>
    set((state) => ({
      dcaStrategies: [
        ...state.dcaStrategies,
        {
          ...s,
          id: `dca-${Date.now()}`,
          createdAt: Date.now(),
          nextRun: Date.now() + 7 * 86400_000,
          totalInvested: 0,
          runs: 0,
        },
      ],
      dcaOpen: false,
    })),
  removeDcaStrategy: (id) =>
    set((s) => ({ dcaStrategies: s.dcaStrategies.filter((x) => x.id !== id) })),
  toggleDcaStrategy: (id) =>
    set((s) => ({
      dcaStrategies: s.dcaStrategies.map((x) =>
        x.id === id ? { ...x, enabled: !x.enabled } : x
      ),
    })),

  // ===== BATCH 3: Wallet activity =====
  walletActivityOpen: false,
  setWalletActivityOpen: (open) => set({ walletActivityOpen: open }),

  // ===== BATCH 3: Solana stats =====
  solanaStatsOpen: false,
  setSolanaStatsOpen: (open) => set({ solanaStatsOpen: open }),

  // ===== BATCH 3: PNL leaderboard =====
  pnlLeaderboardOpen: false,
  setPnlLeaderboardOpen: (open) => set({ pnlLeaderboardOpen: open }),

  // ===== BATCH 3: Social sentiment =====
  socialOpen: false,
  setSocialOpen: (open) => set({ socialOpen: open }),

  // ===== BATCH 3: Rebalancing =====
  rebalanceOpen: false,
  setRebalanceOpen: (open) => set({ rebalanceOpen: open }),

  // ===== BATCH 3: Referral =====
  referralOpen: false,
  setReferralOpen: (open) => set({ referralOpen: open }),

  // ===== BATCH 3: Achievements detail =====
  achievementsOpen: false,
  setAchievementsOpen: (open) => set({ achievementsOpen: open }),

  // ===== BATCH 4: Perpetuals =====
  perpsOpen: false,
  setPerpsOpen: (open) => set({ perpsOpen: open }),
  selectedPerpId: null,
  openPerp: (id) => set({ selectedPerpId: id }),

  // ===== BATCH 4: NFT detail =====
  nftDetailOpen: false,
  setNftDetailOpen: (open) => set({ nftDetailOpen: open }),
  selectedNftId: null,
  openNft: (id) => set({ selectedNftId: id }),

  // ===== BATCH 4: Launch scanner =====
  launchScannerOpen: false,
  setLaunchScannerOpen: (open) => set({ launchScannerOpen: open }),

  // ===== BATCH 4: Bridge =====
  bridgeOpen: false,
  setBridgeOpen: (open) => set({ bridgeOpen: open }),

  // ===== BATCH 4: Staking =====
  stakingOpen: false,
  setStakingOpen: (open) => set({ stakingOpen: open }),

  // ===== BATCH 4: Gas optimizer =====
  gasOptimizerOpen: false,
  setGasOptimizerOpen: (open) => set({ gasOptimizerOpen: open }),

  // ===== BATCH 4: Airdrop center =====
  airdropOpen: false,
  setAirdropOpen: (open) => set({ airdropOpen: open }),
  claimedAirdrops: ["ad2"], // Drift already claimed
  claimAirdrop: (id) =>
    set((s) => ({
      claimedAirdrops: [...s.claimedAirdrops, id],
      toasts: [
        {
          id: `toast-${Date.now()}`,
          ts: Date.now(),
          title: "Airdrop claimed!",
          description: "Tokens will arrive in your wallet shortly.",
          type: "success",
        },
        ...s.toasts,
      ],
    })),

  // ===== BATCH 4: Toast notifications =====
  toasts: [],
  pushToast: (t) =>
    set((s) => ({
      toasts: [
        { ...t, id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now() },
        ...s.toasts,
      ].slice(0, 5), // Keep only 5 most recent
    })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // ===== BATCH 5: Full-screen chart =====
  chartOpen: false,
  chartTokenId: null,
  openChart: (tokenId) => set({ chartOpen: true, chartTokenId: tokenId }),
  closeChart: () => set({ chartOpen: false }),

  // ===== BATCH 5: Narrative detail =====
  narrativeDetailOpen: false,
  selectedNarrativeId: null,
  openNarrative: (id) => set({ selectedNarrativeId: id, narrativeDetailOpen: true }),
  setNarrativeDetailOpen: (open) => set({ narrativeDetailOpen: open }),

  // ===== BATCH 5: Smart money map =====
  smartMoneyMapOpen: false,
  setSmartMoneyMapOpen: (open) => set({ smartMoneyMapOpen: open }),

  // ===== BATCH 5: Push notifications =====
  pushPermission: typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "default",
  requestPushPermission: () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then((p) => {
        useMoby.getState().setPushPermission(p as "default" | "granted" | "denied");
        if (p === "granted") {
          useMoby.getState().pushToast({
            title: "Push notifications enabled",
            description: "You'll get alerts for whale moves and smart money entries.",
            type: "success",
          });
        }
      });
    }
  },
  setPushPermission: (p) => set({ pushPermission: p }),

  // ===== BATCH 6: Portfolio analytics =====
  analyticsOpen: false,
  setAnalyticsOpen: (open) => set({ analyticsOpen: open }),

  // ===== BATCH 6: Yield farming =====
  yieldOpen: false,
  setYieldOpen: (open) => set({ yieldOpen: open }),

  // ===== BATCH 6: Token unlocks =====
  unlocksOpen: false,
  setUnlocksOpen: (open) => set({ unlocksOpen: open }),

  // ===== BATCH 6: Governance =====
  governanceOpen: false,
  setGovernanceOpen: (open) => set({ governanceOpen: open }),
  votedProposals: { g2: "for", g3: "for", g5: "against" },
  vote: (proposalId, voteChoice) =>
    set((s) => ({
      votedProposals: { ...s.votedProposals, [proposalId]: voteChoice },
      toasts: [
        {
          id: `toast-${Date.now()}`,
          ts: Date.now(),
          title: "Vote submitted",
          description: `You voted ${voteChoice} on this proposal.`,
          type: "success",
        },
        ...s.toasts,
      ],
    })),

  // ===== BATCH 6: DeFi positions =====
  defiOpen: false,
  setDefiOpen: (open) => set({ defiOpen: open }),

  // ===== BATCH 6: Market calendar =====
  calendarOpen: false,
  setCalendarOpen: (open) => set({ calendarOpen: open }),

  // ===== BATCH 6: Transaction simulator =====
  simulatorOpen: false,
  setSimulatorOpen: (open) => set({ simulatorOpen: open }),

  // ===== BATCH 6: Multi-wallet manager =====
  multiWalletOpen: false,
  setMultiWalletOpen: (open) => set({ multiWalletOpen: open }),
  activeWalletId: "mw1",
  setActiveWalletId: (id) => set({ activeWalletId: id }),

  // ===== BATCH 6: Watchlist performance =====
  watchlistPerfOpen: false,
  setWatchlistPerfOpen: (open) => set({ watchlistPerfOpen: open }),

  // ===== BATCH 6: Theme toggle =====
  theme: "dark",
  toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

  // ===== BATCH 7: Token security audit =====
  securityAuditOpen: false,
  securityAuditTokenId: null,
  openSecurityAudit: (tokenId) => set({ securityAuditTokenId: tokenId, securityAuditOpen: true }),
  setSecurityAuditOpen: (open) => set({ securityAuditOpen: open }),

  // ===== BATCH 7: Tokenized stocks =====
  stocksOpen: false,
  setStocksOpen: (open) => set({ stocksOpen: open }),

  // ===== BATCH 7: Wallet PnL tracker =====
  walletPnlOpen: false,
  walletPnlAddress: "0x7a3f...b9c2",
  setWalletPnlOpen: (open) => set({ walletPnlOpen: open }),
  setWalletPnlAddress: (addr) => set({ walletPnlAddress: addr }),

  // ===== BATCH 7: Snipe bot =====
  snipeBotOpen: false,
  setSnipeBotOpen: (open) => set({ snipeBotOpen: open }),

  // ===== BATCH 7: Price prediction =====
  predictionOpen: false,
  predictionTokenId: null,
  openPrediction: (tokenId) => set({ predictionTokenId: tokenId, predictionOpen: true }),
  setPredictionOpen: (open) => set({ predictionOpen: open }),

  // ===== BATCH 7: Liquidity depth =====
  liquidityDepthOpen: false,
  liquidityDepthTokenId: null,
  openLiquidityDepth: (tokenId) => set({ liquidityDepthTokenId: tokenId, liquidityDepthOpen: true }),
  setLiquidityDepthOpen: (open) => set({ liquidityDepthOpen: open }),

  // ===== BATCH 7: Trading journal =====
  journalOpen: false,
  setJournalOpen: (open) => set({ journalOpen: open }),

  // ===== BATCH 7: DeFi health monitor =====
  defiHealthOpen: false,
  setDefiHealthOpen: (open) => set({ defiHealthOpen: open }),

  // ===== BATCH 7: Tax loss harvesting =====
  harvestOpen: false,
  setHarvestOpen: (open) => set({ harvestOpen: open }),

  // ===== BATCH 8: Trailing stops =====
  trailingStopsOpen: false,
  setTrailingStopsOpen: (open) => set({ trailingStopsOpen: open }),

  // ===== BATCH 8: Hot wallets =====
  hotWalletsOpen: false,
  setHotWalletsOpen: (open) => set({ hotWalletsOpen: open }),

  // ===== BATCH 8: Token migrations =====
  migrationsOpen: false,
  setMigrationsOpen: (open) => set({ migrationsOpen: open }),

  // ===== BATCH 8: MEV protection info =====
  mevInfoOpen: false,
  setMevInfoOpen: (open) => set({ mevInfoOpen: open }),

  // ===== BATCH 8: Wallet import =====
  walletImportOpen: false,
  setWalletImportOpen: (open) => set({ walletImportOpen: open }),

  // ===== BATCH 8: Watchlist alerts =====
  watchlistAlertsOpen: false,
  setWatchlistAlertsOpen: (open) => set({ watchlistAlertsOpen: open }),

  // Recently viewed tokens
  recentlyViewed: [],
  addRecentlyViewed: (id) =>
    set((s) => ({
      recentlyViewed: [id, ...s.recentlyViewed.filter((x) => x !== id)].slice(0, 10),
    })),

  // ===== BATCH 9: Pump.fun explorer =====
  pumpFunOpen: false,
  setPumpFunOpen: (open) => set({ pumpFunOpen: open }),

  // ===== Enhancement: Discover "More" panels modal =====
  discoverMoreOpen: false,
  setDiscoverMoreOpen: (open) => set({ discoverMoreOpen: open }),

  // ===== Enhancement: Token list modal (for "View all" buttons) =====
  tokenListOpen: false,
  tokenListConfig: null,
  openTokenList: (config) => set({ tokenListOpen: true, tokenListConfig: config }),
  setTokenListOpen: (open) => set({ tokenListOpen: open }),

  // ===== Enhancement: Wallet detail sheet =====
  walletDetailOpen: false,
  walletDetailAddress: null,
  walletDetailLabel: "",
  openWalletDetail: (address, label) => set({
    walletDetailOpen: true,
    walletDetailAddress: address,
    walletDetailLabel: label || "Wallet",
  }),
  setWalletDetailOpen: (open) => set({ walletDetailOpen: open }),

  // ===== Enhancement: Portfolio holdings (persisted, mutated by trades) =====
  portfolioHoldings: initialPortfolioHoldings(),
  applyTrade: ({ tokenId, side, usdAmount, tokenAmount, price }) => {
    set((s) => {
      const existing = s.portfolioHoldings.find((h) => h.tokenId === tokenId);
      let nextHoldings: PortfolioHolding[];
      if (side === "BUY") {
        if (existing) {
          const newAmount = existing.amount + tokenAmount;
          const newCost = existing.costUsd + usdAmount;
          nextHoldings = s.portfolioHoldings.map((h) =>
            h.tokenId === tokenId ? { ...h, amount: newAmount, costUsd: newCost } : h
          );
        } else {
          nextHoldings = [
            ...s.portfolioHoldings,
            { tokenId, amount: tokenAmount, costUsd: usdAmount },
          ];
        }
      } else {
        // SELL: reduce amount, reduce cost proportionally
        if (!existing) {
          nextHoldings = s.portfolioHoldings;
        } else {
          const newAmount = Math.max(0, existing.amount - tokenAmount);
          const costPerToken = existing.amount > 0 ? existing.costUsd / existing.amount : 0;
          const realizedCost = costPerToken * Math.min(tokenAmount, existing.amount);
          const newCost = Math.max(0, existing.costUsd - realizedCost);
          nextHoldings = s.portfolioHoldings
            .map((h) =>
              h.tokenId === tokenId
                ? newAmount > 0.000001
                  ? { ...h, amount: newAmount, costUsd: newCost }
                  : null
                : h
            )
            .filter(Boolean) as PortfolioHolding[];
        }
      }
      return { portfolioHoldings: nextHoldings };
    });
    // Auto-unlock "first_trade"
    get().unlockAchievement("first_trade");
    // Update "ten_trades" progress based on trade history length
    const tradeCount = get().tradeHistory.length + 1; // +1 because recordTrade hasn't fired yet
    if (tradeCount >= 10) {
      get().unlockAchievement("ten_trades");
    } else {
      set((s) => ({
        achievements: s.achievements.map((a) =>
          a.id === "ten_trades" && !a.unlocked ? { ...a, progress: tradeCount / 10 } : a
        ),
      }));
    }
    // Auto-check portfolio milestone achievements
    const holdings = get().portfolioHoldings;
    const totalValue = holdings.reduce((sum, h) => {
      const tk = TOKENS.find((t) => t.id === h.tokenId);
      const livePrice = get().prices[h.tokenId]?.price ?? tk?.price ?? 0;
      return sum + h.amount * livePrice;
    }, 0);
    if (totalValue >= 100_000) get().unlockAchievement("portfolio_100k");
    else if (totalValue >= 10_000) get().unlockAchievement("portfolio_10k");
    if (holdings.filter((h) => h.amount > 0.000001).length >= 5) {
      get().unlockAchievement("diversified");
    }
  },

  // ===== Enhancement: Trade history (persisted) =====
  tradeHistory: [],
  recordTrade: (trade) => {
    const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: TradeRecord = { id, ts: Date.now(), ...trade };
    set((s) => ({ tradeHistory: [record, ...s.tradeHistory].slice(0, 200) }));
  },

  // ===== Enhancement: Achievements (persisted) =====
  achievements: DEFAULT_ACHIEVEMENTS,
  unlockAchievement: (id) => {
    let justUnlocked = false;
    set((s) => {
      const exists = s.achievements.find((a) => a.id === id);
      if (exists?.unlocked) return {}; // no-op if already unlocked
      justUnlocked = true;
      return {
        achievements: s.achievements.map((a) =>
          a.id === id ? { ...a, unlocked: true, unlockedAt: Date.now(), progress: 1 } : a
        ),
      };
    });
    if (justUnlocked) {
      get().pushAlert({
        title: "Achievement unlocked",
        description: achievementLabel(id),
        type: "success",
      });
    }
  },
  isAchievementUnlocked: (id) => {
    const a = get().achievements.find((x) => x.id === id);
    return !!a?.unlocked;
  },

  // ===== Enhancement: Per-token watchlist alerts (persisted) =====
  watchlistAlerts: {},
  setWatchlistAlert: (tokenId, cfg) => {
    set((s) => ({
      watchlistAlerts: {
        ...s.watchlistAlerts,
        [tokenId]: { ...(s.watchlistAlerts[tokenId] || {}), ...cfg },
      },
    }));
    get().unlockAchievement("first_alert");
    get().pushAlert({
      title: "Watchlist alert saved",
      description: "You'll be notified when conditions are met.",
      type: "success",
    });
  },
  removeWatchlistAlert: (tokenId) => {
    set((s) => {
      const next = { ...s.watchlistAlerts };
      delete next[tokenId];
      return { watchlistAlerts: next };
    });
  },

  // ===== Enhancement #13: Snipe-bot rules (persisted) =====
  snipeRules: [],
  addSnipeRule: (rule) => {
    const id = `snipe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRule: SnipeRule = {
      ...rule,
      id,
      createdAt: Date.now(),
      enabled: true,
      stats: { triggered: 0, filled: 0, pnl: 0 },
    };
    set((s) => ({ snipeRules: [...s.snipeRules, newRule].slice(0, 20) }));
    get().pushAlert({
      title: "Snipe rule created",
      description: `"${rule.name}" is now live — will auto-fire on matching new pairs.`,
      type: "success",
    });
  },
  updateSnipeRule: (id, patch) => {
    set((s) => ({
      snipeRules: s.snipeRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  },
  removeSnipeRule: (id) => {
    set((s) => ({ snipeRules: s.snipeRules.filter((r) => r.id !== id) }));
  },
  toggleSnipeRule: (id) => {
    set((s) => ({
      snipeRules: s.snipeRules.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  },
  recordSnipeTrigger: (id, filled, pnlUsd) => {
    set((s) => ({
      snipeRules: s.snipeRules.map((r) =>
        r.id === id
          ? {
              ...r,
              stats: {
                triggered: r.stats.triggered + 1,
                filled: r.stats.filled + (filled ? 1 : 0),
                pnl: r.stats.pnl + pnlUsd,
              },
            }
          : r
      ),
    }));
  },

  // ===== Enhancement #12: Trailing stops (persisted) =====
  trailingStops: [],
  addTrailingStop: (cfg) => {
    const id = `ts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Seed peakPrice from the current live price with a 0.1% buffer to avoid
    // tick-noise triggers on the very next price update.
    const livePrice = get().prices[cfg.tokenId]?.price ?? 0;
    const seededPeak = livePrice > 0 ? livePrice * 1.001 : 0;
    const newStop: TrailingStopConfig = {
      ...cfg,
      id,
      createdAt: Date.now(),
      peakPrice: seededPeak,
      triggered: false,
      minHoldMs: 30_000, // 30s minimum hold before stop can trigger
    };
    set((s) => ({ trailingStops: [...s.trailingStops, newStop].slice(0, 20) }));
    get().pushAlert({
      title: "Trailing stop set",
      description: `Trailing ${cfg.trailPct}% on ${cfg.tokenSymbol} from peak $${livePrice.toFixed(4)} (30s min hold)`,
      type: "success",
    });
  },
  removeTrailingStop: (id) => {
    set((s) => ({ trailingStops: s.trailingStops.filter((t) => t.id !== id) }));
  },
  updateTrailingPeak: (tokenId, price) => {
    set((s) => ({
      trailingStops: s.trailingStops.map((t) =>
        t.tokenId === tokenId && !t.triggered && price > t.peakPrice
          ? { ...t, peakPrice: price }
          : t
      ),
    }));
  },
  fireTrailingStop: (id) => {
    const stop = get().trailingStops.find((t) => t.id === id);
    if (!stop || stop.triggered) return;
    const livePrice = get().prices[stop.tokenId]?.price ?? stop.peakPrice;
    set((s) => ({
      trailingStops: s.trailingStops.map((t) =>
        t.id === id
          ? { ...t, triggered: true, triggeredAt: Date.now(), triggeredPrice: livePrice }
          : t
      ),
    }));
    // Apply sell to portfolio
    get().applyTrade({
      tokenId: stop.tokenId,
      side: "SELL",
      usdAmount: stop.buyUsd,
      tokenAmount: stop.buyUsd / Math.max(0.000001, livePrice),
      price: livePrice,
    });
    get().recordTrade({
      tokenId: stop.tokenId,
      tokenSymbol: stop.tokenSymbol,
      side: "SELL",
      usdAmount: stop.buyUsd,
      tokenAmount: stop.buyUsd / Math.max(0.000001, livePrice),
      price: livePrice,
      txHash: `trailing_${id}`,
    });
    get().pushToast({
      title: `Trailing stop triggered: ${stop.tokenSymbol}`,
      description: `Sold ${fmtUsd(stop.buyUsd)} at $${livePrice.toFixed(4)} (peak was $${stop.peakPrice.toFixed(4)}, trail ${stop.trailPct}%)`,
      type: "alert",
    });
  },

  // ===== Enhancement: Global Share modal (store-driven) =====
  shareOpen: false,
  shareData: { title: "", description: "" },
  openShare: (data) => set({ shareOpen: true, shareData: data }),
  setShareOpen: (open) => set({ shareOpen: open }),
  }),
  {
    name: "moby-storage",
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({
      watchlist: s.watchlist,
      followedTraders: s.followedTraders,
      savedSignals: s.savedSignals,
      dismissedSignals: s.dismissedSignals,
      customAlerts: s.customAlerts,
      copyTrades: s.copyTrades,
      limitOrders: s.limitOrders,
      dcaStrategies: s.dcaStrategies,
      settings: s.settings,
      onboarded: s.onboarded,
      claimedAirdrops: s.claimedAirdrops,
      votedProposals: s.votedProposals,
      activeWalletId: s.activeWalletId,
      wallet: s.wallet,
      walletPnlAddress: s.walletPnlAddress,
      theme: s.theme,
      pushPermission: s.pushPermission,
      recentlyViewed: s.recentlyViewed,
      portfolioHoldings: s.portfolioHoldings,
      tradeHistory: s.tradeHistory,
      achievements: s.achievements,
      watchlistAlerts: s.watchlistAlerts,
      viewedTraders: s.viewedTraders,
      followedWallets: s.followedWallets,
      followedWalletLabels: s.followedWalletLabels,
      snipeRules: s.snipeRules,
      trailingStops: s.trailingStops,
      selectedChain: s.selectedChain,
    }),
  }
  )
);

// Convenience hook selectors
export function useToken(id: string | null): Token | null {
  return useMoby((s) => (id ? TOKENS.find((t) => t.id === id) ?? null : null));
}

export function useTrader(id: string | null): Trader | null {
  return useMoby((s) => (id ? TRADERS.find((t) => t.id === id) ?? null : null));
}
