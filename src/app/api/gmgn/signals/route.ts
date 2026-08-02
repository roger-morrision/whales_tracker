import { NextRequest, NextResponse } from "next/server";
import { fetchMarketSignals, type GmgnMarketSignal } from "@/lib/gmgn";

/**
 * GET /api/gmgn/signals?chain=sol&limit=30
 *
 * Returns market signals (smart money entries, large buys, price spikes, new listings).
 */

function fallbackSignals(chain: string, limit: number): GmgnMarketSignal[] {
  const SIGNAL_TYPES: GmgnMarketSignal["signal_type"][] = [
    "smart_money_buy", "smart_money_sell", "large_buy", "price_spike", "new_listing",
  ];
  const SYMBOLS = [
    ["WIF", "dogwifhat", "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"],
    ["BONK", "Bonk", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw"],
    ["JUP", "Jupiter", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK"],
    ["POPCAT", "Popcat", "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"],
    ["MEW", "cat in a dogs world", "MEW1gQWJ3jEXF2GGkQu5Q3p5v1J8e5t8t7tZ4p2mEq"],
  ];
  let seed = Math.floor(Date.now() / 60_000);
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const out: GmgnMarketSignal[] = [];
  let ts = Date.now();
  for (let i = 0; i < limit; i++) {
    ts -= Math.round(rng() * 900_000 + 30_000);
    const [symbol, name, addr] = SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
    out.push({
      token_address: addr,
      symbol,
      name,
      signal_type: SIGNAL_TYPES[Math.floor(rng() * SIGNAL_TYPES.length)],
      ts: Math.floor(ts / 1000),
      amount_usd: Math.round(rng() * 200_000 + 5_000),
      price: Number((rng() * 5).toFixed(4)),
      change_1h: Number(((rng() - 0.4) * 30).toFixed(2)),
      change_24h: Number(((rng() - 0.3) * 100).toFixed(2)),
      wallet_count: Math.round(rng() * 50 + 1),
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get("chain") || "sol";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);

  try {
    const signals = await fetchMarketSignals(chain, limit);
    if (signals && signals.length > 0) {
      return NextResponse.json({
        signals,
        count: signals.length,
        source: "gmgn",
        chain,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackSignals(chain, limit);
  return NextResponse.json({
    signals: fallback,
    count: fallback.length,
    source: "simulated",
    chain,
    timestamp: Date.now(),
    note: "GMGN CLI unavailable — showing simulated signals.",
  });
}
