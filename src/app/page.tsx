"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useMoby } from "@/lib/moby-store";
import { tabFromPathname, tabHref } from "@/lib/moby-navigation";
import { TOKENS } from "@/lib/moby-data";
import { getCurrentCongestion, computeAutoPriorityFee } from "@/lib/moby-data";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/moby/top-bar";
import ActionBar from "@/components/moby/action-bar";
import { BottomNav } from "@/components/moby/bottom-nav";
import { DiscoverView } from "@/components/moby/discover-view";
import { FeedsView } from "@/components/moby/feeds-view";
import { WhalesView } from "@/components/moby/whales-view";
import { SignalsView } from "@/components/moby/signals-view";
import { PortfolioView } from "@/components/moby/portfolio-view";
import { ProfileView } from "@/components/moby/profile-view";
import { LeaderboardView } from "@/components/moby/leaderboard-view";
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
import { ToastContainer, WhaleAlertPusher } from "@/components/moby/toast-system";
import { PushNotificationManager } from "@/components/moby/push-notifications";
import { ErrorBoundary } from "@/components/moby/error-boundary";
import { ShareModal } from "@/components/moby/share-modal";
import { TokenListModal } from "@/components/moby/token-list-modal";
import { WalletDetailSheet } from "@/components/moby/wallet-detail-sheet";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Compass, PieChart, User, Waves, Zap } from "lucide-react";
import type { TabKey } from "@/lib/moby-store";

// Code-split heavy modals (recharts, lightweight-charts, large data sets)
// These load on-demand when first opened, reducing initial JS bundle by ~400-600KB.
const FullChartModal = dynamic(() => import("@/components/moby/full-chart-modal").then(m => ({ default: m.FullChartModal })), { ssr: false, loading: () => null });
const NarrativeDetailModal = dynamic(() => import("@/components/moby/narrative-detail-modal").then(m => ({ default: m.NarrativeDetailModal })), { ssr: false, loading: () => null });
const SmartMoneyMapModal = dynamic(() => import("@/components/moby/smart-money-map-modal").then(m => ({ default: m.SmartMoneyMapModal })), { ssr: false, loading: () => null });
const PerpsModal = dynamic(() => import("@/components/moby/perps-modal").then(m => ({ default: m.PerpsModal })), { ssr: false, loading: () => null });
const NftDetailModal = dynamic(() => import("@/components/moby/nft-detail-modal").then(m => ({ default: m.NftDetailModal })), { ssr: false, loading: () => null });
const LaunchScannerModal = dynamic(() => import("@/components/moby/launch-scanner-modal").then(m => ({ default: m.LaunchScannerModal })), { ssr: false, loading: () => null });
const BridgeModal = dynamic(() => import("@/components/moby/bridge-modal").then(m => ({ default: m.BridgeModal })), { ssr: false, loading: () => null });
const StakingModal = dynamic(() => import("@/components/moby/staking-modal").then(m => ({ default: m.StakingModal })), { ssr: false, loading: () => null });
const GasOptimizerModal = dynamic(() => import("@/components/moby/gas-optimizer-modal").then(m => ({ default: m.GasOptimizerModal })), { ssr: false, loading: () => null });
const AirdropModal = dynamic(() => import("@/components/moby/airdrop-modal").then(m => ({ default: m.AirdropModal })), { ssr: false, loading: () => null });
const PumpFunExplorerModal = dynamic(() => import("@/components/moby/pumpfun-explorer").then(m => ({ default: m.PumpFunExplorerModal })), { ssr: false, loading: () => null });

const Batch6Modals = dynamic(() => import("@/components/moby/batch6-modals"), { ssr: false, loading: () => null });
const Batch7Modals = dynamic(() => import("@/components/moby/batch7-modals"), { ssr: false, loading: () => null });
const Batch8Modals = dynamic(() => import("@/components/moby/batch8-modals"), { ssr: false, loading: () => null });

