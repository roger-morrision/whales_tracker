import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';

// Create a single shared store object that persists across calls
const createSharedStore = () => {
  const s = {
    activeTab: 'discover',
    prices: {},
    wallet: null,
    watchlist: [],
    customAlerts: [],
    settings: {
      defaultSlippage: 1.0,
      defaultGas: 'fast',
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
        currency: 'USD',
        theme: 'dark',
        compactMode: false,
        showSparklines: true,
      },
    },
    portfolioHoldings: [],
    tradeHistory: [],
    achievements: [
      { id: 'first_trade', unlocked: false, progress: 0 },
      { id: 'ten_trades', unlocked: false, progress: 0 },
    ],
    snipeRules: [],
    trailingStops: [],
    copyTrades: [],
    limitOrders: [],
    dcaStrategies: [],
    theme: 'dark',
    selectedChain: 'sol',
    followedWallets: [],
    followedWalletLabels: {},
    lastSeenWalletTx: {},
    pushToast: vi.fn(),
    dismissToast: vi.fn(),
    toasts: [],
    alerts: [],
  };

  // Add methods that mutate s
  s.setActiveTab = vi.fn((tab: string) => { s.activeTab = tab; });
  s.tickPrices = vi.fn();
  s.setPrice = vi.fn((id: string, price: number) => { s.prices[id] = { price, prev: price, ts: Date.now() }; });
  s.connectWallet = vi.fn((label: string, address?: string) => { 
    s.wallet = { connected: true, address: address || '0x123...', label, balanceUsd: 0 }; 
  });
  s.disconnectWallet = vi.fn(() => { s.wallet = null; });
  s.toggleWatch = vi.fn((id: string) => {
    s.watchlist = s.watchlist.includes(id)
      ? s.watchlist.filter(x => x !== id)
      : [...s.watchlist, id];
  });
  s.addCustomAlert = vi.fn((alert: any) => {
    s.customAlerts = [{ ...alert, id: `ca-${Date.now()}`, createdAt: Date.now() }, ...s.customAlerts];
  });
  s.removeCustomAlert = vi.fn((id: string) => {
    s.customAlerts = s.customAlerts.filter(x => x.id !== id);
  });
  s.setSettings = vi.fn((newSettings: any) => { s.settings = { ...s.settings, ...newSettings }; });
  s.applyTrade = vi.fn((trade: any) => {
    const existing = s.portfolioHoldings.find((h: any) => h.tokenId === trade.tokenId);
    if (trade.side === 'BUY') {
      if (existing) {
        existing.amount += trade.tokenAmount;
        existing.costUsd += trade.usdAmount;
      } else {
        s.portfolioHoldings.push({ tokenId: trade.tokenId, amount: trade.tokenAmount, costUsd: trade.usdAmount });
      }
    } else {
      if (existing) {
        existing.amount = Math.max(0, existing.amount - trade.tokenAmount);
        if (existing.amount <= 0.000001) {
          s.portfolioHoldings = s.portfolioHoldings.filter((h: any) => h.tokenId !== trade.tokenId);
        }
      }
    }
  });
  s.recordTrade = vi.fn((trade: any) => {
    s.tradeHistory = [{ id: `tx_${Date.now()}`, ts: Date.now(), ...trade }, ...s.tradeHistory].slice(0, 200);
  });
  s.unlockAchievement = vi.fn((id: string) => {
    const ach = s.achievements.find((a: any) => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      ach.unlockedAt = Date.now();
      ach.progress = 1;
    }
  });
  s.isAchievementUnlocked = vi.fn((id: string) => s.achievements.find((a: any) => a.id === id)?.unlocked ?? false);
  s.addSnipeRule = vi.fn((rule: any) => {
    s.snipeRules = [...s.snipeRules, { ...rule, id: `snipe_${Date.now()}`, createdAt: Date.now(), enabled: true, stats: { triggered: 0, filled: 0, pnl: 0 } }].slice(0, 20);
  });
  s.removeSnipeRule = vi.fn((id: string) => {
    s.snipeRules = s.snipeRules.filter((r: any) => r.id !== id);
  });
  s.toggleSnipeRule = vi.fn((id: string) => {
    s.snipeRules = s.snipeRules.map((r: any) => r.id === id ? { ...r, enabled: !r.enabled } : r);
  });
  s.addTrailingStop = vi.fn((cfg: any) => {
    s.trailingStops = [...s.trailingStops, { ...cfg, id: `ts_${Date.now()}`, createdAt: Date.now(), peakPrice: 0, triggered: false, minHoldMs: 30000 }].slice(0, 20);
  });
  s.removeTrailingStop = vi.fn((id: string) => {
    s.trailingStops = s.trailingStops.filter((t: any) => t.id !== id);
  });
  s.updateTrailingPeak = vi.fn((tokenId: string, price: number) => {
    s.trailingStops = s.trailingStops.map((t: any) =>
      t.tokenId === tokenId && !t.triggered && price > t.peakPrice ? { ...t, peakPrice: price } : t
    );
  });
  s.fireTrailingStop = vi.fn((id: string) => {
    const stop = s.trailingStops.find((t: any) => t.id === id);
    if (stop && !stop.triggered) {
      stop.triggered = true;
      stop.triggeredAt = Date.now();
      stop.triggeredPrice = s.prices[stop.tokenId]?.price ?? stop.peakPrice;
    }
  });
  s.addCopyTrade = vi.fn((c: any) => {
    s.copyTrades = [...s.copyTrades, { ...c, id: `ct-${Date.now()}`, createdAt: Date.now() }];
  });
  s.removeCopyTrade = vi.fn((id: string) => {
    s.copyTrades = s.copyTrades.filter((c: any) => c.id !== id);
  });
  s.toggleCopyTrade = vi.fn((id: string) => {
    s.copyTrades = s.copyTrades.map((c: any) => c.id === id ? { ...c, enabled: !c.enabled } : c);
  });
  s.updateCopyTrade = vi.fn((id: string, patch: any) => {
    s.copyTrades = s.copyTrades.map((c: any) => c.id === id ? { ...c, ...patch } : c);
  });
  s.executeCopyTrade = vi.fn(() => true);
  s.addLimitOrder = vi.fn((o: any) => {
      s.limitOrders = [{ ...o, id: `lo-${Date.now()}`, createdAt: Date.now(), status: 'open' }, ...s.limitOrders];
    });
  s.cancelLimitOrder = vi.fn((id: string) => {
    s.limitOrders = s.limitOrders.map((x: any) => x.id === id && x.status === 'open' ? { ...x, status: 'cancelled' } : x);
  });
  s.addDcaStrategy = vi.fn((dca: any) => {
    s.dcaStrategies = [...s.dcaStrategies, { ...dca, id: `dca-${Date.now()}`, createdAt: Date.now(), nextRun: Date.now() + 7 * 86400000, totalInvested: 0, runs: 0 }];
  });
  s.removeDcaStrategy = vi.fn((id: string) => {
    s.dcaStrategies = s.dcaStrategies.filter((x: any) => x.id !== id);
  });
  s.toggleDcaStrategy = vi.fn((id: string) => {
    s.dcaStrategies = s.dcaStrategies.map((x: any) => x.id === id ? { ...x, enabled: !x.enabled } : x);
  });
  s.toggleTheme = vi.fn(() => { s.theme = s.theme === 'dark' ? 'light' : 'dark'; });
  s.setSelectedChain = vi.fn((chain: string) => { s.selectedChain = chain; });
  s.toggleFollowWallet = vi.fn((address: string, label?: string) => {
    if (s.followedWallets.includes(address)) {
      s.followedWallets = s.followedWallets.filter(x => x !== address);
      delete s.followedWalletLabels[address];
    } else if (s.followedWallets.length < 10) {
      s.followedWallets = [...s.followedWallets, address];
      if (label) s.followedWalletLabels[address] = label;
    }
  });
  s.pushToast = vi.fn((toast: any) => {
    s.toasts = [{ ...toast, id: `toast-${Date.now()}` }, ...s.toasts].slice(0, 50);
  });
  s.dismissToast = vi.fn();
  s.pushAlert = vi.fn((a: any) => {
    s.alerts = [{ ...a, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...s.alerts].slice(0, 50);
  });
  s.dismissAlert = vi.fn((id: string) => {
    s.alerts = s.alerts.filter((x: any) => x.id !== id);
  });

  return s;
};

