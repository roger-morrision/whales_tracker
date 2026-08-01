"use client";

import { Search, Bell, Sparkles, Wallet } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { MobyLogo } from "./primitives";
import { TOKENS, fmtPrice, fmtPct } from "@/lib/moby-data";
import { cn } from "@/lib/utils";

/**
 * Top bar with logo, search trigger, notifications, AI copilot trigger.
 * Below it: a marquee ticker tape with all token prices.
 */
export function TopBar() {
  const setSearchOpen = useMoby((s) => s.setSearchOpen);
  const setNotifOpen = useMoby((s) => s.setNotifOpen);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const alerts = useMoby((s) => s.alerts);
  const setActiveTab = useMoby((s) => s.setActiveTab);

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <button onClick={() => setActiveTab("discover")} aria-label="Moby home">
          <MobyLogo />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => setNotifOpen(true)}
            className="relative h-9 w-9 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Alerts"
          >
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-bear ring-2 ring-background" />
            )}
          </button>
          <button
            onClick={() => setCopilotOpen(true)}
            className="h-9 px-2.5 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#14F195]/20 to-[#22D3EE]/20 text-bull border border-bull/30 hover:from-[#14F195]/30 hover:to-[#22D3EE]/30 transition-colors"
            aria-label="Ask Moby AI"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Ask Moby</span>
          </button>
        </div>
      </div>
      <TickerTape />
    </header>
  );
}

function TickerTape() {
  const prices = useMoby((s) => s.prices);
  const tickers = TOKENS.slice(0, 14);
  const doubled = [...tickers, ...tickers];

  return (
    <div className="relative overflow-hidden border-t border-border/60 bg-surface/50">
      <div className="flex marquee whitespace-nowrap py-1.5">
        {doubled.map((t, i) => {
          const p = prices[t.id];
          const price = p?.price ?? t.price;
          const delta = ((price - t.price) / t.price) * 100;
          const isBull = delta >= 0;
          return (
            <button
              key={`${t.id}-${i}`}
              onClick={() => useMoby.getState().openToken(t.id)}
              className="inline-flex items-center gap-1.5 px-3 text-[11px] hover:bg-surface-3/50 transition-colors"
            >
              <span className="font-semibold text-foreground/80">{t.symbol}</span>
              <span className="tabular text-muted-foreground">{fmtPrice(price)}</span>
              <span className={cn("tabular font-medium", isBull ? "text-bull" : "text-bear")}>
                {isBull ? "+" : ""}
                {delta.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
