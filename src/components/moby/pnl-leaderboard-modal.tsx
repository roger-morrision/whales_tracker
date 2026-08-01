"use client";

import { useState } from "react";
import { X, Trophy, Crown, Medal, TrendingUp } from "lucide-react";
import { PNL_DAILY, PNL_WEEKLY, PNL_ALLTIME, fmtUsd, fmtNum, type PnlEntry } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip } from "./primitives";
import { WalletLink } from "./wallet-link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "allTime";

const PERIODS: { k: Period; label: string }[] = [
  { k: "daily", label: "Today" },
  { k: "weekly", label: "This week" },
  { k: "allTime", label: "All time" },
];

export function PnlLeaderboardModal() {
  const open = useMoby((s) => s.pnlLeaderboardOpen);
  const setOpen = useMoby((s) => s.setPnlLeaderboardOpen);
  const openTrader = useMoby((s) => s.openTrader);
  const [period, setPeriod] = useState<Period>("daily");

  const data = period === "daily" ? PNL_DAILY : period === "weekly" ? PNL_WEEKLY : PNL_ALLTIME;
  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

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
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-semibold text-sm flex-1">P&L leaderboard</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Period tabs */}
            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {PERIODS.map((p) => (
                <button
                  key={p.k}
                  onClick={() => setPeriod(p.k)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                    period === p.k ? "bg-surface-3 text-foreground" : "text-muted-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
              {/* Podium */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* 2nd place */}
                {top3[1] && (
                  <PodiumCard entry={top3[1]} place={2} onClick={() => openTrader(top3[1].handle === "0xMoby" ? "t1" : top3[1].handle === "DegenDiva" ? "t4" : "t2")} />
                )}
                {/* 1st place - taller */}
                {top3[0] && (
                  <PodiumCard entry={top3[0]} place={1} onClick={() => openTrader(top3[0].handle === "0xMoby" ? "t1" : top3[0].handle === "DegenDiva" ? "t4" : "t2")} highlight />
                )}
                {/* 3rd place */}
                {top3[2] && (
                  <PodiumCard entry={top3[2]} place={3} onClick={() => openTrader(top3[2].handle === "0xMoby" ? "t1" : top3[2].handle === "DegenDiva" ? "t4" : "t2")} />
                )}
              </div>

              {/* Rest of leaderboard */}
              <div className="space-y-1.5">
                {rest.map((entry, i) => (
                  <LeaderboardRow key={entry.id} entry={entry} onClick={() => openTrader(entry.handle === "0xMoby" ? "t1" : entry.handle === "DegenDiva" ? "t4" : "t2")} />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PodiumCard({ entry, place, highlight, onClick }: { entry: PnlEntry; place: number; highlight?: boolean; onClick: () => void }) {
  const medalColor = place === 1 ? "text-gold" : place === 2 ? "text-[#94A3B8]" : "text-[#CD7F32]";
  const Medal_ = place === 1 ? Crown : Medal;
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-2 text-center transition-colors",
        highlight ? "border-gold/40 bg-gold/10 -mt-3 pb-3" : "border-border bg-surface-2"
      )}
    >
      <div className={cn("mx-auto mb-1", highlight ? "h-14 w-14" : "h-12 w-12")}>
        <div className={cn("rounded-full bg-gradient-to-br grid place-items-center font-bold text-white h-full w-full", entry.avatarColor)}>
          <span className={highlight ? "text-xl" : "text-base"}>{entry.avatarGlyph}</span>
        </div>
      </div>
      <div className={cn("flex items-center justify-center mb-1", medalColor)}>
        <Medal_ className={highlight ? "h-4 w-4" : "h-3 w-3"} />
      </div>
      <div className="text-[11px] font-semibold truncate">@{entry.handle}</div>
      <div className="text-[10px] text-bull tabular font-bold">+{fmtUsd(entry.pnlUsd, { compact: true })}</div>
      <div className="text-[9px] text-muted-foreground tabular">{entry.pnlPct >= 0 ? "+" : ""}{entry.pnlPct}%</div>
    </button>
  );
}

function LeaderboardRow({ entry, onClick }: { entry: PnlEntry; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-surface-2 transition-colors text-left"
    >
      <span className="w-6 text-center text-sm font-bold tabular text-muted-foreground">#{entry.rank}</span>
      <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white text-xs shrink-0", entry.avatarColor)}>
        {entry.avatarGlyph}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">@{entry.handle}</div>
        <div className="text-[10px] text-muted-foreground">
          {entry.trades} trades · WR {entry.winRate}% · best ${entry.bestTrade}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold tabular text-bull">+{fmtUsd(entry.pnlUsd, { compact: true })}</div>
        <div className="text-[10px] text-bull tabular">+{entry.pnlPct}%</div>
      </div>
    </button>
  );
}
