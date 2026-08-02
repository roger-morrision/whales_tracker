import { NextRequest, NextResponse } from "next/server";
import { fetchTopHolders, type GmgnHolder } from "@/lib/gmgn";

/**
 * GET /api/gmgn/holders?address=<mint>&limit=20
 *
 * Returns top token holders from GMGN with smart-money/KOL/dev/whale tags.
 */

function fallbackHolders(address: string, limit: number): GmgnHolder[] {
  let seed = 0;
  for (let i = 0; i < address.length; i++) seed = (seed * 31 + address.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const totalSupply = 1_000_000_000;
  const holders: GmgnHolder[] = [];
  let remainingPct = 100;

  for (let i = 0; i < limit && remainingPct > 0.1; i++) {
    const pct = i === 0
      ? Number((5 + rng() * 15).toFixed(2))
      : Number((remainingPct * (0.3 + rng() * 0.4)).toFixed(2));
    if (pct < 0.01) break;
    remainingPct -= pct;
    const balance = Math.round((pct / 100) * totalSupply);
    const tags: string[] = [];
    const isDev = i === 0 && rng() > 0.5;
    const isSmart = rng() > 0.85;
    const isKol = rng() > 0.92;
    const isWhale = pct > 3;
    if (isDev) tags.push("dev");
    if (isSmart) tags.push("smart_money");
    if (isKol) tags.push("kol");
    if (isWhale) tags.push("whale");
    holders.push({
      address: `${address.slice(0, 4)}${Math.floor(rng() * 1e10).toString(16).slice(0, 6)}...${address.slice(-4)}`,
      balance,
      value_usd: Math.round(balance * 0.5),
      holder_rate: pct,
      is_dev: isDev,
      is_top10: i < 10,
      is_smart_money: isSmart,
      is_kol: isKol,
      tags,
    });
  }
  return holders;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 100);
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  try {
    const holders = await fetchTopHolders(address, limit);
    if (holders && holders.length > 0) {
      return NextResponse.json({
        holders,
        count: holders.length,
        source: "gmgn",
        address,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackHolders(address, limit);
  return NextResponse.json({
    holders: fallback,
    count: fallback.length,
    source: "simulated",
    address,
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated holder data.",
  });
}
