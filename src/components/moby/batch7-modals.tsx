"use client";

import { useState, useMemo } from "react";
import { X, ShieldCheck, ShieldAlert, ShieldX, TrendingUp, TrendingDown, Activity, Bot, BookOpen, Heart, AlertTriangle, Zap, DollarSign } from "lucide-react";
import {
  getSecurityAudit,
  TOKENIZED_STOCKS,
  getWalletPnl,
  SNIPE_RULES,
  getPricePrediction,
  getLiquidityDepth,
  JOURNAL_ENTRIES,
  getDefiHealth,
  getHarvestOpportunities,
  TOKENS_BY_ID,
  fmtUsd,
  fmtPrice,
  fmtPct,
  fmtNum,
  fmtAge,
  type SnipeRule,
} from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip, Sparkline, SectionHeader } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const RISK_COLORS = {
  low: { text: "text-bull", bg: "bg-bull/10", label: "Low Risk" },
  medium: { text: "text-gold", bg: "bg-gold/10", label: "Medium Risk" },
  high: { text: "text-bear", bg: "bg-bear/10", label: "High Risk" },
  extreme: { text: "text-bear", bg: "bg-bear/20", label: "Extreme Risk" },
};

// ========== TOKEN SECURITY AUDIT ==========
export function SecurityAuditModal() {
  const open = useMoby((s) => s.securityAuditOpen);
  const setOpen = useMoby((s) => s.setSecurityAuditOpen);
  const tokenId = useMoby((s) => s.securityAuditTokenId);
  const audit = useMemo(() => (tokenId ? getSecurityAudit(tokenId) : null), [tokenId]);
  const token = tokenId ? TOKENS_BY_ID[tokenId] : null;
  if (!audit || !token) return null;
  const risk = RISK_COLORS[audit.riskLevel];

  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="Security audit" icon={<ShieldCheck className="h-4 w-4 text-bull" />}>
          {/* Overall score */}
          <div className={cn("rounded-2xl p-4 border", risk.bg, audit.riskLevel === "extreme" ? "border-bear/40" : audit.riskLevel === "high" ? "border-bear/30" : audit.riskLevel === "medium" ? "border-gold/30" : "border-bull/30")}>
            <div className="flex items-center gap-3">
              <TokenIcon symbol={token.symbol} glyph={token.logoGlyph} color={token.logoColor} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base">{token.symbol}</span>
                  <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", risk.bg, risk.text)}>{risk.label}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{token.name}</div>
              </div>
              <div className="text-right">
                <div className={cn("text-3xl font-bold tabular", risk.text)}>{audit.overallScore}</div>
                <div className="text-[10px] text-muted-foreground">/ 100</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-surface-3 overflow-hidden mt-2">
              <div className={cn("h-full rounded-full", audit.overallScore > 70 ? "bg-bull" : audit.overallScore > 50 ? "bg-gold" : "bg-bear")} style={{ width: `${audit.overallScore}%` }} />
            </div>
          </div>

          {/* Warnings */}
          {audit.warnings.length > 0 && (
            <div className="rounded-xl border border-bear/30 bg-bear/5 p-3 space-y-1">
              <div className="text-xs font-semibold text-bear flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Warnings</div>
              {audit.warnings.map((w, i) => <div key={i} className="text-[11px] text-bear">• {w}</div>)}
            </div>
          )}

          {/* Checks list */}
          <div>
            <SectionHeader title="Security checks" emoji="🔍" />
            <div className="space-y-1.5">
              {audit.checks.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border">
                  <div className={cn("h-5 w-5 rounded grid place-items-center shrink-0 mt-0.5",
                    c.status === "pass" ? "bg-bull/15 text-bull" : c.status === "warning" ? "bg-gold/15 text-gold" : "bg-bear/15 text-bear"
                  )}>
                    {c.status === "pass" ? <ShieldCheck className="h-3 w-3" /> : c.status === "warning" ? <ShieldAlert className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax scan */}
          <div className="rounded-xl border border-border p-3">
            <div className="text-xs font-semibold mb-2">Tax scan</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-[9px] text-muted-foreground">Buy tax</div><div className="text-sm font-bold tabular text-bull">{audit.taxScan.buyTax}%</div></div>
              <div><div className="text-[9px] text-muted-foreground">Sell tax</div><div className="text-sm font-bold tabular text-bull">{audit.taxScan.sellTax}%</div></div>
              <div><div className="text-[9px] text-muted-foreground">Transfer</div><div className="text-sm font-bold tabular text-bull">{audit.taxScan.transferTax}%</div></div>
            </div>
          </div>

          {/* Honeypot check */}
          <div className="rounded-xl border border-bull/30 bg-bull/5 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-bull" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-bull">Honeypot check passed</div>
                <div className="text-[10px] text-muted-foreground">Buy and sell simulation successful — token is freely tradable</div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ========== TOKENIZED STOCKS ==========
export function TokenizedStocksModal() {
  const open = useMoby((s) => s.stocksOpen);
  const setOpen = useMoby((s) => s.setStocksOpen);
  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="Tokenized stocks" icon={<span className="text-base">📈</span>}>
          <div className="text-[11px] text-muted-foreground mb-3">Trade fractional shares of pre-IPO and public companies, 24/7 on-chain.</div>
          <div className="space-y-2">
            {TOKENIZED_STOCKS.map((s) => {
              const isBull = s.change24h >= 0;
              return (
                <div key={s.id} className="rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white text-xs", s.color)}>{s.glyph}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{s.ticker}</span>
                        {s.isPreIPO && <Chip variant="gold">Pre-IPO</Chip>}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{s.name}</div>
                    </div>
                    <Sparkline data={s.sparkline} width={50} height={20} bullish={isBull} />
                    <div className="text-right">
                      <div className="text-sm font-bold tabular">{s.price >= 1000 ? `$${(s.price / 1000).toFixed(1)}K` : `$${s.price.toFixed(2)}`}</div>
                      <div className={cn("text-[11px] tabular", isBull ? "text-bull" : "text-bear")}>{isBull ? "+" : ""}{s.change24h.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                    <div><span className="text-muted-foreground">Mcap: </span><span className="font-semibold tabular">{fmtUsd(s.marketCap, { compact: true })}</span></div>
                    <div><span className="text-muted-foreground">Vol: </span><span className="font-semibold tabular">{fmtUsd(s.volume24h, { compact: true })}</span></div>
                    <div><span className="text-muted-foreground">Shares: </span><span className="font-semibold tabular">{s.shares}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button className="py-1.5 rounded-lg bg-bear/15 text-bear border border-bear/30 text-xs font-bold">Sell</button>
                    <button className="py-1.5 rounded-lg bg-bull text-background text-xs font-bold">Buy</button>
                  </div>
                </div>
              );
            })}
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ========== WALLET PNL TRACKER ==========
export function WalletPnlModal() {
  const open = useMoby((s) => s.walletPnlOpen);
  const setOpen = useMoby((s) => s.setWalletPnlOpen);
  const address = useMoby((s) => s.walletPnlAddress);
  const setAddress = useMoby((s) => s.setWalletPnlAddress);
  const [inputAddr, setInputAddr] = useState(address);
  const pnl = useMemo(() => getWalletPnl(address), [address]);

  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="Wallet PnL tracker" icon={<Activity className="h-4 w-4 text-bull" />}>
          {/* Address input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={inputAddr}
              onChange={(e) => setInputAddr(e.target.value)}
              placeholder="Enter wallet address (0x...)"
              className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-bull/40"
            />
            <button onClick={() => setAddress(inputAddr || "0x7a3f...b9c2")} className="px-3 py-2 rounded-lg bg-bull text-background text-xs font-bold">Track</button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{fmtUsd(pnl.totalInvested, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Invested</div></div>
            <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center"><div className={cn("text-lg font-bold tabular", pnl.totalPnl >= 0 ? "text-bull" : "text-bear")}>{pnl.totalPnl >= 0 ? "+" : ""}{fmtUsd(pnl.totalPnl, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Total PnL</div></div>
            <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{pnl.winRate}%</div><div className="text-[10px] text-muted-foreground">Win rate</div></div>
          </div>

          {/* Positions */}
          <div>
            <SectionHeader title="Positions" emoji="📊" />
            <div className="space-y-1.5">
              {pnl.positions.map((p) => (
                <div key={p.tokenSymbol} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">${p.tokenSymbol}</span>
                    <span className="text-[10px] text-muted-foreground">{p.firstBuyDays}d held</span>
                    <span className={cn("ml-auto text-sm font-bold tabular", p.totalPnl >= 0 ? "text-bull" : "text-bear")}>
                      {p.totalPnl >= 0 ? "+" : ""}{fmtUsd(p.totalPnl)} ({fmtPct(p.pnlPct)})
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    <div><span className="text-muted-foreground">Bought: </span><span className="font-semibold tabular">{fmtUsd(p.boughtUsd, { compact: true })}</span></div>
                    <div><span className="text-muted-foreground">Current: </span><span className="font-semibold tabular">{fmtUsd(p.currentUsd, { compact: true })}</span></div>
                    <div><span className="text-muted-foreground">Realized: </span><span className={cn("font-semibold tabular", p.realizedPnl >= 0 ? "text-bull" : "text-bear")}>{p.realizedPnl >= 0 ? "+" : ""}{fmtUsd(p.realizedPnl)}</span></div>
                    <div><span className="text-muted-foreground">Unrealized: </span><span className={cn("font-semibold tabular", p.unrealizedPnl >= 0 ? "text-bull" : "text-bear")}>{p.unrealizedPnl >= 0 ? "+" : ""}{fmtUsd(p.unrealizedPnl)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ========== SNIPE BOT ==========
export function SnipeBotModal() {
  const open = useMoby((s) => s.snipeBotOpen);
  const setOpen = useMoby((s) => s.setSnipeBotOpen);
  const pushToast = useMoby((s) => s.pushToast);
  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="Snipe bot" icon={<Bot className="h-4 w-4 text-bull" />}>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{SNIPE_RULES.reduce((s, r) => s + r.stats.triggered, 0)}</div><div className="text-[10px] text-muted-foreground">Triggered</div></div>
            <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{SNIPE_RULES.reduce((s, r) => s + r.stats.filled, 0)}</div><div className="text-[10px] text-muted-foreground">Filled</div></div>
            <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center"><div className="text-lg font-bold tabular text-bull">{fmtUsd(SNIPE_RULES.reduce((s, r) => s + r.stats.pnl, 0), { compact: true })}</div><div className="text-[10px] text-muted-foreground">Total PnL</div></div>
          </div>
          {SNIPE_RULES.map((r) => <SnipeRuleCard key={r.id} rule={r} onTrigger={() => pushToast({ title: "🎯 Snipe rule triggered!", description: `${r.name} matched a new token`, type: "alert" })} />)}
          <button className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1.5">+ Create snipe rule</button>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

function SnipeRuleCard({ rule, onTrigger }: { rule: SnipeRule; onTrigger: () => void }) {
  return (
    <div className={cn("rounded-xl border p-3 mb-2", rule.enabled ? "border-bull/30 bg-bull/5" : "border-border")}>
      <div className="flex items-center gap-2 mb-2">
        <Bot className={cn("h-4 w-4", rule.enabled ? "text-bull" : "text-muted-foreground")} />
        <span className="font-semibold text-sm flex-1">{rule.name}</span>
        {rule.enabled ? <Chip variant="bull">LIVE</Chip> : <Chip variant="default">PAUSED</Chip>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
        <div><span className="text-muted-foreground">Min liq: </span><span className="font-semibold tabular">{fmtUsd(rule.conditions.minLiquidity, { compact: true })}</span></div>
        <div><span className="text-muted-foreground">Max mcap: </span><span className="font-semibold tabular">{fmtUsd(rule.conditions.maxMarketCap, { compact: true })}</span></div>
        <div><span className="text-muted-foreground">Smart wallets: </span><span className="font-semibold tabular">≥{rule.conditions.minSmartMoneyEntries}</span></div>
        <div><span className="text-muted-foreground">Max age: </span><span className="font-semibold tabular">{rule.conditions.maxAgeMinutes}m</span></div>
        <div><span className="text-muted-foreground">Buy: </span><span className="font-semibold tabular">{fmtUsd(rule.actions.buyAmountUsd)}</span></div>
        <div><span className="text-muted-foreground">SL/TP: </span><span className="font-semibold tabular">-{rule.actions.autoSellAtLoss}%/+{rule.actions.autoSellAtProfit}%</span></div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
        <span>Stats: {rule.stats.triggered} triggered · {rule.stats.filled} filled · {rule.stats.winRate}% WR · PnL {fmtUsd(rule.stats.pnl, { compact: true })}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button onClick={onTrigger} className="py-1.5 rounded-md border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground">Test trigger</button>
        <button className="py-1.5 rounded-md border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>
        <button className={cn("py-1.5 rounded-md text-[11px] font-bold", rule.enabled ? "bg-bear/15 text-bear border border-bear/30" : "bg-bull text-background")}>{rule.enabled ? "Pause" : "Start"}</button>
      </div>
    </div>
  );
}

// ========== PRICE PREDICTION ==========
export function PricePredictionModal() {
  const open = useMoby((s) => s.predictionOpen);
  const setOpen = useMoby((s) => s.setPredictionOpen);
  const tokenId = useMoby((s) => s.predictionTokenId);
  const pred = useMemo(() => (tokenId ? getPricePrediction(tokenId) : null), [tokenId]);
  const token = tokenId ? TOKENS_BY_ID[tokenId] : null;
  if (!pred || !token) return null;

  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="AI price prediction" icon={<Zap className="h-4 w-4 text-bull" />}>
          {/* Token header */}
          <div className="flex items-center gap-2.5 mb-3">
            <TokenIcon symbol={token.symbol} glyph={token.logoGlyph} color={token.logoColor} size="md" />
            <div className="flex-1"><div className="font-bold text-sm">{token.symbol}</div><div className="text-[11px] text-muted-foreground">{fmtPrice(pred.currentPrice)} now</div></div>
            <Chip variant={pred.signals.overall === "bullish" ? "bull" : pred.signals.overall === "bearish" ? "bear" : "default"}>{pred.signals.overall}</Chip>
          </div>

          {/* Predictions */}
          <div className="space-y-2 mb-3">
            {pred.predictions.map((p) => (
              <div key={p.timeframe} className="rounded-xl border border-border p-3 flex items-center gap-3">
                <div className="w-12 text-center"><div className="text-[10px] text-muted-foreground uppercase">{p.timeframe}</div></div>
                <div className="flex-1">
                  <div className="text-sm font-bold tabular">{fmtPrice(p.predictedPrice)}</div>
                  <div className={cn("text-[11px] tabular font-semibold", p.direction === "up" ? "text-bull" : "text-bear")}>{p.changePct >= 0 ? "+" : ""}{p.changePct.toFixed(1)}%</div>
                </div>
                <div className="text-right"><div className="text-[10px] text-muted-foreground">Confidence</div><div className={cn("text-sm font-bold tabular", p.confidence > 65 ? "text-bull" : p.confidence > 50 ? "text-gold" : "text-bear")}>{p.confidence}%</div></div>
              </div>
            ))}
          </div>

          {/* Signal breakdown */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Technical", value: pred.signals.technical },
              { label: "Smart money", value: pred.signals.smartMoney },
              { label: "Social", value: pred.signals.social },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border p-2.5 text-center">
                <div className="text-[9px] text-muted-foreground uppercase">{s.label}</div>
                <div className={cn("text-xs font-bold", s.value === "bullish" ? "text-bull" : s.value === "bearish" ? "text-bear" : "text-muted-foreground")}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* AI summary */}
          <div className="rounded-xl p-3 bg-gradient-to-br from-[#14F195]/12 to-transparent border border-bull/20">
            <div className="flex items-center gap-1.5 mb-1"><Zap className="h-3.5 w-3.5 text-bull" /><span className="text-xs font-semibold">Moby AI analysis</span></div>
            <p className="text-[12px] text-foreground/90 leading-relaxed">{pred.aiSummary}</p>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ========== LIQUIDITY DEPTH ==========
export function LiquidityDepthModal() {
  const open = useMoby((s) => s.liquidityDepthOpen);
  const setOpen = useMoby((s) => s.setLiquidityDepthOpen);
  const tokenId = useMoby((s) => s.liquidityDepthTokenId);
  const token = tokenId ? TOKENS_BY_ID[tokenId] : null;
  const depth = useMemo(() => (tokenId ? getLiquidityDepth(tokenId) : null), [tokenId]);
  if (!depth || !token) return null;
  const maxTotal = Math.max(...depth.bids.map((b) => b.total), ...depth.asks.map((a) => a.total));

  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="Liquidity depth" icon={<Activity className="h-4 w-4 text-bull" />}>
          <div className="flex items-center gap-2 mb-3">
            <TokenIcon symbol={token.symbol} glyph={token.logoGlyph} color={token.logoColor} size="sm" />
            <span className="font-semibold text-sm">{token.symbol}</span>
            <span className="text-[11px] text-muted-foreground tabular">{fmtPrice(token.price)}</span>
            <span className="text-[11px] text-muted-foreground ml-auto">{fmtUsd(token.liquidity, { compact: true })} liq</span>
          </div>

          {/* Depth visualization */}
          <div className="rounded-xl border border-border p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Order book depth</div>
            <div className="space-y-px">
              {/* Asks (sells) - top */}
              {depth.asks.slice(0, 10).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] relative">
                  <div className="absolute right-0 h-full bg-bear/10 rounded" style={{ width: `${(a.total / maxTotal) * 100}%` }} />
                  <span className="font-mono text-bear tabular relative z-10 w-20">{fmtPrice(a.price)}</span>
                  <span className="text-muted-foreground tabular relative z-10 flex-1">{fmtNum(a.amount)}</span>
                  <span className="text-muted-foreground tabular relative z-10 w-20 text-right">{fmtUsd(a.total * token.price, { compact: true })}</span>
                </div>
              ))}
              {/* Spread */}
              <div className="flex items-center justify-center py-1 text-[10px] text-muted-foreground border-y border-border">
                <span>Spread: {fmtPrice(depth.asks[0].price - depth.bids[depth.bids.length - 1].price)} ({(((depth.asks[0].price - depth.bids[depth.bids.length - 1].price) / token.price) * 100).toFixed(2)}%)</span>
              </div>
              {/* Bids (buys) - bottom */}
              {depth.bids.slice(-10).reverse().map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] relative">
                  <div className="absolute right-0 h-full bg-bull/10 rounded" style={{ width: `${(b.total / maxTotal) * 100}%` }} />
                  <span className="font-mono text-bull tabular relative z-10 w-20">{fmtPrice(b.price)}</span>
                  <span className="text-muted-foreground tabular relative z-10 flex-1">{fmtNum(b.amount)}</span>
                  <span className="text-muted-foreground tabular relative z-10 w-20 text-right">{fmtUsd(b.total * token.price, { compact: true })}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl border border-bull/30 bg-bull/5 p-3 text-center"><div className="text-lg font-bold tabular text-bull">{fmtUsd(depth.bids.reduce((s, b) => s + b.amount * token.price, 0), { compact: true })}</div><div className="text-[10px] text-muted-foreground">Bid liquidity</div></div>
            <div className="rounded-xl border border-bear/30 bg-bear/5 p-3 text-center"><div className="text-lg font-bold tabular text-bear">{fmtUsd(depth.asks.reduce((s, a) => s + a.amount * token.price, 0), { compact: true })}</div><div className="text-[10px] text-muted-foreground">Ask liquidity</div></div>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ========== TRADING JOURNAL ==========
export function TradingJournalModal() {
  const open = useMoby((s) => s.journalOpen);
  const setOpen = useMoby((s) => s.setJournalOpen);
  const totalPnl = JOURNAL_ENTRIES.filter((e) => e.pnl !== 0).reduce((s, e) => s + e.pnl, 0);
  const wins = JOURNAL_ENTRIES.filter((e) => e.pnl > 0).length;
  const losses = JOURNAL_ENTRIES.filter((e) => e.pnl < 0).length;

  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="Trading journal" icon={<BookOpen className="h-4 w-4 text-bull" />}>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{JOURNAL_ENTRIES.length}</div><div className="text-[10px] text-muted-foreground">Entries</div></div>
            <div className="rounded-xl border border-bull/30 bg-bull/5 p-2.5 text-center"><div className={cn("text-lg font-bold tabular", totalPnl >= 0 ? "text-bull" : "text-bear")}>{totalPnl >= 0 ? "+" : ""}{fmtUsd(totalPnl, { compact: true })}</div><div className="text-[10px] text-muted-foreground">Realized PnL</div></div>
            <div className="rounded-xl border border-border p-2.5 text-center"><div className="text-lg font-bold tabular">{wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0}%</div><div className="text-[10px] text-muted-foreground">Win rate</div></div>
          </div>
          <div className="space-y-2">
            {JOURNAL_ENTRIES.map((e) => (
              <div key={e.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Chip variant={e.side === "BUY" ? "bull" : "bear"}>{e.side}</Chip>
                  <span className="font-semibold text-sm">${e.tokenSymbol}</span>
                  <span className="text-[10px] text-muted-foreground">{e.date}</span>
                  {e.pnl !== 0 && <span className={cn("ml-auto text-sm font-bold tabular", e.pnl >= 0 ? "text-bull" : "text-bear")}>{e.pnl >= 0 ? "+" : ""}{fmtUsd(e.pnl)} ({fmtPct(e.pnlPct)})</span>}
                </div>
                <p className="text-[11px] text-muted-foreground mb-1">{e.note}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {e.tags.map((t) => <span key={t} className="text-[9px] font-semibold text-muted-foreground bg-surface-3 px-1.5 py-0.5 rounded">#{t}</span>)}
                  <span className="text-[9px] text-muted-foreground ml-auto">{e.mood} · {"⭐".repeat(e.rating)}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1.5 mt-2">+ New journal entry</button>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ========== DEFI HEALTH MONITOR ==========
export function DefiHealthModal() {
  const open = useMoby((s) => s.defiHealthOpen);
  const setOpen = useMoby((s) => s.setDefiHealthOpen);
  const health = useMemo(() => getDefiHealth(), []);
  const riskColor = health.riskLevel === "safe" ? "text-bull" : health.riskLevel === "moderate" ? "text-gold" : "text-bear";

  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="DeFi health monitor" icon={<Heart className="h-4 w-4 text-bull" />}>
          <div className={cn("rounded-2xl p-4 border mb-3", health.riskLevel === "safe" ? "bg-bull/5 border-bull/30" : health.riskLevel === "moderate" ? "bg-gold/5 border-gold/30" : "bg-bear/5 border-bear/30")}>
            <div className="flex items-center justify-between mb-2">
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Health factor</div><div className={cn("text-3xl font-bold tabular", riskColor)}>{health.healthFactor.toFixed(2)}</div></div>
              <div className="text-right"><div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Risk level</div><div className={cn("text-lg font-bold capitalize", riskColor)}>{health.riskLevel}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-muted-foreground">Total collateral: </span><span className="font-semibold tabular">{fmtUsd(health.totalCollateral, { compact: true })}</span></div>
              <div><span className="text-muted-foreground">Total debt: </span><span className="font-semibold tabular">{fmtUsd(health.totalDebt, { compact: true })}</span></div>
            </div>
          </div>

          {health.recommendations.length > 0 && (
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 mb-3">
              <div className="text-xs font-semibold text-gold mb-1">⚠️ Recommendations</div>
              {health.recommendations.map((r, i) => <div key={i} className="text-[11px] text-muted-foreground">• {r}</div>)}
            </div>
          )}

          <div className="space-y-2">
            {health.positions.map((p, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{p.protocol}</span>
                  <Chip variant="outline">{p.type}</Chip>
                  <Chip variant="outline">{p.asset}</Chip>
                  <span className={cn("ml-auto text-sm font-bold tabular", p.healthFactor > 2 ? "text-bull" : p.healthFactor > 1.5 ? "text-gold" : "text-bear")}>HF {p.healthFactor.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div><span className="text-muted-foreground">Collateral: </span><span className="font-semibold tabular">{fmtUsd(p.collateral, { compact: true })}</span></div>
                  <div><span className="text-muted-foreground">Debt: </span><span className="font-semibold tabular">{fmtUsd(p.debt, { compact: true })}</span></div>
                  <div><span className="text-muted-foreground">Liq. distance: </span><span className={cn("font-semibold tabular", p.distancePct < 20 ? "text-bear" : "text-bull")}>{p.distancePct.toFixed(1)}%</span></div>
                </div>
                <div className="mt-2"><div className="h-1.5 rounded-full bg-surface-3 overflow-hidden"><div className={cn("h-full rounded-full", p.distancePct < 20 ? "bg-bear" : p.distancePct < 40 ? "bg-gold" : "bg-bull")} style={{ width: `${Math.min(100, p.distancePct * 2)}%` }} /></div></div>
              </div>
            ))}
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ========== TAX LOSS HARVESTING ==========
export function HarvestModal() {
  const open = useMoby((s) => s.harvestOpen);
  const setOpen = useMoby((s) => s.setHarvestOpen);
  const opps = useMemo(() => getHarvestOpportunities(), []);
  const totalSavings = opps.reduce((s, o) => s + o.potentialTaxSavings, 0);
  const totalLoss = opps.reduce((s, o) => s + Math.abs(o.unrealizedLoss), 0);

  return (
    <AnimatePresence>
      {open && (
        <ModalShell open={open} onClose={() => setOpen(false)} title="Tax loss harvesting" icon={<DollarSign className="h-4 w-4 text-bull" />}>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-bull/10 to-transparent border border-bull/20 mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Potential tax savings</div>
            <div className="text-3xl font-bold tabular text-bull">{fmtUsd(totalSavings)}</div>
            <div className="text-[11px] text-muted-foreground">From {fmtUsd(totalLoss)} in unrealized losses</div>
          </div>
          <div className="space-y-2">
            {opps.map((o) => (
              <div key={o.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">${o.tokenSymbol}</span>
                  <Chip variant="bear">{fmtUsd(o.unrealizedLoss)} loss</Chip>
                  <Chip variant="outline">{o.holdingPeriodDays}d held</Chip>
                  <span className="ml-auto text-sm font-bold tabular text-bull">Save {fmtUsd(o.potentialTaxSavings)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{o.recommendation}</p>
                <button className="w-full py-1.5 rounded-lg bg-bull/15 text-bull border border-bull/30 text-xs font-bold">Harvest {o.tokenSymbol} loss</button>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border p-3 mt-3 bg-surface-2/50">
            <div className="text-[10px] text-muted-foreground">⚠️ Wash sale rule: Wait 30 days before rebuying the same token to preserve the tax loss. Consider swapping to a similar token to maintain market exposure.</div>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ========== MODAL SHELL (shared) ==========
function ModalShell({ open, onClose, title, icon, children }: { open: boolean; onClose: () => void; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <motion.div initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }} transition={{ type: "spring", damping: 30, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          {icon}
          <h2 className="font-semibold text-sm flex-1">{title}</h2>
          <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}