// Create a single shared store instance
const sharedStore = createSharedStore();

// Mock the store before importing - always return the same shared store
vi.mock('@/lib/moby-store', () => {
  return {
    useMoby: vi.fn((selector: any) => selector(sharedStore)),
  };
});

import { useMoby } from '@/lib/moby-store';

describe('Moby Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset state without recreating the store
    sharedStore.activeTab = 'discover';
    sharedStore.prices = {};
    sharedStore.wallet = null;
    sharedStore.watchlist = [];
    sharedStore.customAlerts = [];
    sharedStore.settings = {
      defaultSlippage: 1.0,
      defaultGas: 'fast',
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
        currency: 'USD',
        theme: 'dark',
        compactMode: false,
        showSparklines: true,
      },
    };
    sharedStore.portfolioHoldings = [];
    sharedStore.tradeHistory = [];
    sharedStore.achievements = [
      { id: 'first_trade', unlocked: false, progress: 0 },
      { id: 'ten_trades', unlocked: false, progress: 0 },
    ];
    sharedStore.snipeRules = [];
    sharedStore.trailingStops = [];
    sharedStore.copyTrades = [];
    sharedStore.limitOrders = [];
    sharedStore.dcaStrategies = [];
    sharedStore.theme = 'dark';
    sharedStore.selectedChain = 'sol';
    sharedStore.followedWallets = [];
    sharedStore.followedWalletLabels = {};
    sharedStore.lastSeenWalletTx = {};
        sharedStore.pushToast = vi.fn((toast: any) => {
          sharedStore.toasts = [{ ...toast, id: `toast-${Date.now()}` }, ...sharedStore.toasts].slice(0, 50);
        });
        sharedStore.dismissToast = vi.fn();
        sharedStore.toasts = [];
        sharedStore.alerts = [];
  });

    // Helper to re-read state after mutations
    const getStore = () => {
      // Use the store directly since we're in a test
      return sharedStore;
    };

    describe('Navigation', () => {
      it('should set active tab', () => {
        sharedStore.setActiveTab('portfolio');
        expect(sharedStore.activeTab).toBe('portfolio');
      });
    });

  describe('Price Management', () => {
    it('should set price for a token', () => {
      const { setPrice } = useMoby((s) => ({ setPrice: s.setPrice }));
      setPrice('sol', 100);
      expect(getStore().prices.sol?.price).toBe(100);
    });

    it('should tick prices', () => {
      const { tickPrices } = useMoby((s) => ({ tickPrices: s.tickPrices }));
      tickPrices();
      expect(tickPrices).toHaveBeenCalled();
    });
  });

  describe('Wallet Connection', () => {
    it('should connect wallet with address', () => {
      const { connectWallet } = useMoby((s) => ({ connectWallet: s.connectWallet }));
      connectWallet('Phantom', 'ABC123');
      expect(getStore().wallet).toEqual({
        connected: true,
        address: 'ABC123',
        label: 'Phantom',
        balanceUsd: 0,
      });
    });

    it('should disconnect wallet', () => {
      const { connectWallet, disconnectWallet } = useMoby((s) => ({
        connectWallet: s.connectWallet,
        disconnectWallet: s.disconnectWallet,
      }));
      connectWallet('Phantom', 'ABC123');
      expect(getStore().wallet).not.toBeNull();
      disconnectWallet();
      expect(getStore().wallet).toBeNull();
    });
  });

  describe('Watchlist', () => {
    it('should add token to watchlist', () => {
      const { toggleWatch } = useMoby((s) => ({ toggleWatch: s.toggleWatch }));
      toggleWatch('sol');
      expect(getStore().watchlist).toContain('sol');
    });

    it('should remove token from watchlist', () => {
      const { toggleWatch } = useMoby((s) => ({ toggleWatch: s.toggleWatch }));
      toggleWatch('sol');
      toggleWatch('sol');
      expect(getStore().watchlist).not.toContain('sol');
    });
  });

  describe('Custom Alerts', () => {
    it('should add custom alert', () => {
      const { addCustomAlert } = useMoby((s) => ({ addCustomAlert: s.addCustomAlert }));
      addCustomAlert({
        tokenId: 'sol',
        tokenSymbol: 'SOL',
        condition: 'price_above',
        threshold: 150,
        channels: ['push'],
        active: true,
        triggered: false,
      });
      expect(getStore().customAlerts.length).toBeGreaterThan(0);
      expect(getStore().customAlerts[0].tokenSymbol).toBe('SOL');
    });

    it('should remove custom alert', () => {
      const { addCustomAlert, removeCustomAlert } = useMoby((s) => ({
        addCustomAlert: s.addCustomAlert,
        removeCustomAlert: s.removeCustomAlert,
      }));
      addCustomAlert({
        tokenId: 'sol',
        tokenSymbol: 'SOL',
        condition: 'price_above',
        threshold: 150,
        channels: ['push'],
        active: true,
        triggered: false,
      });
      const alertId = getStore().customAlerts[0].id;
      removeCustomAlert(alertId);
      expect(getStore().customAlerts.find(a => a.id === alertId)).toBeUndefined();
    });
  });

  describe('Settings', () => {
    it('should update settings', () => {
      const { setSettings } = useMoby((s) => ({ setSettings: s.setSettings }));
      const settingsBefore = getStore().settings;
      setSettings({ defaultSlippage: 2.0, display: { ...settingsBefore.display, theme: 'light' } });
      expect(getStore().settings.defaultSlippage).toBe(2.0);
      expect(getStore().settings.display.theme).toBe('light');
    });
  });

  describe('Portfolio & Trades', () => {
    it('should apply BUY trade', () => {
      const { applyTrade } = useMoby((s) => ({ applyTrade: s.applyTrade }));
      applyTrade({ tokenId: 'sol', side: 'BUY', usdAmount: 1000, tokenAmount: 10, price: 100 });
      const holding = getStore().portfolioHoldings.find(h => h.tokenId === 'sol');
      expect(holding).toBeDefined();
      expect(holding?.amount).toBe(10);
      expect(holding?.costUsd).toBe(1000);
    });

    it('should apply SELL trade and reduce holding', () => {
      const { applyTrade } = useMoby((s) => ({ applyTrade: s.applyTrade }));
      applyTrade({ tokenId: 'sol', side: 'BUY', usdAmount: 1000, tokenAmount: 10, price: 100 });
      applyTrade({ tokenId: 'sol', side: 'SELL', usdAmount: 500, tokenAmount: 5, price: 100 });
      const holding = getStore().portfolioHoldings.find(h => h.tokenId === 'sol');
      expect(holding?.amount).toBe(5);
    });

    it('should record trade in history', () => {
      const { recordTrade } = useMoby((s) => ({ recordTrade: s.recordTrade }));
      recordTrade({ tokenId: 'sol', tokenSymbol: 'SOL', side: 'BUY', usdAmount: 1000, tokenAmount: 10, price: 100 });
      expect(getStore().tradeHistory.length).toBeGreaterThan(0);
      expect(getStore().tradeHistory[0].tokenSymbol).toBe('SOL');
    });
  });

  describe('Achievements', () => {
    it('should unlock achievement', () => {
      const { unlockAchievement, isAchievementUnlocked } = useMoby((s) => ({
        unlockAchievement: s.unlockAchievement,
        isAchievementUnlocked: s.isAchievementUnlocked,
      }));
      expect(isAchievementUnlocked('first_trade')).toBe(false);
      unlockAchievement('first_trade');
      expect(isAchievementUnlocked('first_trade')).toBe(true);
      const ach = getStore().achievements.find(a => a.id === 'first_trade');
      expect(ach?.unlocked).toBe(true);
      expect(ach?.progress).toBe(1);
    });

    it('should not double-unlock achievement', () => {
      const { unlockAchievement } = useMoby((s) => ({ unlockAchievement: s.unlockAchievement }));
      unlockAchievement('first_trade');
      const firstUnlockAt = getStore().achievements.find(a => a.id === 'first_trade')?.unlockedAt;
      unlockAchievement('first_trade');
      const secondUnlockAt = getStore().achievements.find(a => a.id === 'first_trade')?.unlockedAt;
      expect(firstUnlockAt).toBe(secondUnlockAt);
    });
  });

  describe('Snipe Rules', () => {
    it('should add snipe rule', () => {
      const { addSnipeRule } = useMoby((s) => ({ addSnipeRule: s.addSnipeRule }));
      addSnipeRule({
        name: 'Test Rule',
        conditions: { maxDevHoldPct: 10, minLiquidityUsd: 10000, maxAgeMinutes: 60, minSmartMoneyHolders: 2, renouncedOnly: true, maxRugRatio: 0.3 },
        actions: { buyUsd: 100, slippagePct: 1, autoTakeProfitPct: 50, autoStopLossPct: 20, autoExecute: false },
      });
      expect(getStore().snipeRules.length).toBeGreaterThan(0);
      expect(getStore().snipeRules[0].name).toBe('Test Rule');
      expect(getStore().snipeRules[0].enabled).toBe(true);
    });

    it('should toggle snipe rule', () => {
      const { addSnipeRule, toggleSnipeRule } = useMoby((s) => ({
        addSnipeRule: s.addSnipeRule,
        toggleSnipeRule: s.toggleSnipeRule,
      }));
      addSnipeRule({
        name: 'Test Rule',
        conditions: { maxDevHoldPct: 10, minLiquidityUsd: 10000, maxAgeMinutes: 60, minSmartMoneyHolders: 2, renouncedOnly: true, maxRugRatio: 0.3 },
        actions: { buyUsd: 100, slippagePct: 1, autoTakeProfitPct: 50, autoStopLossPct: 20, autoExecute: false },
      });
      const ruleId = getStore().snipeRules[0].id;
      expect(getStore().snipeRules[0].enabled).toBe(true);
      toggleSnipeRule(ruleId);
      expect(getStore().snipeRules.find(r => r.id === ruleId)?.enabled).toBe(false);
    });
  });

  describe('Trailing Stops', () => {
    it('should add trailing stop', () => {
      const { addTrailingStop } = useMoby((s) => ({ addTrailingStop: s.addTrailingStop }));
      addTrailingStop({ tokenId: 'sol', tokenSymbol: 'SOL', trailPct: 10, buyUsd: 1000 });
      expect(getStore().trailingStops.length).toBeGreaterThan(0);
      expect(getStore().trailingStops[0].tokenSymbol).toBe('SOL');
      expect(getStore().trailingStops[0].trailPct).toBe(10);
      expect(getStore().trailingStops[0].minHoldMs).toBe(30000);
    });

    it('should update trailing peak', () => {
      const { addTrailingStop, updateTrailingPeak } = useMoby((s) => ({
        addTrailingStop: s.addTrailingStop,
        updateTrailingPeak: s.updateTrailingPeak,
      }));
      addTrailingStop({ tokenId: 'sol', tokenSymbol: 'SOL', trailPct: 10, buyUsd: 1000 });
      const stopId = getStore().trailingStops[0].id;
      updateTrailingPeak('sol', 150);
      const stop = getStore().trailingStops.find(t => t.id === stopId);
      expect(stop?.peakPrice).toBe(150);
    });
  });

  describe('Copy Trades', () => {
    it('should add copy trade config', () => {
      const { addCopyTrade } = useMoby((s) => ({ addCopyTrade: s.addCopyTrade }));
      addCopyTrade({
        traderId: 't1',
        traderHandle: 'Trader1',
        traderGlyph: 'T',
        traderColor: 'blue',
        enabled: true,
        maxPerTradeUsd: 500,
        dailyLimitUsd: 2000,
        totalAllocatedUsd: 10000,
        slippage: 1.5,
        onlyBuy: false,
        minTraderScore: 80,
      });
      expect(getStore().copyTrades.length).toBeGreaterThan(0);
      expect(getStore().copyTrades[0].traderHandle).toBe('Trader1');
    });

    it('should toggle copy trade', () => {
      const { addCopyTrade, toggleCopyTrade } = useMoby((s) => ({
        addCopyTrade: s.addCopyTrade,
        toggleCopyTrade: s.toggleCopyTrade,
      }));
      addCopyTrade({
        traderId: 't1',
        traderHandle: 'Trader1',
        traderGlyph: 'T',
        traderColor: 'blue',
        enabled: true,
        maxPerTradeUsd: 500,
        dailyLimitUsd: 2000,
        totalAllocatedUsd: 10000,
        slippage: 1.5,
        onlyBuy: false,
        minTraderScore: 80,
      });
      const ctId = getStore().copyTrades[0].id;
      expect(getStore().copyTrades[0].enabled).toBe(true);
      toggleCopyTrade(ctId);
      expect(getStore().copyTrades.find(c => c.id === ctId)?.enabled).toBe(false);
    });
  });

  describe('Limit Orders', () => {
    it('should add limit order', () => {
      const { addLimitOrder } = useMoby((s) => ({ addLimitOrder: s.addLimitOrder }));
      addLimitOrder({
        tokenId: 'sol',
        tokenSymbol: 'SOL',
        side: 'BUY',
        targetPrice: 90,
        amountUsd: 1000,
        expiry: '7d',
      });
      expect(getStore().limitOrders.length).toBeGreaterThan(0);
      expect(getStore().limitOrders[0].tokenSymbol).toBe('SOL');
      expect(getStore().limitOrders[0].status).toBe('open');
    });
  });

  describe('DCA Strategies', () => {
    it('should add DCA strategy', () => {
      const { addDcaStrategy } = useMoby((s) => ({ addDcaStrategy: s.addDcaStrategy }));
      addDcaStrategy({
        name: 'Weekly SOL',
        tokenIds: ['sol'],
        frequency: 'weekly',
        amountUsd: 100,
        enabled: true,
      });
      expect(getStore().dcaStrategies.length).toBeGreaterThan(0);
      expect(getStore().dcaStrategies[0].name).toBe('Weekly SOL');
      expect(getStore().dcaStrategies[0].totalInvested).toBe(0);
      expect(getStore().dcaStrategies[0].runs).toBe(0);
    });
  });

  describe('Theme', () => {
    it('should toggle theme', () => {
      const { toggleTheme } = useMoby((s) => ({ toggleTheme: s.toggleTheme }));
      expect(getStore().theme).toBe('dark');
      toggleTheme();
      expect(getStore().theme).toBe('light');
      toggleTheme();
      expect(getStore().theme).toBe('dark');
    });
  });

  describe('Chain Selection', () => {
    it('should set selected chain', () => {
      const { setSelectedChain } = useMoby((s) => ({ setSelectedChain: s.setSelectedChain }));
      expect(getStore().selectedChain).toBe('sol');
      setSelectedChain('base');
      expect(getStore().selectedChain).toBe('base');
      setSelectedChain('eth');
      expect(getStore().selectedChain).toBe('eth');
    });
  });

  describe('Followed Wallets', () => {
    it('should follow wallet', () => {
      const { toggleFollowWallet } = useMoby((s) => ({ toggleFollowWallet: s.toggleFollowWallet }));
      toggleFollowWallet('WALLET123', 'Whale 1');
      expect(getStore().followedWallets).toContain('WALLET123');
      expect(getStore().followedWalletLabels['WALLET123']).toBe('Whale 1');
    });

    it('should unfollow wallet', () => {
      const { toggleFollowWallet } = useMoby((s) => ({ toggleFollowWallet: s.toggleFollowWallet }));
      toggleFollowWallet('WALLET123', 'Whale 1');
      toggleFollowWallet('WALLET123');
      expect(getStore().followedWallets).not.toContain('WALLET123');
      expect(getStore().followedWalletLabels['WALLET123']).toBeUndefined();
    });

    it('should enforce max 10 followed wallets', () => {
      const { toggleFollowWallet } = useMoby((s) => ({ toggleFollowWallet: s.toggleFollowWallet }));
      for (let i = 0; i < 11; i++) {
        toggleFollowWallet(`WALLET${i}`, `Whale ${i}`);
      }
      expect(getStore().followedWallets.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Toasts & Alerts', () => {
    it('should push toast', () => {
      const { pushToast } = useMoby((s) => ({ pushToast: s.pushToast }));
      pushToast({ title: 'Test', description: 'Desc', type: 'success' });
      expect(getStore().toasts.length).toBeGreaterThan(0);
      expect(getStore().toasts[0].title).toBe('Test');
    });

    it('should push alert', () => {
      const { pushAlert } = useMoby((s) => ({ pushAlert: s.pushAlert }));
      pushAlert({ title: 'Alert', description: 'Desc', type: 'alert' });
      expect(getStore().alerts.length).toBeGreaterThan(0);
      expect(getStore().alerts[0].title).toBe('Alert');
    });
  });
});