"use client";

import { useEffect, useRef } from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle, Bell, Share2 } from "lucide-react";
import { useMoby, type ToastItem } from "@/lib/moby-store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<
  ToastItem["type"],
  { icon: typeof Info; color: string; bg: string }
> = {
  info: { icon: Info, color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10" },
  success: { icon: CheckCircle2, color: "text-bull", bg: "bg-bull/10" },
  warn: { icon: AlertTriangle, color: "text-gold", bg: "bg-gold/10" },
  alert: { icon: AlertCircle, color: "text-bear", bg: "bg-bear/10" },
};

/**
 * Toast notification system — renders transient popups at the top of the screen.
 * Auto-dismisses after 4 seconds. Supports optional action button.
 */
export function ToastContainer() {
  const toasts = useMoby((s) => s.toasts);
  const dismiss = useMoby((s) => s.dismissToast);

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] flex flex-col items-center gap-2 pt-2 px-4 pointer-events-none" role="status" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const config = TYPE_CONFIG[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={cn(
        "pointer-events-auto w-full max-w-sm rounded-xl border bg-surface border-border shadow-2xl p-3 flex items-start gap-2.5",
        toast.type === "alert" && "border-bear/30"
      )}
    >
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", config.bg)}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{toast.title}</div>
        {toast.description && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{toast.description}</div>
        )}
        <div className="flex items-center gap-2 mt-1">
          {toast.actionLabel && (
            <button
              onClick={() => {
                if (toast.actionId) {
                  useMoby.getState().openToken(toast.actionId);
                }
                onDismiss();
              }}
              className="text-[11px] font-semibold text-bull hover:opacity-80"
            >
              {toast.actionLabel} →
            </button>
          )}
          {toast.quickBuyLabel && toast.quickBuyTokenId && (
            <button
              onClick={() => {
                // Open trade modal pre-filled with amount
                useMoby.getState().openTrade(
                  toast.quickBuyTokenId!,
                  "BUY",
                  toast.quickBuyAmountUsd
                );
                onDismiss();
              }}
              className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-bull text-background hover:opacity-90"
            >
              {toast.quickBuyLabel}
            </button>
          )}
          {toast.type === "success" && toast.description && (
            <button
              onClick={() => {
                const text = `${toast.title}\n${toast.description}\n\nVia Moby 🐋`;
                if (typeof navigator !== "undefined" && navigator.share) {
                  navigator.share({ title: toast.title, text }).catch(() => {});
                } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(text);
                  useMoby.getState().pushToast({ title: "Copied to clipboard", type: "info" });
                }
              }}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
            >
              <Share2 className="h-2.5 w-2.5" /> Share
            </button>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="h-5 w-5 grid place-items-center rounded text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

/**
 * Simulated whale alert pusher — periodically pushes toast notifications
 * for new smart money entries and whale flows.
 */
export function WhaleAlertPusher() {
  // Production alerts must come from an observed server event. Do not invent
  // whale activity on a client timer.
  return null;

  const pushToast = useMoby((s) => s.pushToast);
  const refreshFeeds = useMoby((s) => s.refreshFeeds);

  useEffect(() => {
    // Push a whale alert every ~45s (skipped when tab is hidden to save battery
    // and avoid notification spam on backgrounded tabs)
    const alerts = [
      { title: "🐋 Whale alert: WIF", description: "0xMoby bought 280K WIF ($795K)", actionId: "wif", actionLabel: "View WIF", quickBuyTokenId: "wif", quickBuyLabel: "Buy 0.1 SOL", quickBuyAmountUsd: 18 },
      { title: "⚡ Smart money entry: MNGO", description: "7 wallets accumulated $1.24M", actionId: "mngo", actionLabel: "View MNGO", quickBuyTokenId: "mngo", quickBuyLabel: "Buy 0.1 SOL", quickBuyAmountUsd: 18 },
      { title: "🐋 Whale alert: SOL", description: "Scoop bought 24K SOL ($4.4M)", actionId: "sol", actionLabel: "View SOL", quickBuyTokenId: "sol", quickBuyLabel: "Buy 0.1 SOL", quickBuyAmountUsd: 18 },
      { title: "⚡ Cluster buy: BONK", description: "5 smart wallets bought within 30m", actionId: "bonk", actionLabel: "View BONK", quickBuyTokenId: "bonk", quickBuyLabel: "Buy 0.1 SOL", quickBuyAmountUsd: 18 },
    ];
    let idx = 0;
    const interval = setInterval(() => {
      // Skip when tab is hidden — no visible UI, no haptic, no notification spam
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const alert = alerts[idx % alerts.length];
      // Haptic feedback on mobile
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
      pushToast({
        title: alert.title,
        description: alert.description,
        type: "alert",
        actionLabel: alert.actionLabel,
        actionId: alert.actionId,
      });
      refreshFeeds();
      idx++;
    }, 45_000);
    return () => clearInterval(interval);
  }, [pushToast, refreshFeeds]);

  return null;
}
