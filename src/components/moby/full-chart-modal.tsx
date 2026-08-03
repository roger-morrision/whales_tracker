"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  CandlestickChart,
  Activity,
  TrendingUp,
  TrendingDown,
  Star,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TOKENS_BY_ID,
  genCandles,
  rsi as calcRsi,
  macd as calcMacd,
  bollingerBands as calcBB,
  ema as calcEma,
  sma as calcSma,
  fmtUsd,
  fmtPrice,
  fmtPct,
  fmtNum,
  fmtAge,
  type Candle,
} from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { useGmgn } from "@/hooks/use-gmgn";
import { LightweightChart } from "./lightweight-chart";
import { TokenIcon, Chip, Sparkline } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Indicator = "candles" | "line" | "bb" | "ema";
type Range = "1H" | "4H" | "1D" | "1W" | "1M";

// Map UI range to GMGN resolution + candle count
const RANGE_CONFIG: Record<Range, { resolution: "1m" | "5m" | "15m" | "1h" | "4h" | "1d"; limit: number }> = {
  "1H": { resolution: "1m", limit: 60 },
  "4H": { resolution: "5m", limit: 48 },
  "1D": { resolution: "15m", limit: 96 },
  "1W": { resolution: "1h", limit: 168 },
  "1M": { resolution: "4h", limit: 180 },
};

