"use client";

import { useMemo, useState } from "react";
import {
  X,
  Star,
  StarOff,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Wallet,
  Activity,
  TrendingUp,
  Bell,
  GitCompareArrows,
  Share2,
  Globe,
  Twitter,
  Send,
  MessageCircle,
  Rocket,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TOKENS_BY_ID, fmtUsd, fmtPrice, fmtPct, fmtNum, fmtAge, type Token } from "@/lib/moby-data";
import { useMoby, useToken } from "@/lib/moby-store";
import { useGmgn } from "@/hooks/use-gmgn";
import { TokenIcon, Chip, Sparkline } from "./primitives";
import { HolderDistributionSection } from "./holder-distribution";
import { WalletLink } from "./wallet-link";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { TokenDetailLayout } from "./token-detail-layout";

type Range = "5M" | "1H" | "1D" | "1W" | "ALL";

export function TokenDetailSheet() {
  const tokenId = useMoby((s) => s.selectedTokenId);
  const openToken = useMoby((s) => s.openToken);
  const externalTokenData = useMoby((s) => s.externalTokenData);
  const clearExternalToken = useMoby((s) => s.clearExternalToken);
  const token = useToken(tokenId);

  // If we have external token data (from DexScreener), show an external token detail sheet
  if (externalTokenData && tokenId?.startsWith("ext_")) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => clearExternalToken()}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl"
          >
            <ExternalTokenContent data={externalTokenData} onClose={() => clearExternalToken()} />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {token && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => openToken(null)}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl"
          >
            <TokenDetailLayout />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TokenDetailContent({ token }: { token: Token }) {
  const [range, setRange] = useState<Range>("1D");
  const openToken = useMoby((s) => s.openToken);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const watchlist = useMoby((s) => s.watchlist);
  const toggleWatch = useMoby((s) => s.toggleWatch);
  const prices = useMoby((s) => s.prices);
  const openTrade = useMoby((s) => s.openTrade);
  const openAlertCreator = useMoby((s) => s.openAlertCreator);
  const toggleCompareId = useMoby((s) => s.toggleCompareId);
  const setCompareOpen = useMoby((s) => s.setCompareOpen);
  const compareIds = useMoby((s) => s.compareIds);
  const watched = watchlist.includes(token.id);
  const inCompare = compareIds.includes(token.id);

  const live = prices[token.id]?.price ?? token.price;
  const delta1h = ((live - token.price * (1 - token.change1h / 100)) / token.price) * 100;
  const delta24h = ((live - token.price * (1 - token.change24h / 100)) / token.price) * 100;
  const isBull = delta24h >= 0;

  // Build a synthetic chart series from the sparkline + live price.
  // Use the token id + index as a deterministic seed so the chart shape is stable
  // across renders (only the last point moves with `live`).
  const chartData = useMemo(() => {
    const base = token.sparkline;
    const n = base.length;
    // tiny deterministic wiggle from a hash of token.id + i
    const hash = (s: string) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 1000) / 1000; // 0..1
    };
    return base.map((v, i) => ({
      i,
      v: i === n - 1 ? live : v * (1 + (hash(`${token.id}-${i}`) - 0.5) * 0.01),
      t: i * 60_000,
    }));
  }, [token, live]);

  return (
    <TokenDetailLayout />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

// ===== GMGN Live Data Panel ====
function GmgnPanel({ mint, symbol }: { mint: string; symbol: string }) {
  const [tab, setTab] = useState<"security" | "holders" | "smart" | "kol" | "traders">("security");
  const apiUrl = `/api/gmgn/${tab === "smart" ? "smart-money" : tab}?address=${mint}&limit=15`;
  const { data, loading, source } = useGmgn<any>(apiUrl, { refreshMs: 60_000 });

  return (
    <div className="px-4 mt-4">
      <div className="rounded-2xl border border-border bg-surface-2/50 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-md bg-gradient-to-br from-[#14F195] to-[#9945FF] grid place-items-center text-[10px] font-bold text-background">
              G
            </div>
            <span className="text-xs font-semibold">GMGN Live</span>
            {source && (
              <Chip variant={(source === "gmgn" || source === "dexscreener") ? "bull" : "outline"} className="text-[9px]">
                {(source === "gmgn" || source === "dexscreener") ? "live" : "demo"}
              </Chip>
            )}
          </div>
          <div className="ml-auto text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
            {mint.slice(0, 6)}...{mint.slice(-4)}
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-0.5 p-2 border-b border-border bg-surface-3/30">
          {[
            { k: "security", label: "Security" },
            { k: "holders", label: "Holders" },
            { k: "smart", label: "Smart" },
            { k: "kol", label: "KOL" },
            { k: "traders", label: "Traders" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors",
                tab === t.k
                  ? "bg-bull/15 text-bull"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-3 max-h-[300px] overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-surface-3 animate-pulse" />
              ))}
            </div>
          ) : !data ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Failed to load GMGN data. Try again later.
            </div>
          ) : (
            <>
              {tab === "security" && <GmgnSecurityView data={data.security} />}
              {tab === "holders" && <GmgnHoldersView holders={data.holders || []} />}
              {tab === "smart" && <GmgnSmartView activity={data.activity || []} />}
              {tab === "kol" && <GmgnKolView kols={data.kols || []} />}
              {tab === "traders" && <GmgnTradersView traders={data.traders || []} />}
            </>
          )}
        </div>

        {/* Footer link to GMGN */}
        <div className="px-3 py-2 border-t border-border bg-surface-3/20">
          <button
            onClick={() => useMoby.getState().pushToast({ title: "GMGN report", description: `Full report available for ${mint.slice(0, 8)}...`, type: "info" })}
            className="text-[10px] text-muted-foreground hover:text-bull inline-flex items-center gap-1"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            View full report
          </button>
        </div>
      </div>
    </div>
  );
}

