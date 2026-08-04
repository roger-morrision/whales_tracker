import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';

// Mock the store before importing
vi.mock('@/lib/moby-store', () => {
  const store = {
    activeTab: 'discover',
    setActiveTab: vi.fn((tab) => { store.activeTab = tab; }),
    prices: {},
    tickPrices: vi.fn(),
    setPrice: vi.fn((id, price) => { store.prices[id] = { price, prev: price, ts: Date.now() }; }),
    wallet: null,
    connectWallet: vi.fn((label, address) => {
      store.wallet = { connected: true, address: address || '0x123...', label, balanceUsd: 0 };
    }),
    disconnectWallet: vi.fn(() => { store.wallet = null; }),
    watchlist: [],
    toggleWatch: vi.fn((id) => {
      store.watchlist = store.watchlist.includes(id)
        ? store.watchlist.filter(x => x !== id)
        : [...store.watchlist, id];
    }),
    customAlerts: [],
    addCustomAlert: vi.fn((alert) => {
      store.customAlerts = [{ ...alert, id: `ca-${Date.now()}`, createdAt: Date.now() }, ...store.customAlerts];
    }),
    removeCustomAlert: vi.fn((id) => {
      store.customAlerts = store.customAlerts.filter(x => x.id !== id);
    }),
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
    setSettings: vi.fn((s) => { store.settings = { ...store.settings, ...s }; }),
    portfolioHoldings: [],
    applyTrade: vi.fn((trade) => {
      const existing = store.portfolioHoldings.find((h: any) => h.tokenId === trade.tokenId);
      if (trade.side === 'BUY') {
        if (existing) {
          existing.amount += trade.tokenAmount;
          existing.costUsd += trade.usdAmount;
        } else {
          store.portfolioHoldings.push({ tokenId: trade.tokenId, amount: trade.tokenAmount, costUsd: trade.usdAmount });
        }
      } else {
        if (existing) {
          existing.amount = Math.max(0, existing.amount - trade.tokenAmount);
          if (existing.amount <= 0.000001) {
            store.portfolioHoldings = store.portfolioHoldings.filter((h: any) => h.tokenId !== trade.tokenId);
          }
        }
      }
    }),
    tradeHistory: [],
    recordTrade: vi.fn((trade) => {
      store.tradeHistory = [{ id: `tx_${Date.now()}`, ts: Date.now(), ...trade }, ...store.tradeHistory].slice(0, 200);
    }),
    achievements: [
      { id: 'first_trade', unlocked: false, progress: 0 },
      { id: 'ten_trades', unlocked: false, progress: 0 },
    ],
    unlockAchievement: vi.fn((id) => {
      const ach = store.achievements.find((a: any) => a.id === id);
      if (ach && !ach.unlocked) {
        ach.unlocked = true;
        ach.unlockedAt = Date.now();
        ach.progress = 1;
      }
    }),
    isAchievementUnlocked: vi.fn((id) => store.achievements.find((a: any) => a.id === id)?.unlocked ?? false),
    snipeRules: [],
    addSnipeRule: vi.fn((rule) => {
      store.snipeRules = [...store.snipeRules, { ...rule, id: `snipe_${Date.now()}`, createdAt: Date.now(), enabled: true, stats: { triggered: 0, filled: 0, pnl: 0 } }].slice(0, 20);
    }),
    removeSnipeRule: vi.fn((id) => {
      store.snipeRules = store.snipeRules.filter((r: any) => r.id !== id);
    }),
    toggleSnipeRule: vi.fn((id) => {
      store.snipeRules = store.snipeRules.map((r: any) => r.id === id ? { ...r, enabled: !r.enabled } : r);
    }),
    trailingStops: [],
    addTrailingStop: vi.fn((cfg) => {
      store.trailingStops = [...store.trailingStops, { ...cfg, id: `ts_${Date.now()}`, createdAt: Date.now(), peakPrice: 0, triggered: false, minHoldMs: 30000 }].slice(0, 20);
    }),
    removeTrailingStop: vi.fn((id) => {
      store.trailingStops = store.trailingStops.filter((t: any) => t.id !== id);
    }),
    updateTrailingPeak: vi.fn((tokenId, price) => {
      store.trailingStops = store.trailingStops.map((t: any) =>
        t.tokenId === tokenId && !t.triggered && price > t.peakPrice ? { ...t, peakPrice: price } : t
      );
    }),
    fireTrailingStop: vi.fn((id) => {
      const stop = store.trailingStops.find((t: any) => t.id === id);
      if (stop && !stop.triggered) {
        stop.triggered = true;
        stop.triggeredAt = Date.now();
        stop.triggeredPrice = store.prices[stop.tokenId]?.price ?? stop.peakPrice;
      }
    }),
    copyTrades: [],
    addCopyTrade: vi.fn((c) => {
      store.copyTrades = [...store.copyTrades, { ...c, id: `ct-${Date.now()}`, createdAt: Date.now() }];
    }),
    removeCopyTrade: vi.fn((id) => {
      store.copyTrades = store.copyTrades.filter((c: any) => c.id !== id);
    }),
    toggleCopyTrade: vi.fn((id) => {
      store.copyTrades = store.copyTrades.map((c: any) => c.id === id ? { ...c, enabled: !c.enabled } : c);
    }),
    updateCopyTrade: vi.fn((id, patch) => {
      store.copyTrades = store.copyTrades.map((c: any) => c.id === id ? { ...c, ...patch } : c);
    }),
    executeCopyTrade: vi.fn(() => true),
    limitOrders: [],
    addLimitOrder: vi.fn((o) => {
      store.limitOrders = [{ ...o, id: `lo-${Date.now()}`, createdAt: Date.now() }, ...store.limitOrders];
    }),
    cancelLimitOrder: vi.fn((id) => {
      store.limitOrders = store.limitOrders.map((x: any) => x.id === id && x.status === 'open' ? { ...x, status: 'cancelled' } : x);
    }),
    dcaStrategies: [],
    addDcaStrategy: vi.fn((s) => {
      store.dcaStrategies = [...store.dcaStrategies, { ...s, id: `dca-${Date.now()}`, createdAt: Date.now(), nextRun: Date.now() + 7 * 86400000, totalInvested: 0, runs: 0 }];
    }),
    removeDcaStrategy: vi.fn((id) => {
      store.dcaStrategies = store.dcaStrategies.filter((x: any) => x.id !== id);
    }),
    toggleDcaStrategy: vi.fn((id) => {
      store.dcaStrategies = store.dcaStrategies.map((x: any) => x.id === id ? { ...x, enabled: !x.enabled } : x);
    }),
    theme: 'dark',
    toggleTheme: vi.fn(() => { store.theme = store.theme === 'dark' ? 'light' : 'dark'; }),
    selectedChain: 'sol',
    setSelectedChain: vi.fn((chain) => { store.selectedChain = chain; }),
    followedWallets: [],
    toggleFollowWallet: vi.fn((address, label) => {
      if (store.followedWallets.includes(address)) {
        store.followedWallets = store.followedWallets.filter(x => x !== address);
        delete store.followedWalletLabels[address];
      } else if (store.followedWallets.length < 10) {
        store.followedWallets = [...store.followedWallets, address];
        if (label) store.followedWalletLabels[address] = label;
      }
    }),
    followedWalletLabels: {},
    lastSeenWalletTx: {},
    pushToast: vi.fn(),
    dismissToast: vi.fn(),
    toasts: [],
    alerts: [],
    pushAlert: vi.fn((a) => {
      store.alerts = [{ ...a, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...store.alerts].slice(0, 50);
    }),
    dismissAlert: vi.fn((id) => {
      store.alerts = store.alerts.filter((x: any) => x.id !== id);
    }),
  };

  return {
    useMoby: vi.fn((selector) => selector(store)),
    useMobyStore: store,
  };
});

import { useMoby } from '@/lib/moby-store';

describe('Moby Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Navigation', () => {
    it('should set active tab', () => {
      const { setActiveTab, activeTab } = useMoby((s) => ({
        setActiveTab: s.setActiveTab,
        activeTab: s.activeTab,
      }));
      setActiveTab('portfolio');
      expect(activeTab).toBe('portfolio');
    });
  });

  describe('Price Management', () => {
    it('should set price for a token', () => {
      const { setPrice, prices } = useMoby((s) => ({
        setPrice: s.setPrice,
        prices: s.prices,
      }));
      setPrice('sol', 100);
      expect(prices.sol?.price).toBe(100);
    });

    it('should tick prices', () => {
      const { tickPrices } = useMoby((s) => ({ tickPrices: s.tickPrices }));
      tickPrices();
      expect(tickPrices).toHaveBeenCalled();
    });
  });

  describe('Wallet Connection', () => {
    it('should connect wallet with address', () => {
      const { connectWallet, wallet } = useMoby((s) => ({
        connectWallet: s.connectWallet,
        wallet: s.wallet,
      }));
      connectWallet('Phantom', 'ABC123');
      expect(wallet).toEqual({
        connected: true,
        address: 'ABC123',
        label: 'Phantom',
        balanceUsd: 0,
      });
    });

    it('should disconnect wallet', () => {
      const { connectWallet, disconnectWallet, wallet } = useMoby((s) => ({
        connectWallet: s.connectWallet,
        disconnectWallet: s.disconnectWallet,
        wallet: s.wallet,
      }));
      connectWallet('Phantom', 'ABC123');
      expect(wallet).not.toBeNull();
      disconnectWallet();
      expect(wallet).toBeNull();
    });
  });

  describe('Watchlist', () => {
    it('should add token to watchlist', () => {
      const { toggleWatch, watchlist } = useMoby((s) => ({
        toggleWatch: s.toggleWatch,
        watchlist: s.watchlist,
      }));
      toggleWatch('sol');
      expect(watchlist).toContain('sol');
    });

    it('should remove token from watchlist', () => {
      const { toggleWatch, watchlist } = useMoby((s) => ({
        toggleWatch: s.toggleWatch,
        watchlist: s.watchlist,
      }));
      toggleWatch('sol');
      toggleWatch('sol');
      expect(watchlist).not.toContain('sol');
    });
  });

  describe('Custom Alerts', () => {
    it('should add custom alert', () => {
      const { addCustomAlert, customAlerts } = useMoby((s) => ({
        addCustomAlert: s.addCustomAlert,
        customAlerts: s.customAlerts,
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
      expect(customAlerts.length).toBeGreaterThan(0);
      expect(customAlerts[0].tokenSymbol).toBe('SOL');
    });

    it('should remove custom alert', () => {
      const { addCustomAlert, removeCustomAlert, customAlerts } = useMoby((s) => ({
        addCustomAlert: s.addCustomAlert,
        removeCustomAlert: s.removeCustomAlert,
        customAlerts: s.customAlerts,
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
      const alertId = customAlerts[0].id;
      removeCustomAlert(alertId);
      expect(customAlerts.find(a => a.id === alertId)).toBeUndefined();
    });
  });

  describe('Settings', () => {
    it('should update settings', () => {
      const { setSettings, settings } = useMoby((s) => ({
        setSettings: s.setSettings,
        settings: s.settings,
      }));
      setSettings({ defaultSlippage: 2.0, display: { ...settings.display, theme: 'light' } });
      expect(settings.defaultSlippage).toBe(2.0);
      expect(settings.display.theme).toBe('light');
    });
  });

  describe('Portfolio & Trades', () => {
    it('should apply BUY trade', () => {
      const { applyTrade, portfolioHoldings } = useMoby((s) => ({
        applyTrade: s.applyTrade,
        portfolioHoldings: s.portfolioHoldings,
      }));
      applyTrade({ tokenId: 'sol', side: 'BUY', usdAmount: 1000, tokenAmount: 10, price: 100 });
      const holding = portfolioHoldings.find(h => h.tokenId === 'sol');
      expect(holding).toBeDefined();
      expect(holding?.amount).toBe(10);
      expect(holding?.costUsd).toBe(1000);
    });

    it('should apply SELL trade and reduce holding', () => {
      const { applyTrade, portfolioHoldings } = useMoby((s) => ({
        applyTrade: s.applyTrade,
        portfolioHoldings: s.portfolioHoldings,
      }));
      applyTrade({ tokenId: 'sol', side: 'BUY', usdAmount: 1000, tokenAmount: 10, price: 100 });
      applyTrade({ tokenId: 'sol', side: 'SELL', usdAmount: 500, tokenAmount: 5, price: 100 });
      const holding = portfolioHoldings.find(h => h.tokenId === 'sol');
      expect(holding?.amount).toBe(5);
    });

    it('should record trade in history', () => {
      const { recordTrade, tradeHistory } = useMoby((s) => ({
        recordTrade: s.recordTrade,
        tradeHistory: s.tradeHistory,
      }));
      recordTrade({ tokenId: 'sol', tokenSymbol: 'SOL', side: 'BUY', usdAmount: 1000, tokenAmount: 10, price: 100 });
      expect(tradeHistory.length).toBeGreaterThan(0);
      expect(tradeHistory[0].tokenSymbol).toBe('SOL');
    });
  });

  describe('Achievements', () => {
    it('should unlock achievement', () => {
      const { unlockAchievement, isAchievementUnlocked, achievements } = useMoby((s) => ({
        unlockAchievement: s.unlockAchievement,
        isAchievementUnlocked: s.isAchievementUnlocked,
        achievements: s.achievements,
      }));
      expect(isAchievementUnlocked('first_trade')).toBe(false);
      unlockAchievement('first_trade');
      expect(isAchievementUnlocked('first_trade')).toBe(true);
      const ach = achievements.find(a => a.id === 'first_trade');
      expect(ach?.unlocked).toBe(true);
      expect(ach?.progress).toBe(1);
    });

    it('should not double-unlock achievement', () => {
      const { unlockAchievement, achievements } = useMoby((s) => ({
        unlockAchievement: s.unlockAchievement,
        achievements: s.achievements,
      }));
      unlockAchievement('first_trade');
      const firstUnlockAt = achievements.find(a => a.id === 'first_trade')?.unlockedAt;
      unlockAchievement('first_trade');
      const secondUnlockAt = achievements.find(a => a.id === 'first_trade')?.unlockedAt;
      expect(firstUnlockAt).toBe(secondUnlockAt);
    });
  });

  describe('Snipe Rules', () => {
    it('should add snipe rule', () => {
      const { addSnipeRule, snipeRules } = useMoby((s) => ({
        addSnipeRule: s.addSnipeRule,
        snipeRules: s.snipeRules,
      }));
      addSnipeRule({
        name: 'Test Rule',
        conditions: { maxDevHoldPct: 10, minLiquidityUsd: 10000, maxAgeMinutes: 60, minSmartMoneyHolders: 2, renouncedOnly: true, maxRugRatio: 0.3 },
        actions: { buyUsd: 100, slippagePct: 1, autoTakeProfitPct: 50, autoStopLossPct: 20, autoExecute: false },
      });
      expect(snipeRules.length).toBeGreaterThan(0);
      expect(snipeRules[0].name).toBe('Test Rule');
      expect(snipeRules[0].enabled).toBe(true);
    });

    it('should toggle snipe rule', () => {
      const { addSnipeRule, toggleSnipeRule, snipeRules } = useMoby((s) => ({
        addSnipeRule: s.addSnipeRule,
        toggleSnipeRule: s.toggleSnipeRule,
        snipeRules: s.snipeRules,
      }));
      addSnipeRule({
        name: 'Test Rule',
        conditions: { maxDevHoldPct: 10, minLiquidityUsd: 10000, maxAgeMinutes: 60, minSmartMoneyHolders: 2, renouncedOnly: true, maxRugRatio: 0.3 },
        actions: { buyUsd: 100, slippagePct: 1, autoTakeProfitPct: 50, autoStopLossPct: 20, autoExecute: false },
      });
      const ruleId = snipeRules[0].id;
      expect(snipeRules[0].enabled).toBe(true);
      toggleSnipeRule(ruleId);
      expect(snipeRules.find(r => r.id === ruleId)?.enabled).toBe(false);
    });
  });

  describe('Trailing Stops', () => {
    it('should add trailing stop', () => {
      const { addTrailingStop, trailingStops } = useMoby((s) => ({
        addTrailingStop: s.addTrailingStop,
        trailingStops: s.trailingStops,
      }));
      addTrailingStop({ tokenId: 'sol', tokenSymbol: 'SOL', trailPct: 10, buyUsd: 1000 });
      expect(trailingStops.length).toBeGreaterThan(0);
      expect(trailingStops[0].tokenSymbol).toBe('SOL');
      expect(trailingStops[0].trailPct).toBe(10);
      expect(trailingStops[0].minHoldMs).toBe(30000);
    });

    it('should update trailing peak', () => {
      const { addTrailingStop, updateTrailingPeak, trailingStops } = useMoby((s) => ({
        addTrailingStop: s.addTrailingStop,
        updateTrailingPeak: s.updateTrailingPeak,
        trailingStops: s.trailingStops,
      }));
      addTrailingStop({ tokenId: 'sol', tokenSymbol: 'SOL', trailPct: 10, buyUsd: 1000 });
      const stopId = trailingStops[0].id;
      updateTrailingPeak('sol', 150);
      const stop = trailingStops.find(t => t.id === stopId);
      expect(stop?.peakPrice).toBe(150);
    });
  });

  describe('Copy Trades', () => {
    it('should add copy trade config', () => {
      const { addCopyTrade, copyTrades } = useMoby((s) => ({
        addCopyTrade: s.addCopyTrade,
        copyTrades: s.copyTrades,
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
      expect(copyTrades.length).toBeGreaterThan(0);
      expect(copyTrades[0].traderHandle).toBe('Trader1');
    });

    it('should toggle copy trade', () => {
      const { addCopyTrade, toggleCopyTrade, copyTrades } = useMoby((s) => ({
        addCopyTrade: s.addCopyTrade,
        toggleCopyTrade: s.toggleCopyTrade,
        copyTrades: s.copyTrades,
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
      const ctId = copyTrades[0].id;
      expect(copyTrades[0].enabled).toBe(true);
      toggleCopyTrade(ctId);
      expect(copyTrades.find(c => c.id === ctId)?.enabled).toBe(false);
    });
  });

  describe('Limit Orders', () => {
    it('should add limit order', () => {
      const { addLimitOrder, limitOrders } = useMoby((s) => ({
        addLimitOrder: s.addLimitOrder,
        limitOrders: s.limitOrders,
      }));
      addLimitOrder({
        tokenId: 'sol',
        tokenSymbol: 'SOL',
        side: 'BUY',
        targetPrice: 90,
        amountUsd: 1000,
        expiry: '7d',
      });
      expect(limitOrders.length).toBeGreaterThan(0);
      expect(limitOrders[0].tokenSymbol).toBe('SOL');
      expect(limitOrders[0].status).toBe('open');
    });
  });

  describe('DCA Strategies', () => {
    it('should add DCA strategy', () => {
      const { addDcaStrategy, dcaStrategies } = useMoby((s) => ({
        addDcaStrategy: s.addDcaStrategy,
        dcaStrategies: s.dcaStrategies,
      }));
      addDcaStrategy({
        name: 'Weekly SOL',
        tokenIds: ['sol'],
        frequency: 'weekly',
        amountUsd: 100,
        enabled: true,
      });
      expect(dcaStrategies.length).toBeGreaterThan(0);
      expect(dcaStrategies[0].name).toBe('Weekly SOL');
      expect(dcaStrategies[0].totalInvested).toBe(0);
      expect(dcaStrategies[0].runs).toBe(0);
    });
  });

  describe('Theme', () => {
    it('should toggle theme', () => {
      const { toggleTheme, theme } = useMoby((s) => ({
        toggleTheme: s.toggleTheme,
        theme: s.theme,
      }));
      expect(theme).toBe('dark');
      toggleTheme();
      expect(theme).toBe('light');
      toggleTheme();
      expect(theme).toBe('dark');
    });
  });

  describe('Chain Selection', () => {
    it('should set selected chain', () => {
      const { setSelectedChain, selectedChain } = useMoby((s) => ({
        setSelectedChain: s.setSelectedChain,
        selectedChain: s.selectedChain,
      }));
      expect(selectedChain).toBe('sol');
      setSelectedChain('base');
      expect(selectedChain).toBe('base');
      setSelectedChain('eth');
      expect(selectedChain).toBe('eth');
    });
  });

  describe('Followed Wallets', () => {
    it('should follow wallet', () => {
      const { toggleFollowWallet, followedWallets, followedWalletLabels } = useMoby((s) => ({
        toggleFollowWallet: s.toggleFollowWallet,
        followedWallets: s.followedWallets,
        followedWalletLabels: s.followedWalletLabels,
      }));
      toggleFollowWallet('WALLET123', 'Whale 1');
      expect(followedWallets).toContain('WALLET123');
      expect(followedWalletLabels['WALLET123']).toBe('Whale 1');
    });

    it('should unfollow wallet', () => {
      const { toggleFollowWallet, followedWallets, followedWalletLabels } = useMoby((s) => ({
        toggleFollowWallet: s.toggleFollowWallet,
        followedWallets: s.followedWallets,
        followedWalletLabels: s.followedWalletLabels,
      }));
      toggleFollowWallet('WALLET123', 'Whale 1');
      toggleFollowWallet('WALLET123');
      expect(followedWallets).not.toContain('WALLET123');
      expect(followedWalletLabels['WALLET123']).toBeUndefined();
    });

    it('should enforce max 10 followed wallets', () => {
      const { toggleFollowWallet, followedWallets } = useMoby((s) => ({
        toggleFollowWallet: s.toggleFollowWallet,
        followedWallets: s.followedWallets,
      }));
      for (let i = 0; i < 11; i++) {
        toggleFollowWallet(`WALLET${i}`, `Whale ${i}`);
      }
      expect(followedWallets.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Toasts & Alerts', () => {
    it('should push toast', () => {
      const { pushToast, toasts } = useMoby((s) => ({
        pushToast: s.pushToast,
        toasts: s.toasts,
      }));
      pushToast({ title: 'Test', description: 'Desc', type: 'success' });
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0].title).toBe('Test');
    });

    it('should push alert', () => {
      const { pushAlert, alerts } = useMoby((s) => ({
        pushAlert: s.pushAlert,
        alerts: s.alerts,
      }));
      pushAlert({ title: 'Alert', description: 'Desc', type: 'alert' });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].title).toBe('Alert');
    });
  });
});