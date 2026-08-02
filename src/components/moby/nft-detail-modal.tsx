"use client";

import { useMemo } from "react";
import { X, TrendingUp, TrendingDown, ExternalLink, Shield } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NFT_COLLECTIONS, genNftFloorHistory, fmtUsd, fmtNum, fmtPct, timeLabel, type NftCollection } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { Chip, SectionHeader } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function NftDetailModal() {
  const open = useMoby((s) => s.nftDetailOpen);
  const setOpen = useMoby((s) => s.setNftDetailOpen);
  const selectedId = useMoby((s) => s.selectedNftId);

  const collection = useMemo(
    () => NFT_COLLECTIONS.find((c) => c.id === selectedId) ?? null,
    [selectedId]
  );

  return (
    <AnimatePresence>
      {open && collection && (
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
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl"
          >
            <NftDetailContent collection={collection} onClose={() => setOpen(false)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NftDetailContent({ collection, onClose }: { collection: NftCollection; onClose: () => void }) {
  const floorHistory = useMemo(
    () => genNftFloorHistory(collection.id, collection.floorPrice),
    [collection]
  );
  const isBull = collection.floorChange24h >= 0;

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3 z-10">
        <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br grid place-items-center text-xl", collection.color)}>
          {collection.glyph}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{collection.name}</span>
            {collection.verified && <Shield className="h-3.5 w-3.5 text-bull" />}
          </div>
          <div className="text-[11px] text-muted-foreground">{collection.chain} · {fmtNum(collection.items)} items</div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Floor price */}
      <div className="px-4 pt-4">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Floor price</div>
            <div className="text-3xl font-bold tabular">{collection.floorPrice} SOL</div>
          </div>
          <div className={cn("flex items-center gap-1 pb-1.5 text-sm font-semibold", isBull ? "text-bull" : "text-bear")}>
            {isBull ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {fmtPct(collection.floorChange24h)}
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">24h Volume</div>
            <div className="text-sm font-semibold tabular">{fmtUsd(collection.volume24h, { compact: true })}</div>
          </div>
        </div>
      </div>

      {/* Floor price chart */}
      <div className="px-2 mt-3">
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={floorHistory}>
              <defs>
                <linearGradient id={`nft-floor-${collection.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isBull ? "var(--bull)" : "var(--bear)"} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={isBull ? "var(--bull)" : "var(--bear)"} stopOpacity="0" />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={isBull ? "var(--bull)" : "var(--bear)"}
                strokeWidth={2}
                fill={`url(#nft-floor-${collection.id})`}
                isAnimationActive={false}
              />
              <XAxis dataKey="t" tickFormatter={(v) => timeLabel(v)} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => timeLabel(v)}
                formatter={(v: number) => [`${v} SOL`, "Floor"]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 mt-3 grid grid-cols-3 gap-2">
        <Stat label="Owners" value={fmtNum(collection.owners)} />
        <Stat label="Items" value={fmtNum(collection.items)} />
        <Stat label="Listed" value={`${collection.listedPct}%`} />
      </div>

      {/* Traits */}
      <div className="px-4 mt-4">
        <SectionHeader title="Traits & rarity" emoji="🎨" />
        <div className="space-y-3">
          {collection.traits.map((trait) => (
            <div key={trait.name}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{trait.name}</div>
              <div className="space-y-1.5">
                {trait.values.map((v) => (
                  <div key={v.label} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2">
                    <div className="flex-1">
                      <div className="text-xs font-semibold">{v.label}</div>
                      <div className="text-[10px] text-muted-foreground tabular">{v.pct}% have this</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">Floor mult</div>
                      <div className={cn("text-xs font-semibold tabular", v.floorMod > 1.5 ? "text-bull" : v.floorMod < 1 ? "text-bear" : "text-foreground")}>
                        {v.floorMod.toFixed(1)}x
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buy/Sell buttons */}
      <div className="px-4 mt-4 pb-6 grid grid-cols-2 gap-2">
        <button
          onClick={() =>
            useMoby.getState().pushToast({
              title: "Listing drafted",
              description: `Demo: List a ${collection.name} NFT at ${collection.floorPrice} SOL floor.`,
              type: "info",
            })
          }
          className="py-2.5 rounded-xl bg-bear/15 text-bear border border-bear/30 text-sm font-bold hover:bg-bear/20 transition-colors"
        >
          List for sale
        </button>
        <button
          onClick={() =>
            useMoby.getState().pushToast({
              title: "Buy order pending",
              description: `Demo: Buy ${collection.name} at ${collection.floorPrice} SOL floor.`,
              type: "info",
            })
          }
          className="py-2.5 rounded-xl bg-bull text-background text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Buy at floor
        </button>
      </div>
    </div>
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

/**
 * NFT collections list — used in Portfolio NFT tab.
 */
export function NftCollectionsList() {
  const openNft = useMoby((s) => s.openNft);
  const setNftDetailOpen = useMoby((s) => s.setNftDetailOpen);

  return (
    <div className="grid grid-cols-2 gap-2">
      {NFT_COLLECTIONS.map((c) => {
        const isBull = c.floorChange24h >= 0;
        return (
          <button
            key={c.id}
            onClick={() => {
              openNft(c.id);
              setNftDetailOpen(true);
            }}
            className="rounded-xl border border-border overflow-hidden hover:border-bull/30 transition-colors text-left"
          >
            <div className={cn("h-20 bg-gradient-to-br relative grid place-items-center", c.color)}>
              <span className="text-3xl">{c.glyph}</span>
              {c.verified && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-bull grid place-items-center">
                  <Shield className="h-2.5 w-2.5 text-background" />
                </span>
              )}
            </div>
            <div className="p-2">
              <div className="font-semibold text-sm truncate">{c.name}</div>
              <div className="text-[10px] text-muted-foreground tabular mb-0.5">
                Floor {c.floorPrice} SOL
              </div>
              <div className={cn("text-[11px] tabular font-semibold", isBull ? "text-bull" : "text-bear")}>
                {isBull ? "+" : ""}{c.floorChange24h.toFixed(1)}%
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
