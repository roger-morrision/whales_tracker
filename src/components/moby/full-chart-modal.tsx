"use client";

import { useState, useMemo } from "react";
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
import { TokenIcon, Chip, Sparkline } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Indicator = "candles" | "line" | "bb" | "ema";
type Range = "1H" | "4H" | "1D" | "1W" | "1M";

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

  // Generate candles
  const candles = useMemo(() => {
    if (!token) return [];
    const counts: Record<Range, number> = { "1H": 24, "4H": 48, "1D": 96, "1W": 168, "1M": 240 };
    return genCandles(`chart-${token.id}-${range}`, token.price, counts[range]);
  }, [token, range]);

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
                </div>
              </div>

              {/* Main chart */}
              <div className="rounded-xl border border-border p-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    {indicator === "candles" ? (
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                        <XAxis dataKey="t" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric" })} />
                        <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} domain={["dataMin", "dataMax"]} orientation="right" />
                        <Tooltip content={<CandleTooltip />} />
                        {/* High-Low bars */}
                        <Bar dataKey="h" fill="transparent" />
                        {/* Candle bodies using open-close as bars */}
                        <Bar dataKey={(d) => d.c >= d.o ? d.c - d.o : 0} fill="var(--bull)" radius={[1, 1, 0, 0]} />
                        <Bar dataKey={(d) => d.c < d.o ? d.o - d.c : 0} fill="var(--bear)" radius={[1, 1, 0, 0]} />
                        {indicator === "ema" && (
                          <>
                            <Line type="monotone" dataKey="ema12" stroke="var(--bull)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="ema26" stroke="var(--bear)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                          </>
                        )}
                      </ComposedChart>
                    ) : indicator === "line" ? (
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
              </div>

              {/* Volume */}
              {showVolume && (
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
