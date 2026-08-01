"use client";

import { useMemo, useState } from "react";
import { Search, X, TrendingUp, Hash, Clock } from "lucide-react";
import { TOKENS, TRADERS, NARRATIVES, TOKENS_BY_ID, fmtPrice, fmtPct, fmtAge } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function SearchModal() {
  const open = useMoby((s) => s.searchOpen);
  const setOpen = useMoby((s) => s.setSearchOpen);
  const openToken = useMoby((s) => s.openToken);
  const openTrader = useMoby((s) => s.openTrader);
  const recentlyViewed = useMoby((s) => s.recentlyViewed);
  const setActiveTab = useMoby((s) => s.setActiveTab);
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) {
      return {
        tokens: TOKENS.slice(0, 5),
        traders: TRADERS.slice(0, 3),
        narratives: NARRATIVES.slice(0, 3),
      };
    }
    return {
      tokens: TOKENS.filter(
        (t) =>
          t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      ).slice(0, 8),
      traders: TRADERS.filter(
        (t) =>
          t.handle.toLowerCase().includes(query) ||
          t.displayName.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      ).slice(0, 5),
      narratives: NARRATIVES.filter(
        (n) => n.name.toLowerCase().includes(query) || n.description.toLowerCase().includes(query)
      ).slice(0, 4),
    };
  }, [q]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md bg-background border border-border rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Search input */}
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tokens, traders, narratives, wallets…"
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-2">
              {!q.trim() && (
                <>
                  {/* Recently viewed */}
                  {recentlyViewed.length > 0 && (
                    <>
                      <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Recently viewed
                      </div>
                      {recentlyViewed.slice(0, 5).map((id) => {
                        const t = TOKENS_BY_ID[id];
                        if (!t) return null;
                        return (
                          <button
                            key={id}
                            onClick={() => { openToken(id); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 transition-colors text-left"
                          >
                            <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold">{t.symbol}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{t.name}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-semibold tabular">{fmtPrice(t.price)}</div>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                  <div className="px-2 pt-3 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Trending now
                  </div>
                </>
              )}

              {/* Tokens */}
              {results.tokens.length > 0 && (
                <div>
                  <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Tokens
                  </div>
                  {results.tokens.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        openToken(t.id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 transition-colors text-left"
                    >
                      <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{t.symbol}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {t.name} · {t.smartMoneyHolders} smart · {fmtAge(t.ageHours)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold tabular">{fmtPrice(t.price)}</div>
                        <div className={cn("text-[10px] tabular", t.change24h >= 0 ? "text-bull" : "text-bear")}>
                          {fmtPct(t.change24h)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Traders */}
              {results.traders.length > 0 && (
                <div>
                  <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Traders
                  </div>
                  {results.traders.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        openTrader(t.id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 transition-colors text-left"
                    >
                      <div className={cn("h-8 w-8 rounded-full bg-gradient-to-br grid place-items-center text-xs font-bold text-white", t.avatarColor)}>
                        {t.avatarGlyph}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{t.displayName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">@{t.handle} · {t.smartScore} score</div>
                      </div>
                      <Chip variant="gold">#{t.rank}</Chip>
                    </button>
                  ))}
                </div>
              )}

              {/* Narratives */}
              {results.narratives.length > 0 && (
                <div>
                  <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Narratives
                  </div>
                  {results.narratives.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        useMoby.getState().openNarrative(n.id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 transition-colors text-left"
                    >
                      <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br grid place-items-center text-base", n.color)}>
                        {n.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{n.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{n.description}</div>
                      </div>
                      <div className="text-[11px] text-bull font-semibold tabular">+{n.change24h.toFixed(1)}%</div>
                    </button>
                  ))}
                </div>
              )}

              {q.trim() && results.tokens.length === 0 && results.traders.length === 0 && results.narratives.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No results for "{q}"
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NotificationsPanel() {
  const open = useMoby((s) => s.notifOpen);
  const setOpen = useMoby((s) => s.setNotifOpen);
  const alerts = useMoby((s) => s.alerts);
  const dismiss = useMoby((s) => s.dismissAlert);
  const openToken = useMoby((s) => s.openToken);
  const setActiveTab = useMoby((s) => s.setActiveTab);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-end"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-background/40" />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-sm h-full sm:h-screen bg-background border-l border-border overflow-y-auto scrollbar-thin"
          >
            <div className="sticky top-0 bg-background/95 backdrop-blur-xl px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">Alerts & notifications</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {alerts.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No alerts yet. You'll see smart-money entries, whale flows, and price movements here.
                </div>
              )}
              {alerts.map((a) => {
                const colorCls =
                  a.type === "success"
                    ? "bg-bull/15 text-bull"
                    : a.type === "alert"
                    ? "bg-gold/15 text-gold"
                    : a.type === "warn"
                    ? "bg-bear/15 text-bear"
                    : "bg-surface-3 text-muted-foreground";
                return (
                  <div key={a.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2.5">
                      <span className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", colorCls)}>
                        <span className="text-sm">●</span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{a.title}</div>
                        {a.description && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">{a.description}</div>
                        )}
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={() => {
                              setOpen(false);
                              if (a.title.includes("MNGO")) openToken("mngo");
                              else if (a.title.includes("WIF")) openToken("wif");
                              else if (a.title.includes("MOON")) openToken("moon");
                              else setActiveTab("signals");
                            }}
                            className="px-2 py-0.5 rounded-md bg-bull text-background text-[10px] font-semibold"
                          >
                            View
                          </button>
                          <button
                            onClick={() => dismiss(a.id)}
                            className="px-2 py-0.5 rounded-md border border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
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
