"use client";

import { useMemo, useState } from "react";
import { getHolderDistribution, getTopHolders, fmtUsd, fmtNum, fmtPct } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip } from "./primitives";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Star } from "lucide-react";

/**
 * Token holder distribution + top holders list.
 * Designed to be embedded in the TokenDetailSheet.
 */
export function HolderDistributionSection({ tokenId }: { tokenId: string }) {
  const distribution = useMemo(() => getHolderDistribution(tokenId), [tokenId]);
  const topHolders = useMemo(() => getTopHolders(tokenId, 8), [tokenId]);
  const [showAll, setShowAll] = useState(false);
  const openToken = useMoby((s) => s.openToken);

  return (
    <div className="space-y-3">
      {/* Distribution donut */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-xs font-semibold">Holder distribution</span>
          <Chip variant="outline" className="ml-auto">{fmtNum(topHolders.length)} top wallets</Chip>
        </div>

        {/* Stacked bar instead of donut for simplicity */}
        <div className="flex h-3 rounded-full overflow-hidden mb-3">
          {distribution.map((d) => (
            <div
              key={d.label}
              style={{ width: `${d.pct}%`, backgroundColor: d.color }}
              title={`${d.label}: ${d.pct}%`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {distribution.map((d) => (
            <div key={d.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-muted-foreground">{d.label}</div>
                <div className="text-[11px] font-semibold tabular">
                  {d.pct}% <span className="text-muted-foreground font-normal">· {fmtNum(d.count)} wallets</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top holders */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs font-semibold">Top holders</span>
          <button
            onClick={() => setShowAll(!showAll)}
            className="ml-auto text-[10px] text-bull hover:opacity-80"
          >
            {showAll ? "Show less" : "Show all"}
          </button>
        </div>
        <div className="space-y-1.5">
          {(showAll ? topHolders : topHolders.slice(0, 5)).map((h) => (
            <div key={h.rank} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-[10px] text-muted-foreground tabular">#{h.rank}</span>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground truncate">{h.address}</span>
                {h.isSmart && (
                  <span className="text-[8px] font-bold text-bull bg-bull/15 px-1 py-0.5 rounded shrink-0 inline-flex items-center gap-0.5">
                    <Star className="h-2 w-2" /> SMART
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold tabular">{h.pct}%</div>
                <div className={cn(
                  "text-[9px] tabular flex items-center justify-end gap-0.5",
                  h.change24h >= 0 ? "text-bull" : "text-bear"
                )}>
                  {h.change24h >= 0 ? <ArrowUpRight className="h-2 w-2" /> : <ArrowDownRight className="h-2 w-2" />}
                  {Math.abs(h.change24h).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
          Top 10 holders own {topHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0).toFixed(1)}% of supply
        </div>
      </div>
    </div>
  );
}
