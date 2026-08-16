"use client";

import Link from "next/link";
import { Home, Radio, Trophy, User, Zap } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMoby, type TabKey } from "@/lib/moby-store";
import { tabFromPathname, tabHref } from "@/lib/moby-navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "discover", label: "Discover", icon: Home },
  { key: "whales", label: "Whales", icon: Radio },
  { key: "signals", label: "Signals", icon: Zap },
  { key: "portfolio", label: "Leaders", icon: Trophy },
  { key: "profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const alertsCount = useMoby((s) => s.alerts.length);
  const activeTab = tabFromPathname(usePathname());

  return (
    <nav className="sticky bottom-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border" aria-label="Primary">
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Link key={tab.key} href={tabHref(tab.key)} aria-current={isActive ? "page" : undefined}
              className={cn("relative flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 transition-colors", isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {isActive && <motion.span layoutId="tab-pill" className="absolute -top-px h-0.5 w-10 rounded-full bg-bull" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative">
                <Icon className={cn("h-5 w-5", isActive && "text-bull")} strokeWidth={isActive ? 2.4 : 1.8} />
                {tab.key === "whales" && alertsCount > 0 && <span aria-label={`${alertsCount} alerts`} className="absolute -right-2 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-bear px-1 text-[9px] font-bold text-white">{alertsCount}</span>}
              </span>
              <span className={cn("text-[9px] min-[360px]:text-[10px] font-medium", isActive && "text-bull")}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
