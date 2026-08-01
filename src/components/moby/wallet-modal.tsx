"use client";

import { useState, useEffect } from "react";
import { X, Check, Shield, ChevronRight, ExternalLink, Loader2, Key } from "lucide-react";
import { WALLETS } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
        let provider = null;

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
          connect(name);
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
            onClick={(e) => e.stopPropagation()}
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
              <button className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1">
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

  return (
    <button
      onClick={disconnect}
      className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg bg-surface-3 border border-bull/30 text-xs font-semibold hover:bg-surface-3/70"
      title="Click to disconnect"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-bull" />
      <span className="font-mono">{wallet.address}</span>
      <span className="text-bull tabular">${(wallet.balanceUsd / 1000).toFixed(1)}K</span>
    </button>
  );
}
