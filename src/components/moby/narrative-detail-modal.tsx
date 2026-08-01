"use client";

import { useMemo } from "react";
import { X, TrendingUp, Users, MessageCircle, Activity, ArrowRight, Newspaper } from "lucide-react";
import { getNarrativeDetail, fmtUsd, fmtNum, fmtPct, fmtAgo, TOKENS_BY_ID } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip, Sparkline, SectionHeader } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function NarrativeDetailModal() {
  const open = useMoby((s) => s.narrativeDetailOpen);
  const selectedId = useMoby((s) => s.selectedNarrativeId);
  const setOpen = useMoby((s) => s.setNarrativeDetailOpen);
  const openToken = useMoby((s) => s.openToken);

  const detail = useMemo(() => (selectedId ? getNarrativeDetail(selectedId) : null), [selectedId]);

  return (
    <AnimatePresence>
      {open && detail && (
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
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl"
          >
            {/* Header with gradient */}
            <div className={cn("relative p-4 bg-gradient-to-br border-b border-border", detail.color)}>
              <div className="absolute inset-0 bg-background/40" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">{detail.emoji}</span>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">{detail.name}</h2>
                    <div className="text-xs text-muted-foreground">{detail.description}</div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Chip variant="bull">+{detail.change24h.toFixed(1)}% 24h</Chip>
                  <span className="text-[11px] text-muted-foreground tabular">{fmtNum(detail.mentions24h)} mentions</span>
                  <span className="text-[11px] text-bull tabular">+{fmtUsd(detail.smartMoneyInflow24h, { compact: true })} smart inflow</span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Long description */}
              <div className="rounded-xl border border-border p-3">
                <p className="text-[12px] text-muted-foreground leading-relaxed">{detail.longDescription}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <Stat icon={<TrendingUp className="h-3 w-3" />} label="Market cap" value={fmtUsd(detail.marketCap, { compact: true })} />
                <Stat icon={<Users className="h-3 w-3" />} label="Smart money" value={`${detail.smartMoneyCount} wallets`} />
                <Stat icon={<Activity className="h-3 w-3" />} label="Whale activity" value={fmtUsd(detail.whaleActivity24h, { compact: true })} />
              </div>

              {/* Token list */}
              <div>
                <SectionHeader title="Tokens in this narrative" emoji="🪙" />
                <div className="space-y-2">
                  {detail.tokens.map((t, i) => {
                    const fullToken = TOKENS_BY_ID[t.id];
                    const isBull = t.change24h >= 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setOpen(false);
                          setTimeout(() => openToken(t.id), 200);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-surface-2 transition-colors text-left"
                      >
                        <TokenIcon symbol={t.symbol} glyph={t.glyph} color={t.color} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm">{t.symbol}</span>
                            <Chip variant="outline">{t.weight}% weight</Chip>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{t.name}</div>
                          <div className="text-[10px] text-bull tabular mt-0.5">
                            +{fmtUsd(t.smartMoneyInflow, { compact: true })} smart inflow
                          </div>
                        </div>
                        {fullToken && (
                          <Sparkline data={fullToken.sparkline} width={50} height={24} bullish={isBull} />
                        )}
                        <div className="text-right">
                          <div className={cn("text-sm font-semibold tabular", isBull ? "text-bull" : "text-bear")}>
                            {isBull ? "+" : ""}{t.change24h.toFixed(1)}%
                          </div>
                          <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Related news */}
              {detail.relatedNews.length > 0 && (
                <div>
                  <SectionHeader title="Related news" emoji="📰" />
                  <div className="space-y-2">
                    {detail.relatedNews.map((news, i) => (
                      <div key={i} className="rounded-lg border border-border p-2.5">
                        <div className="flex items-start gap-2">
                          <Newspaper className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium leading-snug">{news.headline}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {news.source} · {fmtAgo(news.agoMinutes * 60)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="flex items-center gap-1 mb-0.5 text-muted-foreground">
        {icon}
        <span className="text-[9px] uppercase font-semibold">{label}</span>
      </div>
      <div className="text-sm font-bold tabular">{value}</div>
    </div>
  );
}