export function MobyApp({ forcedTab }: { forcedTab?: TabKey }) {
  const activeTab = useMoby((s) => s.activeTab);
  const setActiveTab = useMoby((s) => s.setActiveTab);
  const tickPrices = useMoby((s) => s.tickPrices);
  const refreshFeeds = useMoby((s) => s.refreshFeeds);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const wallet = useMoby((s) => s.wallet);
  const theme = useMoby((s) => s.theme);
  const pathname = usePathname();

  useEffect(() => {
    setActiveTab(forcedTab ?? tabFromPathname(pathname));
  }, [forcedTab, pathname, setActiveTab]);

  // Apply theme to document element
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  // Register PWA service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalDev =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

    if (isLocalDev) {
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            caches.delete(key).catch(() => {});
          });
        }).catch(() => {});
      }
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {});
        });
      }).catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
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
      // ===== Enhancement: Real-time price alert checking =====
      // After each price tick, check all active, non-triggered custom alerts.
      const ts = useMoby.getState();
      const ps = ts.prices;
      for (const alert of ts.customAlerts) {
        if (!alert.active || alert.triggered) continue;
        const live = ps[alert.tokenId]?.price;
        if (!live || live <= 0) continue;
        if (alert.condition === "price_above" && live >= alert.threshold) {
          ts.triggerCustomAlert(alert.id);
        } else if (alert.condition === "price_below" && live <= alert.threshold) {
          ts.triggerCustomAlert(alert.id);
        }
        // smart_money_inflow / smart_money_outflow / new_whale_buy conditions
        // are checked by the whale alert pusher + GMGN feed pollers, not here.
      }
      // ===== Enhancement #12: Trailing-stop price tracking =====
      // After each tick, update peaks and check for triggers.
      const state = useMoby.getState();
      const prices = state.prices;
      const nowMs = Date.now();
      for (const stop of state.trailingStops) {
        if (stop.triggered) continue;
        const live = prices[stop.tokenId]?.price;
        if (!live || live <= 0) continue;
        // Enforce minimum hold time — don't trigger within 30s of creation
        // (prevents instant fires on the same candle the user created it)
        const minHoldMs = stop.minHoldMs ?? 30_000;
        if (nowMs - stop.createdAt < minHoldMs) continue;
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
  // Note: deps are empty because the poll reads fresh state via useMoby.getState()
  // on each iteration — we don't need to restart the interval when configs change.
  useEffect(() => {
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
            const localToken = TOKENS.find((t) => t.mint === pair.address);
            const buyUsd = rule.actions.buyUsd;
            const livePrice = localToken
              ? (state.prices[localToken.id]?.price ?? localToken.price)
              : (pair.price || 0);

            // Auto-execute the buy if enabled AND we have a local token mapping
            let executed = false;
            if (rule.actions.autoExecute && localToken && livePrice > 0) {
              try {
                state.applyTrade({
                  tokenId: localToken.id,
                  side: "BUY",
                  usdAmount: buyUsd,
                  tokenAmount: buyUsd / livePrice,
                  price: livePrice,
                });
                state.recordTrade({
                  tokenId: localToken.id,
                  tokenSymbol: localToken.symbol,
                  side: "BUY",
                  usdAmount: buyUsd,
                  tokenAmount: buyUsd / livePrice,
                  price: livePrice,
                  txHash: `snipe_${rule.id}_${Date.now()}`,
                });
                executed = true;
                state.recordSnipeTrigger(rule.id, true, 0);
              } catch {
                // execution failed — fall through to toast-only
              }
            } else {
              state.recordSnipeTrigger(rule.id, false, 0);
            }

            state.pushToast({
              title: `🎯 Snipe rule "${rule.name}" matched!`,
              description: executed
                ? `✓ Auto-bought ${localToken?.symbol || pair.symbol} for $${buyUsd} at $${livePrice.toFixed(6)}`
                : `${pair.symbol} (${pair.name || "unknown"}) — MC $${(pair.market_cap || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} · ${ageMin.toFixed(0)}m old · liq $${(pair.liquidity || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              type: executed ? "success" : "alert",
              actionLabel: localToken ? `View ${localToken.symbol}` : "View on GMGN",
              actionId: localToken?.id,
              quickBuyLabel: !executed && localToken ? `Buy $${buyUsd}` : undefined,
              quickBuyTokenId: localToken?.id,
              quickBuyAmountUsd: buyUsd,
            });

            // #25: Push a secondary toast with the auto-computed gas fee
            const congestion = getCurrentCongestion();
            const fee = computeAutoPriorityFee(congestion);
            state.pushToast({
              title: `⛽ Auto priority fee: ${fee.label}`,
              description: `${fee.microLamports.toLocaleString()} μLamports · ~$${fee.feeUsd.toFixed(6)} · ${congestion > 70 ? "High" : congestion > 40 ? "Medium" : "Low"} congestion (${congestion}%) · ${fee.confidence.toFixed(0)}% confidence`,
              type: "info",
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
  }, []);

  // ===== Enhancement #24: Copy-trade execution poller =====
  // Every 45s, fetches /api/gmgn/smart-money-feed and checks if any enabled
  // copy-trade config should mirror the latest smart-money trade.
  // Only mirrors BUY trades by default (config.onlyBuy controls SELL mirroring).
  // Note: deps are empty — poll reads fresh state via useMoby.getState().
  useEffect(() => {
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
        // Use the most recent trade as the "signal"
        const latest = trades[0];
        if (!latest || !latest.token_address) return;
        // Build a dedup hash for this trade (token + ts + type)
        const tradeHash = `${latest.token_address}_${latest.ts}_${latest.type}`;
        // Find the token in our local registry (only mirror tokens we know)
        const localToken = TOKENS.find((t) => t.mint === latest.token_address);
        if (!localToken) return;
        const isBuy = latest.type === "buy";
        const livePrice = state.prices[localToken.id]?.price ?? localToken.price;
        // For each enabled config, mirror the trade (capped at maxPerTradeUsd)
        for (const cfg of enabledConfigs) {
          if (!isBuy && cfg.onlyBuy) continue;
          if (cancelled) return;
          // Dedup: skip if we already mirrored this exact trade
          if (cfg.lastMirroredTxHash === tradeHash) continue;
          const executed = state.executeCopyTrade({
            copyTradeId: cfg.id,
            tokenId: localToken.id,
            tokenSymbol: localToken.symbol,
            side: isBuy ? "BUY" : "SELL",
            usdAmount: Math.min(latest.amount_usd, cfg.maxPerTradeUsd),
            price: livePrice,
          });
          // Record dedup hash so we don't mirror the same trade again
          if (executed) {
            state.updateCopyTrade(cfg.id, {
              lastMirroredTxHash: tradeHash,
              lastMirroredAt: Date.now(),
            });
          }
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
  }, []);

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
        if (s.walletDetailOpen) { s.setWalletDetailOpen(false); return; }
        if (s.tokenListOpen) { s.setTokenListOpen(false); return; }
        // Trade modal closes before token-detail-sheet (it's visually on top)
        if (s.tradeOpen) { s.closeTrade(); return; }
        if (s.selectedTraderId) { s.openTrader(null); return; }
        if (s.selectedTokenId) { s.openToken(null); return; }
        if (s.copilotOpen) { s.setCopilotOpen(false); return; }
        if (s.searchOpen) { s.setSearchOpen(false); return; }
        if (s.notifOpen) { s.setNotifOpen(false); return; }
        if (s.walletOpen) { s.setWalletOpen(false); return; }
        if (s.screenerOpen) { s.setScreenerOpen(false); return; }
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
      <div className="app-shell">
        <DesktopRail />
        <div className="phone-shell">
          <TopBar />
          {activeTab !== "discover" && <ActionBar />}

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
                {activeTab === "whales" && <FeedsView />}
                {activeTab === "signals" && <SignalsView />}
                {activeTab === "portfolio" && <LeaderboardView />}
                {activeTab === "profile" && <ProfileView />}
              </motion.div>
            </AnimatePresence>
          </main>

          <BottomNav />

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
          <PerpsModal />
          <NftDetailModal />
          <LaunchScannerModal />
          <BridgeModal />
          <StakingModal />
          <GasOptimizerModal />
          <AirdropModal />
          <ToastContainer />
          <WhaleAlertPusher />
          <FullChartModal />
          <NarrativeDetailModal />
          <SmartMoneyMapModal />
          <PushNotificationManager />
          <Batch6Modals />
          <Batch7Modals />
          <Batch8Modals />
          <PumpFunExplorerModal />
          <TokenListModal />
          <WalletDetailSheet />
          <StoreShareModal />
          <OnboardingOverlay />
          <BackToTopButton />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function Home() {
  return <MobyApp forcedTab="discover" />;
}

function DesktopRail() {
  const alertsCount = useMoby((s) => s.alerts.length);
  const wallet = useMoby((s) => s.wallet);
  const activeTab = useMoby((s) => s.activeTab);

  const shortcuts: { tab: TabKey; label: string; note: string }[] = [
    { tab: "discover", label: "Discover", note: "Live discovery and market focus" },
    { tab: "whales", label: "Whales", note: "Wallet flows and trader rankings" },
    { tab: "signals", label: "Signals", note: "Actionable entries and alerts" },
    { tab: "portfolio", label: "Portfolio", note: "Holdings, PnL, and allocation" },
    { tab: "profile", label: "Profile", note: "Settings, achievements, and account" },
  ];

  return (
    <aside className="desktop-rail">
      <div className="flex w-full flex-col rounded-[28px] border border-border bg-surface/75 p-6 shadow-[0_30px_120px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Moby Command</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Desktop now shows the same trading app without the forced phone frame, while keeping mobile behavior intact.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Status</div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wallet</span>
              <span className="font-medium">{wallet?.connected ? wallet.label : "Not connected"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Alerts</span>
              <span className="font-medium">{alertsCount}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/70 p-2">
            {shortcuts.map(({ tab, label, note }) => {
              const Icon = railIcons[tab];
              const isActive = activeTab === tab;
              return (
                <Link
                  key={tab}
                  href={tabHref(tab)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
                    isActive ? "bg-bull/12 text-foreground" : "hover:bg-surface-2"
                  )}
                >
                  <div
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-2xl",
                      isActive ? "bg-bull text-background" : "bg-surface-2 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{note}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

const railIcons = {
  discover: Compass,
  whales: Waves,
  signals: Zap,
  portfolio: PieChart,
  profile: User,
};

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
    // The scroll container is <main>, not window — find it and listen to its scroll.
    // Use a small delay to ensure the element is mounted.
    const findMain = () => {
      const main = document.querySelector("main");
      if (!main) return null;
      const handler = () => setVisible(main.scrollTop > 400);
      handler();
      main.addEventListener("scroll", handler, { passive: true });
      return { main, handler };
    };
    let cleanup: { main: Element; handler: () => void } | null = null;
    const initTimer = setTimeout(() => {
      cleanup = findMain();
    }, 500);
    return () => {
      clearTimeout(initTimer);
      if (cleanup) {
        cleanup.main.removeEventListener("scroll", cleanup.handler);
      }
    };
  }, []);

  const scrollToTop = () => {
    const main = document.querySelector("main");
    if (main) {
      main.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <button
      onClick={scrollToTop}
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

