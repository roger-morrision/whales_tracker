"use client";

import { useEffect, useRef } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { useMoby } from "@/lib/moby-store";

/**
 * Push notification permission banner — shows when permission is "default"
 * and disappears once granted/denied. Also wires the toast system to fire
 * real browser notifications when permission is granted.
 */
export function PushNotificationManager() {
  const permission = useMoby((s) => s.pushPermission);
  const requestPermission = useMoby((s) => s.requestPushPermission);
  const toasts = useMoby((s) => s.toasts);

  // Track which toast IDs we've already notified about
  const notifiedRef = useRef<Set<string>>(new Set());

  // Fire real browser notifications for alert-type toasts when permission granted
  useEffect(() => {
    if (permission !== "granted") return;
    const latest = toasts[0];
    if (latest && latest.type === "alert" && !notifiedRef.current.has(latest.id)) {
      notifiedRef.current.add(latest.id);
      try {
        new Notification(latest.title, {
          body: latest.description ?? "",
          icon: "/logo.svg",
          tag: latest.id,
        });
      } catch {
        // Notification API not available
      }
    }
  }, [toasts, permission]);

  if (permission !== "default") return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-sm z-[60] pointer-events-auto">
      <div className="rounded-xl border border-bull/30 bg-surface shadow-2xl p-3 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-bull/15 grid place-items-center shrink-0">
          <Bell className="h-4 w-4 text-bull" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold">Enable push notifications</div>
          <div className="text-[10px] text-muted-foreground">Get alerted when whales move or smart money enters.</div>
        </div>
        <button
          onClick={requestPermission}
          className="px-2.5 py-1.5 rounded-lg bg-bull text-background text-[11px] font-bold shrink-0"
        >
          Allow
        </button>
        <button
          onClick={() => useMoby.getState().setPushPermission("denied")}
          className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground shrink-0"
        >
          <BellOff className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
