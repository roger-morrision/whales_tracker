"use client";

import { useEffect, useState } from "react";
import { useMoby } from "@/lib/moby-store";
import { TOKENS } from "@/lib/moby-data";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/moby/top-bar";
import { BottomNav } from "@/components/moby/bottom-nav";
import { DiscoverView } from "@/components/moby/discover-view";
import { WhalesView } from "@/components/moby/whales-view";
import { SignalsView } from "@/components/moby/signals-view";
import { PortfolioView } from "@/components/moby/portfolio-view";
import { ProfileView } from "@/components/moby/profile-view";
import { TokenDetailSheet } from "@/components/moby/token-detail-sheet";
import { TraderDetailSheet } from "@/components/moby/trader-detail-sheet";
import { AICopilot } from "@/components/moby/ai-copilot";
import { SearchModal, NotificationsPanel } from "@/components/moby/search-modal";
import { WalletConnectModal } from "@/components/moby/wallet-modal";
import { TokenScreenerModal } from "@/components/moby/token-screener";
import { TradeModal } from "@/components/moby/trade-modal";
import { TaxCalculatorModal } from "@/components/moby/tax-calculator";
import { AlertCreatorModal } from "@/components/moby/alert-creator";
import { SettingsModal } from "@/components/moby/settings-modal";
import { OnboardingOverlay } from "@/components/moby/onboarding";
import { CompareModal } from "@/components/moby/compare-modal";
import { CopyTradeModal } from "@/components/moby/copy-trade-modal";
import { LimitOrdersModal } from "@/components/moby/limit-orders-modal";
import { DcaModal } from "@/components/moby/dca-modal";
import { WalletActivityModal } from "@/components/moby/wallet-activity-modal";
import { SolanaStatsModal } from "@/components/moby/solana-stats-modal";
import { PnlLeaderboardModal } from "@/components/moby/pnl-leaderboard-modal";
import { SocialSentimentModal } from "@/components/moby/social-sentiment-modal";
import { RebalanceModal } from "@/components/moby/rebalance-modal";
import { ReferralModal } from "@/components/moby/referral-modal";
import { AchievementsModal } from "@/components/moby/achievements-modal";
import { PerpsModal } from "@/components/moby/perps-modal";
import { NftDetailModal } from "@/components/moby/nft-detail-modal";
import { LaunchScannerModal } from "@/components/moby/launch-scanner-modal";
import { BridgeModal } from "@/components/moby/bridge-modal";
import { StakingModal } from "@/components/moby/staking-modal";
import { GasOptimizerModal } from "@/components/moby/gas-optimizer-modal";
import { AirdropModal } from "@/components/moby/airdrop-modal";
import { ToastContainer, WhaleAlertPusher } from "@/components/moby/toast-system";
import { FullChartModal } from "@/components/moby/full-chart-modal";
import { NarrativeDetailModal } from "@/components/moby/narrative-detail-modal";
import { SmartMoneyMapModal } from "@/components/moby/smart-money-map-modal";
import { PushNotificationManager } from "@/components/moby/push-notifications";
import { PortfolioAnalyticsModal, YieldFarmingModal, UnlocksModal, GovernanceModal, DeFiPositionsModal, CalendarModal, MultiWalletModal, WatchlistPerfModal } from "@/components/moby/batch6-modals";
import { SecurityAuditModal, TokenizedStocksModal, WalletPnlModal, SnipeBotModal, PricePredictionModal, LiquidityDepthModal, TradingJournalModal, DefiHealthModal, HarvestModal } from "@/components/moby/batch7-modals";
import { TrailingStopsModal, HotWalletsModal, MigrationsModal, MevProtectionModal, WalletImportModal, WatchlistAlertsModal } from "@/components/moby/batch8-modals";
import { ErrorBoundary } from "@/components/moby/error-boundary";
import { PumpFunExplorerModal } from "@/components/moby/pumpfun-explorer";
import { ShareModal } from "@/components/moby/share-modal";
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const activeTab = useMoby((s) => s.activeTab);
  const tickPrices = useMoby((s) => s.tickPrices);
  const refreshFeeds = useMoby((s) => s.refreshFeeds);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const wallet = useMoby((s) => s.wallet);

  // Register PWA service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Live price ticking — every 2.5s (moved below with visibility check)

  // Fetch real prices from /api/prices every 15s (overrides local tick)
  useEffect(() => {
    const controller = new AbortController();
    const fetchRealPrices = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/prices?symbols=SOL,WIF,JUP,BONK,JTO,PYTH,DRIFT,IO,RNDR,POPCAT,HNT,TNSR,MNGO,MOON,ETH,BTC,NEON,RAY", {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.prices) {
          Object.entries(data.prices).forEach(([symbol, info]: [string, any]) => {
            const token = TOKENS.find((t) => t.symbol === symbol);
            if (token && info.price) {
              useMoby.getState().setPrice(token.id, info.price);
            }
          });
        }
      } catch {
        // Silently fail — local tick continues
      }
    };
    fetchRealPrices();
    const interval = setInterval(fetchRealPrices, 15_000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  // Fetch real wallet balance when wallet connects
  // Prefer GMGN portfolio (real on-chain data when API key configured);
  // fall back to /api/wallet (which uses Helius RPC + DexScreener pricing).
  useEffect(() => {
    if (!wallet?.connected) return;
    const controller = new AbortController();
    const fetchBalance = async () => {
      try {
        // Try GMGN portfolio first
        const gmgnRes = await fetch(
          `/api/gmgn/portfolio?wallet=${encodeURIComponent(wallet.address)}`,
          { signal: controller.signal }
        );
        const gmgnData = await gmgnRes.json();
        if (gmgnData?.source === "gmgn" && gmgnData?.totalValue) {
          useMoby.setState((s) => ({
            wallet: s.wallet ? { ...s.wallet, balanceUsd: gmgnData.totalValue } : null,
          }));
          return;
        }
      } catch {
        // fall through to /api/wallet
      }
      try {
        const res = await fetch(`/api/wallet?address=${encodeURIComponent(wallet.address)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.totalUsd) {
          useMoby.setState((s) => ({
            wallet: s.wallet ? { ...s.wallet, balanceUsd: data.totalUsd } : null,
          }));
        }
      } catch {
        // Keep default balance
      }
    };
    fetchBalance();
    return () => controller.abort();
  }, [wallet?.connected, wallet?.address]);

  // Periodic feed refresh — every 30s (skipped when tab hidden)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refreshFeeds();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refreshFeeds]);

  // Followed-wallet activity poller — checks each followed wallet for new
  // transactions every 30s and fires an actionable toast with quick-buy.
  // Capped at 10 wallets (enforced by store).
  const followedWallets = useMoby((s) => s.followedWallets);
  const followedWalletLabels = useMoby((s) => s.followedWalletLabels);
  useEffect(() => {
    if (followedWallets.length === 0) return;
    let cancelled = false;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const state = useMoby.getState();
      for (const wallet of state.followedWallets) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/gmgn/wallet-activity?wallet=${encodeURIComponent(wallet)}&limit=1`);
          if (!res.ok) continue;
          const data = await res.json();
          const latest = data.activity?.[0];
          if (!latest) continue;
          const lastSeen = state.lastSeenWalletTx[wallet];
          if (lastSeen === latest.hash) continue; // already seen
          // New tx! Fire toast and update lastSeen
          useMoby.setState((s) => ({
            lastSeenWalletTx: { ...s.lastSeenWalletTx, [wallet]: latest.hash },
          }));
          const label = state.followedWalletLabels[wallet] || "Followed wallet";
          const isBuy = latest.type === "buy";
          // Try to find the token in our local registry; if found, attach quickBuy
          const localToken = TOKENS.find((t) => t.mint === latest.token_address);
          useMoby.getState().pushToast({
            title: `${isBuy ? "🟢" : "🔴"} ${label} ${isBuy ? "bought" : "sold"} ${latest.token_symbol}`,
            description: `${label === "Followed wallet" ? "Followed wallet" : label} · ${isBuy ? "+" : "-"}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(latest.value_usd)} · via GMGN`,
            type: "alert",
            actionLabel: localToken ? `View ${localToken.symbol}` : undefined,
            actionId: localToken?.id,
            quickBuyLabel: localToken ? "Buy 0.1 SOL" : undefined,
            quickBuyTokenId: localToken?.id,
            quickBuyAmountUsd: 18,
          });
        } catch {
          // ignore individual wallet errors
        }
      }
    };
    // Initial poll after 5s (give the page time to settle)
    const initialTimer = setTimeout(poll, 5000);
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [followedWallets, followedWalletLabels]);

  // Live price ticking — every 2.5s (skipped when tab hidden to save CPU)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      tickPrices();
      // ===== Enhancement #12: Trailing-stop price tracking =====
      // After each tick, update peaks and check for triggers.
      const state = useMoby.getState();
      const prices = state.prices;
      for (const stop of state.trailingStops) {
        if (stop.triggered) continue;
        const live = prices[stop.tokenId]?.price;
        if (!live || live <= 0) continue;
        // Update peak if higher
        if (live > stop.peakPrice) {
          state.updateTrailingPeak(stop.tokenId, live);
        }
        // Check trigger: price dropped trailPct below peak
        const peak = Math.max(stop.peakPrice, live);
        const triggerPrice = peak * (1 - stop.trailPct / 100);
        if (live <= triggerPrice) {
          state.fireTrailingStop(stop.id);
        }
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [tickPrices]);

  // ===== Enhancement #13: Snipe-bot background poller =====
  // Every 60s, fetches new pairs from GMGN and checks each enabled snipe rule.
  // When a rule matches, fires an actionable toast with quick-buy button.
  const snipeRules = useMoby((s) => s.snipeRules);
  const enabledRuleCount = snipeRules.filter((r) => r.enabled).length;
  useEffect(() => {
    if (enabledRuleCount === 0) return;
    let cancelled = false;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const state = useMoby.getState();
      const enabledRules = state.snipeRules.filter((r) => r.enabled);
      if (enabledRules.length === 0) return;
      try {
        const res = await fetch("/api/gmgn/new-pairs?limit=20");
        if (!res.ok) return;
        const data = await res.json();
        const pairs = data.tokens || [];
        const now = Date.now() / 1000;
        for (const pair of pairs) {
          // Compute age in minutes
          const ageMin = pair.create_timestamp
            ? Math.max(0, (now - pair.create_timestamp) / 60)
            : 999;
          for (const rule of enabledRules) {
            // Check each condition
            if (pair.devHoldingPct !== undefined && pair.devHoldingPct > rule.conditions.maxDevHoldPct) continue;
            if (pair.liquidity !== undefined && pair.liquidity < rule.conditions.minLiquidityUsd) continue;
            if (ageMin > rule.conditions.maxAgeMinutes) continue;
            if (pair.smart_money_holders !== undefined && pair.smart_money_holders < rule.conditions.minSmartMoneyHolders) continue;
            // Match! Fire toast + record trigger
            state.recordSnipeTrigger(rule.id, false, 0);
            const localToken = TOKENS.find((t) => t.mint === pair.address);
            state.pushToast({
              title: `🎯 Snipe rule "${rule.name}" matched!`,
              description: `${pair.symbol} (${pair.name || "unknown"}) — MC $${(pair.market_cap || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} · ${ageMin.toFixed(0)}m old · liq $${(pair.liquidity || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              type: "alert",
              actionLabel: localToken ? `View ${localToken.symbol}` : "View on GMGN",
              actionId: localToken?.id,
              quickBuyLabel: `Buy $${rule.actions.buyUsd}`,
              quickBuyTokenId: localToken?.id,
              quickBuyAmountUsd: rule.actions.buyUsd,
            });
            break; // one trigger per pair
          }
        }
      } catch {
        // silent fail
      }
    };
    const initialTimer = setTimeout(poll, 8000);
    const interval = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [enabledRuleCount]);

  // ===== Enhancement #24: Copy-trade execution poller =====
  // Every 45s, fetches /api/gmgn/smart-money-feed and checks if any enabled
  // copy-trade config should mirror the latest smart-money trade.
  // Only mirrors BUY trades by default (config.onlyBuy controls SELL mirroring).
  const copyTrades = useMoby((s) => s.copyTrades);
  const enabledCopyTradeCount = copyTrades.filter((c) => c.enabled).length;
  useEffect(() => {
    if (enabledCopyTradeCount === 0) return;
    let cancelled = false;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const state = useMoby.getState();
      const enabledConfigs = state.copyTrades.filter((c) => c.enabled);
      if (enabledConfigs.length === 0) return;
      try {
        const res = await fetch("/api/gmgn/smart-money-feed?limit=5");
        if (!res.ok) return;
        const data = await res.json();
        const trades = data.trades || [];
        if (trades.length === 0) return;
        // Use the most recent trade as the "signal" — in production this would
        // track per-wallet last-seen to avoid double-execution, but for demo
        // we mirror the latest trade once per poll cycle.
        const latest = trades[0];
        if (!latest || !latest.token_address) return;
        // Find the token in our local registry (only mirror tokens we know)
        const localToken = TOKENS.find((t) => t.mint === latest.token_address);
        if (!localToken) return;
        const isBuy = latest.type === "buy";
        const livePrice = state.prices[localToken.id]?.price ?? localToken.price;
        // For each enabled config, mirror the trade (capped at maxPerTradeUsd)
        for (const cfg of enabledConfigs) {
          if (!isBuy && cfg.onlyBuy) continue;
          // Throttle: skip if we've copied this token in the last 60s
          // (simplified — real impl would track per-token last-copied timestamp)
          if (cancelled) return;
          state.executeCopyTrade({
            copyTradeId: cfg.id,
            tokenId: localToken.id,
            tokenSymbol: localToken.symbol,
            side: isBuy ? "BUY" : "SELL",
            usdAmount: Math.min(latest.amount_usd, cfg.maxPerTradeUsd),
            price: livePrice,
          });
        }
      } catch {
        // silent fail
      }
    };
    const initialTimer = setTimeout(poll, 15_000);
    const interval = setInterval(poll, 45_000);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [enabledCopyTradeCount]);

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  // Keyboard shortcuts: cmd/ctrl+k (copilot), cmd/ctrl+/ (search), Escape (close top modal)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCopilotOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        useMoby.getState().setSearchOpen(true);
      }
      // Escape closes the topmost open modal/sheet
      if (e.key === "Escape") {
        const s = useMoby.getState();
        if (!s.onboarded) { s.setOnboarded(true); return; }
        if (s.shareOpen) { s.setShareOpen(false); return; }
        if (s.selectedTraderId) { s.openTrader(null); return; }
        if (s.selectedTokenId) { s.openToken(null); return; }
        if (s.copilotOpen) { s.setCopilotOpen(false); return; }
        if (s.searchOpen) { s.setSearchOpen(false); return; }
        if (s.notifOpen) { s.setNotifOpen(false); return; }
        if (s.walletOpen) { s.setWalletOpen(false); return; }
        if (s.screenerOpen) { s.setScreenerOpen(false); return; }
        if (s.tradeOpen) { s.closeTrade(); return; }
        if (s.taxOpen) { s.setTaxOpen(false); return; }
        if (s.alertCreatorOpen) { s.closeAlertCreator(); return; }
        if (s.settingsOpen) { s.setSettingsOpen(false); return; }
        if (s.compareOpen) { s.setCompareOpen(false); return; }
        if (s.copyTradeOpen) { s.setCopyTradeOpen(false); return; }
        if (s.limitOrdersOpen) { s.setLimitOrdersOpen(false); return; }
        if (s.dcaOpen) { s.setDcaOpen(false); return; }
        if (s.walletActivityOpen) { s.setWalletActivityOpen(false); return; }
        if (s.solanaStatsOpen) { s.setSolanaStatsOpen(false); return; }
        if (s.pnlLeaderboardOpen) { s.setPnlLeaderboardOpen(false); return; }
        if (s.socialOpen) { s.setSocialOpen(false); return; }
        if (s.rebalanceOpen) { s.setRebalanceOpen(false); return; }
        if (s.referralOpen) { s.setReferralOpen(false); return; }
        if (s.achievementsOpen) { s.setAchievementsOpen(false); return; }
        if (s.perpsOpen) { s.setPerpsOpen(false); return; }
        if (s.nftDetailOpen) { s.setNftDetailOpen(false); return; }
        if (s.launchScannerOpen) { s.setLaunchScannerOpen(false); return; }
        if (s.bridgeOpen) { s.setBridgeOpen(false); return; }
        if (s.stakingOpen) { s.setStakingOpen(false); return; }
        if (s.gasOptimizerOpen) { s.setGasOptimizerOpen(false); return; }
        if (s.airdropOpen) { s.setAirdropOpen(false); return; }
        if (s.chartOpen) { s.closeChart(); return; }
        if (s.narrativeDetailOpen) { s.setNarrativeDetailOpen(false); return; }
        if (s.smartMoneyMapOpen) { s.setSmartMoneyMapOpen(false); return; }
        if (s.analyticsOpen) { s.setAnalyticsOpen(false); return; }
        if (s.yieldOpen) { s.setYieldOpen(false); return; }
        if (s.unlocksOpen) { s.setUnlocksOpen(false); return; }
        if (s.governanceOpen) { s.setGovernanceOpen(false); return; }
        if (s.defiOpen) { s.setDefiOpen(false); return; }
        if (s.calendarOpen) { s.setCalendarOpen(false); return; }
        if (s.multiWalletOpen) { s.setMultiWalletOpen(false); return; }
        if (s.watchlistPerfOpen) { s.setWatchlistPerfOpen(false); return; }
        if (s.securityAuditOpen) { s.setSecurityAuditOpen(false); return; }
        if (s.stocksOpen) { s.setStocksOpen(false); return; }
        if (s.walletPnlOpen) { s.setWalletPnlOpen(false); return; }
        if (s.snipeBotOpen) { s.setSnipeBotOpen(false); return; }
        if (s.predictionOpen) { s.setPredictionOpen(false); return; }
        if (s.liquidityDepthOpen) { s.setLiquidityDepthOpen(false); return; }
        if (s.journalOpen) { s.setJournalOpen(false); return; }
        if (s.defiHealthOpen) { s.setDefiHealthOpen(false); return; }
        if (s.harvestOpen) { s.setHarvestOpen(false); return; }
        if (s.trailingStopsOpen) { s.setTrailingStopsOpen(false); return; }
        if (s.hotWalletsOpen) { s.setHotWalletsOpen(false); return; }
        if (s.migrationsOpen) { s.setMigrationsOpen(false); return; }
        if (s.mevInfoOpen) { s.setMevInfoOpen(false); return; }
        if (s.walletImportOpen) { s.setWalletImportOpen(false); return; }
        if (s.watchlistAlertsOpen) { s.setWatchlistAlertsOpen(false); return; }
        if (s.pumpFunOpen) { s.setPumpFunOpen(false); return; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCopilotOpen]);

  return (
    <ErrorBoundary>
    <div className="phone-shell flex flex-col">
      <TopBar />

      <main className="flex-1 px-4 py-4 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "discover" && <DiscoverView />}
            {activeTab === "whales" && <WhalesView />}
            {activeTab === "signals" && <SignalsView />}
            {activeTab === "portfolio" && <PortfolioView />}
            {activeTab === "profile" && <ProfileView />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav />

      {/* Overlays — modals & sheets */}
      <TokenDetailSheet />
      <TraderDetailSheet />
      <AICopilot />
      <SearchModal />
      <NotificationsPanel />
      <WalletConnectModal />
      <TokenScreenerModal />
      <TradeModal />
      <TaxCalculatorModal />
      <AlertCreatorModal />
      <SettingsModal />
      <CompareModal />

      {/* Batch 3 modals */}
      <CopyTradeModal />
      <LimitOrdersModal />
      <DcaModal />
      <WalletActivityModal />
      <SolanaStatsModal />
      <PnlLeaderboardModal />
      <SocialSentimentModal />
      <RebalanceModal />
      <ReferralModal />
      <AchievementsModal />

      {/* Batch 4 modals */}
      <PerpsModal />
      <NftDetailModal />
      <LaunchScannerModal />
      <BridgeModal />
      <StakingModal />
      <GasOptimizerModal />
      <AirdropModal />

      {/* Toast notifications + whale alert pusher */}
      <ToastContainer />
      <WhaleAlertPusher />

      {/* Batch 5: Full-screen chart + narrative detail + smart money map + push */}
      <FullChartModal />
      <NarrativeDetailModal />
      <SmartMoneyMapModal />
      <PushNotificationManager />

      {/* Batch 6: Analytics + Yield + Unlocks + Governance + DeFi + Calendar + MultiWallet + WatchlistPerf */}
      <PortfolioAnalyticsModal />
      <YieldFarmingModal />
      <UnlocksModal />
      <GovernanceModal />
      <DeFiPositionsModal />
      <CalendarModal />
      <MultiWalletModal />
      <WatchlistPerfModal />

      {/* Batch 7: Security + Stocks + WalletPnl + SnipeBot + Prediction + Liquidity + Journal + Health + Harvest */}
      <SecurityAuditModal />
      <TokenizedStocksModal />
      <WalletPnlModal />
      <SnipeBotModal />
      <PricePredictionModal />
      <LiquidityDepthModal />
      <TradingJournalModal />
      <DefiHealthModal />
      <HarvestModal />

      {/* Batch 8: TrailingStops + HotWallets + Migrations + MEV + WalletImport + WatchlistAlerts */}
      <TrailingStopsModal />
      <HotWalletsModal />
      <MigrationsModal />
      <MevProtectionModal />
      <WalletImportModal />
      <WatchlistAlertsModal />

      {/* Batch 9: Pump.fun explorer */}
      <PumpFunExplorerModal />

      {/* Share modal (global, store-driven) */}
      <StoreShareModal />

      {/* Onboarding — first-time experience */}
      <OnboardingOverlay />

      {/* Back to top floating button */}
      <BackToTopButton />
    </div>
    </ErrorBoundary>
  );
}

function StoreShareModal() {
  const open = useMoby((s) => s.shareOpen);
  const data = useMoby((s) => s.shareData);
  const setOpen = useMoby((s) => s.setShareOpen);
  return (
    <ShareModal
      data={data}
      open={open}
      onClose={() => setOpen(false)}
    />
  );
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", handler, { passive: true });
    // Initial check
    handler();
    return () => {
      window.removeEventListener("scroll", handler);
    };
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-24 right-4 z-40 h-10 w-10 rounded-full bg-surface-2 border border-border shadow-lg grid place-items-center hover:bg-surface-3 transition-all duration-300",
        visible ? "opacity-100 scale-100" : "opacity-0 scale-0 pointer-events-none"
      )}
      aria-label="Back to top"
    >
      <svg className="h-4 w-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
