"use client";

import { useEffect } from "react";
import { useMoby } from "@/lib/moby-store";
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
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const activeTab = useMoby((s) => s.activeTab);
  const tickPrices = useMoby((s) => s.tickPrices);
  const refreshFeeds = useMoby((s) => s.refreshFeeds);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);

  // Live price ticking — every 2.5s
  useEffect(() => {
    const interval = setInterval(() => {
      tickPrices();
    }, 2500);
    return () => clearInterval(interval);
  }, [tickPrices]);

  // Periodic feed refresh — every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      refreshFeeds();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refreshFeeds]);

  // Keyboard shortcut for AI copilot: cmd/ctrl + k
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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCopilotOpen]);

  return (
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

      {/* Onboarding — first-time experience */}
      <OnboardingOverlay />
    </div>
  );
}
