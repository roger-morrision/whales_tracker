"use client";

import { useMemo, useState } from "react";
import {
  PieChart as PieIcon,
  Wallet,
  Image as ImageIcon,
  Landmark,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PORTFOLIO,
  TOKENS_BY_ID,
  fmtUsd,
  fmtPrice,
  fmtPct,
  fmtNum,
  fmtAge,
  timeLabel,
} from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip, SectionHeader, AnimatedNumber } from "./primitives";
import { NftCollectionsList } from "./nft-detail-modal";
import { cn } from "@/lib/utils";

type Range = "1D" | "1W" | "1M" | "ALL";

export function PortfolioView() {
  const [range, setRange] = useState<Range>("1M");
  const [assetTab, setAssetTab] = useState<"crypto" | "nft" | "stocks" | "history">("crypto");
  const prices = useMoby((s) => s.prices);
  const portfolioHoldings = useMoby((s) => s.portfolioHoldings);

  // Compute live portfolio value (uses persisted portfolioHoldings mutated by trades)
  const { totalValue, totalCost, cryptoValue, nftValue, stockValue, dayChange, dayChangePct } = useMemo(() => {
    let cv = 0;
    let cc = 0;
    portfolioHoldings.forEach((h) => {
      const tk = TOKENS_BY_ID[h.tokenId];
      const livePrice = prices[h.tokenId]?.price ?? tk?.price ?? 0;
      cv += h.amount * livePrice;
      cc += h.costUsd;
    });
    let nv = 0;
    let nc = 0;
    PORTFOLIO.nftHoldings.forEach((n) => {
      nv += n.floorPrice * n.count;
      nc += n.avgCost * n.count;
    });
    let sv = 0;
    let sc = 0;
    PORTFOLIO.stockHoldings.forEach((s) => {
      sv += s.shares * s.price;
      sc += s.shares * s.avgCost;
    });
    const total = cv + nv + sv + PORTFOLIO.cashUsd;
    const cost = cc + nc + sc + PORTFOLIO.cashUsd;
    const prev = PORTFOLIO.history[PORTFOLIO.history.length - 2]?.v ?? total;
    const dc = total - prev;
    const dcp = (dc / prev) * 100;
    return {
      totalValue: total,
      totalCost: cost,
      cryptoValue: cv,
      nftValue: nv,
      stockValue: sv,
      dayChange: dc,
      dayChangePct: dcp,
    };
  }, [prices, portfolioHoldings]);

  const totalPnl = totalValue - totalCost;
  const totalPnlPct = (totalPnl / totalCost) * 100;
  const isBull = dayChange >= 0;

  // Compute realized P&L from trade history (profit from completed sells)
  const tradeHistory = useMoby((s) => s.tradeHistory);
  const realizedPnl = useMemo(() => {
    // Group trades by token to compute per-token realized P&L
    const byToken: Record<string, { buys: { usd: number; amount: number }[]; sells: { usd: number; amount: number }[] }> = {};
    for (const t of tradeHistory) {
      if (!byToken[t.tokenId]) byToken[t.tokenId] = { buys: [], sells: [] };
      if (t.side === "BUY") {
        byToken[t.tokenId].buys.push({ usd: t.usdAmount, amount: t.tokenAmount });
      } else {
        byToken[t.tokenId].sells.push({ usd: t.usdAmount, amount: t.tokenAmount });
      }
    }
    // For each token, compute realized P&L using FIFO matching
    let totalRealized = 0;
    for (const [tokenId, { buys, sells }] of Object.entries(byToken)) {
      let buyIdx = 0;
      let remainingBuyAmount = buys[0]?.amount ?? 0;
      for (const sell of sells) {
        let sellAmount = sell.amount;
        let costBasis = 0;
        while (sellAmount > 0 && buyIdx < buys.length) {
          const matched = Math.min(sellAmount, remainingBuyAmount);
          const buyPrice = buys[buyIdx].usd / Math.max(0.000001, buys[buyIdx].amount);
          costBasis += matched * buyPrice;
          sellAmount -= matched;
          remainingBuyAmount -= matched;
          if (remainingBuyAmount <= 0.000001) {
            buyIdx++;
            remainingBuyAmount = buys[buyIdx]?.amount ?? 0;
          }
        }
        totalRealized += sell.usd - costBasis;
      }
    }
    return totalRealized;
  }, [tradeHistory]);

  // Slice history by range
  const history = useMemo(() => {
    const h = PORTFOLIO.history;
    if (range === "1D") {
      // Interpolate 24 hourly points from yesterday to now
      const prev = h[h.length - 2]?.v ?? totalValue * 0.98;
      const out: { t: number; v: number }[] = [];
      for (let i = 0; i < 24; i++) {
        const progress = i / 23;
        const v = prev + (totalValue - prev) * progress + (Math.sin(i * 2.3) * totalValue * 0.003);
        out.push({ t: Date.now() - (23 - i) * 3600_000, v: Math.round(v) });
      }
      return out;
    }
    if (range === "1W") return h.slice(-7);
    if (range === "1M") return h;
    return h;
  }, [range, totalValue]);

  return (
    <div className="space-y-4">
      {/* Portfolio value card */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-[#14F195]/10 via-surface-2 to-surface-2 border border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span>Total portfolio value</span>
          </div>
          <div className="flex gap-0.5">
            {(["1D", "1W", "1M", "ALL"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-semibold rounded",
                  range === r ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-3">
          <AnimatedNumber value={totalValue} format={(n) => fmtUsd(n, { decimals: 2 })} className="text-3xl font-bold" />
          <div className={cn("flex items-center gap-1 pb-1.5 text-sm font-semibold", isBull ? "text-bull" : "text-bear")}>
            {isBull ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {isBull ? "+" : ""}
            {fmtUsd(Math.abs(dayChange), { compact: true })} ({fmtPct(dayChangePct)})
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          All-time PnL:{" "}
          <span className={cn("font-semibold tabular", totalPnl >= 0 ? "text-bull" : "text-bear")}>
            {totalPnl >= 0 ? "+" : "-"}
            {fmtUsd(Math.abs(totalPnl), { compact: true })} ({fmtPct(totalPnlPct)})
          </span>
          {tradeHistory.length > 0 && (
            <>
              {" · "}
              Realized:{" "}
              <span className={cn("font-semibold tabular", realizedPnl >= 0 ? "text-bull" : "text-bear")}>
                {realizedPnl >= 0 ? "+" : "-"}{fmtUsd(Math.abs(realizedPnl), { compact: true })}
              </span>
            </>
          )}
        </div>

        <div className="h-32 mt-3 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="pfolio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--bull)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--bull)"
                strokeWidth={2}
                fill="url(#pfolio)"
                isAnimationActive={false}
              />
              <XAxis
                dataKey="t"
                tickFormatter={(v) => timeLabel(v)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => timeLabel(v)}
                formatter={(v: number) => [fmtUsd(v), "Value"]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset class breakdown */}
      <div className="grid grid-cols-3 gap-2">
        <AssetClassCard
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Crypto"
          value={cryptoValue}
          total={totalValue}
          color="bull"
        />
        <AssetClassCard
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label="NFTs"
          value={nftValue}
          total={totalValue}
          color="gold"
        />
        <AssetClassCard
          icon={<Landmark className="h-3.5 w-3.5" />}
          label="Stocks"
          value={stockValue}
          total={totalValue}
          color="[#22D3EE]"
        />
      </div>

      {/* Holdings */}
      <section>
        <div className="flex gap-1 p-1 bg-surface-2 rounded-lg mb-3">
          {[
            { k: "crypto", label: "Crypto" },
            { k: "nft", label: "NFTs" },
            { k: "stocks", label: "Stocks" },
            { k: "history", label: "History" },
          ].map((s) => (
            <button
              key={s.k}
              onClick={() => setAssetTab(s.k as typeof assetTab)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                assetTab === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {assetTab === "crypto" && <CryptoHoldings />}
        {assetTab === "nft" && <NftCollectionsList />}
        {assetTab === "stocks" && <StockHoldings />}
        {assetTab === "history" && <TradeHistoryView />}
      </section>

      {/* Trading automation tools */}
      <section>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => useMoby.getState().setRebalanceOpen(true)}
            className="rounded-xl border border-border bg-surface-2 p-2.5 hover:bg-surface-3 hover:border-bull/30 transition-colors text-center"
          >
            <div className="text-xl mb-0.5">📊</div>
            <div className="text-[10px] font-medium">Rebalance</div>
          </button>
          <button
            onClick={() => useMoby.getState().setLimitOrdersOpen(true)}
            className="rounded-xl border border-border bg-surface-2 p-2.5 hover:bg-surface-3 hover:border-bull/30 transition-colors text-center"
          >
            <div className="text-xl mb-0.5">🎯</div>
            <div className="text-[10px] font-medium">Limit orders</div>
          </button>
          <button
            onClick={() => useMoby.getState().setDcaOpen(true)}
            className="rounded-xl border border-border bg-surface-2 p-2.5 hover:bg-surface-3 hover:border-bull/30 transition-colors text-center"
          >
            <div className="text-xl mb-0.5">📅</div>
            <div className="text-[10px] font-medium">DCA</div>
          </button>
        </div>
      </section>

      <button onClick={() => useMoby.getState().setWalletOpen(true)} className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Add wallet or chain
      </button>
    </div>
  );
}

function AssetClassCard({
  icon,
  label,
  value,
  total,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
  color: "bull" | "gold" | string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const colorCls =
    color === "bull"
      ? "text-bull bg-bull/10"
      : color === "gold"
      ? "text-gold bg-gold/10"
      : "text-[#22D3EE] bg-[#22D3EE]/10";
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="flex items-center gap-1 mb-1">
        <span className={cn("h-5 w-5 rounded grid place-items-center", colorCls)}>{icon}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-semibold tabular">{fmtUsd(value, { compact: true })}</div>
      <div className="text-[10px] text-muted-foreground tabular">{pct.toFixed(1)}%</div>
    </div>
  );
}

function CryptoHoldings() {
  const prices = useMoby((s) => s.prices);
  const openToken = useMoby((s) => s.openToken);
  const portfolioHoldings = useMoby((s) => s.portfolioHoldings);
  const holdings = useMemo(
    () =>
      portfolioHoldings
        .map((h) => {
          const tk = TOKENS_BY_ID[h.tokenId];
          const live = prices[h.tokenId]?.price ?? tk?.price ?? 0;
          const value = h.amount * live;
          const cost = h.costUsd;
          const pnl = value - cost;
          const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
          const avgCost = h.amount > 0 ? cost / h.amount : 0;
          return {
            ...h,
            id: `ph_${h.tokenId}`,
            chain: tk?.chain ?? "SOL",
            token: tk,
            livePrice: live,
            value,
            cost,
            pnl,
            pnlPct,
            avgCost,
          };
        })
        .sort((a, b) => b.value - a.value),
    [prices, portfolioHoldings]
  );

  return (
    <div className="space-y-1">
      {holdings.map((h) => {
        if (!h.token) return null;
        const isBull = h.pnl >= 0;
        return (
          <div
            key={h.id}
            onClick={() => openToken(h.token!.id)}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-2 cursor-pointer transition-colors"
          >
            <TokenIcon symbol={h.token.symbol} glyph={h.token.logoGlyph} color={h.token.logoColor} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm">{h.token.symbol}</span>
                <Chip variant="outline">{h.chain}</Chip>
                <Chip variant="outline">{fmtAge(h.token.ageHours)}</Chip>
              </div>
              <div className="text-[11px] text-muted-foreground tabular">
                {fmtNum(h.amount)} · avg {fmtPrice(h.avgCost)} · {h.token.smartMoneyHolders} smart
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular">{fmtUsd(h.value, { compact: true })}</div>
              <div className={cn("text-[11px] tabular flex items-center justify-end gap-0.5", isBull ? "text-bull" : "text-bear")}>
                {isBull ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isBull ? "+" : "-"}
                {fmtUsd(Math.abs(h.pnl), { compact: true })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StockHoldings() {
  return (
    <div className="space-y-1">
      {PORTFOLIO.stockHoldings.map((s) => {
        const value = s.shares * s.price;
        const cost = s.shares * s.avgCost;
        const pnl = value - cost;
        const isBull = s.change24h >= 0;
        return (
          <button
            key={s.id}
            onClick={() => useMoby.getState().setStocksOpen(true)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-2 transition-colors text-left"
          >
            <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white text-xs", s.color)}>
              {s.ticker.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm">{s.ticker}</span>
                {s.preipo && <Chip variant="gold">Pre-IPO</Chip>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {s.shares} sh · avg ${s.avgCost.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular">{fmtUsd(value, { compact: true })}</div>
              <div className={cn("text-[11px] tabular", isBull ? "text-bull" : "text-bear")}>
                {isBull ? "+" : ""}
                {fmtPct(s.change24h)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ===== Trade History View =====
function TradeHistoryView() {
  const tradeHistory = useMoby((s) => s.tradeHistory);
  const openToken = useMoby((s) => s.openToken);

  if (tradeHistory.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-3xl mb-2">📊</div>
        <div className="text-sm text-muted-foreground">No trades yet.</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Your executed trades will appear here with P&L tracking.
        </div>
      </div>
    );
  }

  // Compute aggregate stats
  const totalBuyUsd = tradeHistory.filter((t) => t.side === "BUY").reduce((s, t) => s + t.usdAmount, 0);
  const totalSellUsd = tradeHistory.filter((t) => t.side === "SELL").reduce((s, t) => s + t.usdAmount, 0);
  const buyCount = tradeHistory.filter((t) => t.side === "BUY").length;
  const sellCount = tradeHistory.filter((t) => t.side === "SELL").length;

  return (
    <div className="space-y-3">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border p-2.5 text-center">
          <div className="text-lg font-bold tabular">{tradeHistory.length}</div>
          <div className="text-[10px] text-muted-foreground">Total trades</div>
        </div>
        <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center">
          <div className="text-lg font-bold tabular text-bull">{fmtUsd(totalBuyUsd, { compact: true })}</div>
          <div className="text-[10px] text-muted-foreground">{buyCount} buys</div>
        </div>
        <div className="rounded-xl border border-bear/30 bg-bear/5 p-2.5 text-center">
          <div className="text-lg font-bold tabular text-bear">{fmtUsd(totalSellUsd, { compact: true })}</div>
          <div className="text-[10px] text-muted-foreground">{sellCount} sells</div>
        </div>
      </div>

      {/* Trade list */}
      <div className="space-y-1">
        {tradeHistory.slice(0, 50).map((trade) => {
          const isBuy = trade.side === "BUY";
          const date = new Date(trade.ts);
          const timeStr = date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          return (
            <div
              key={trade.id}
              onClick={() => openToken(trade.tokenId)}
              className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <div className={cn(
                "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                isBuy ? "bg-bull/15" : "bg-bear/15"
              )}>
                {isBuy ? (
                  <ArrowUpRight className="h-4 w-4 text-bull" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-bear" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">{trade.tokenSymbol}</span>
                  <span className={cn(
                    "text-[9px] font-bold px-1 py-0.5 rounded",
                    isBuy ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"
                  )}>
                    {trade.side}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground tabular">
                  {fmtNum(trade.tokenAmount)} @ {fmtPrice(trade.price)} · {timeStr}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("text-sm font-bold tabular", isBuy ? "text-bull" : "text-bear")}>
                  {isBuy ? "+" : "-"}{fmtUsd(trade.usdAmount, { compact: true })}
                </div>
                {trade.txHash && (
                  <div className="text-[9px] text-muted-foreground font-mono truncate max-w-[80px]">
                    {trade.txHash.slice(0, 12)}…
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
