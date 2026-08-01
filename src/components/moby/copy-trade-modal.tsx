"use client";

import { useState } from "react";
import {
  X,
  Copy,
  Trash2,
  Power,
  PowerOff,
  Shield,
  TrendingUp,
  AlertTriangle,
  Settings2,
  Plus,
} from "lucide-react";
import { TRADERS, fmtUsd, fmtNum } from "@/lib/moby-data";
import { useMoby, type CopyTradeConfig } from "@/lib/moby-store";
import { WalletLink } from "./wallet-link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function CopyTradeModal() {
  const open = useMoby((s) => s.copyTradeOpen);
  const setOpen = useMoby((s) => s.setCopyTradeOpen);
  const copyTrades = useMoby((s) => s.copyTrades);
  const removeCopyTrade = useMoby((s) => s.removeCopyTrade);
  const toggleCopyTrade = useMoby((s) => s.toggleCopyTrade);
  const [showForm, setShowForm] = useState(false);

  const totalAllocated = copyTrades.reduce((s, c) => s + c.totalAllocatedUsd, 0);
  const totalCopied = copyTrades.reduce((s, c) => s + c.totalCopiedUsd, 0);
  const activeCount = copyTrades.filter((c) => c.enabled).length;

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
              <Copy className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Copy trading</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border p-2.5 text-center">
                  <div className="text-lg font-bold tabular text-bull">{activeCount}</div>
                  <div className="text-[10px] text-muted-foreground">Active</div>
                </div>
                <div className="rounded-xl border border-border p-2.5 text-center">
                  <div className="text-lg font-bold tabular">{fmtUsd(totalAllocated, { compact: true })}</div>
                  <div className="text-[10px] text-muted-foreground">Allocated</div>
                </div>
                <div className="rounded-xl border border-border p-2.5 text-center">
                  <div className="text-lg font-bold tabular text-bull">{fmtUsd(totalCopied, { compact: true })}</div>
                  <div className="text-[10px] text-muted-foreground">Copied</div>
                </div>
              </div>

              {/* Existing copy trades */}
              {copyTrades.length > 0 && (
                <div className="space-y-2">
                  {copyTrades.map((c) => (
                    <CopyTradeCard
                      key={c.id}
                      config={c}
                      onToggle={() => toggleCopyTrade(c.id)}
                      onRemove={() => removeCopyTrade(c.id)}
                    />
                  ))}
                </div>
              )}

              {/* New copy trade form */}
              {showForm ? (
                <CopyTradeForm onClose={() => setShowForm(false)} />
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Copy a new trader
                </button>
              )}

              {/* Risk disclaimer */}
              <div className="rounded-lg p-2.5 bg-gold/5 border border-gold/20 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                <div className="text-[10px] text-muted-foreground">
                  Copy trading involves significant risk. Past performance is not indicative of future results.
                  Never allocate more than you can afford to lose.
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CopyTradeCard({
  config,
  onToggle,
  onRemove,
}: {
  config: CopyTradeConfig;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const utilization = (config.totalCopiedUsd / config.totalAllocatedUsd) * 100;
  return (
    <div className={cn("rounded-xl border p-3", config.enabled ? "border-bull/30 bg-bull/5" : "border-border bg-surface-2")}>
      <div className="flex items-center gap-2.5">
        <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br grid place-items-center font-bold text-white shrink-0", config.traderColor)}>
          {config.traderGlyph}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <WalletLink
              label={config.traderHandle}
              address={`0x${config.traderId}`}
              className="text-sm font-semibold"
            />
            {config.enabled ? (
              <span className="text-[9px] font-bold text-bull bg-bull/15 px-1.5 py-0.5 rounded">LIVE</span>
            ) : (
              <span className="text-[9px] font-bold text-muted-foreground bg-surface-3 px-1.5 py-0.5 rounded">PAUSED</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {config.tradesCopied} trades copied · {fmtUsd(config.totalCopiedUsd, { compact: true })} deployed
          </div>
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "h-8 w-8 grid place-items-center rounded-lg transition-colors",
            config.enabled ? "text-bull hover:bg-bull/10" : "text-muted-foreground hover:bg-surface-3"
          )}
          aria-label={config.enabled ? "Pause" : "Resume"}
        >
          {config.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
        </button>
        <button
          onClick={onRemove}
          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-bear hover:bg-surface-3"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2.5 text-[11px]">
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Max/trade</div>
          <div className="font-semibold tabular">{fmtUsd(config.maxPerTradeUsd, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Daily limit</div>
          <div className="font-semibold tabular">{fmtUsd(config.dailyLimitUsd, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Slippage</div>
          <div className="font-semibold tabular">{config.slippage}%</div>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">Utilization</span>
          <span className="font-semibold tabular">{utilization.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full bg-bull rounded-full" style={{ width: `${utilization}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {config.onlyBuy && (
          <span className="text-[9px] font-semibold text-bull bg-bull/10 px-1.5 py-0.5 rounded">BUY ONLY</span>
        )}
        <span className="text-[9px] font-semibold text-muted-foreground bg-surface-3 px-1.5 py-0.5 rounded">
          MIN SCORE {config.minTraderScore}
        </span>
      </div>
    </div>
  );
}

function CopyTradeForm({ onClose }: { onClose: () => void }) {
  const addCopyTrade = useMoby((s) => s.addCopyTrade);
  const [traderId, setTraderId] = useState(TRADERS[0].id);
  const [maxPerTrade, setMaxPerTrade] = useState(500);
  const [dailyLimit, setDailyLimit] = useState(2000);
  const [totalAllocated, setTotalAllocated] = useState(5000);
  const [slippage, setSlippage] = useState(1.5);
  const [onlyBuy, setOnlyBuy] = useState(false);
  const [minScore, setMinScore] = useState(85);

  const trader = TRADERS.find((t) => t.id === traderId)!;

  const handleCreate = () => {
    addCopyTrade({
      traderId: trader.id,
      traderHandle: trader.handle,
      traderGlyph: trader.avatarGlyph,
      traderColor: trader.avatarColor,
      enabled: true,
      maxPerTradeUsd: maxPerTrade,
      dailyLimitUsd: dailyLimit,
      totalAllocatedUsd: totalAllocated,
      totalCopiedUsd: 0,
      tradesCopied: 0,
      slippage,
      onlyBuy,
      minTraderScore: minScore,
    });
    onClose();
  };

  return (
    <div className="rounded-xl border border-bull/30 bg-bull/5 p-3 space-y-3">
      <div className="text-xs font-semibold flex items-center gap-1">
        <Settings2 className="h-3.5 w-3.5 text-bull" /> New copy trade
      </div>

      {/* Trader picker */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Trader to copy</div>
        <div className="max-h-32 overflow-y-auto scrollbar-thin space-y-1">
          {TRADERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTraderId(t.id)}
              className={cn(
                "w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-colors",
                traderId === t.id ? "border-bull/30 bg-bull/10" : "border-border hover:bg-surface-2"
              )}
            >
              <div className={cn("h-7 w-7 rounded-full bg-gradient-to-br grid place-items-center text-xs font-bold text-white", t.avatarColor)}>
                {t.avatarGlyph}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">@{t.handle}</div>
                <div className="text-[10px] text-muted-foreground">Score {t.smartScore} · WR {t.winRate}%</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <RangeField label="Max per trade" value={maxPerTrade} min={50} max={10000} step={50} format={(v) => fmtUsd(v, { compact: true })} onChange={setMaxPerTrade} />
      <RangeField label="Daily limit" value={dailyLimit} min={100} max={50000} step={100} format={(v) => fmtUsd(v, { compact: true })} onChange={setDailyLimit} />
      <RangeField label="Total allocation" value={totalAllocated} min={500} max={100000} step={500} format={(v) => fmtUsd(v, { compact: true })} onChange={setTotalAllocated} />
      <RangeField label="Slippage tolerance" value={slippage} min={0.5} max={10} step={0.5} format={(v) => `${v}%`} onChange={setSlippage} />
      <RangeField label="Min trader score" value={minScore} min={50} max={100} step={1} format={(v) => `${Math.round(v)}`} onChange={setMinScore} />

      <button
        onClick={() => setOnlyBuy(!onlyBuy)}
        className={cn(
          "w-full flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors",
          onlyBuy ? "border-bull/30 bg-bull/10" : "border-border"
        )}
      >
        <Shield className={cn("h-4 w-4", onlyBuy ? "text-bull" : "text-muted-foreground")} />
        <div className="flex-1">
          <div className="text-xs font-medium">Only copy buys</div>
          <div className="text-[10px] text-muted-foreground">Skip sell trades to avoid panic selling</div>
        </div>
        <div className={cn("h-5 w-9 rounded-full p-0.5 transition-colors", onlyBuy ? "bg-bull" : "bg-surface-3")}>
          <div className={cn("h-4 w-4 rounded-full bg-white transition-transform", onlyBuy && "translate-x-4")} />
        </div>
      </button>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          className="flex-1 py-2 rounded-lg bg-bull text-background text-xs font-bold hover:opacity-90"
        >
          Start copying
        </button>
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <span className="text-[11px] font-semibold tabular">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-bull h-1.5"
      />
    </div>
  );
}