export function FullChartModal() {
  const open = useMoby((s) => s.chartOpen);
  const tokenId = useMoby((s) => s.chartTokenId);
  const closeChart = useMoby((s) => s.closeChart);
  const token = tokenId ? TOKENS_BY_ID[tokenId] : null;

  const [indicator, setIndicator] = useState<Indicator>("candles");
  const [range, setRange] = useState<Range>("1D");
  const [showRsi, setShowRsi] = useState(true);
  const [showMacd, setShowMacd] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showTvl, setShowTvl] = useState(false);

  // Try fetching GMGN candles when token has a mint
  const gmgnConfig = token?.mint && token.mint !== "0x0000000000000000000000000000000000000000"
    ? RANGE_CONFIG[range]
    : null;
  const gmgnUrl = gmgnConfig && token?.mint
    ? `/api/gmgn/chart?address=${token.mint}&resolution=${gmgnConfig.resolution}&limit=${gmgnConfig.limit}`
    : null;
  const { data: gmgnData, source: gmgnSource } = useGmgn<any>(gmgnUrl, { refreshMs: 30_000 });

  // Build candles: prefer GMGN, fall back to simulated
  const candles = useMemo<Candle[]>(() => {
    if (!token) return [];
    if (gmgnData?.candles && gmgnData.candles.length > 0) {
      // Convert GmgnCandle to local Candle type
      return gmgnData.candles.map((c: any) => ({
        t: c.t,
        o: c.o,
        h: c.h,
        l: c.l,
        c: c.c,
        v: c.v,
      }));
    }
    const counts: Record<Range, number> = { "1H": 24, "4H": 48, "1D": 96, "1W": 168, "1M": 240 };
    return genCandles(`chart-${token.id}-${range}`, token.price, counts[range]);
  }, [token, range, gmgnData]);

  const closes = candles.map((c) => c.c);
  const rsiData = useMemo(() => calcRsi(closes, 14), [closes]);
  const macdData = useMemo(() => calcMacd(closes), [closes]);
  const bbData = useMemo(() => calcBB(closes, 20, 2), [closes]);
  const ema12 = useMemo(() => calcEma(closes, 12), [closes]);
  const ema26 = useMemo(() => calcEma(closes, 26), [closes]);
  const sma50 = useMemo(() => calcSma(closes, 50), [closes]);

  // Build chart data
  const chartData = useMemo(() => {
    return candles.map((c, i) => ({
      t: c.t,
      o: c.o,
      h: c.h,
      l: c.l,
      c: c.c,
      v: c.v,
      bbUpper: bbData.upper[i],
      bbMiddle: bbData.middle[i],
      bbLower: bbData.lower[i],
      ema12: ema12[i],
      ema26: ema26[i],
      sma50: sma50[i],
      rsi: rsiData[i],
      macd: macdData.macd[i],
      macdSignal: macdData.signal[i],
      macdHist: macdData.histogram[i],
    }));
  }, [candles, bbData, ema12, ema26, sma50, rsiData, macdData]);

  // Latest values
  const lastClose = closes[closes.length - 1] ?? 0;
  const firstClose = closes[0] ?? 0;
  const changePct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const lastRsi = rsiData[rsiData.length - 1];
  const lastMacd = macdData.macd[macdData.macd.length - 1];
  const lastMacdSignal = macdData.signal[macdData.signal.length - 1];
  const lastMacdHist = macdData.histogram[macdData.histogram.length - 1];
  const isBull = changePct >= 0;

  if (!token) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[65] bg-background"
          onClick={() => closeChart()}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="h-full flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-background/95 backdrop-blur-xl">
              <button onClick={() => closeChart()} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              <TokenIcon symbol={token.symbol} glyph={token.logoGlyph} color={token.logoColor} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base">{token.symbol}</span>
                  <Chip variant="outline">{token.chain}</Chip>
                  <Chip variant="outline">{fmtAge(token.ageHours)}</Chip>
                  {gmgnSource && (
                    <Chip variant={gmgnSource === "gmgn" ? "bull" : "outline"} className="text-[9px]">
                      {gmgnSource === "gmgn" ? "GMGN live" : "GMGN demo"}
                    </Chip>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">{token.name}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular">{fmtPrice(lastClose)}</div>
                <div className={cn("text-xs tabular flex items-center justify-end gap-0.5", isBull ? "text-bull" : "text-bear")}>
                  {isBull ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {fmtPct(changePct)}
                </div>
              </div>
            </div>

            {/* Chart area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {/* Indicator selector + range */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
                  {([
                    { k: "candles", label: "🕯️" },
                    { k: "line", label: "📈" },
                    { k: "bb", label: "📊" },
                    { k: "ema", label: "📉" },
                  ] as { k: Indicator; label: string }[]).map((s) => (
                    <button
                      key={s.k}
                      onClick={() => setIndicator(s.k)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                        indicator === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
                  {(["1H", "4H", "1D", "1W", "1M"] as Range[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={cn(
                        "px-2 py-1 text-[10px] font-semibold rounded",
                        range === r ? "bg-surface-3 text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={() => setShowRsi(!showRsi)}
                    className={cn("px-2 py-1 rounded text-[10px] font-semibold", showRsi ? "bg-bull/15 text-bull" : "bg-surface-2 text-muted-foreground")}
                  >
                    RSI
                  </button>
                  <button
                    onClick={() => setShowMacd(!showMacd)}
                    className={cn("px-2 py-1 rounded text-[10px] font-semibold", showMacd ? "bg-bull/15 text-bull" : "bg-surface-2 text-muted-foreground")}
                  >
                    MACD
                  </button>
                  <button
                    onClick={() => setShowVolume(!showVolume)}
                    className={cn("px-2 py-1 rounded text-[10px] font-semibold", showVolume ? "bg-bull/15 text-bull" : "bg-surface-2 text-muted-foreground")}
                  >
                    VOL
                  </button>
                  <button
                    onClick={() => setShowTvl(!showTvl)}
                    className={cn("px-2 py-1 rounded text-[10px] font-semibold", showTvl ? "bg-gold/15 text-gold" : "bg-surface-2 text-muted-foreground")}
                    title="Overlay pool liquidity (TVL) — divergence from price signals liquidity pull"
                  >
                    TVL
                  </button>
                </div>
              </div>

              {/* TVL overlay badge */}
              {showTvl && token?.mint && (
                <TvlOverlay mint={token.mint} />
              )}

              {/* Main chart */}
              <div className="rounded-xl border border-border p-2">
                {indicator === "candles" ? (
                  <LightweightChart candles={candles} height={256} showVolume={showVolume} />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {indicator === "line" ? (
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={isBull ? "var(--bull)" : "var(--bear)"} stopOpacity="0.3" />
                              <stop offset="100%" stopColor={isBull ? "var(--bull)" : "var(--bear)"} stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                          <XAxis dataKey="t" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric" })} />
                          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} domain={["dataMin", "dataMax"]} orientation="right" />
                          <Tooltip content={<PriceTooltip />} />
                          <Area type="monotone" dataKey="c" stroke={isBull ? "var(--bull)" : "var(--bear)"} strokeWidth={2} fill="url(#chart-area)" isAnimationActive={false} />
                        </AreaChart>
                      ) : indicator === "bb" ? (
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                          <XAxis dataKey="t" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric" })} />
                          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} domain={["dataMin", "dataMax"]} orientation="right" />
                          <Tooltip content={<PriceTooltip />} />
                          <Area type="monotone" dataKey="bbUpper" stroke="#64748B" strokeWidth={1} strokeDasharray="4 4" fill="transparent" isAnimationActive={false} />
                          <Area type="monotone" dataKey="bbLower" stroke="#64748B" strokeWidth={1} strokeDasharray="4 4" fill="transparent" isAnimationActive={false} />
                          <Area type="monotone" dataKey="c" stroke={isBull ? "var(--bull)" : "var(--bear)"} strokeWidth={2} fill="transparent" isAnimationActive={false} />
                          <Line type="monotone" dataKey="bbMiddle" stroke="#64748B" strokeWidth={1} dot={false} isAnimationActive={false} />
                        </ComposedChart>
                      ) : (
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                          <XAxis dataKey="t" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric" })} />
                          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} domain={["dataMin", "dataMax"]} orientation="right" />
                          <Tooltip content={<PriceTooltip />} />
                          <Area type="monotone" dataKey="c" stroke={isBull ? "var(--bull)" : "var(--bear)"} strokeWidth={2} fill="transparent" isAnimationActive={false} />
                        <Line type="monotone" dataKey="ema12" stroke="var(--bull)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="ema26" stroke="var(--bear)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="sma50" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
                )}
              </div>

              {/* Volume — hidden when using LightweightChart (it includes volume) */}
              {showVolume && indicator !== "candles" && (
                <div className="rounded-xl border border-border p-2">
                  <div className="text-[10px] text-muted-foreground mb-1">Volume</div>
                  <div className="h-16">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="t" hide />
                        <YAxis hide />
                        <Tooltip content={<VolumeTooltip />} />
                        <Bar dataKey="v" fill="var(--muted-foreground)" opacity={0.5} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* RSI */}
              {showRsi && (
                <div className="rounded-xl border border-border p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">RSI (14)</span>
                    {lastRsi !== null && lastRsi !== undefined && (
                      <span className={cn("text-[11px] font-semibold tabular", lastRsi > 70 ? "text-bear" : lastRsi < 30 ? "text-bull" : "text-foreground")}>
                        {lastRsi.toFixed(1)} {lastRsi > 70 ? "⚠️ Overbought" : lastRsi < 30 ? "💪 Oversold" : ""}
                      </span>
                    )}
                  </div>
                  <div className="h-16">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="t" hide />
                        <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<RsiTooltip />} />
                        <ReferenceLine y={70} stroke="var(--bear)" strokeDasharray="3 3" />
                        <ReferenceLine y={30} stroke="var(--bull)" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="rsi" stroke="#8B5CF6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* MACD */}
              {showMacd && (
                <div className="rounded-xl border border-border p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">MACD (12, 26, 9)</span>
                    {lastMacd !== null && lastMacd !== undefined && lastMacdSignal !== null && lastMacdSignal !== undefined && (
                      <span className={cn("text-[11px] font-semibold tabular", lastMacd > lastMacdSignal ? "text-bull" : "text-bear")}>
                        {lastMacd > lastMacdSignal ? "▲ Bullish" : "▼ Bearish"}
                      </span>
                    )}
                  </div>
                  <div className="h-16">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="t" hide />
                        <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<MacdTooltip />} />
                        <ReferenceLine y={0} stroke="var(--border)" />
                        <Bar dataKey="macdHist" fill="#64748B" opacity={0.5} isAnimationActive={false} />
                        <Line type="monotone" dataKey="macd" stroke="var(--bull)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="macdSignal" stroke="var(--bear)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Indicator summary */}
              <div className="grid grid-cols-3 gap-2">
                <IndicatorCard
                  label="RSI (14)"
                  value={lastRsi?.toFixed(1) ?? "—"}
                  signal={lastRsi !== null && lastRsi !== undefined ? (lastRsi > 70 ? "Sell" : lastRsi < 30 ? "Buy" : "Neutral") : "—"}
                  color={lastRsi !== null && lastRsi !== undefined ? (lastRsi > 70 ? "bear" : lastRsi < 30 ? "bull" : "default") : "default"}
                />
                <IndicatorCard
                  label="MACD"
                  value={lastMacd !== null && lastMacd !== undefined ? lastMacd.toFixed(4) : "—"}
                  signal={lastMacd !== null && lastMacdSignal !== null && lastMacd !== undefined && lastMacdSignal !== undefined ? (lastMacd > lastMacdSignal ? "Buy" : "Sell") : "—"}
                  color={lastMacd !== null && lastMacdSignal !== null && lastMacd !== undefined && lastMacdSignal !== undefined ? (lastMacd > lastMacdSignal ? "bull" : "bear") : "default"}
                />
                <IndicatorCard
                  label="EMA 12/26"
                  value={ema12[ema12.length - 1] !== null ? (ema12[ema12.length - 1] as number).toFixed(4) : "—"}
                  signal={
                    ema12[ema12.length - 1] !== null && ema26[ema26.length - 1] !== null
                      ? (ema12[ema12.length - 1] as number) > (ema26[ema26.length - 1] as number) ? "Buy" : "Sell"
                      : "—"
                  }
                  color={
                    ema12[ema12.length - 1] !== null && ema26[ema26.length - 1] !== null
                      ? (ema12[ema12.length - 1] as number) > (ema26[ema26.length - 1] as number) ? "bull" : "bear"
                      : "default"
                  }
                />
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => useMoby.getState().openTrade(token.id, "BUY")}
                  className="py-2 rounded-xl bg-bull text-background text-xs font-bold"
                >
                  Buy
                </button>
                <button
                  onClick={() => useMoby.getState().openAlertCreator(token.id)}
                  className="py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Bell className="h-3 w-3 inline mr-1" /> Alert
                </button>
                <button
                  onClick={() => useMoby.getState().openTrade(token.id, "SELL")}
                  className="py-2 rounded-xl bg-bear/15 text-bear border border-bear/30 text-xs font-bold"
                >
                  Sell
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CandleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const isBull = d.c >= d.o;
  return (
    <div className="bg-surface border border-border rounded-lg p-2 text-[11px]">
      <div className="text-muted-foreground">{new Date(d.t).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
        <span className="text-muted-foreground">O:</span><span className="tabular font-semibold">{fmtPrice(d.o)}</span>
        <span className="text-muted-foreground">H:</span><span className="tabular font-semibold text-bull">{fmtPrice(d.h)}</span>
        <span className="text-muted-foreground">L:</span><span className="tabular font-semibold text-bear">{fmtPrice(d.l)}</span>
        <span className="text-muted-foreground">C:</span><span className={cn("tabular font-semibold", isBull ? "text-bull" : "text-bear")}>{fmtPrice(d.c)}</span>
        <span className="text-muted-foreground">Vol:</span><span className="tabular font-semibold">{fmtUsd(d.v, { compact: true })}</span>
      </div>
    </div>
  );
}

function PriceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-2 text-[11px]">
      <div className="text-muted-foreground">{new Date(d.t).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
      <div className="font-semibold tabular mt-1">{fmtPrice(d.c)}</div>
    </div>
  );
}

function VolumeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-2 text-[11px]">
      <div className="font-semibold tabular">{fmtUsd(payload[0].value, { compact: true })}</div>
    </div>
  );
}

function RsiTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-2 text-[11px]">
      <div className="font-semibold tabular">{payload[0].value?.toFixed(1)}</div>
    </div>
  );
}

function MacdTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-2 text-[11px]">
      <div>MACD: <span className="font-semibold tabular">{d.macd?.toFixed(4)}</span></div>
      <div>Signal: <span className="font-semibold tabular">{d.macdSignal?.toFixed(4)}</span></div>
    </div>
  );
}

function IndicatorCard({ label, value, signal, color }: { label: string; value: string; signal: string; color: "bull" | "bear" | "default" }) {
  const colorCls = color === "bull" ? "text-bull" : color === "bear" ? "text-bear" : "text-foreground";
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
      <div className={cn("text-sm font-bold tabular", colorCls)}>{value}</div>
      <div className={cn("text-[10px] font-semibold", colorCls)}>{signal}</div>
    </div>
  );
}

// ===== TVL Overlay — shows pool liquidity alongside price =====
function TvlOverlay({ mint }: { mint: string }) {
  const { data, loading, source } = useGmgn<{ pairs: any[] }>(
    `/api/dexscreener/pairs?address=${mint}&chain=solana`,
    { refreshMs: 60_000 }
  );

  const pairs = data?.pairs || [];
  const totalLiquidity = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
  const totalVolume24h = pairs.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
  const topPair = pairs[0];

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-2.5 mb-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-semibold text-gold">📊 Pool Liquidity (TVL)</span>
        {source && (
          <Chip variant={source === "dexscreener" ? "bull" : "outline"} className="text-[9px]">
            {source === "dexscreener" ? "live" : "demo"}
          </Chip>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">loading…</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Total TVL</div>
          <div className="font-bold tabular text-gold">{fmtUsd(totalLiquidity, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">24h Volume</div>
          <div className="font-bold tabular">{fmtUsd(totalVolume24h, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Vol/TVL ratio</div>
          <div className={cn("font-bold tabular", totalVolume24h / Math.max(1, totalLiquidity) > 1 ? "text-bull" : "text-muted-foreground")}>
            {(totalVolume24h / Math.max(1, totalLiquidity)).toFixed(2)}x
          </div>
        </div>
      </div>
      {topPair && (
        <div className="text-[9px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border">
          Top pool: {topPair.dexId} · Liq {fmtUsd(topPair.liquidity?.usd ?? 0, { compact: true })} · Vol {fmtUsd(topPair.volume?.h24 ?? 0, { compact: true })}
        </div>
      )}
      <div className="text-[9px] text-muted-foreground mt-1">
        💡 High Vol/TVL ratio (&gt;1x) = high turnover = active trading. Low ratio with rising price = liquidity pull = potential dump.
      </div>
    </div>
  );
}
