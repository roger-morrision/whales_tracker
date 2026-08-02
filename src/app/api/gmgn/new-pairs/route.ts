import { NextRequest, NextResponse } from "next/server";
import { fetchNewPairs, fetchTrenches, type GmgnTrendingToken } from "@/lib/gmgn";

/**
 * GET /api/gmgn/new-pairs?limit=30&type=new_creation
 *
 * type: "new_creation" (default), "near_completion", "completed"
 *
 * Returns recently-launched token pairs from GMGN.
 */

function fallbackNewPairs(limit: number): GmgnTrendingToken[] {
  const NAMES: [string, string][] = [
    ["MOON", "MoonRocket"],
    ["PEPE2", "Pepe 2.0"],
    ["WOJAK", "Wojak"],
    ["DOGE2", "Doge 2.0"],
    ["FROG", "Frog"],
    ["CAT", "Cat Token"],
    ["BNB", "Banana"],
    ["COPe", "Copium"],
  ];

  let seed = Math.floor(Date.now() / 60_000);
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const out: GmgnTrendingToken[] = [];
  for (let i = 0; i < limit; i++) {
    const [symbol, name] = NAMES[i % NAMES.length];
    const marketCap = Math.round(5000 + rng() * 200_000);
    out.push({
      address: `${symbol.slice(0, 4)}${Math.floor(rng() * 1e12).toString(16).slice(0, 28)}`,
      symbol: symbol + (i >= NAMES.length ? Math.floor(i / NAMES.length) : ""),
      name,
      decimals: 9,
      price: marketCap / 1_000_000_000,
      price_change_1h: Number(((rng() - 0.5) * 80).toFixed(2)),
      price_change_24h: Number(((rng() - 0.3) * 200).toFixed(2)),
      volume_24h: Math.round(marketCap * (0.2 + rng() * 1)),
      market_cap: marketCap,
      liquidity: Math.round(marketCap * 0.2),
      holders: Math.round(20 + rng() * 500),
      total_supply: 1_000_000_000,
      create_timestamp: Date.now() / 1000 - rng() * 3600 * 6, // last 6 hours
      last_trade_timestamp: Date.now() / 1000 - rng() * 60,
      tx_24h_buy: Math.round(rng() * 500),
      tx_24h_sell: Math.round(rng() * 500),
      is_alive: true,
      rank: i + 1,
      chain: "SOL",
      swaps_24h: Math.round(rng() * 2000),
      buyers_24h: Math.round(rng() * 500),
      sellers_24h: Math.round(rng() * 500),
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);
  const type = (req.nextUrl.searchParams.get("type") || "new_creation") as
    | "new_creation" | "near_completion" | "completed";

  // For non-default types, prefer fetchTrenches
  if (type !== "new_creation") {
    try {
      const trenches = await fetchTrenches(type, "sol", limit);
      if (trenches && trenches.length > 0) {
        return NextResponse.json({
          tokens: trenches,
          count: trenches.length,
          type,
          source: "gmgn",
          timestamp: Date.now(),
        });
      }
    } catch {
      // fall through
    }
  }

  try {
    const pairs = await fetchNewPairs(limit);
    if (pairs && pairs.length > 0) {
      return NextResponse.json({
        tokens: pairs,
        count: pairs.length,
        type,
        source: "gmgn",
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackNewPairs(limit);
  return NextResponse.json({
    tokens: fallback,
    count: fallback.length,
    type,
    source: "simulated",
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated new pairs.",
  });
}
