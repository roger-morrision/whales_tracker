"use client";

import { useState, useEffect, useRef } from "react";
import { X, Gift, CheckCircle2, Clock, AlertCircle, Lock, Loader2 } from "lucide-react";
import { AIRDROPS, fmtUsd, fmtNum, type AirdropClaim } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip, SectionHeader } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  AirdropClaim["status"],
  { label: string; icon: typeof CheckCircle2; color: string; bg: string }
> = {
  eligible: { label: "Eligible", icon: CheckCircle2, color: "text-bull", bg: "bg-bull/10" },
  claimed: { label: "Claimed", icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-surface-3" },
  not_eligible: { label: "Not eligible", icon: AlertCircle, color: "text-bear", bg: "bg-bear/10" },
  snapshot_pending: { label: "Snapshot pending", icon: Clock, color: "text-gold", bg: "bg-gold/10" },
};

export function AirdropModal() {
  const open = useMoby((s) => s.airdropOpen);
  const setOpen = useMoby((s) => s.setAirdropOpen);
  const claimedAirdrops = useMoby((s) => s.claimedAirdrops);
  const claimAirdrop = useMoby((s) => s.claimAirdrop);
  const [claiming, setClaiming] = useState<string | null>(null);
  const claimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending claim timer when modal closes
  useEffect(() => {
    if (!open && claimTimerRef.current) {
      clearTimeout(claimTimerRef.current);
      claimTimerRef.current = null;
      // Defer setState to avoid synchronous setState in effect
      Promise.resolve().then(() => setClaiming(null));
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (claimTimerRef.current) clearTimeout(claimTimerRef.current);
    };
  }, []);

  const totalEligible = AIRDROPS.filter(
    (a) => (a.status === "eligible" || (a.status === "claimed")) && a.estimatedValue > 0
  ).reduce((s, a) => s + a.estimatedValue, 0);
  const totalClaimed = AIRDROPS.filter((a) => claimedAirdrops.includes(a.id)).reduce(
    (s, a) => s + a.estimatedValue,
    0
  );

  const handleClaim = (id: string) => {
    setClaiming(id);
    claimTimerRef.current = setTimeout(() => {
      claimAirdrop(id);
      setClaiming(null);
      claimTimerRef.current = null;
    }, 1800);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-gold/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Gift className="h-4 w-4 text-gold" />
              <h2 className="font-semibold text-sm flex-1">Airdrop center</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {/* Summary */}
              <div className="rounded-2xl p-4 bg-gradient-to-br from-[#F59E0B]/15 via-[#EF4444]/8 to-transparent border border-gold/20">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Total estimated value</div>
                <div className="text-3xl font-bold tabular text-gold">{fmtUsd(totalEligible)}</div>
                <div className="flex items-center gap-4 mt-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Claimed: </span>
                    <span className="font-semibold tabular text-bull">{fmtUsd(totalClaimed)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pending: </span>
                    <span className="font-semibold tabular">{fmtUsd(totalEligible - totalClaimed)}</span>
                  </div>
                </div>
              </div>

              {/* Airdrop list */}
              {AIRDROPS.map((a) => {
                const isClaimed = claimedAirdrops.includes(a.id);
                const status = isClaimed && a.status === "eligible" ? "claimed" : a.status;
                const meta = STATUS_META[status];
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white text-sm", a.color)}>
                        {a.glyph}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm">{a.project}</span>
                          <Chip variant="outline">${a.token}</Chip>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{a.description}</div>
                      </div>
                      <div className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded inline-flex items-center gap-0.5", meta.bg, meta.color)}>
                        <Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] mb-2">
                      <div>
                        <div className="text-[9px] text-muted-foreground uppercase">Amount</div>
                        <div className="font-semibold tabular">{fmtNum(a.eligibleAmount)} {a.token}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground uppercase">Est. value</div>
                        <div className="font-semibold tabular text-gold">{fmtUsd(a.estimatedValue)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground uppercase">Deadline</div>
                        <div className="font-semibold">{a.claimDeadline}</div>
                      </div>
                    </div>

                    {/* Requirements */}
                    <div className="text-[10px] text-muted-foreground mb-2">
                      <span className="font-semibold">Requirements: </span>
                      {a.requirements.join(" · ")}
                    </div>

                    {/* Claim button */}
                    {status === "eligible" && (
                      <button
                        onClick={() => handleClaim(a.id)}
                        disabled={claiming === a.id}
                        className="w-full py-2 rounded-lg bg-bull text-background text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {claiming === a.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Claiming…
                          </>
                        ) : (
                          <>Claim {fmtNum(a.eligibleAmount)} {a.token}</>
                        )}
                      </button>
                    )}
                    {status === "claimed" && (
                      <div className="w-full py-2 rounded-lg bg-surface-3 text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3" /> Claimed on {a.snapshotDate}
                      </div>
                    )}
                    {status === "snapshot_pending" && (
                      <div className="w-full py-2 rounded-lg bg-gold/10 text-gold text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Clock className="h-3 w-3" /> Snapshot on {a.snapshotDate}
                      </div>
                    )}
                    {status === "not_eligible" && (
                      <div className="w-full py-2 rounded-lg bg-surface-3 text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Lock className="h-3 w-3" /> Requirements not met
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
