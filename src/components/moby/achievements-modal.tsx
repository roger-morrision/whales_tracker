"use client";

import { X, Award, Lock, Star, TrendingUp, Crown } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  icon: string;
  label: string;
  desc: string;
  unlocked: boolean;
  progress?: number; // 0-100
  tier?: "bronze" | "silver" | "gold" | "platinum";
  points: number;
}

const ACHIEVEMENTS: (Achievement & { storeId?: string })[] = [
  { id: "a1", storeId: "whale_spotter", icon: "🐋", label: "Whale Watcher", desc: "Track 100+ whale wallets", unlocked: false, tier: "gold", points: 100 },
  { id: "a2", storeId: "early_adopter", icon: "⚡", label: "Early Bird", desc: "Joined Moby early", unlocked: true, tier: "silver", points: 75 },
  { id: "a3", icon: "🎯", label: "Sniper", desc: "Hit 5 cluster buy signals", unlocked: false, tier: "silver", points: 75 },
  { id: "a4", storeId: "first_trade", icon: "🚀", label: "First Trade", desc: "Execute your first swap", unlocked: false, tier: "bronze", points: 50 },
  { id: "a5", icon: "🔮", label: "Oracle", desc: "Have 5 calls validated by smart money", unlocked: false, progress: 0, tier: "gold", points: 100 },
  { id: "a6", storeId: "first_follow", icon: "👑", label: "First Follow", desc: "Follow your first trader", unlocked: false, tier: "platinum", points: 150 },
  { id: "a7", icon: "🪙", label: "Coin Collector", desc: "Track 50 unique tokens", unlocked: false, progress: 32, tier: "bronze", points: 50 },
  { id: "a8", storeId: "diversified", icon: "🌊", label: "Diversified", desc: "Hold 5+ Solana tokens", unlocked: false, tier: "bronze", points: 50 },
  { id: "a9", storeId: "portfolio_100k", icon: "📊", label: "Portfolio Pro", desc: "Reach $100K portfolio value", unlocked: false, tier: "gold", points: 100 },
  { id: "a10", icon: "🤖", label: "AI Whisperer", desc: "Ask Moby AI 100 questions", unlocked: false, progress: 42, tier: "silver", points: 75 },
  { id: "a11", storeId: "first_alert", icon: "💸", label: "First Alert", desc: "Create your first price alert", unlocked: false, tier: "bronze", points: 50 },
  { id: "a12", storeId: "ten_trades", icon: "🏆", label: "Ten Trades", desc: "Execute 10 swaps on Moby", unlocked: false, progress: 0, tier: "platinum", points: 200 },
];

const TIER_COLORS: Record<NonNullable<Achievement["tier"]>, string> = {
  bronze: "from-[#CD7F32] to-[#8B4513]",
  silver: "from-[#94A3B8] to-[#475569]",
  gold: "from-[#F59E0B] to-[#EF4444]",
  platinum: "from-[#22D3EE] to-[#9945FF]",
};

const TIER_RING: Record<NonNullable<Achievement["tier"]>, string> = {
  bronze: "border-[#CD7F32]/40",
  silver: "border-[#94A3B8]/40",
  gold: "border-[#F59E0B]/40",
  platinum: "border-[#22D3EE]/40",
};

export function AchievementsModal() {
  const open = useMoby((s) => s.achievementsOpen);
  const setOpen = useMoby((s) => s.setAchievementsOpen);
  const storeAchievements = useMoby((s) => s.achievements);

  // Merge static rich definitions with persisted store state
  const merged: Achievement[] = ACHIEVEMENTS.map((a) => {
    if (!a.storeId) return a;
    const storeA = storeAchievements.find((x) => x.id === a.storeId);
    if (!storeA) return a;
    return {
      ...a,
      unlocked: a.unlocked || storeA.unlocked,
      progress: storeA.unlocked ? 100 : Math.round((storeA.progress ?? 0) * 100),
    };
  });

  const unlocked = merged.filter((a) => a.unlocked);
  const locked = merged.filter((a) => !a.unlocked);
  const totalPoints = unlocked.reduce((s, a) => s + a.points, 0);
  const maxPoints = merged.reduce((s, a) => s + a.points, 0);

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
              <Award className="h-4 w-4 text-gold" />
              <h2 className="font-semibold text-sm flex-1">Achievements</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {/* Points summary */}
              <div className="rounded-2xl p-4 bg-gradient-to-br from-[#F59E0B]/15 via-[#EF4444]/8 to-transparent border border-gold/20">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-gold" />
                  <div>
                    <div className="text-2xl font-bold tabular">{totalPoints}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Moby Points</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-sm font-semibold">{unlocked.length}/{merged.length}</div>
                    <div className="text-[10px] text-muted-foreground">unlocked</div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444] rounded-full"
                    style={{ width: `${(totalPoints / maxPoints) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {((totalPoints / maxPoints) * 100).toFixed(0)}% complete · {maxPoints - totalPoints} points to go
                </div>
              </div>

              {/* Unlocked */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                  <Star className="h-3 w-3 text-gold" /> Unlocked ({unlocked.length})
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {unlocked.map((a) => (
                    <div
                      key={a.id}
                      className={cn("rounded-xl border p-2 text-center bg-surface-2", TIER_RING[a.tier!])}
                    >
                      <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center text-xl mx-auto mb-1", TIER_COLORS[a.tier!])}>
                        {a.icon}
                      </div>
                      <div className="text-[10px] font-semibold truncate">{a.label}</div>
                      <div className="text-[9px] text-gold tabular">+{a.points} pts</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Locked / in progress */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> In progress ({locked.length})
                </div>
                <div className="space-y-2">
                  {locked.map((a) => (
                    <div key={a.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-10 w-10 rounded-full grid place-items-center text-xl shrink-0 grayscale opacity-60", TIER_COLORS[a.tier!])}>
                          {a.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{a.label}</div>
                          <div className="text-[11px] text-muted-foreground">{a.desc}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-gold tabular font-semibold">+{a.points}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">{a.tier}</div>
                        </div>
                      </div>
                      {a.progress !== undefined && a.progress > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold tabular">{a.progress}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full bg-gradient-to-r", TIER_COLORS[a.tier!])}
                              style={{ width: `${a.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
