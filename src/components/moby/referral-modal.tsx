"use client";

import { useState } from "react";
import { X, Gift, Copy, Check, Share2, Users, DollarSign, Crown, ChevronRight } from "lucide-react";
import { REFERRAL_STATS, REFERRAL_TIERS, fmtUsd, fmtNum } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function ReferralModal() {
  const open = useMoby((s) => s.referralOpen);
  const setOpen = useMoby((s) => s.setReferralOpen);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTierIdx = REFERRAL_TIERS.findIndex((t) => t.name === REFERRAL_STATS.tier);
  const nextTier = REFERRAL_TIERS[currentTierIdx + 1];

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
              <h2 className="font-semibold text-sm flex-1">Refer & earn</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {/* Hero */}
              <div className="rounded-2xl p-4 bg-gradient-to-br from-[#F59E0B]/15 via-[#EF4444]/8 to-transparent border border-gold/20 text-center">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EF4444] grid place-items-center mx-auto mb-2">
                  <Gift className="h-7 w-7 text-background" />
                </div>
                <h3 className="font-bold text-base mb-1">Earn ${REFERRAL_STATS.rewardPerReferral} per friend</h3>
                <p className="text-xs text-muted-foreground">
                  Get ${REFERRAL_STATS.rewardPerReferral} for every friend who connects a wallet and makes their first trade.
                  They get 1 month of Moby Pro free.
                </p>
              </div>

              {/* Referral code & link */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Your code</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-sm font-bold bg-surface-2 rounded-lg px-3 py-2">{REFERRAL_STATS.code}</code>
                    <button
                      onClick={() => handleCopy(REFERRAL_STATS.code)}
                      className={cn(
                        "h-9 w-9 grid place-items-center rounded-lg",
                        copied ? "bg-bull/15 text-bull" : "bg-surface-2 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Your link</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-xs bg-surface-2 rounded-lg px-3 py-2 truncate">{REFERRAL_STATS.link}</code>
                    <button
                      onClick={() => handleCopy(REFERRAL_STATS.code)}
                      className={cn(
                        "h-9 w-9 grid place-items-center rounded-lg",
                        copied ? "bg-bull/15 text-bull" : "bg-surface-2 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1 mb-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span className="text-[10px] uppercase font-semibold">Referrals</span>
                  </div>
                  <div className="text-xl font-bold tabular">{REFERRAL_STATS.referrals}</div>
                  <div className="text-[10px] text-muted-foreground">{REFERRAL_STATS.activeReferrals} active</div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1 mb-1 text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    <span className="text-[10px] uppercase font-semibold">Earnings</span>
                  </div>
                  <div className="text-xl font-bold tabular text-bull">{fmtUsd(REFERRAL_STATS.earningsUsd)}</div>
                  <div className="text-[10px] text-muted-foreground">{fmtUsd(REFERRAL_STATS.pendingUsd)} pending</div>
                </div>
              </div>

              {/* Tier progress */}
              <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Crown className="h-3.5 w-3.5 text-gold" />
                  <span className="text-xs font-semibold">Tier: {REFERRAL_STATS.tier}</span>
                  <Chip variant="gold" className="ml-auto">{REFERRAL_TIERS[currentTierIdx].perk}</Chip>
                </div>
                {nextTier && (
                  <>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted-foreground">Progress to {REFERRAL_STATS.nextTierName}</span>
                      <span className="font-semibold tabular">{REFERRAL_STATS.referrals}/{nextTier.min}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444] rounded-full"
                        style={{ width: `${REFERRAL_STATS.nextTierProgress * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {nextTier.min - REFERRAL_STATS.referrals} more referrals to unlock ${nextTier.reward}/referral
                    </div>
                  </>
                )}
              </div>

              {/* All tiers */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">All tiers</div>
                <div className="space-y-1.5">
                  {REFERRAL_TIERS.map((t, i) => {
                    const isCurrent = t.name === REFERRAL_STATS.tier;
                    const isUnlocked = i <= currentTierIdx;
                    return (
                      <div
                        key={t.name}
                        className={cn(
                          "rounded-lg border p-2.5 flex items-center gap-2",
                          isCurrent ? "border-gold/40 bg-gold/10" : isUnlocked ? "border-bull/30 bg-bull/5" : "border-border"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-full grid place-items-center text-xs font-bold",
                          isUnlocked ? "bg-gold text-background" : "bg-surface-3 text-muted-foreground"
                        )}>
                          {isUnlocked ? <Crown className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold">{t.name}</span>
                            {isCurrent && <Chip variant="gold">Current</Chip>}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{t.perk}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold tabular">${t.reward}</div>
                          <div className="text-[9px] text-muted-foreground">per referral</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Share buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const link = "https://moby.win/r/YOURCODE";
                    const text = encodeURIComponent(`Join me on Moby — track smart money, get signals, and trade smarter. ${link}`);
                    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
                  }}
                  className="py-2 rounded-lg border border-border text-xs font-semibold hover:bg-surface-2 flex flex-col items-center gap-0.5"
                >
                  <span className="text-base">𝕏</span>
                  <span className="text-[10px]">X</span>
                </button>
                <button
                  onClick={() => {
                    const link = "https://moby.win/r/YOURCODE";
                    const text = encodeURIComponent("Join me on Moby — track smart money and trade smarter.");
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`, "_blank");
                  }}
                  className="py-2 rounded-lg border border-border text-xs font-semibold hover:bg-surface-2 flex flex-col items-center gap-0.5"
                >
                  <span className="text-base">✈️</span>
                  <span className="text-[10px]">Telegram</span>
                </button>
                <button
                  onClick={() => {
                    const link = "https://moby.win/r/YOURCODE";
                    const subject = encodeURIComponent("Join me on Moby");
                    const body = encodeURIComponent(`Check out Moby — onchain intelligence for traders.\n\n${link}`);
                    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
                  }}
                  className="py-2 rounded-lg border border-border text-xs font-semibold hover:bg-surface-2 flex flex-col items-center gap-0.5"
                >
                  <span className="text-base">📧</span>
                  <span className="text-[10px]">Email</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
