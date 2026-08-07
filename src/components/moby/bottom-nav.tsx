"use client";

import { Home, Radio, Trophy, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMoby, type TabKey } from "@/lib/moby-store";
import { tabFromPathname, tabHref } from "@/lib/moby-navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const TABS: {
  key: TabKey;
  label: string;
  icon: typeof Home;
}[] = [
  { key: "discover", label: "Home", icon: Home },
  { key: "whales", label: "Feeds", icon: Radio },
  { key: "portfolio", label: "Leaderboard", icon: Trophy },
  { key: "profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const setActiveTab = useMoby((s) => s.setActiveTab);
  const alertsCount = useMoby((s) => s.alerts.length);
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = tabFromPathname(pathname);

  return (
    <nav
      className="sticky bottom-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border"
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                router.push(tabHref(tab.key));
              }}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-pill"
                  className="absolute -top-px h-0.5 w-10 rounded-full bg-bull"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive && "text-bull")} strokeWidth={isActive ? 2.4 : 1.8} />
                {tab.key === "whales" && alertsCount > 0 && (
                  <span className="absolute -top-1 -right-2 h-3.5 min-w-3.5 px-1 rounded-full bg-bear text-[9px] font-bold text-white grid place-items-center">
                    {alertsCount}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-medium", isActive && "text-bull")}>{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* iOS safe-area spacer */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
