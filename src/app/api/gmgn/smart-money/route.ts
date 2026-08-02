import { NextRequest, NextResponse } from "next/server";
import { fetchSmartMoneyActivity, type GmgnSmartMoneyActivity } from "@/lib/gmgn";

/**
 * GET /api/gmgn/smart-money?address=<mint>&limit=30
 *
 * Returns recent smart-money wallet activity (buys/sells) for a token.
 * Each entry includes the wallet tag (smart money / KOL / celebrity / fund).
 */

function fallbackActivity(address: string, limit: number): GmgnSmartMoneyActivity[] {
  let seed = 0;
  for (let i = 0; i < address.length; i++) seed = (seed * 31 + address.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const tags = ["Smart Wallet #4218", "Whale: 0xMoby", "KOL: DegenDiva", "Smart Wallet #9821", "Fund: Sparta"];
  const out: GmgnSmartMoneyActivity[] = [];
  let ts = Date.now();
  for (let i = 0; i < limit; i++) {
    ts -= Math.round(rng() * 1800_000 + 60_000);
    const isBuy = rng() > 0.4;
    const amountUsd = Math.round(rng() * 50_000 + 500);
    out.push({
      address: `S${Math.floor(rng() * 1e12).toString(16).slice(0, 8)}...${Math.floor(rng() * 1e8).toString(16).slice(0, 4)}`,
      type: isBuy ? "buy" : "sell",
      amount_usd: amountUsd,
      amount_token: Number((amountUsd / 0.5).toFixed(2)),
      ts: Math.floor(ts / 1000),
      wallet_tag: ["smart_money", "kol", "celebrity", "fund"][Math.floor(rng() * 4)],
      wallet_label: tags[Math.floor(rng() * tags.length)],
      pnl_30d_usd: Math.round((rng() - 0.3) * 500_000),
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  try {
    const activity = await fetchSmartMoneyActivity(address, limit);
    if (activity && activity.length > 0) {
      return NextResponse.json({
        activity,
        count: activity.length,
        source: "gmgn",
        address,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackActivity(address, limit);
  return NextResponse.json({
    activity: fallback,
    count: fallback.length,
    source: "simulated",
    address,
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated smart money activity.",
  });
}
