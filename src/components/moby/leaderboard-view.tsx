"use client";

import { useMemo, useState } from "react";
import { Info, Trophy, Crown, Medal } from "lucide-react";
import { PNL_DAILY, PNL_WEEKLY, PNL_ALLTIME, fmtUsd, type PnlEntry } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "allTime";

const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "24H" },
  { key: "weekly", label: "7D" },
  { key: "allTime", label: "All time" },
];

export function LeaderboardView() {
  const [period, setPeriod] = useState<Period>("daily");
  const openTrader = useMoby((s) => s.openTrader);

  const entries = useMemo(() => {
    return period === "daily" ? PNL_DAILY : period === "weekly" ? PNL_WEEKLY : PNL_ALLTIME;
  }, [period]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 via-surface-2 to-transparent p-4">
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold">Top Traders</h2>
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {PERIODS.map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriod(item.key)}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                period === item.key ? "bg-surface-3 text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => openTrader(entry.handle === "0xMoby" ? "t1" : entry.handle === "DegenDiva" ? "t4" : "t2")}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2/20 p-3 text-left transition-colors hover:bg-surface-2"
          >
            <div className="w-9 shrink-0 text-center">
              <RankBadge rank={entry.rank} />
            </div>
            <div className={cn("h-12 w-12 shrink-0 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white", entry.avatarColor)}>
              {entry.avatarGlyph}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">#{entry.handle}</div>
              <div className="text-xs text-gold">Next payout: +${Math.max(entry.pnlUsd * 0.000035, 0.1303).toFixed(4)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold tabular text-bull">+{fmtUsd(entry.pnlUsd, { compact: true })}</div>
              <div className="text-[10px] text-muted-foreground">{entry.trades} trades</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="mx-auto h-5 w-5 text-gold" />;
  if (rank === 2) return <Medal className="mx-auto h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Medal className="mx-auto h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
}
