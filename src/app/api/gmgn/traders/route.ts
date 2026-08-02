import { NextRequest, NextResponse } from "next/server";
import { fetchTopTraders, type GmgnTrader } from "@/lib/gmgn";

/**
 * GET /api/gmgn/traders?address=<mint>&limit=20
 *
 * Returns top traders (by PnL) for a given token from GMGN.
 * Includes smart-money / KOL tags where applicable.
 */

function fallbackTraders(address: string, limit: number): GmgnTrader[] {
  let seed = 0;
  for (let i = 0; i < address.length; i++) seed = (seed * 31 + address.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const traders: GmgnTrader[] = [];
  for (let i = 0; i < limit; i++) {
    const isWin = rng() > 0.35;
    const pnl = isWin ? Math.round(rng() * 250_000) : -Math.round(rng() * 80_000);
    const buyUsd = Math.round(rng() * 100_000 + 1000);
    const sellUsd = Math.round(buyUsd * (0.5 + rng() * 0.8));
    const isSmart = rng() > 0.85;
    const isKol = rng() > 0.93;
    const tags: string[] = [];
    if (isSmart) tags.push("smart_money");
    if (isKol) tags.push("kol");
    traders.push({
      address: `T${Math.floor(rng() * 1e12).toString(16).slice(0, 8)}...${Math.floor(rng() * 1e8).toString(16).slice(0, 4)}`,
      pnl,
      pnl_rate: Number(((pnl / buyUsd) * 100).toFixed(1)),
      buy_usd: buyUsd,
      sell_usd: sellUsd,
      tx_count: Math.round(rng() * 50 + 1),
      is_smart_money: isSmart,
      is_kol: isKol,
      first_buy_time: Date.now() / 1000 - rng() * 86400 * 7,
      last_active_time: Date.now() / 1000 - rng() * 3600,
      tags,
    });
  }
  return traders.sort((a, b) => b.pnl - a.pnl);
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 100);
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  try {
    const traders = await fetchTopTraders(address, limit);
    if (traders && traders.length > 0) {
      return NextResponse.json({
        traders,
        count: traders.length,
        source: "gmgn",
        address,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackTraders(address, limit);
  return NextResponse.json({
    traders: fallback,
    count: fallback.length,
    source: "simulated",
    address,
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated trader data.",
  });
}
