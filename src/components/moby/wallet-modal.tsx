"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Check,
  Shield,
  ChevronRight,
  ExternalLink,
  Loader2,
  Key,
  Copy,
  LogOut,
  UserRound,
  Wallet,
  ArrowDownToLine,
  ArrowUpCircle,
  ArrowDownCircle,
  Boxes,
  Split,
  ArrowRightLeft,
  RefreshCw,
  Briefcase,
  BadgeCheck,
  Gift,
} from "lucide-react";
import { WALLETS } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/moby-data";

// Detect real injected wallet providers
function getInjectedWallets(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  const w = window as any;
  return {
    phantom: !!(w.solana?.isPhantom || w.phantom?.solana?.isPhantom),
    solflare: !!(w.solflare?.isSolflare),
    backpack: !!(w.backpack),
    metamask: !!(w.ethereum?.isMetaMask),
  };
}

export function WalletConnectModal() {
  const open = useMoby((s) => s.walletOpen);
  const setOpen = useMoby((s) => s.setWalletOpen);
  const connect = useMoby((s) => s.connectWallet);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [injected, setInjected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Use microtask to avoid setState-in-effect lint
      Promise.resolve().then(() => {
        setInjected(getInjectedWallets());
        setError(null);
      });
    }
  }, [open]);

  const handleConnect = async (walletId: string, name: string) => {
    setConnecting(walletId);
    setError(null);

    // Try real wallet connection first
    try {
      if (typeof window !== "undefined") {
        const w = window as any;
        let provider: any = null;

        if (walletId === "phantom" && (w.solana?.isPhantom || w.phantom?.solana?.isPhantom)) {
          provider = w.solana || w.phantom?.solana;
        } else if (walletId === "solflare" && w.solflare?.isSolflare) {
          provider = w.solflare;
        } else if (walletId === "backpack" && w.backpack) {
          provider = w.backpack;
        } else if (walletId === "metamask" && w.ethereum?.isMetaMask) {
          provider = w.ethereum;
        }

        if (provider) {
          // Real wallet exists — attempt connection
          const resp = await provider.connect();
          const address = resp.publicKey?.toString() ?? resp.publicKey ?? resp;
          // Success — connect with real address
          connect(name, typeof address === "string" ? address : undefined);
          setConnecting(null);
          return;
        }
      }
    } catch (err: any) {
      // User rejected or error — fall through to simulated
      if (err?.code === 4001 || err?.message?.includes("reject")) {
        setError(`${name} connection rejected`);
        setConnecting(null);
        return;
      }
    }

    // Fall back to simulated connection (for demo / when no wallet installed)
    setTimeout(() => {
      connect(name);
      setConnecting(null);
    }, 1100);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => !connecting && setOpen(false)}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Connect a wallet</h2>
                <p className="text-xs text-muted-foreground">Choose how you want to connect</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={!!connecting}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {error && (
                <div className="mb-2 rounded-lg border border-bear/30 bg-bear/5 p-2.5 text-[11px] text-bear flex items-center gap-1.5">
                  <span>⚠️</span>
                  {error}
                </div>
              )}
              {WALLETS.map((w) => {
                const isInjected = injected[w.id] ?? false;
                const isConnecting = connecting === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => handleConnect(w.id, w.name)}
                    disabled={!!connecting}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-surface-2 transition-colors text-left disabled:opacity-60",
                      w.recommended && "border-bull/30 bg-bull/5"
                    )}
                  >
                    <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center text-lg shrink-0", w.color)}>
                      {w.glyph}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{w.name}</span>
                        {w.recommended && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-bull bg-bull/15 px-1.5 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{w.description}</div>
                    </div>
                    <div className="shrink-0">
                      {isConnecting ? (
                        <div className="flex items-center gap-1">
                          {isInjected ? (
                            <Loader2 className="h-3 w-3 animate-spin text-bull" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-bull live-dot" />
                          )}
                          <span className="text-[11px] text-bull">{isInjected ? "Connecting" : "Simulating"}</span>
                        </div>
                      ) : isInjected ? (
                        <span className="text-[10px] font-semibold text-bull bg-bull/10 px-1.5 py-0.5 rounded">Installed</span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-border">
              <div className="flex items-start gap-2 text-[11px] text-muted-foreground mb-2">
                <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  By connecting, you agree to Moby's Terms of Service and acknowledge that your wallet activity stays private.
                  Moby never asks for your seed phrase.
                </span>
              </div>
              <button
                onClick={() => {
                  useMoby.getState().setWalletOpen(false);
                  setTimeout(() => useMoby.getState().setWalletImportOpen(true), 200);
                }}
                className="w-full text-center text-[11px] text-bull hover:opacity-80 inline-flex items-center justify-center gap-1 font-semibold"
              >
                <Key className="h-3 w-3" /> Import existing wallet (seed phrase / private key)
              </button>
              <button onClick={() => useMoby.getState().pushToast({ title: "Wallet security", description: "Moby never stores your seed phrase. All transactions require your approval.", type: "info" })} className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1">
                <ExternalLink className="h-3 w-3" /> Learn more about wallet security
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Pill button in the top bar that opens the wallet modal — or shows the
 * connected wallet address with balance.
 */
export function WalletButton() {
  const wallet = useMoby((s) => s.wallet);
  const setWalletOpen = useMoby((s) => s.setWalletOpen);
  const disconnect = useMoby((s) => s.disconnectWallet);
  const setActiveTab = useMoby((s) => s.setActiveTab);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  if (!wallet) {
    return (
      <button
        onClick={() => setWalletOpen(true)}
        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-bull text-background text-xs font-bold hover:opacity-90"
      >
        Connect
      </button>
    );
  }

  const shortAddress =
    wallet.address.length > 14
      ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
      : wallet.address;
  const balanceLabel =
    wallet.balanceUsd > 0
      ? fmtUsd(wallet.balanceUsd, { compact: wallet.balanceUsd >= 1000 })
      : "$0.00";

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      useMoby.getState().pushToast({
        title: "Wallet address copied",
        description: shortAddress,
        type: "success",
      });
    } catch {
      useMoby.getState().pushToast({
        title: "Copy failed",
        description: "Could not copy the wallet address.",
        type: "warn",
      });
    }
  };

  const quickActions = [
    { label: "Deposit", icon: ArrowDownToLine, onClick: copyAddress },
    {
      label: "Buy",
      icon: ArrowUpCircle,
      onClick: () => {
        setActiveTab("discover");
        setProfileOpen(false);
      },
    },
    {
      label: "Withdraw",
      icon: ArrowDownCircle,
      onClick: () => {
        useMoby.getState().pushToast({
          title: "Withdraw flow",
          description: "Withdrawal flow coming soon.",
          type: "info",
        });
        setProfileOpen(false);
      },
    },
    {
      label: "Consolidate",
      icon: Boxes,
      onClick: () => {
        useMoby.getState().setMultiWalletOpen(true);
        setProfileOpen(false);
      },
    },
    {
      label: "Distribute",
      icon: Split,
      onClick: () => {
        useMoby.getState().pushToast({
          title: "Distribute funds",
          description: "Distribution tools are available in the wallet manager.",
          type: "info",
        });
        setProfileOpen(false);
      },
    },
    {
      label: "Transfer",
      icon: ArrowRightLeft,
      onClick: () => {
        useMoby.getState().pushToast({
          title: "Transfer flow",
          description: "Transfer flow coming soon.",
          type: "info",
        });
        setProfileOpen(false);
      },
    },
    {
      label: "Convert",
      icon: RefreshCw,
      onClick: () => {
        useMoby.getState().setTradeOpen(true);
        setProfileOpen(false);
      },
    },
  ];

  const profileRows = [
    {
      label: "Portfolio",
      icon: Briefcase,
      onClick: () => {
        setActiveTab("portfolio");
        setProfileOpen(false);
      },
    },
    {
      label: "Security",
      icon: BadgeCheck,
      onClick: () => {
        useMoby.getState().setSettingsOpen(true);
        setProfileOpen(false);
      },
    },
    {
      label: "Referral",
      icon: Gift,
      onClick: () => {
        useMoby.getState().setReferralOpen(true);
        setProfileOpen(false);
      },
    },
  ];

  return (
    <div className="relative" ref={profileRef}>
      <button
        onClick={() => setProfileOpen((open) => !open)}
        className="h-8 px-3 inline-flex items-center gap-2 rounded-lg bg-surface-3 border border-bull/30 text-xs font-semibold hover:bg-surface-3/70"
        title="Open wallet profile"
        aria-haspopup="dialog"
        aria-expanded={profileOpen}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-bull" />
        <span className="text-bull tabular">{balanceLabel}</span>
      </button>

      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-50 mt-2 w-[20rem] overflow-hidden rounded-2xl border border-border bg-[#171717] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)]"
            role="dialog"
            aria-label="Wallet profile"
          >
            <div className="border-b border-white/8 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] text-zinc-400">SOL Balance</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Wallet className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[1.65rem] font-semibold tracking-tight text-white tabular">
                        {(wallet.balanceUsd / 74.3 || 0).toFixed(2)}
                      </span>
                      <span className="text-sm font-medium text-zinc-300">{fmtUsd(wallet.balanceUsd)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={copyAddress}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/4 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-white/8 hover:text-white"
                  title="Copy address"
                >
                  <span className="font-mono">{shortAddress}</span>
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
                <span>UID: -----</span>
                <button
                  onClick={() => {
                    useMoby.getState().pushToast({
                      title: "UID hidden",
                      description: "Moby keeps this demo profile private.",
                      type: "info",
                    });
                  }}
                  className="transition-colors hover:text-zinc-300"
                >
                  <UserRound className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/12 text-emerald-400 transition-colors hover:bg-emerald-500/18">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="text-[11px] font-medium text-zinc-200">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/8 px-3 py-2">
              {profileRows.map((row) => {
                const Icon = row.icon;
                return (
                  <button
                    key={row.label}
                    onClick={row.onClick}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left text-sm text-zinc-100 transition-colors hover:bg-white/4"
                  >
                    <Icon className="h-4 w-4 text-zinc-400" />
                    <span className="flex-1">{row.label}</span>
                    <ChevronRight className="h-4 w-4 text-zinc-600" />
                  </button>
                );
              })}
            </div>

            <div className="px-4 py-3">
              <button
                onClick={() => {
                  useMoby.getState().setReferralOpen(true);
                  setProfileOpen(false);
                }}
                className="relative flex w-full items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-400/40 via-cyan-400/35 to-violet-500/45 px-4 py-3 text-left"
              >
                <div className="absolute inset-y-0 right-3 w-16 rounded-full bg-white/10 blur-2xl" />
                <Gift className="relative z-10 h-4 w-4 text-white" />
                <div className="relative z-10">
                  <div className="text-xs font-semibold text-white">MOBY Rewards</div>
                  <div className="text-[11px] text-white/80">Earn cashback and referral perks</div>
                </div>
              </button>
            </div>

            <div className="border-t border-white/8 p-2">
              <button
                onClick={() => {
                  disconnect();
                  setProfileOpen(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/4"
              >
                <LogOut className="h-4 w-4 text-zinc-400" />
                <span>Disconnect</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
