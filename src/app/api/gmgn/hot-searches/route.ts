import { NextRequest, NextResponse } from "next/server";
import { fetchHotSearches, type GmgnHotSearch } from "@/lib/gmgn";

/**
 * GET /api/gmgn/hot-searches?chain=sol&interval=1h&limit=20
 *
 * Returns the most-searched tokens on gmgn.ai.
 */

function fallbackHotSearches(limit: number): GmgnHotSearch[] {
  const SYMBOLS = [
    ["WIF", "dogwifhat", "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"],
    ["BONK", "Bonk", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw"],
    ["POPCAT", "Popcat", "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"],
    ["MEW", "cat in a dogs world", "MEW1gQWJ3jEXF2GGkQu5Q3p5v1J8e5t8t7tZ4p2mEq"],
    ["MNGO", "Mango", "MangoCzJ36AjZyKKs9xLpNfcddzZdp6VJuRKrZ4PjmhY"],
    ["JTO", "Jito", "jtojtWpa9ZAewgzs2bhj3qLezLMfXiwQ8m8p9Ln5xMT"],
  ];
  let seed = Math.floor(Date.now() / 300_000);
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const out: GmgnHotSearch[] = SYMBOLS.slice(0, limit).map(([sym, name, addr], i) => ({
    rank: i + 1,
    token_address: addr,
    symbol: sym,
    name,
    chain: "sol",
    search_count_24h: Math.round(10000 - i * 800 + rng() * 500),
    price: Number((rng() * 5).toFixed(4)),
    change_24h: Number(((rng() - 0.4) * 80).toFixed(2)),
    market_cap: Math.round(rng() * 500_000_000 + 1_000_000),
  }));
  return out;
}

export async function GET(req: NextRequest) {
  const chainParam = req.nextUrl.searchParams.get("chain") || "sol";
  const chains = chainParam.split(",");
  const interval = (req.nextUrl.searchParams.get("interval") || "1h") as "1m" | "5m" | "1h" | "6h" | "24h";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 100);

  try {
    const hot = await fetchHotSearches(chains, interval, limit);
    if (hot && hot.length > 0) {
      return NextResponse.json({
        hotSearches: hot,
        count: hot.length,
        source: "gmgn",
        chains,
        interval,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackHotSearches(limit);
  return NextResponse.json({
    hotSearches: fallback,
    count: fallback.length,
    source: "simulated",
    chains,
    interval,
    timestamp: Date.now(),
    note: "GMGN CLI unavailable — showing simulated hot searches.",
  });
}
