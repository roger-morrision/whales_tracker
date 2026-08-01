"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Bell, Plus, Trash2, ChevronRight, Check } from "lucide-react";
import { TOKENS, fmtPrice, fmtUsd } from "@/lib/moby-data";
import { useMoby, type CustomAlert } from "@/lib/moby-store";
import { TokenIcon, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CONDITIONS: { k: CustomAlert["condition"]; label: string; emoji: string; desc: string }[] = [
  { k: "price_above", label: "Price above", emoji: "📈", desc: "Trigger when price crosses above target" },
  { k: "price_below", label: "Price below", emoji: "📉", desc: "Trigger when price crosses below target" },
  { k: "smart_money_inflow", label: "Smart money inflow", emoji: "🐋", desc: "Net smart money inflow exceeds threshold (24h)" },
  { k: "smart_money_outflow", label: "Smart money outflow", emoji: "🐳", desc: "Net smart money outflow exceeds threshold (24h)" },
  { k: "new_whale_buy", label: "New whale buy", emoji: "💰", desc: "Any tracked whale buys this token" },
];

const CHANNELS: { k: "push" | "email" | "telegram"; label: string; emoji: string }[] = [
  { k: "push", label: "Push", emoji: "🔔" },
  { k: "email", label: "Email", emoji: "✉️" },
  { k: "telegram", label: "Telegram", emoji: "✈️" },
];

export function AlertCreatorModal() {
  const open = useMoby((s) => s.alertCreatorOpen);
  const close = useMoby((s) => s.closeAlertCreator);
  const presetTokenId = useMoby((s) => s.alertCreatorTokenId);
  const addAlert = useMoby((s) => s.addCustomAlert);
  const customAlerts = useMoby((s) => s.customAlerts);
  const removeAlert = useMoby((s) => s.removeCustomAlert);

  const [tokenId, setTokenId] = useState(presetTokenId ?? "wif");
  const [condition, setCondition] = useState<CustomAlert["condition"]>("price_above");
  const [threshold, setThreshold] = useState("");
  const [channels, setChannels] = useState<("push" | "email" | "telegram")[]>(["push"]);
  const [showTokenPicker, setShowTokenPicker] = useState(false);

  // Sync presetTokenId when it changes (e.g., opening from different tokens)
  useEffect(() => {
    if (presetTokenId) {
      Promise.resolve().then(() => setTokenId(presetTokenId));
    }
  }, [presetTokenId]);

  const token = useMemo(() => TOKENS.find((t) => t.id === tokenId) ?? TOKENS[0], [tokenId]);

  const isPriceCondition = condition === "price_above" || condition === "price_below";
  const thresholdLabel = isPriceCondition ? "Target price (USD)" : "Threshold (USD)";
  const thresholdPlaceholder = isPriceCondition ? fmtPrice(token.price) : "1,000,000";

  const toggleChannel = (ch: "push" | "email" | "telegram") => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((x) => x !== ch) : [...prev, ch]
    );
  };

  const handleCreate = () => {
    if (!threshold || channels.length === 0) return;
    addAlert({
      tokenId,
      tokenSymbol: token.symbol,
      condition,
      threshold: parseFloat(threshold),
      channels,
      active: true,
      triggered: false,
    });
    // Reset
    setThreshold("");
    setChannels(["push"]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={close}
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
              <Bell className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Create custom alert</h2>
              <button
                onClick={close}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {/* Existing alerts */}
              {customAlerts.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Active alerts ({customAlerts.length})
                  </div>
                  <div className="space-y-1.5">
                    {customAlerts.map((a) => {
                      const tk = TOKENS.find((t) => t.id === a.tokenId);
                      const condMeta = CONDITIONS.find((c) => c.k === a.condition);
                      return (
                        <div key={a.id} className="rounded-lg border border-border p-2.5 flex items-center gap-2.5">
                          <TokenIcon
                            symbol={a.tokenSymbol}
                            glyph={tk?.logoGlyph}
                            color={tk?.logoColor}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold">
                              ${a.tokenSymbol} · {condMeta?.emoji} {condMeta?.label}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {isPriceCondition ? fmtPrice(a.threshold) : fmtUsd(a.threshold, { compact: true })}
                              {" · "}
                              {a.channels.map((c) => c).join(", ")}
                            </div>
                          </div>
                          <button
                            onClick={() => removeAlert(a.id)}
                            className="h-7 w-7 grid place-items-center rounded-md hover:bg-surface-3 text-muted-foreground hover:text-bear"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New alert form */}
              <div className="rounded-xl border border-bull/30 bg-bull/5 p-3 space-y-3">
                <div className="text-xs font-semibold flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5 text-bull" /> New alert
                </div>

                {/* Token picker */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Token</div>
                  <button
                    onClick={() => setShowTokenPicker(!showTokenPicker)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg bg-surface-2 border border-border hover:bg-surface-3 transition-colors"
                  >
                    <TokenIcon symbol={token.symbol} glyph={token.logoGlyph} color={token.logoColor} size="sm" />
                    <span className="text-sm font-semibold flex-1 text-left">{token.symbol}</span>
                    <span className="text-[11px] text-muted-foreground">{token.name}</span>
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showTokenPicker && "rotate-90")} />
                  </button>
                  {showTokenPicker && (
                    <div className="mt-1.5 max-h-40 overflow-y-auto scrollbar-thin rounded-lg border border-border bg-surface-2 p-1">
                      {TOKENS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTokenId(t.id);
                            setShowTokenPicker(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 p-1.5 rounded hover:bg-surface-3 text-left",
                            tokenId === t.id && "bg-surface-3"
                          )}
                        >
                          <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="xs" />
                          <span className="text-xs font-semibold">{t.symbol}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{t.name}</span>
                          {tokenId === t.id && <Check className="h-3 w-3 text-bull ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Condition */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Condition</div>
                  <div className="space-y-1">
                    {CONDITIONS.map((c) => (
                      <button
                        key={c.k}
                        onClick={() => setCondition(c.k)}
                        className={cn(
                          "w-full flex items-start gap-2 p-2 rounded-lg border text-left transition-colors",
                          condition === c.k
                            ? "border-bull/30 bg-bull/10"
                            : "border-border hover:bg-surface-2"
                        )}
                      >
                        <span className="text-base">{c.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">{c.label}</div>
                          <div className="text-[10px] text-muted-foreground">{c.desc}</div>
                        </div>
                        {condition === c.k && <Check className="h-3.5 w-3.5 text-bull shrink-0 mt-0.5" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Threshold */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                    {thresholdLabel}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      placeholder={thresholdPlaceholder}
                      className="w-full bg-surface-2 border border-border rounded-lg pl-7 pr-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-bull/40"
                    />
                  </div>
                  {!isPriceCondition && (
                    <div className="flex gap-1.5 mt-1.5">
                      {[100_000, 500_000, 1_000_000, 5_000_000].map((v) => (
                        <button
                          key={v}
                          onClick={() => setThreshold(String(v))}
                          className="px-2 py-0.5 rounded text-[10px] bg-surface-2 border border-border text-muted-foreground hover:text-foreground"
                        >
                          {fmtUsd(v, { compact: true })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Channels */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                    Notify me via
                  </div>
                  <div className="flex gap-1.5">
                    {CHANNELS.map((ch) => {
                      const active = channels.includes(ch.k);
                      return (
                        <button
                          key={ch.k}
                          onClick={() => toggleChannel(ch.k)}
                          className={cn(
                            "flex-1 py-2 rounded-lg border text-xs font-medium transition-colors flex flex-col items-center gap-0.5",
                            active
                              ? "border-bull/30 bg-bull/10 text-bull"
                              : "border-border bg-surface-2 text-muted-foreground"
                          )}
                        >
                          <span className="text-base">{ch.emoji}</span>
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={!threshold || channels.length === 0}
                className="w-full py-2.5 rounded-xl bg-bull text-background text-sm font-bold disabled:opacity-50 hover:opacity-90"
              >
                Create alert
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
