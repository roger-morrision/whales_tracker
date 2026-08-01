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

      {/* Overlays */}
      <TokenDetailSheet />
      <TraderDetailSheet />
      <AICopilot />
      <SearchModal />
      <NotificationsPanel />
    </div>
  );
}
