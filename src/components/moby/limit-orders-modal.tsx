"use client";

import { useState } from "react";
import { X, ListOrdered, Plus, Trash2, Check, Clock, Target } from "lucide-react";
import { TOKENS, TOKENS_BY_ID, fmtPrice, fmtUsd } from "@/lib/moby-data";
import { useMoby, type LimitOrder } from "@/lib/moby-store";
import { TokenIcon, Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const EXPIRY_OPTIONS: { k: LimitOrder["expiry"]; label: string }[] = [
  { k: "1d", label: "1 day" },
  { k: "7d", label: "7 days" },
  { k: "30d", label: "30 days" },
  { k: "90d", label: "90 days" },
  { k: "gtc", label: "Good till cancelled" },
];

export function LimitOrdersModal() {
  const open = useMoby((s) => s.limitOrdersOpen);
  const setOpen = useMoby((s) => s.setLimitOrdersOpen);
  const orders = useMoby((s) => s.limitOrders);
  const cancelOrder = useMoby((s) => s.cancelLimitOrder);
  const addOrder = useMoby((s) => s.addLimitOrder);
  const [showForm, setShowForm] = useState(false);

  const openOrders = orders.filter((o) => o.status === "open");
  const filledOrders = orders.filter((o) => o.status === "filled");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

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
              <ListOrdered className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Limit orders</h2>
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
                <StatBox label="Open" value={openOrders.length} accent="bull" />
                <StatBox label="Filled" value={filledOrders.length} accent="default" />
                <StatBox label="Cancelled" value={cancelledOrders.length} accent="bear" />
              </div>

              {showForm ? (
                <LimitOrderForm onClose={() => setShowForm(false)} onCreate={addOrder} />
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> New limit order
                </button>
              )}

              {/* Open orders */}
              {openOrders.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Open orders</div>
                  <div className="space-y-2">
                    {openOrders.map((o) => (
                      <OrderCard key={o.id} order={o} onCancel={() => cancelOrder(o.id)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Filled orders */}
              {filledOrders.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Filled</div>
                  <div className="space-y-2">
                    {filledOrders.map((o) => (
                      <OrderCard key={o.id} order={o} />
                    ))}
                  </div>
                </div>
              )}

              {/* Cancelled */}
              {cancelledOrders.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Cancelled</div>
                  <div className="space-y-2">
                    {cancelledOrders.map((o) => (
                      <OrderCard key={o.id} order={o} />
                    ))}
                  </div>
                </div>
              )}

              {orders.length === 0 && !showForm && (
                <div className="text-center py-8">
                  <Target className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-semibold mb-1">No limit orders yet</p>
                  <p className="text-xs text-muted-foreground">Set price targets and let Moby execute when the market hits them.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number; accent: "bull" | "bear" | "default" }) {
  const color = accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : "text-foreground";
  return (
    <div className="rounded-xl border border-border p-2.5 text-center">
      <div className={cn("text-lg font-bold tabular", color)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function OrderCard({ order, onCancel }: { order: LimitOrder; onCancel?: () => void }) {
  const token = TOKENS_BY_ID[order.tokenId];
  const isBuy = order.side === "BUY";
  const statusColor =
    order.status === "open" ? "text-bull bg-bull/10"
    : order.status === "filled" ? "text-muted-foreground bg-surface-3"
    : "text-bear bg-bear/10";

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2.5">
        {token && (
          <TokenIcon symbol={token.symbol} glyph={token.logoGlyph} color={token.logoColor} size="sm" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">${order.tokenSymbol}</span>
            <Chip variant={isBuy ? "bull" : "bear"}>{order.side}</Chip>
            <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ml-auto", statusColor)}>
              {order.status}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground tabular">
            {order.status === "filled" && order.fillPrice
              ? `Filled @ ${fmtPrice(order.fillPrice)}`
              : `Target ${fmtPrice(order.targetPrice)}`} · {fmtUsd(order.amountUsd, { compact: true })}
          </div>
        </div>
        {onCancel && order.status === "open" && (
          <button
            onClick={onCancel}
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-surface-3 text-muted-foreground hover:text-bear"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
        <Clock className="h-2.5 w-2.5" />
        <span>Expiry: {EXPIRY_OPTIONS.find((e) => e.k === order.expiry)?.label}</span>
        {order.status === "open" && (
          <span className="ml-auto text-bull">
            {isBuy ? "Waiting for price drop" : "Waiting for price rise"}
          </span>
        )}
      </div>
    </div>
  );
}

function LimitOrderForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (o: Omit<LimitOrder, "id" | "createdAt">) => void;
}) {
  const [tokenId, setTokenId] = useState("wif");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [targetPrice, setTargetPrice] = useState("");
  const [amountUsd, setAmountUsd] = useState("500");
  const [expiry, setExpiry] = useState<LimitOrder["expiry"]>("7d");

  const token = TOKENS_BY_ID[tokenId];
  const currentPrice = token?.price ?? 0;
  const target = parseFloat(targetPrice) || 0;
  const distancePct = currentPrice > 0 ? ((target - currentPrice) / currentPrice) * 100 : 0;

  const handleCreate = () => {
    if (!target || !amountUsd) return;
    onCreate({
      tokenId,
      tokenSymbol: token!.symbol,
      side,
      targetPrice: target,
      amountUsd: parseFloat(amountUsd),
      expiry,
      status: "open",
    });
    onClose();
  };

  return (
    <div className="rounded-xl border border-bull/30 bg-bull/5 p-3 space-y-3">
      <div className="text-xs font-semibold flex items-center gap-1">
        <Target className="h-3.5 w-3.5 text-bull" /> New limit order
      </div>

      {/* Token picker */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Token</div>
        <select
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bull/40"
        >
          {TOKENS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.symbol} — {t.name} ({fmtPrice(t.price)})
            </option>
          ))}
        </select>
      </div>

      {/* Side */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Side</div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setSide("BUY")}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold border",
              side === "BUY" ? "bg-bull text-background border-bull" : "border-border text-muted-foreground"
            )}
          >
            Buy (limit)
          </button>
          <button
            onClick={() => setSide("SELL")}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold border",
              side === "SELL" ? "bg-bear text-white border-bear" : "border-border text-muted-foreground"
            )}
          >
            Sell (limit)
          </button>
        </div>
      </div>

      {/* Target price */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Target price</span>
          <span className="text-[10px] text-muted-foreground tabular">Current: {fmtPrice(currentPrice)}</span>
        </div>
        <input
          type="number"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder={String(currentPrice)}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-bull/40"
        />
        {target > 0 && (
          <div className={cn("text-[10px] mt-1 tabular", distancePct >= 0 ? "text-bull" : "text-bear")}>
            {distancePct >= 0 ? "+" : ""}
            {distancePct.toFixed(2)}% from current
          </div>
        )}
      </div>

      {/* Amount */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Amount (USD)</div>
        <input
          type="number"
          value={amountUsd}
          onChange={(e) => setAmountUsd(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-bull/40"
        />
      </div>

      {/* Expiry */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Expiry</div>
        <div className="flex flex-wrap gap-1.5">
          {EXPIRY_OPTIONS.map((e) => (
            <button
              key={e.k}
              onClick={() => setExpiry(e.k)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium border",
                expiry === e.k
                  ? "bg-bull/15 text-bull border-bull/30"
                  : "bg-surface-2 text-muted-foreground border-border"
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
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
          disabled={!target || !amountUsd}
          className="flex-1 py-2 rounded-lg bg-bull text-background text-xs font-bold hover:opacity-90 disabled:opacity-50"
        >
          Place order
        </button>
      </div>
    </div>
  );
}
