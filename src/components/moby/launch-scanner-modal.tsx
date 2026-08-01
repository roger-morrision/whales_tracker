"use client";

import { useMemo, useState } from "react";
import { X, Rocket, Shield, ShieldCheck, ShieldAlert, Filter, RefreshCw } from "lucide-react";
import { TOKEN_LAUNCHES, fmtUsd, fmtNum, fmtPct, type TokenLaunch } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Sparkline, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type SortKey = "newest" | "smart_money" | "volume" | "gainers";

export function LaunchScannerModal() {
  const open = useMoby((s) => s.launchScannerOpen);
  const setOpen = useMoby((s) => s.setLaunchScannerOpen);
  const openToken = useMoby((s) => s.openToken);
  const [sort, setSort] = useState<SortKey>("newest");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlySmartMoney, setOnlySmartMoney] = useState(false);

  const filtered = useMemo(() => {
    let list = [...TOKEN_LAUNCHES];
    if (onlyVerified) list = list.filter((t) => t.contractVerified && t.liquidityLocked && t.mintAuthorityRevoked);
    if (onlySmartMoney) list = list.filter((t) => t.smartMoneyEntries >= 2);
    switch (sort) {
      case "newest":
        list.sort((a, b) => a.ageMinutes - b.ageMinutes);
        break;
      case "smart_money":
        list.sort((a, b) => b.smartMoneyInflowUsd - a.smartMoneyInflowUsd);
        break;
      case "volume":
        list.sort((a, b) => b.volume24h - a.volume24h);
        break;
      case "gainers":
        list.sort((a, b) => b.priceChange24h - a.priceChange24h);
        break;
    }
    return list;
  }, [sort, onlyVerified, onlySmartMoney]);

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
            className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Rocket className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Launch scanner</h2>
              <span className="text-[10px] text-bull flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" /> Live
              </span>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {/* Sort + filters */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                {[
                  { k: "newest", label: "🆕 Newest" },
                  { k: "smart_money", label: "🐋 Smart money" },
                  { k: "volume", label: "📈 Volume" },
                  { k: "gainers", label: "🔥 Gainers" },
                ].map((s) => (
                  <button
                    key={s.k}
                    onClick={() => setSort(s.k as SortKey)}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border",
                      sort === s.k
                        ? "bg-bull/15 text-bull border-bull/30"
                        : "bg-surface-2 text-muted-foreground border-border"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setOnlyVerified(!onlyVerified)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1",
                    onlyVerified ? "border-bull/30 bg-bull/10 text-bull" : "border-border text-muted-foreground"
                  )}
                >
                  <ShieldCheck className="h-3 w-3" /> Verified only
                </button>
                <button
                  onClick={() => setOnlySmartMoney(!onlySmartMoney)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1",
                    onlySmartMoney ? "border-bull/30 bg-bull/10 text-bull" : "border-border text-muted-foreground"
                  )}
                >
                  🐌 Smart money only
                </button>
              </div>

              {/* Launch list */}
              <div className="space-y-2">
                {filtered.map((t) => (
                  <LaunchCard
                    key={t.id}
                    launch={t}
                    onClick={() => {
                      setOpen(false);
                      // Map launch to token if exists, else just close
                      const tokenMap: Record<string, string> = { "launch-1": "moon", "launch-4": "moon" };
                      if (tokenMap[t.id]) openToken(tokenMap[t.id]);
                    }}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No launches match these filters.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LaunchCard({ launch, onClick }: { launch: TokenLaunch; onClick: () => void }) {
  const isBull = launch.priceChange24h >= 0;
  const ageLabel =
    launch.ageMinutes < 60
      ? `${launch.ageMinutes}m`
      : launch.ageMinutes < 1440
      ? `${Math.floor(launch.ageMinutes / 60)}h`
      : `${Math.floor(launch.ageMinutes / 1440)}d`;

  return (
    <div
      onClick={onClick}
      className="rounded-xl border border-border p-3 hover:bg-surface-2 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <TokenIcon symbol={launch.symbol} glyph={launch.glyph} color={launch.color} size="md" live />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">{launch.symbol}</span>
            <Chip variant="bear">{ageLabel} old</Chip>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{launch.name}</div>
        </div>
        <Sparkline data={launch.sparkline} width={56} height={24} bullish={isBull} />
        <div className="text-right">
          <div className={cn("text-sm font-semibold tabular", isBull ? "text-bull" : "text-bear")}>
            {isBull ? "+" : ""}{launch.priceChange24h.toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground tabular">{fmtUsd(launch.marketCap, { compact: true })} mcap</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mt-2 text-[10px]">
        <div>
          <span className="text-muted-foreground">Liq: </span>
          <span className="font-semibold tabular">{fmtUsd(launch.liquidity, { compact: true })}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Vol: </span>
          <span className="font-semibold tabular">{fmtUsd(launch.volume24h, { compact: true })}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Holders: </span>
          <span className="font-semibold tabular">{fmtNum(launch.holders)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Smart: </span>
          <span className="font-semibold tabular text-bull">{launch.smartMoneyEntries} 🐋</span>
        </div>
      </div>

      {/* Safety badges */}
      <div className="flex flex-wrap gap-1 mt-2">
        {launch.contractVerified ? (
          <span className="text-[9px] font-bold text-bull bg-bull/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <ShieldCheck className="h-2.5 w-2.5" /> Contract
          </span>
        ) : (
          <span className="text-[9px] font-bold text-bear bg-bear/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <ShieldAlert className="h-2.5 w-2.5" /> Unverified
          </span>
        )}
        {launch.liquidityLocked ? (
          <span className="text-[9px] font-bold text-bull bg-bull/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Shield className="h-2.5 w-2.5" /> Liq locked
          </span>
        ) : (
          <span className="text-[9px] font-bold text-bear bg-bear/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <ShieldAlert className="h-2.5 w-2.5" /> Liq NOT locked
          </span>
        )}
        {launch.mintAuthorityRevoked ? (
          <span className="text-[9px] font-bold text-bull bg-bull/10 px-1.5 py-0.5 rounded">Mint revoked</span>
        ) : (
          <span className="text-[9px] font-bold text-bear bg-bear/10 px-1.5 py-0.5 rounded">Mint active!</span>
        )}
      </div>
    </div>
  );
}
