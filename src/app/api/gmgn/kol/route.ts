import { NextRequest, NextResponse } from "next/server";
import { fetchKolHolders, type GmgnKolHolder } from "@/lib/gmgn";

/**
 * GET /api/gmgn/kol?address=<mint>&limit=30
 *
 * Returns KOL (Key Opinion Leader) holders of a token from GMGN.
 * Includes Twitter handle, follower count, balance, buy USD, PnL.
 */

const SAMPLE_TWITTERS = [
  { handle: "DegenSpartan", name: "Degen Spartan", followers: 184_000 },
  { handle: "HsakaTrades", name: "Hsaka", followers: 312_000 },
  { handle: "CryptoCobain", name: "Cobie", followers: 742_000 },
  { handle: "LightCrypto", name: "Light", followers: 145_000 },
  { handle: "Pentosh1", name: "Pentoshi", followers: 521_000 },
  { handle: "CoinMamba", name: "CoinMamba", followers: 92_000 },
  { handle: "0xMert", name: "Mert", followers: 168_000 },
  { handle: "Bluntz_Capital", name: "Bluntz", followers: 84_000 },
  { handle: "CryptoCapo", name: "Capo", followers: 234_000 },
  { handle: "PumpCapital", name: "Pump Capital", followers: 67_000 },
];

function fallbackKols(address: string, limit: number): GmgnKolHolder[] {
  let seed = 0;
  for (let i = 0; i < address.length; i++) seed = (seed * 31 + address.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const kols: GmgnKolHolder[] = [];
  for (let i = 0; i < limit; i++) {
    const t = SAMPLE_TWITTERS[i % SAMPLE_TWITTERS.length];
    const balance = Math.round(rng() * 1_000_000 + 1000);
    const buyUsd = Math.round(rng() * 100_000 + 500);
    const pnlUsd = Math.round((rng() - 0.4) * 300_000);
    kols.push({
      address: `K${Math.floor(rng() * 1e12).toString(16).slice(0, 8)}...${Math.floor(rng() * 1e8).toString(16).slice(0, 4)}`,
      twitter_handle: t.handle.trim(),
      twitter_name: t.name,
      followers: t.followers + Math.floor(rng() * 5000),
      balance,
      value_usd: Math.round(balance * 0.5),
      buy_usd: buyUsd,
      avg_buy_price: Number((0.1 + rng() * 2).toFixed(4)),
      pnl_usd: pnlUsd,
      last_buy_ts: Math.floor(Date.now() / 1000) - Math.round(rng() * 86400 * 14),
    });
  }
  return kols.sort((a, b) => b.value_usd - a.value_usd);
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  try {
    const kols = await fetchKolHolders(address, limit);
    if (kols && kols.length > 0) {
      return NextResponse.json({
        kols,
        count: kols.length,
        source: "gmgn",
        address,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackKols(address, limit);
  return NextResponse.json({
    kols: fallback,
    count: fallback.length,
    source: "simulated",
    address,
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated KOL data.",
  });
}
