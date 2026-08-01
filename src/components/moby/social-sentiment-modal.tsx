"use client";

import { useState, useMemo } from "react";
import { X, MessageCircle, Heart, Repeat2, Reply, BadgeCheck, TrendingUp, TrendingDown } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SOCIAL_MENTIONS, SOCIAL_STATS, TOKENS_BY_ID, fmtNum, type SocialMention } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const PLATFORM_META: Record<SocialMention["platform"], { label: string; emoji: string; color: string }> = {
  twitter: { label: "X", emoji: "𝕏", color: "text-foreground" },
  farcaster: { label: "Farcaster", emoji: "🌐", color: "text-[#855DCD]" },
  telegram: { label: "Telegram", emoji: "✈️", color: "text-[#229ED9]" },
  discord: { label: "Discord", emoji: "🎮", color: "text-[#5865F2]" },
};

export function SocialSentimentModal() {
  const open = useMoby((s) => s.socialOpen);
  const setOpen = useMoby((s) => s.setSocialOpen);
  const openToken = useMoby((s) => s.openToken);
  const [tab, setTab] = useState<"feed" | "stats">("feed");

  // Build a fake "mentions over time" series
  const mentionsSeries = useMemo(() => {
    const out: { t: string; bullish: number; bearish: number; neutral: number }[] = [];
    let bull = 40;
    let bear = 20;
    for (let i = 0; i < 24; i++) {
      const r = (n: number) => ((n * 9301 + 49297) % 233280) / 233280;
      bull = Math.max(10, Math.min(80, bull + (r(i) - 0.4) * 12));
      bear = Math.max(5, Math.min(50, bear + (r(i + 100) - 0.5) * 10));
      out.push({
        t: `${i}h`,
        bullish: Math.round(bull),
        bearish: Math.round(bear),
        neutral: Math.round(100 - bull - bear),
      });
    }
    return out;
  }, []);

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
              <MessageCircle className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Social sentiment</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {[
                { k: "feed", label: "🔥 Live feed" },
                { k: "stats", label: "📊 By token" },
              ].map((s) => (
                <button
                  key={s.k}
                  onClick={() => setTab(s.k as typeof tab)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                    tab === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
              {tab === "feed" && (
                <>
                  {/* Sentiment chart */}
                  <div className="rounded-xl border border-border p-3 mb-3">
                    <div className="text-xs font-semibold mb-2">24h sentiment trend</div>
                    <div className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mentionsSeries}>
                          <defs>
                            <linearGradient id="bull-area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="var(--bull)" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="bear-area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--bear)" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="var(--bear)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="bullish" stroke="var(--bull)" strokeWidth={1.5} fill="url(#bull-area)" isAnimationActive={false} />
                          <Area type="monotone" dataKey="bearish" stroke="var(--bear)" strokeWidth={1.5} fill="url(#bear-area)" isAnimationActive={false} />
                          <XAxis dataKey="t" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-bull" /> Bullish
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-bear" /> Bearish
                      </span>
                    </div>
                  </div>

                  {/* Mentions feed */}
                  <div className="space-y-2">
                    {SOCIAL_MENTIONS.map((m) => (
                      <MentionCard key={m.id} mention={m} onTokenClick={openToken} />
                    ))}
                  </div>
                </>
              )}

              {tab === "stats" && (
                <div className="space-y-2">
                  {SOCIAL_STATS.map((s) => {
                    const token = TOKENS_BY_ID[s.tokenId];
                    if (!token) return null;
                    const isBull = s.mentionsChange24h >= 0;
                    return (
                      <button
                        key={s.tokenId}
                        onClick={() => openToken(s.tokenId)}
                        className="w-full rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <TokenIcon symbol={s.symbol} glyph={token.logoGlyph} color={token.logoColor} size="sm" />
                          <div className="flex-1">
                            <div className="text-sm font-semibold">${s.symbol}</div>
                            <div className="text-[10px] text-muted-foreground">{fmtNum(s.mentions24h)} mentions</div>
                          </div>
                          <div className={cn("text-[11px] font-semibold tabular", isBull ? "text-bull" : "text-bear")}>
                            {isBull ? "+" : ""}{s.mentionsChange24h.toFixed(1)}%
                          </div>
                        </div>
                        {/* Sentiment bar */}
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-3 mb-1.5">
                          <div className="bg-bull" style={{ width: `${s.bullishPct}%` }} />
                          <div className="bg-muted" style={{ width: `${s.neutralPct}%` }} />
                          <div className="bg-bear" style={{ width: `${s.bearishPct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground tabular">
                          <span className="text-bull">{s.bullishPct}% bull</span>
                          <span>{s.neutralPct}% neutral</span>
                          <span className="text-bear">{s.bearishPct}% bear</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          <div className="flex-1 h-1 rounded-full bg-surface-3 overflow-hidden">
                            <div className="h-full bg-gold rounded-full" style={{ width: `${s.engagementScore}%` }} />
                          </div>
                          <span className="text-[9px] text-muted-foreground">Engagement {s.engagementScore}/100</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MentionCard({ mention, onTokenClick }: { mention: SocialMention; onTokenClick: (id: string) => void }) {
  const platform = PLATFORM_META[mention.platform];
  const sentColor =
    mention.sentiment === "bullish" ? "text-bull bg-bull/10"
    : mention.sentiment === "bearish" ? "text-bear bg-bear/10"
    : "text-muted-foreground bg-surface-3";
  const sentIcon = mention.sentiment === "bullish" ? <TrendingUp className="h-3 w-3" /> : mention.sentiment === "bearish" ? <TrendingDown className="h-3 w-3" /> : null;

  return (
    <div className="rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors">
      <div className="flex items-start gap-2.5">
        <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white text-xs shrink-0", mention.avatarColor)}>
          {mention.author[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-sm font-semibold">{mention.author}</span>
            {mention.verified && <BadgeCheck className="h-3.5 w-3.5 text-bull" />}
            <span className="text-[11px] text-muted-foreground">{mention.authorHandle}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{mention.agoMinutes < 60 ? `${mention.agoMinutes}m` : `${Math.floor(mention.agoMinutes / 60)}h`}</span>
          </div>
          <p className="text-[13px] leading-snug whitespace-pre-wrap">{mention.content}</p>
          {mention.tokenMentions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {mention.tokenMentions.map((id) => {
                const tk = TOKENS_BY_ID[id];
                if (!tk) return null;
                return (
                  <button
                    key={id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTokenClick(id);
                    }}
                    className="text-[10px] font-mono bg-surface-3 hover:bg-surface-3/70 px-1.5 py-0.5 rounded"
                  >
                    ${tk.symbol}
                  </button>
                );
              })}
              <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ml-auto inline-flex items-center gap-0.5", sentColor)}>
                {sentIcon}
                {mention.sentiment}
              </span>
            </div>
          )}
          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5 hover:text-bull">
              <Reply className="h-3 w-3" /> {fmtNum(mention.replies)}
            </span>
            <span className="flex items-center gap-0.5 hover:text-bull">
              <Heart className="h-3 w-3" /> {fmtNum(mention.likes)}
            </span>
            <span className="flex items-center gap-0.5 hover:text-bull">
              <Repeat2 className="h-3 w-3" /> {fmtNum(mention.retweets)}
            </span>
            <span className="ml-auto text-[10px]">{platform.emoji} {platform.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
