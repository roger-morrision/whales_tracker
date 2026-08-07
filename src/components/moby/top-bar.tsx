"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Sparkles, SlidersHorizontal, FileText, ChevronDown, X } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { MobyLogo } from "./primitives";
import { WalletButton } from "./wallet-modal";
import { cn } from "@/lib/utils";

const CHAINS: { key: "sol" | "base" | "eth" | "bsc"; label: string; emoji: string; color: string }[] = [
  { key: "sol", label: "Solana", emoji: "◎", color: "from-[#9945FF] to-[#14F195]" },
  { key: "base", label: "Base", emoji: "🔵", color: "from-[#0052FF] to-[#0066FF]" },
  { key: "eth", label: "Ethereum", emoji: "♦", color: "from-[#627EEA] to-[#8A92B2]" },
  { key: "bsc", label: "BNB", emoji: "🟡", color: "from-[#F3BA2F] to-[#F0B90B]" },
];

export function TopBar() {
  const setSearchOpen = useMoby((s) => s.setSearchOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const setNotifOpen = useMoby((s) => s.setNotifOpen);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const setScreenerOpen = useMoby((s) => s.setScreenerOpen);
  const setTaxOpen = useMoby((s) => s.setTaxOpen);
  const alerts = useMoby((s) => s.alerts);
  const selectedChain = useMoby((s) => s.selectedChain);
  const setSelectedChain = useMoby((s) => s.setSelectedChain);
  const [chainOpen, setChainOpen] = useState(false);
  const chainRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!chainOpen) return;
    const handler = (e: MouseEvent) => {
      if (chainRef.current && !chainRef.current.contains(e.target as Node)) {
        setChainOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [chainOpen]);

  const currentChain = CHAINS.find((c) => c.key === selectedChain) ?? CHAINS[0];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-3">
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => router.push("/")} aria-label="Moby home" className="shrink-0">
            <MobyLogo withText={false} />
          </button>

          <div className="relative" ref={chainRef}>
            <button
              onClick={() => setChainOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/5 bg-surface-2/90 px-3 transition-colors hover:bg-surface-3"
              aria-label="Switch chain"
            >
              <span className={cn("grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br text-[9px] font-bold text-background", currentChain.color)}>
                {currentChain.emoji}
              </span>
              <span className="text-sm font-semibold text-white">{selectedChain.toUpperCase()}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", chainOpen && "rotate-180")} />
            </button>
            {chainOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                {CHAINS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => {
                      setSelectedChain(c.key);
                      setChainOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2",
                      c.key === selectedChain && "bg-surface-2"
                    )}
                  >
                    <span className={cn("grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br text-[9px] font-bold text-background", c.color)}>
                      {c.emoji}
                    </span>
                    <span className="flex-1 text-xs font-semibold">{c.label}</span>
                    {c.key === selectedChain && <span className="text-xs text-bull">✓</span>}
                  </button>
                ))}
                <div className="border-t border-border px-3 py-1.5 text-[9px] text-muted-foreground">
                  Chain affects GMGN data + DEX pairs.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                setIsSearchFocused(true);
                setSearchOpen(true);
              }}
              onBlur={() => {
                setIsSearchFocused(false);
                if (!searchQuery) setSearchOpen(false);
              }}
              placeholder="Search"
              className={cn(
                "h-10 w-full rounded-2xl border border-white/5 bg-[#141926] pl-10 pr-4 text-sm font-medium transition-colors",
                isSearchFocused || searchQuery ? "border-bull/30 bg-[#171d2b]" : "hover:bg-[#171d2b]"
              )}
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setScreenerOpen(true)}
            className="hidden h-10 w-10 place-items-center rounded-2xl bg-surface-2/90 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground sm:grid"
            aria-label="Token screener"
            title="Token screener"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTaxOpen(true)}
            className="hidden h-10 w-10 place-items-center rounded-2xl bg-surface-2/90 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground sm:grid"
            aria-label="Tax calculator"
            title="Tax calculator"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            onClick={() => setNotifOpen(true)}
            className="relative grid h-10 w-10 place-items-center rounded-2xl bg-surface-2/90 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label="Alerts"
          >
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-bear ring-2 ring-background" />
            )}
          </button>
          <WalletButton />
          <button
            onClick={() => setCopilotOpen(true)}
            className="hidden h-10 items-center gap-1.5 rounded-2xl border border-bull/30 bg-gradient-to-br from-[#14F195]/20 to-[#22D3EE]/20 px-3 text-bull transition-colors hover:from-[#14F195]/30 hover:to-[#22D3EE]/30 sm:inline-flex"
            aria-label="Ask Moby AI"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Ask Moby</span>
          </button>
        </div>
      </div>
    </header>
  );
}
