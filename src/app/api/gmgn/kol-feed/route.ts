import { NextRequest, NextResponse } from "next/server";
import { fetchKolTrades, type GmgnTrackTrade } from "@/lib/gmgn";

/**
 * GET /api/gmgn/kol-feed?chain=sol&limit=30
 *
 * Returns recent trades from GMGN-tagged KOL wallets.
 */

const SAMPLE_KOLS = [
  { handle: "DegenSpartan", name: "Degen Spartan" },
  { handle: "HsakaTrades", name: "Hsaka" },
  { handle: "CryptoCobain", name: "Cobie" },
  { handle: "LightCrypto", name: "Light" },
  { handle: "Pentosh1", name: "Pentoshi" },
  { handle: "CoinMamba", name: "CoinMamba" },
];

function fallbackFeed(limit: number): GmgnTrackTrade[] {
  const SYMBOLS = [
    ["WIF", "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"],
    ["BONK", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw"],
    ["POPCAT", "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"],
    ["MEW", "MEW1gQWJ3jEXF2GGkQu5Q3p5v1J8e5t8t7tZ4p2mEq"],
    ["JUP", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK"],
  ];
  let seed = Math.floor(Date.now() / 60_000);
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const out: GmgnTrackTrade[] = [];
  let ts = Date.now();
  for (let i = 0; i < limit; i++) {
    ts -= Math.round(rng() * 1800_000 + 60_000);
    const [sym, addr] = SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
    const isBuy = rng() > 0.45;
    const kol = SAMPLE_KOLS[Math.floor(rng() * SAMPLE_KOLS.length)];
    out.push({
      wallet_address: `K${Math.floor(rng() * 1e12).toString(16).slice(0, 8)}...${Math.floor(rng() * 1e8).toString(16).slice(0, 4)}`,
      wallet_label: kol.name,
      wallet_tags: ["renowned"],
      token_address: addr,
      token_symbol: sym,
      type: isBuy ? "buy" : "sell",
      ts: Math.floor(ts / 1000),
      amount_usd: Math.round(rng() * 50_000 + 200),
      amount_token: Number((rng() * 20000).toFixed(2)),
      price: Number((rng() * 5).toFixed(4)),
      price_change_since: Number((rng() * 4).toFixed(2)),
      is_open_or_close: rng() > 0.7,
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get("chain") || "sol";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);

  try {
    const trades = await fetchKolTrades(chain, limit);
    if (trades && trades.length > 0) {
      return NextResponse.json({
        trades,
        count: trades.length,
        source: "gmgn",
        chain,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = [];
  return NextResponse.json({
    trades: fallback,
    count: fallback.length,
    source: "error",
    chain,
    timestamp: Date.now(),
    note: "GMGN CLI unavailable — showing simulated KOL feed.",
  });
}
