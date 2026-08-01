// Moby global client state — Zustand store
import { create } from "zustand";
import {
  TOKENS,
  TRADERS,
  SIGNALS,
  WHALE_FLOWS,
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

interface MobyState {
  // navigation
  activeTab: TabKey;
  setActiveTab: (t: TabKey) => void;

  // live prices keyed by token id
  prices: Record<string, { price: number; prev: number; ts: number }>;
  tickPrices: () => void;
  setPrice: (id: string, price: number) => void;

  // selected token (opens detail sheet)
  selectedTokenId: string | null;
  openToken: (id: string | null) => void;

  // selected trader (opens trader sheet)
  selectedTraderId: string | null;
  openTrader: (id: string | null) => void;

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
  connectWallet: (label: string) => void;
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
  openTrade: (tokenId: string, side: "BUY" | "SELL") => void;
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
  addDcaStrategy: (s: Omit<DcaStrategy, "id" | "createdAt" | "nextRun">) => void;
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

export const useMoby = create<MobyState>((set, get) => ({
  activeTab: "discover",
  setActiveTab: (t) => set({ activeTab: t }),

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
  openToken: (id) => set({ selectedTokenId: id }),

  selectedTraderId: null,
  openTrader: (id) => set({ selectedTraderId: id }),

  watchlist: ["wif", "jup", "io", "mngo"],
  toggleWatch: (id) =>
    set((s) => ({
      watchlist: s.watchlist.includes(id)
        ? s.watchlist.filter((w) => w !== id)
        : [...s.watchlist, id],
    })),

  followedTraders: TRADERS.filter((t) => t.following).map((t) => t.id),
  toggleFollow: (id) =>
    set((s) => ({
      followedTraders: s.followedTraders.includes(id)
        ? s.followedTraders.filter((w) => w !== id)
        : [...s.followedTraders, id],
    })),

  savedSignals: [],
  dismissedSignals: [],
  toggleSaveSignal: (id) =>
    set((s) => ({
      savedSignals: s.savedSignals.includes(id)
        ? s.savedSignals.filter((x) => x !== id)
        : [...s.savedSignals, id],
    })),
  dismissSignal: (id) =>
    set((s) => ({ dismissedSignals: [...s.dismissedSignals, id] })),

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

    // Simulate async assistant reply
    setTimeout(() => {
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
    }, 900 + Math.random() * 700);
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
      alerts: [{ ...a, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...s.alerts],
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
  connectWallet: (label) => {
    const addr = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
    set({
      wallet: { connected: true, address: addr, label, balanceUsd: 8420.5 },
      walletOpen: false,
    });
    get().pushAlert({
      title: "Wallet connected",
      description: `${label} · ${addr}`,
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
  openTrade: (tokenId, side) =>
    set({ tradeOpen: true, tradeTokenId: tokenId, tradeSide: side }),
  closeTrade: () => set({ tradeOpen: false }),

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
}));

// Convenience hook selectors
export function useToken(id: string | null): Token | null {
  return useMoby((s) => (id ? TOKENS.find((t) => t.id === id) ?? null : null));
}

export function useTrader(id: string | null): Trader | null {
  return useMoby((s) => (id ? TRADERS.find((t) => t.id === id) ?? null : null));
}
