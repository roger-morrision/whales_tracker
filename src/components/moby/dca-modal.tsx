"use client";

import { useState } from "react";
import { X, CalendarClock, Plus, Trash2, Power, PowerOff, Repeat } from "lucide-react";
import { TOKENS_BY_ID, DCA_PRESETS, fmtUsd, fmtNum } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { TokenIcon, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const FREQUENCIES = [
  { k: "daily", label: "Daily", emoji: "☀️" },
  { k: "weekly", label: "Weekly", emoji: "📅" },
  { k: "biweekly", label: "Biweekly", emoji: "🗓" },
  { k: "monthly", label: "Monthly", emoji: "📆" },
] as const;

export function DcaModal() {
  const open = useMoby((s) => s.dcaOpen);
  const setOpen = useMoby((s) => s.setDcaOpen);
  const strategies = useMoby((s) => s.dcaStrategies);
  const removeStrategy = useMoby((s) => s.removeDcaStrategy);
  const toggleStrategy = useMoby((s) => s.toggleDcaStrategy);
  const addStrategy = useMoby((s) => s.addDcaStrategy);
  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const totalInvested = strategies.reduce((s, x) => s + x.totalInvested, 0);
  const activeCount = strategies.filter((s) => s.enabled).length;

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
              <CalendarClock className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">DCA scheduler</h2>
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
                  <div className="text-lg font-bold tabular">{fmtUsd(totalInvested, { compact: true })}</div>
                  <div className="text-[10px] text-muted-foreground">Invested</div>
                </div>
                <div className="rounded-xl border border-border p-2.5 text-center">
                  <div className="text-lg font-bold tabular">{strategies.reduce((s, x) => s + x.runs, 0)}</div>
                  <div className="text-[10px] text-muted-foreground">Total runs</div>
                </div>
              </div>

              {/* Active strategies */}
              {strategies.length > 0 && (
                <div className="space-y-2">
                  {strategies.map((s) => (
                    <DcaStrategyCard
                      key={s.id}
                      strategy={s}
                      onToggle={() => toggleStrategy(s.id)}
                      onRemove={() => removeStrategy(s.id)}
                    />
                  ))}
                </div>
              )}

              {/* Presets */}
              {showPresets && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Strategy presets</div>
                  {DCA_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addStrategy({
                          name: p.name,
                          tokenIds: p.tokens,
                          frequency: p.frequency,
                          amountUsd: p.amountUsd,
                          enabled: true,
                        });
                        setShowPresets(false);
                      }}
                      className="w-full rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{p.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{p.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold tabular">{fmtUsd(p.amountUsd)}/{p.frequency}</div>
                          <div className="text-[10px] text-bull tabular">+{p.expectedApy}% APY</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        {p.tokens.map((tid) => {
                          const t = TOKENS_BY_ID[tid];
                          if (!t) return null;
                          return (
                            <span key={tid} className="inline-flex items-center gap-0.5 text-[9px] bg-surface-3 px-1 py-0.5 rounded">
                              <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="xs" />
                              {t.symbol}
                            </span>
                          );
                        })}
                        <Chip variant={p.riskLevel === "low" ? "bull" : p.riskLevel === "high" ? "bear" : "gold"} className="ml-auto">
                          {p.riskLevel}
                        </Chip>
                        <span className="text-[9px] text-muted-foreground">{fmtNum(p.followers)} followers</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Form */}
              {showForm && <DcaForm onClose={() => setShowForm(false)} />}

              {/* Actions */}
              {!showForm && !showPresets && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowPresets(true)}
                    className="py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Repeat className="h-3.5 w-3.5" /> Use preset
                  </button>
                  <button
                    onClick={() => setShowForm(true)}
                    className="py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Custom
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DcaStrategyCard({
  strategy,
  onToggle,
  onRemove,
}: {
  strategy: ReturnType<typeof useMoby.getState>["dcaStrategies"][number];
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={cn("rounded-xl border p-3", strategy.enabled ? "border-bull/30 bg-bull/5" : "border-border bg-surface-2")}>
      <div className="flex items-center gap-2">
        <Repeat className={cn("h-4 w-4", strategy.enabled ? "text-bull" : "text-muted-foreground")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">{strategy.name}</span>
            {strategy.enabled ? (
              <span className="text-[9px] font-bold text-bull bg-bull/15 px-1.5 py-0.5 rounded">LIVE</span>
            ) : (
              <span className="text-[9px] font-bold text-muted-foreground bg-surface-3 px-1.5 py-0.5 rounded">PAUSED</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {strategy.frequency} · {fmtUsd(strategy.amountUsd)} · {strategy.runs} runs
          </div>
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "h-8 w-8 grid place-items-center rounded-lg",
            strategy.enabled ? "text-bull hover:bg-bull/10" : "text-muted-foreground hover:bg-surface-3"
          )}
        >
          {strategy.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
        </button>
        <button
          onClick={onRemove}
          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-bear hover:bg-surface-3"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {strategy.tokenIds.map((tid) => {
          const t = TOKENS_BY_ID[tid];
          if (!t) return null;
          return (
            <span key={tid} className="inline-flex items-center gap-0.5 text-[10px] bg-surface-3 px-1.5 py-0.5 rounded">
              <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="xs" />
              {t.symbol}
            </span>
          );
        })}
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">Total invested</span>
          <span className="font-semibold tabular text-bull">{fmtUsd(strategy.totalInvested, { compact: true })}</span>
        </div>
      </div>
    </div>
  );
}

function DcaForm({ onClose }: { onClose: () => void }) {
  const addStrategy = useMoby((s) => s.addDcaStrategy);
  const [name, setName] = useState("");
  const [tokenIds, setTokenIds] = useState<string[]>(["sol"]);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "biweekly" | "monthly">("weekly");
  const [amountUsd, setAmountUsd] = useState("200");

  const handleCreate = () => {
    if (!name || tokenIds.length === 0) return;
    addStrategy({
      name,
      tokenIds,
      frequency,
      amountUsd: parseFloat(amountUsd) || 100,
      enabled: true,
    });
    onClose();
  };

  return (
    <div className="rounded-xl border border-bull/30 bg-bull/5 p-3 space-y-3">
      <div className="text-xs font-semibold flex items-center gap-1">
        <Plus className="h-3.5 w-3.5 text-bull" /> Custom DCA strategy
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Name</div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My weekly SOL stack"
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bull/40"
        />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Tokens</div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin">
          {Object.values(TOKENS_BY_ID).map((t) => {
            const active = tokenIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() =>
                  setTokenIds((prev) =>
                    prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                  )
                }
                className={cn(
                  "px-2 py-1 rounded-full text-[11px] font-medium border",
                  active ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-2 text-muted-foreground border-border"
                )}
              >
                {t.symbol}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Frequency</div>
        <div className="grid grid-cols-4 gap-1.5">
          {FREQUENCIES.map((f) => (
            <button
              key={f.k}
              onClick={() => setFrequency(f.k)}
              className={cn(
                "py-2 rounded-lg text-[11px] font-medium border flex flex-col items-center gap-0.5",
                frequency === f.k ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-2 text-muted-foreground border-border"
              )}
            >
              <span className="text-base">{f.emoji}</span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Amount per run (USD)</div>
        <input
          type="number"
          value={amountUsd}
          onChange={(e) => setAmountUsd(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-bull/40"
        />
      </div>

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
          Create strategy
        </button>
      </div>
    </div>
  );
}
