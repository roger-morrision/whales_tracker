"use client";

import { useState } from "react";
import { RotateCcw, Filter, Target, Waves, TrendingUp, CalendarDays } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { cn } from "@/lib/utils";
import { WhalesView } from "./whales-view";
import { SignalsView } from "./signals-view";

type FeedTab = "whale-watch" | "movers" | "dcas";

const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: "whale-watch", label: "Whale Watch" },
  { key: "movers", label: "Movers" },
  { key: "dcas", label: "DCAs" },
];

export function FeedsView() {
  const [tab, setTab] = useState<FeedTab>("whale-watch");
  const [filtersVisible, setFiltersVisible] = useState(true);
  const followedWallets = useMoby((s) => s.followedWallets);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FEED_TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              tab === item.key
                ? "bg-bull text-background"
                : "text-foreground/80 hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtersVisible && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface-2/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-bull" />
            <FilterChip active>{tab === "movers" ? "Mid Cap" : "(1) Transactions"}</FilterChip>
            <FilterChip>{tab === "movers" ? "Period" : "Whales"}</FilterChip>
            <FilterChip>{tab === "movers" ? "Advanced" : "Top Traders"}</FilterChip>
            <button
              onClick={() => setFiltersVisible(false)}
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
            >
              Hide
            </button>
          </div>
          <button
            onClick={() => useMoby.getState().pushToast({
              title: "Filters reset",
              description: "Feed filters were reset to the Moby-style defaults.",
              type: "info",
            })}
            className="inline-flex items-center gap-2 text-sm font-medium text-bull"
          >
            <RotateCcw className="h-4 w-4" />
            Reset filters
          </button>
        </div>
      )}

      {!filtersVisible && (
        <button
          onClick={() => setFiltersVisible(true)}
          className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Show filters
        </button>
      )}

      {tab === "whale-watch" && <WhalesView />}
      {tab === "movers" && <SignalsView />}
      {tab === "dcas" && <DcasPanel followedWallets={followedWallets.length} />}
    </div>
  );
}

function FilterChip({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-bull/40 bg-bull/10 text-bull"
          : "border-border bg-background/40 text-foreground/80 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function DcasPanel({ followedWallets }: { followedWallets: number }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-[#14F195]/10 via-surface-2 to-surface-2 p-4">
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-bull" />
          <span className="text-sm font-semibold">Recurring smart-money trading</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Set up Moby-style DCA automation for the wallets and tokens you follow most.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <QuickAction
          icon={<Target className="h-4 w-4" />}
          title="Token DCA"
          subtitle="Buy on schedule"
          onClick={() => useMoby.getState().setDcaOpen(true)}
        />
        <QuickAction
          icon={<Waves className="h-4 w-4" />}
          title="Copy whales"
          subtitle={`${followedWallets} tracked`}
          onClick={() => useMoby.getState().setCopyTradeOpen(true)}
        />
        <QuickAction
          icon={<TrendingUp className="h-4 w-4" />}
          title="Limit ladder"
          subtitle="Scale entries"
          onClick={() => useMoby.getState().setLimitOrdersOpen(true)}
        />
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-surface-2/30 p-3">
        {[
          ["SOL momentum", "Buy 0.15 SOL every 4h when smart-money net flow is positive."],
          ["Whale copy basket", "Mirror buys from followed wallets with a capped daily budget."],
          ["Dip accumulator", "Average into tracked tokens while preserving stop-loss discipline."],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-xl border border-border bg-background/40 p-3">
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-border bg-surface-2 p-3 text-left transition-colors hover:border-bull/30 hover:bg-surface-3"
    >
      <div className="mb-2 text-bull">{icon}</div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[11px] text-muted-foreground">{subtitle}</div>
    </button>
  );
}
