import { NextRequest, NextResponse } from "next/server";
import { fetchWalletActivity, type GmgnWalletActivity } from "@/lib/gmgn";

/**
 * GET /api/gmgn/wallet-activity?wallet=<address>&limit=30&chain=sol
 *
 * Returns the wallet's recent on-chain activity (buys/sells/transfers).
 */

function fallbackActivity(wallet: string, limit: number): GmgnWalletActivity[] {
  let seed = 0;
  for (let i = 0; i < wallet.length; i++) seed = (seed * 31 + wallet.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const out: GmgnWalletActivity[] = [];
  let ts = Date.now();
  const symbols = ["SOL", "WIF", "JUP", "BONK", "MNGO", "IO"];
  for (let i = 0; i < limit; i++) {
    ts -= Math.round(rng() * 1800_000 + 60_000);
    const isBuy = rng() > 0.45;
    out.push({
      hash: `${wallet.slice(0, 4)}${Math.floor(rng() * 1e12).toString(16).slice(0, 16)}`,
      ts: Math.floor(ts / 1000),
      type: isBuy ? "buy" : "sell",
      token_address: `Token${Math.floor(rng() * 6)}`,
      token_symbol: symbols[Math.floor(rng() * symbols.length)],
      amount: Number((rng() * 10000).toFixed(2)),
      value_usd: Math.round(rng() * 50_000 + 100),
      price: Number((rng() * 5).toFixed(4)),
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);
  const chain = req.nextUrl.searchParams.get("chain") || "sol";
  if (!wallet) {
    return NextResponse.json({ error: "Missing 'wallet' parameter" }, { status: 400 });
  }

  try {
    const activity = await fetchWalletActivity(wallet, limit, chain);
    if (activity && activity.length > 0) {
      return NextResponse.json({
        activity,
        count: activity.length,
        source: "gmgn",
        wallet,
        chain,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackActivity(wallet, limit);
  return NextResponse.json({
    activity: fallback,
    count: fallback.length,
    source: "simulated",
    wallet,
    chain,
    timestamp: Date.now(),
    note: "GMGN CLI unavailable — showing simulated activity.",
  });
}
