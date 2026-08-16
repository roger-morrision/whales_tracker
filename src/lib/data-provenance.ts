export type DataSource =
  | "solana-rpc"
  | "jupiter"
  | "dexscreener"
  | "gmgn"
  | "pumpfun"
  | "openai"
  | "fallback"
  | "error";

export type DataFreshness = "live" | "stale" | "unavailable";

export interface DataMeta {
  source: DataSource;
  freshness: DataFreshness;
  observedAt: number;
  staleAfterMs: number;
  note?: string;
}

export function liveMeta(source: DataSource, staleAfterMs: number, observedAt = Date.now()): DataMeta {
  return { source, freshness: "live", observedAt, staleAfterMs };
}

export function unavailableMeta(source: DataSource, note: string): DataMeta {
  return {
    source,
    freshness: "unavailable",
    observedAt: Date.now(),
    staleAfterMs: 0,
    note,
  };
}

export function freshnessFor(meta: Pick<DataMeta, "observedAt" | "staleAfterMs">, now = Date.now()): DataFreshness {
  if (meta.staleAfterMs <= 0) return "unavailable";
  return now - meta.observedAt <= meta.staleAfterMs ? "live" : "stale";
}