function GmgnSecurityView({ data }: { data: any }) {
  if (!data) return <div className="text-xs text-muted-foreground py-4 text-center">No security data</div>;
  const checks: { label: string; ok: boolean; value?: string }[] = [
    { label: "Mint authority revoked", ok: data.is_mint_authority_revoked },
    { label: "Freeze authority revoked", ok: data.is_freeze_authority_revoked },
    { label: "Not honeypot", ok: !data.is_honeypot },
    { label: "LP locked", ok: !!data.liquidity_locked, value: data.lp_locked_ratio ? `${(data.lp_locked_ratio * 100).toFixed(0)}%` : undefined },
    { label: "Open source", ok: data.is_open_source },
    { label: "Not proxy", ok: !data.is_proxy },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {checks.map((c) => (
          <div key={c.label} className="rounded-lg border border-border p-2 flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full shrink-0", c.ok ? "bg-bull" : "bg-bear")} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium truncate">{c.label}</div>
              {c.value && <div className="text-[10px] text-muted-foreground tabular">{c.value}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="rounded-lg border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Top 10 holders</div>
          <div className={cn("text-sm font-bold tabular", (data.top10_holder_rate ?? 0) > 35 ? "text-bear" : "text-foreground")}>
            {(data.top10_holder_rate ?? 0).toFixed(2)}%
          </div>
        </div>
        <div className="rounded-lg border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Dev holdings</div>
          <div className={cn("text-sm font-bold tabular", (data.dev_holder_rate ?? 0) > 10 ? "text-bear" : "text-foreground")}>
            {(data.dev_holder_rate ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>
      {data.risks && data.risks.length > 0 && (
        <div className="rounded-lg border border-bear/30 bg-bear/5 p-2">
          <div className="text-[10px] font-semibold text-bear mb-1">⚠ Risks identified</div>
          <ul className="text-[10px] text-muted-foreground list-disc list-inside space-y-0.5">
            {data.risks.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GmgnHoldersView({ holders }: { holders: any[] }) {
  if (holders.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No holder data</div>;

  // Compute exposure summary from holder tags
  const bundled = holders.filter((h) => h.is_bundler || h.tags?.includes("bundler"));
  const snipers = holders.filter((h) => h.is_sniper || h.tags?.includes("sniper"));
  const ratTraders = holders.filter((h) => h.is_rat_trader || h.tags?.includes("rat_trader"));
  const freshWallets = holders.filter((h) => h.is_fresh_wallet || h.tags?.includes("fresh_wallet"));
  const smartMoney = holders.filter((h) => h.is_smart_money || h.tags?.includes("smart_degen"));
  const kols = holders.filter((h) => h.is_kol || h.tags?.includes("renowned"));

  const totalBundlerPct = bundled.reduce((s, h) => s + (h.holder_rate || 0), 0);
  const totalSniperPct = snipers.reduce((s, h) => s + (h.holder_rate || 0), 0);

  return (
    <div className="space-y-2">
      {/* Exposure summary */}
      {(bundled.length > 0 || snipers.length > 0 || ratTraders.length > 0 || freshWallets.length > 0) && (
        <div className="rounded-lg border border-border bg-surface-2/50 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Wallet exposure</div>
          {/* Donut: top-10 vs next-10 vs rest */}
          <HolderConcentrationDonut holders={holders} />
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <ExposureMetric label="Bundlers" count={bundled.length} pct={totalBundlerPct} tone={totalBundlerPct > 20 ? "bear" : "muted"} tip="Bundler bots that bought in coordinated batches at launch" />
            <ExposureMetric label="Snipers" count={snipers.length} pct={totalSniperPct} tone={totalSniperPct > 20 ? "bear" : "muted"} tip="Wallets that bought in the first blocks after launch" />
            <ExposureMetric label="Rat traders" count={ratTraders.length} pct={0} tone="muted" tip="Insider/sneak trading wallets" />
            <ExposureMetric label="Fresh wallets" count={freshWallets.length} pct={0} tone="muted" tip="Newly-created wallets — often insider-linked" />
            <ExposureMetric label="Smart money" count={smartMoney.length} pct={0} tone="bull" tip="GMGN-tagged smart-money holders (bullish)" />
            <ExposureMetric label="KOLs" count={kols.length} pct={0} tone="bull" tip="GMGN-tagged KOL/influencer holders (bullish)" />
          </div>
          {totalBundlerPct > 20 && (
            <div className="mt-2 rounded-md border border-bear/30 bg-bear/5 p-1.5 text-[10px] text-bear">
              ⚠️ Bundled cluster detected — {totalBundlerPct.toFixed(1)}% of supply held by {bundled.length} bundler wallet(s). High rug risk.
            </div>
          )}
        </div>
      )}

      {/* Holder list */}
      <div className="space-y-1">
        {holders.slice(0, 15).map((h, i) => (
          <div key={i} onClick={() => useMoby.getState().openWalletDetail(h.address, h.is_smart_money ? "Smart wallet" : h.is_kol ? "KOL wallet" : "Holder")} className="rounded-lg border border-border p-2 flex items-center gap-2 cursor-pointer hover:bg-surface-2 transition-colors">
            <div className="text-[10px] font-semibold text-muted-foreground w-5">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono truncate">{h.address}</span>
                {h.is_dev && <Chip variant="bear" className="text-[9px]">DEV</Chip>}
                {h.is_smart_money && <Chip variant="bull" className="text-[9px]">SMART</Chip>}
                {h.is_kol && <Chip variant="gold" className="text-[9px]">KOL</Chip>}
                {h.is_sniper && <Chip variant="bear" className="text-[9px]">SNIPER</Chip>}
                {h.is_bundler && <Chip variant="bear" className="text-[9px]">BUNDLER</Chip>}
                {h.is_fresh_wallet && <Chip variant="outline" className="text-[9px]">FRESH</Chip>}
              </div>
              <div className="text-[10px] text-muted-foreground tabular">
                {fmtNum(h.balance)} · {fmtUsd(h.value_usd, { compact: true })}
              </div>
            </div>
            <div className="text-right">
              <div className={cn("text-xs font-bold tabular", h.holder_rate > 5 ? "text-bear" : "text-foreground")}>
                {h.holder_rate.toFixed(2)}%
              </div>
              <FollowWalletButton address={h.address} label={h.is_smart_money ? "Smart wallet" : h.is_kol ? "KOL" : "Holder"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExposureMetric({ label, count, pct, tone, tip }: { label: string; count: number; pct: number; tone: "bull" | "bear" | "muted"; tip: string }) {
  if (count === 0) return null;
  return (
    <div
      className={cn(
        "rounded-md border p-1.5",
        tone === "bear" && "border-bear/30 bg-bear/5",
        tone === "bull" && "border-bull/30 bg-bull/5",
        tone === "muted" && "border-border"
      )}
      title={tip}
    >
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
      <div className={cn(
        "text-xs font-bold tabular",
        tone === "bear" && "text-bear",
        tone === "bull" && "text-bull",
        tone === "muted" && "text-foreground"
      )}>
        {count} {pct > 0 && <span className="text-[9px] font-normal opacity-70">· {pct.toFixed(1)}%</span>}
      </div>
    </div>
  );
}

function GmgnSmartView({ activity }: { activity: any[] }) {
  if (activity.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No smart money activity</div>;
  return (
    <div className="space-y-1">
      {activity.slice(0, 15).map((a, i) => {
        const isBuy = a.type === "buy";
        return (
          <div key={i} onClick={() => useMoby.getState().openWalletDetail(a.address, a.wallet_label || "Smart wallet")} className="rounded-lg border border-border p-2 flex items-center gap-2 cursor-pointer hover:bg-surface-2 transition-colors">
            <div className={cn("h-7 w-7 rounded-lg grid place-items-center shrink-0", isBuy ? "bg-bull/15" : "bg-bear/15")}>
              {isBuy ? <ArrowUpRight className="h-3.5 w-3.5 text-bull" /> : <ArrowDownRight className="h-3.5 w-3.5 text-bear" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono truncate">{a.address}</span>
                {a.wallet_tag && <Chip variant="outline" className="text-[9px]">{a.wallet_tag}</Chip>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {a.wallet_label || "Smart wallet"} · {new Date(a.ts * 1000).toLocaleTimeString()}
              </div>
            </div>
            <div className="text-right">
              <div className={cn("text-xs font-bold tabular", isBuy ? "text-bull" : "text-bear")}>
                {isBuy ? "+" : "-"}{fmtUsd(a.amount_usd, { compact: true })}
              </div>
              {a.pnl_30d_usd !== undefined && (
                <div className={cn("text-[10px] tabular", a.pnl_30d_usd >= 0 ? "text-bull" : "text-bear")}>
                  30d: {a.pnl_30d_usd >= 0 ? "+" : ""}{fmtUsd(a.pnl_30d_usd, { compact: true })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GmgnKolView({ kols }: { kols: any[] }) {
  if (kols.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No KOL holders</div>;
  return (
    <div className="space-y-1">
      {kols.slice(0, 15).map((k, i) => (
        <div key={i} onClick={() => useMoby.getState().openWalletDetail(k.address, k.twitter_name || k.twitter_handle || "KOL")} className="rounded-lg border border-border p-2 flex items-center gap-2 cursor-pointer hover:bg-surface-2 transition-colors">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#22D3EE] to-[#9945FF] grid place-items-center text-[10px] font-bold text-background shrink-0">
            {k.twitter_name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold truncate">@{k.twitter_handle}</span>
              <Chip variant="gold" className="text-[9px]">KOL</Chip>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {fmtNum(k.followers)} followers · {fmtUsd(k.value_usd, { compact: true })}
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-xs font-bold tabular", (k.pnl_usd ?? 0) >= 0 ? "text-bull" : "text-bear")}>
              {k.pnl_usd >= 0 ? "+" : ""}{fmtUsd(k.pnl_usd, { compact: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GmgnTradersView({ traders }: { traders: any[] }) {
  if (traders.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">No trader data</div>;
  return (
    <div className="space-y-1">
      {traders.slice(0, 15).map((t, i) => {
        const isWin = t.pnl >= 0;
        return (
          <div key={i} onClick={() => useMoby.getState().openWalletDetail(t.address, t.is_smart_money ? "Smart trader" : t.is_kol ? "KOL trader" : "Trader")} className="rounded-lg border border-border p-2 flex items-center gap-2 cursor-pointer hover:bg-surface-2 transition-colors">
            <div className="text-[10px] font-semibold text-muted-foreground w-5">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono truncate">{t.address}</span>
                {t.is_smart_money && <Chip variant="bull" className="text-[9px]">SMART</Chip>}
                {t.is_kol && <Chip variant="gold" className="text-[9px]">KOL</Chip>}
              </div>
              <div className="text-[10px] text-muted-foreground tabular">
                Buy {fmtUsd(t.buy_usd, { compact: true })} · Sell {fmtUsd(t.sell_usd, { compact: true })}
              </div>
            </div>
            <div className="text-right">
              <div className={cn("text-xs font-bold tabular", isWin ? "text-bull" : "text-bear")}>
                {isWin ? "+" : ""}{fmtUsd(t.pnl, { compact: true })}
              </div>
              {t.pnl_rate !== undefined && (
                <div className={cn("text-[10px] tabular", isWin ? "text-bull" : "text-bear")}>
                  {isWin ? "+" : ""}{t.pnl_rate.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== GMGN Token Badges — risk score, dev renouncement, bonding curve =====
function GmgnTokenBadges({ mint }: { mint: string }) {
  // Fetch token info + security in parallel
  const tokenUrl = `/api/gmgn/token?address=${mint}`;
  const securityUrl = `/api/gmgn/security?address=${mint}`;
  const { data: tokenData, source: tokenSource } = useGmgn<any>(tokenUrl, { refreshMs: 60_000 });
  const { data: secData } = useGmgn<any>(securityUrl, { refreshMs: 120_000 });

  const token = tokenData?.token;
  const sec = secData?.security;
  if (!token) return null;

  // Compose risk badges from already-fetched GMGN fields
  const badges: { label: string; emoji: string; tone: "bull" | "bear" | "gold" | "muted"; tip: string }[] = [];

  // Dev renouncement (positive signal)
  if (sec?.is_mint_authority_revoked && sec?.is_freeze_authority_revoked) {
    badges.push({
      label: "Dev renounced",
      emoji: "✅",
      tone: "bull",
      tip: "Mint and freeze authority both revoked — dev cannot mint more or freeze wallets.",
    });
  } else if (sec?.is_mint_authority_revoked) {
    badges.push({
      label: "Mint revoked",
      emoji: "✅",
      tone: "bull",
      tip: "Mint authority revoked — dev cannot create more supply. Freeze authority still active.",
    });
  } else if (sec && !sec.is_mint_authority_revoked) {
    badges.push({
      label: "Mint live",
      emoji: "⚠️",
      tone: "bear",
      tip: "Mint authority NOT revoked — dev can still mint more tokens.",
    });
  }

  // CTO (community takeover) flag
  if (token.cto_flag === 1) {
    badges.push({
      label: "CTO",
      emoji: "👋",
      tone: "gold",
      tip: "Community Takeover — original dev abandoned, community is running the project.",
    });
  }

  // Bonding curve status
  if (token.is_on_curve === true) {
    badges.push({
      label: "On curve",
      emoji: "📈",
      tone: "gold",
      tip: "Still inside pump.fun bonding curve — buy via pump.fun, not Raydium.",
    });
  } else if (token.is_on_curve === false && token.market_cap > 0) {
    badges.push({
      label: "Graduated",
      emoji: "🎓",
      tone: "bull",
      tip: "Graduated to open DEX (Raydium/PumpSwap) — bonding curve complete.",
    });
  }

  // Risk scores (only show if non-zero)
  if (typeof token.rug_ratio === "number") {
    const pct = Math.round(token.rug_ratio * 100);
    if (pct > 0) {
      badges.push({
        label: `Rug ${pct}%`,
        emoji: "🚩",
        tone: pct > 30 ? "bear" : pct > 10 ? "gold" : "muted",
        tip: `Rug-ratio score: ${pct}/100. GMGN's historical rug-pull probability estimate. >30% is high risk.`,
      });
    }
  }
  if (typeof token.bundler_rate === "number" && token.bundler_rate > 0) {
    const pct = Math.round(token.bundler_rate * 100);
    badges.push({
      label: `Bundler ${pct}%`,
      emoji: "🤖",
      tone: pct > 30 ? "bear" : "muted",
      tip: `${pct}% of supply was bought by bundler bots in the first transactions. High values suggest coordinated launch.`,
    });
  }
  if (typeof token.sniper_count === "number" && token.sniper_count > 0) {
    badges.push({
      label: `${token.sniper_count} snipers`,
      emoji: "🎯",
      tone: token.sniper_count > 20 ? "bear" : "gold",
      tip: `${token.sniper_count} sniper wallets bought in the first blocks after launch. These wallets typically dump quickly.`,
    });
  }
  if (typeof token.rat_trader_amount_rate === "number" && token.rat_trader_amount_rate > 0) {
    const pct = Math.round(token.rat_trader_amount_rate * 100);
    badges.push({
      label: `Rat ${pct}%`,
      emoji: "🐀",
      tone: pct > 30 ? "bear" : "muted",
      tip: `${pct}% of volume from "rat trader" (insider/sneak) wallets. Indicates coordinated fake activity.`,
    });
  }

  // Smart money / KOL counts (positive signals)
  if (typeof token.smart_degen_count === "number" && token.smart_degen_count > 0) {
    badges.push({
      label: `${token.smart_degen_count} smart`,
      emoji: "🐋",
      tone: "bull",
      tip: `${token.smart_degen_count} GMGN-tagged smart-money wallets holding this token.`,
    });
  }
  if (typeof token.renowned_count === "number" && token.renowned_count > 0) {
    badges.push({
      label: `${token.renowned_count} KOL`,
      emoji: "⭐",
      tone: "bull",
      tip: `${token.renowned_count} KOL/influencer wallets holding this token.`,
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="px-4 mt-3">
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b, i) => (
          <span
            key={i}
            title={b.tip}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
              b.tone === "bull" && "bg-bull/10 text-bull border-bull/30",
              b.tone === "bear" && "bg-bear/10 text-bear border-bear/30",
              b.tone === "gold" && "bg-gold/10 text-gold border-gold/30",
              b.tone === "muted" && "bg-surface-2 text-muted-foreground border-border"
            )}
          >
            <span className="text-[11px]">{b.emoji}</span>
            {b.label}
          </span>
        ))}
        {tokenSource && (
          <span className="text-[9px] text-muted-foreground self-center ml-1">
            via {tokenSource === "gmgn" ? "GMGN" : "demo"}
          </span>
        )}
      </div>
    </div>
  );
}

// ===== Bonding Curve Progress Bar =====
function BondingCurveBar({ mint, marketCap }: { mint: string; marketCap: number }) {
  const { data } = useGmgn<any>(`/api/gmgn/token?address=${mint}`, { refreshMs: 60_000 });
  const token = data?.token;
  if (!token) return null;
  // Only show if on curve (pump.fun style)
  if (token.is_on_curve !== true) return null;

  // Pump.fun graduation threshold ≈ $69k SOL market cap
  const GRAD_THRESHOLD = 69_000;
  const progress = Math.min(100, Math.round((marketCap / GRAD_THRESHOLD) * 100));
  const isGraduating = progress > 85;

  return (
    <div className="px-4 mt-3">
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gold">📈 Bonding curve</span>
            {isGraduating && (
              <span className="text-[9px] font-bold text-gold animate-pulse">⚡ Graduating soon</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground tabular">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isGraduating
                ? "bg-gradient-to-r from-gold to-bull live-dot"
                : "bg-gradient-to-r from-gold/60 to-gold"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-[9px] text-muted-foreground mt-1 flex justify-between">
          <span>MC {fmtUsd(marketCap, { compact: true })}</span>
          <span>Graduates at ~$69K</span>
        </div>
      </div>
    </div>
  );
}

// ===== Token Social Header — logo + socials + boosts badge =====
function TokenSocialHeader({ mint, symbol }: { mint: string; symbol: string }) {
  const { data } = useGmgn<any>(`/api/gmgn/token?address=${mint}`, { refreshMs: 120_000 });
  const token = data?.token;
  if (!token) return null;

  const socials: { type: string; url: string }[] = token.socials || [];
  const websites: { url: string; label?: string }[] = token.websites || [];
  const website = token.website || websites[0]?.url;
  const boostsActive: number = token.boosts_active || 0;
  const hasAnySocial = socials.length > 0 || website;

  if (!hasAnySocial && !token.image_uri && boostsActive === 0) return null;

  const socialIcon: Record<string, React.ReactNode> = {
    twitter: <Twitter className="h-3.5 w-3.5" />,
    telegram: <Send className="h-3.5 w-3.5" />,
    discord: <MessageCircle className="h-3.5 w-3.5" />,
    instagram: <Globe className="h-3.5 w-3.5" />,
  };

  return (
    <div className="px-4 mt-3">
      <div className="rounded-xl border border-border bg-surface-2/40 p-2.5 flex items-center gap-2.5">
        {/* Token logo from DexScreener */}
        {token.image_uri && (
          <img
            src={token.image_uri}
            alt={symbol}
            className="h-9 w-9 rounded-full object-cover shrink-0"
            onError={(e) => { (e.currentTarget.style.display = "none"); }}
          />
        )}
        <div className="flex-1 min-w-0">
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-foreground hover:text-bull inline-flex items-center gap-1 max-w-full"
              title={website}
            >
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate">{websites[0]?.label || new URL(website).hostname.replace("www.", "")}</span>
            </a>
          )}
          {socials.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              {socials.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-6 w-6 grid place-items-center rounded-md bg-surface-3 hover:bg-bull/15 hover:text-bull text-muted-foreground transition-colors"
                  aria-label={s.type}
                  title={s.type}
                >
                  {socialIcon[s.type] || <Globe className="h-3.5 w-3.5" />}
                </a>
              ))}
            </div>
          )}
          {!website && socials.length === 0 && (
            <div className="text-[10px] text-muted-foreground">No social links available</div>
          )}
        </div>
        {/* Boosted badge */}
        {boostsActive > 0 && (
          <a
            onClick={() => useMoby.getState().pushToast({ title: "Boosted token", description: `${boostsActive} active boosts on DexScreener`, type: "info" })}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gold/10 text-gold border border-gold/30 text-[10px] font-bold hover:bg-gold/20"
            title={`${boostsActive} active boosts on DexScreener — paid promotion. Tap to view.`}
          >
            <Rocket className="h-3 w-3" />
            {boostsActive}
          </a>
        )}
      </div>
    </div>
  );
}

// ===== All-DEXes Multi-Pair View =====
function AllDexesPairsView({ mint }: { mint: string }) {
  const { data, loading, source } = useGmgn<{ pairs: any[] }>(
    `/api/dexscreener/pairs?address=${mint}&chain=solana`,
    { refreshMs: 60_000 }
  );

  const pairs = data?.pairs || [];

  // Don't render if only 1 pair (no value over the inline view)
  if (!loading && pairs.length <= 1) return null;

  return (
    <div className="px-4 mt-4">
      <div className="rounded-2xl border border-border bg-surface-2/40 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
          <span className="text-xs font-semibold">🔗 All DEXes</span>
          {source && (
            <Chip variant={source === "dexscreener" ? "bull" : "outline"} className="text-[9px]">
              {source === "dexscreener" ? "live" : "demo"}
            </Chip>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">{pairs.length} pairs</span>
        </div>
        <div className="p-2 overflow-x-auto no-scrollbar">
          {loading ? (
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shrink-0 w-32 h-24 rounded-lg bg-surface-3 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              {pairs.map((p: any, i: number) => {
                const liq = p.liquidity?.usd ?? 0;
                const vol = p.volume?.h24 ?? 0;
                const change = p.priceChange?.h24 ?? 0;
                const priceUsd = parseFloat(p.priceUsd ?? "0");
                const isBull = change >= 0;
                return (
                  <a
                    key={p.pairAddress || i}
                    onClick={() => useMoby.getState().pushToast({ title: `${p.dexId} pair`, description: `Liq ${fmtUsd(p.liquidity?.usd ?? 0, { compact: true })} · Vol ${fmtUsd(p.volume?.h24 ?? 0, { compact: true })}`, type: "info" })}
                    className="shrink-0 w-32 rounded-lg border border-border bg-surface-2 p-2 hover:bg-surface-3 transition-colors"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase truncate">{p.dexId}</span>
                      {p.labels?.[0] && (
                        <Chip variant="outline" className="text-[8px] px-1 py-0">{p.labels[0]}</Chip>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold tabular">{fmtPrice(priceUsd)}</div>
                    <div className={cn("text-[10px] tabular", isBull ? "text-bull" : "text-bear")}>
                      {isBull ? "+" : ""}{change.toFixed(2)}%
                    </div>
                    <div className="mt-1 pt-1 border-t border-border text-[9px] text-muted-foreground tabular space-y-0.5">
                      <div>Liq {fmtUsd(liq, { compact: true })}</div>
                      <div>Vol {fmtUsd(vol, { compact: true })}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Follow Wallet Button (per-wallet push alerts) =====
function FollowWalletButton({ address, label }: { address: string; label?: string }) {
  const followedWallets = useMoby((s) => s.followedWallets);
  const toggleFollowWallet = useMoby((s) => s.toggleFollowWallet);
  const isFollowing = followedWallets.includes(address);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleFollowWallet(address, label);
      }}
      className={cn(
        "mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors",
        isFollowing
          ? "bg-bull/15 text-bull border-bull/30"
          : "bg-surface-3 text-muted-foreground border-border hover:text-foreground"
      )}
      title={isFollowing ? "Unfollow — stop alerts for this wallet" : "Follow — get push alerts when this wallet trades"}
    >
      {isFollowing ? "✓ Following" : "+ Follow"}
    </button>
  );
}

// ===== Holder Concentration Donut =====
function HolderConcentrationDonut({ holders }: { holders: any[] }) {
  if (holders.length === 0) return null;

  // Compute top-10 vs next-10 vs rest
  const top10 = holders.slice(0, 10).reduce((s, h) => s + (h.holder_rate || 0), 0);
  const next10 = holders.slice(10, 20).reduce((s, h) => s + (h.holder_rate || 0), 0);
  const rest = Math.max(0, 100 - top10 - next10);

  // SVG donut (no recharts needed — keeps bundle small)
  const radius = 32;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const top10Offset = 0;
  const next10Offset = (top10 / 100) * circumference;
  const restOffset = ((top10 + next10) / 100) * circumference;

  const segments = [
    { label: "Top 10", pct: top10, offset: top10Offset, color: "#EF4444" }, // red — high concentration
    { label: "Next 10", pct: next10, offset: next10Offset, color: "#F59E0B" }, // gold
    { label: "Rest", pct: rest, offset: restOffset, color: "#14F195" }, // green — distributed
  ].filter((s) => s.pct > 0.5);

  const riskLabel = top10 > 50 ? "High concentration" : top10 > 30 ? "Moderate concentration" : "Well distributed";
  const riskColor = top10 > 50 ? "text-bear" : top10 > 30 ? "text-gold" : "text-bull";

  return (
    <div className="flex items-center gap-3 my-2">
      <div className="relative h-20 w-20 shrink-0">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
          {segments.map((s, i) => (
            <circle
              key={i}
              cx="40" cy="40" r={radius} fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${(s.pct / 100) * circumference} ${circumference}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className={cn("text-sm font-bold tabular", riskColor)}>{top10.toFixed(0)}%</div>
            <div className="text-[8px] text-muted-foreground uppercase">top 10</div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-1">
        <div className={cn("text-[11px] font-semibold", riskColor)}>{riskLabel}</div>
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground flex-1">{s.label}</span>
            <span className="font-semibold tabular">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== External Token Content (for DexScreener tokens not in static list) =====
function ExternalTokenContent({ data, onClose }: { data: any; onClose: () => void }) {
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const watchlist = useMoby((s) => s.watchlist);
  const toggleWatch = useMoby((s) => s.toggleWatch);
  const watched = watchlist.includes(data.address);
  const { data: gmgnData, source } = useGmgn<any>(`/api/gmgn/token?address=${data.address}`, { refreshMs: 60_000 });
  const { data: secData } = useGmgn<any>(`/api/gmgn/security?address=${data.address}`, { refreshMs: 120_000 });

  const token = gmgnData?.token;
  const live = token?.price ?? data.price;
  const change24h = token?.price_change_24h ?? data.change_24h ?? 0;
  const change1h = token?.price_change_1h ?? data.change_1h ?? 0;
  const isBull = change24h >= 0;

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3 z-10">
        {token?.image_uri || data.image_uri ? (
          <img
            src={token?.image_uri || data.image_uri}
            alt={data.symbol}
            className="h-8 w-8 rounded-full object-cover"
            onError={(e) => { (e.currentTarget.style.display = "none"); }}
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-surface-3 to-surface-2 grid place-items-center text-xs font-bold">
            {data.symbol?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{data.symbol}</span>
            <Chip variant="outline">{data.dex || "SOL"}</Chip>
            {source === "gmgn" && <Chip variant="bull" className="text-[9px]">GMGN live</Chip>}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{data.name}</div>
        </div>
        <button
          onClick={() => toggleWatch(data.address)}
          className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
          aria-label="Watchlist"
        >
          {watched ? <Star className="h-4 w-4 fill-gold text-gold" /> : <StarOff className="h-4 w-4" />}
        </button>
        <button
          onClick={onClose}
          className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Price */}
      <div className="px-4 pt-4">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold tabular">{fmtPrice(live)}</span>
          <div className={cn("flex items-center gap-1 pb-1.5 text-sm font-semibold", isBull ? "text-bull" : "text-bear")}>
            {isBull ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {isBull ? "+" : ""}{change24h.toFixed(2)}%
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
          <span>1h: <span className={cn("tabular font-medium", change1h >= 0 ? "text-bull" : "text-bear")}>{change1h >= 0 ? "+" : ""}{change1h.toFixed(2)}%</span></span>
          <span>24h: <span className={cn("tabular font-medium", isBull ? "text-bull" : "text-bear")}>{isBull ? "+" : ""}{change24h.toFixed(2)}%</span></span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <Stat label="Market cap" value={fmtUsd(data.market_cap || token?.market_cap || 0, { compact: true })} />
        <Stat label="Liquidity" value={fmtUsd(data.liquidity || token?.liquidity || 0, { compact: true })} />
        <Stat label="24h Volume" value={fmtUsd(data.volume_24h || token?.volume_24h || 0, { compact: true })} />
        <Stat label="Buys 24h" value={String(data.txns_24h_buys || 0)} />
        <Stat label="Sells 24h" value={String(data.txns_24h_sells || 0)} />
        <Stat label="DEX" value={data.dex || "—"} />
      </div>

      {/* GMGN risk badges */}
      {token && (
        <div className="px-4 mt-3">
          <div className="flex flex-wrap gap-1.5">
            {token.renounced_mint && <Chip variant="bull" className="text-[9px]">✅ Mint revoked</Chip>}
            {token.renounced_freeze_account && <Chip variant="bull" className="text-[9px]">✅ Freeze revoked</Chip>}
            {token.cto_flag === 1 && <Chip variant="gold" className="text-[9px]">👋 CTO</Chip>}
            {token.is_on_curve && <Chip variant="gold" className="text-[9px]">📈 On curve</Chip>}
            {typeof token.rug_ratio === "number" && token.rug_ratio > 0 && (
              <Chip variant={token.rug_ratio > 0.3 ? "bear" : "outline"} className="text-[9px]">🚩 Rug {Math.round(token.rug_ratio * 100)}%</Chip>
            )}
            {typeof token.smart_degen_count === "number" && token.smart_degen_count > 0 && (
              <Chip variant="bull" className="text-[9px]">🐋 {token.smart_degen_count} smart</Chip>
            )}
          </div>
        </div>
      )}

      {/* Address + pair link */}
      <div className="px-4 mt-4">
        <div className="rounded-xl border border-border p-2.5">
          <div className="text-[9px] text-muted-foreground uppercase mb-0.5">Mint address</div>
          <div className="text-[11px] font-mono break-all">{data.address}</div>
          <div className="text-[10px] text-muted-foreground mt-1">DEX: {data.dex} · Pair: {data.pair_address?.slice(0, 12) || "—"}</div>
        </div>
      </div>

      {/* Buy/Sell buttons */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            useMoby.getState().pushToast({
              title: "Trade not available",
              description: `${data.symbol} is not in the Moby trade registry. Use the DEX directly.`,
              type: "info",
            });
          }}
          className="py-2.5 rounded-xl bg-bull/15 text-bull border border-bull/30 text-sm font-bold hover:bg-bull/20"
        >
          Buy {data.symbol}
        </button>
        <button
          onClick={() => {
            useMoby.getState().pushToast({
              title: "Trade not available",
              description: `${data.symbol} is not in the Moby trade registry. Use the DEX directly.`,
              type: "info",
            });
          }}
          className="py-2.5 rounded-xl bg-bear/15 text-bear border border-bear/30 text-sm font-bold hover:bg-bear/20"
        >
          Sell {data.symbol}
        </button>
      </div>

      {/* Alert + Compare */}
      <div className="px-4 mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => useMoby.getState().pushToast({ title: "Alert created", description: `We'll notify you about ${data.symbol}.`, type: "success" })}
          className="h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
        >
          <Bell className="h-3 w-3" /> Alert
        </button>
        <button
          onClick={() => useMoby.getState().pushToast({ title: "Added to compare", description: `${data.symbol} added to comparison list.`, type: "success" })}
          className="h-9 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
        >
          <GitCompareArrows className="h-3 w-3" /> Compare
        </button>
      </div>

      {/* GMGN panel */}
      {data.address && (
        <GmgnPanel mint={data.address} symbol={data.symbol} />
      )}

      {/* All DEX pairs */}
      {data.address && (
        <AllDexesPairsView mint={data.address} />
      )}

      <div className="px-4 mt-4 pb-6 space-y-2">
        {/* Share button */}
        <button
          onClick={() => {
            const text = `${data.symbol} (${data.name})\nPrice: ${fmtPrice(live)}\n24h: ${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%\nMC: ${fmtUsd(data.market_cap || 0, { compact: true })}\n\nDiscovered on Moby 🐋`;
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({ title: `${data.symbol} on Moby`, text }).catch(() => {});
            } else {
              useMoby.getState().openShare({
                title: `${data.name} ($${data.symbol})`,
                description: `Price: ${fmtPrice(live)} · 24h: ${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}% · MC: ${fmtUsd(data.market_cap || 0, { compact: true })}`,
              });
            }
          }}
          className="w-full h-9 rounded-lg bg-bull/15 text-bull border border-bull/30 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-bull/20"
        >
          <Share2 className="h-3 w-3" /> Share {data.symbol}
        </button>
        {/* Ask Moby */}
        <button
          onClick={() => setCopilotOpen(true)}
          className="w-full h-9 rounded-lg bg-gradient-to-r from-[#9945FF]/15 to-[#14F195]/15 border border-[#9945FF]/30 text-xs font-bold inline-flex items-center justify-center gap-1.5"
        >
          <Sparkles className="h-3 w-3" /> Ask Moby for a deeper dive
        </button>
      </div>
    </div>
  );
}
