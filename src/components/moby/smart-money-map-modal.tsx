"use client";

import { useMemo, useState } from "react";
import { X, Network, Filter, ArrowRight, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getSmartMoneyMap, fmtUsd, fmtNum, fmtAgo, type WalletNode, type WalletEdge } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { WalletLink } from "./wallet-link";
import { Chip } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const TYPE_META: Record<WalletNode["type"], { label: string; color: string }> = {
  whale: { label: "Whale", color: "#F59E0B" },
  smart_money: { label: "Smart Money", color: "#14F195" },
  kol: { label: "KOL", color: "#EC4899" },
  cex: { label: "CEX", color: "#F7931A" },
  fund: { label: "Fund", color: "#627EEA" },
};

export function SmartMoneyMapModal() {
  const open = useMoby((s) => s.smartMoneyMapOpen);
  const setOpen = useMoby((s) => s.setSmartMoneyMapOpen);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<WalletNode["type"] | "all">("all");

  const map = useMemo(() => getSmartMoneyMap(), []);
  const filteredNodes = filterType === "all" ? map.nodes : map.nodes.filter((n) => n.type === filterType);
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const visibleEdges = map.edges.filter((e) => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));

  const selectedNodeData = selectedNode ? map.nodes.find((n) => n.id === selectedNode) : null;
  const selectedEdges = selectedNode
    ? map.edges.filter((e) => e.from === selectedNode || e.to === selectedNode)
    : [];

  const maxEdgeValue = Math.max(...map.edges.map((e) => e.value));

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
              <Network className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Smart money map</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {/* Filter chips */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                <button
                  onClick={() => setFilterType("all")}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border",
                    filterType === "all" ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-2 text-muted-foreground border-border"
                  )}
                >
                  All
                </button>
                {(Object.keys(TYPE_META) as WalletNode["type"][]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border inline-flex items-center gap-1",
                      filterType === t ? "bg-bull/15 text-bull border-bull/30" : "bg-surface-2 text-muted-foreground border-border"
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_META[t].color }} />
                    {TYPE_META[t].label}
                  </button>
                ))}
              </div>

              {/* Map visualization */}
              <div className="rounded-xl border border-border p-2 bg-surface-2/50">
                <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Edges */}
                    {visibleEdges.map((edge, i) => {
                      const from = map.nodes.find((n) => n.id === edge.from);
                      const to = map.nodes.find((n) => n.id === edge.to);
                      if (!from || !to) return null;
                      const width = Math.max(0.5, (edge.value / maxEdgeValue) * 3);
                      const isActive = selectedNode === edge.from || selectedNode === edge.to;
                      return (
                        <line
                          key={i}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={isActive ? "var(--bull)" : "var(--muted-foreground)"}
                          strokeWidth={width}
                          strokeOpacity={isActive ? 0.8 : 0.3}
                          strokeDasharray={isActive ? "0" : "2 2"}
                        />
                      );
                    })}
                  </svg>
                  {/* Nodes */}
                  {filteredNodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    >
                      <div
                        className="rounded-full grid place-items-center font-bold text-white ring-2 transition-all"
                        style={{
                          width: `${node.size}px`,
                          height: `${node.size}px`,
                          backgroundColor: node.color,
                          // @ts-expect-error CSS custom property
                          "--tw-ring-color": selectedNode === node.id ? "var(--bull)" : "var(--background)",
                          fontSize: `${node.size * 0.4}px`,
                        }}
                      >
                        {node.glyph}
                      </div>
                      <div className="text-[9px] font-semibold mt-0.5 text-center whitespace-nowrap bg-background/80 rounded px-1">
                        {node.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected node detail */}
              {selectedNodeData && (
                <div className="rounded-xl border border-bull/30 bg-bull/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-10 w-10 rounded-full grid place-items-center font-bold text-white"
                      style={{ backgroundColor: selectedNodeData.color }}
                    >
                      {selectedNodeData.glyph}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{selectedNodeData.label}</span>
                        <Chip variant="outline">{TYPE_META[selectedNodeData.type].label}</Chip>
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular">
                        In: <span className="text-bull">+{fmtUsd(selectedNodeData.inflowUsd, { compact: true })}</span> · Out: <span className="text-bear">-{fmtUsd(selectedNodeData.outflowUsd, { compact: true })}</span>
                      </div>
                    </div>
                    <WalletLink
                      label={selectedNodeData.label}
                      address={`0x${selectedNodeData.id}`}
                      className="text-[11px]"
                    />
                  </div>

                  {/* Connected flows */}
                  <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Connected flows ({selectedEdges.length})</div>
                    <div className="space-y-1">
                      {selectedEdges.map((edge, i) => {
                        const isOutgoing = edge.from === selectedNode;
                        const otherNode = map.nodes.find((n) => n.id === (isOutgoing ? edge.to : edge.from));
                        return (
                          <div key={i} className="flex items-center gap-2 text-[11px] p-1.5 rounded-lg bg-surface-2">
                            <span className={cn("h-5 w-5 rounded grid place-items-center", isOutgoing ? "bg-bear/15 text-bear" : "bg-bull/15 text-bull")}>
                              {isOutgoing ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            </span>
                            <WalletLink
                              label={otherNode?.label ?? "Unknown"}
                              address={`0x${otherNode?.id}`}
                              variant="muted"
                              className="text-[11px]"
                            />
                            <span className="text-muted-foreground">${edge.tokenSymbol}</span>
                            <span className="ml-auto font-semibold tabular">{fmtUsd(edge.value, { compact: true })}</span>
                            <span className="text-muted-foreground text-[9px]">{fmtAgo(edge.agoSeconds)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border p-2.5 text-center">
                  <div className="text-lg font-bold tabular">{filteredNodes.length}</div>
                  <div className="text-[10px] text-muted-foreground">Wallets</div>
                </div>
                <div className="rounded-xl border border-border p-2.5 text-center">
                  <div className="text-lg font-bold tabular">{visibleEdges.length}</div>
                  <div className="text-[10px] text-muted-foreground">Flows</div>
                </div>
                <div className="rounded-xl border border-border p-2.5 text-center">
                  <div className="text-lg font-bold tabular text-bull">{fmtUsd(visibleEdges.reduce((s, e) => s + e.value, 0), { compact: true })}</div>
                  <div className="text-[10px] text-muted-foreground">Total flow</div>
                </div>
              </div>

              {/* Legend */}
              <div className="rounded-xl border border-border p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Legend</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TYPE_META) as WalletNode["type"][]).map((t) => (
                    <div key={t} className="flex items-center gap-1.5 text-[11px]">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: TYPE_META[t].color }} />
                      <span>{TYPE_META[t].label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  Line thickness = flow size · Click a node to see its connections
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
