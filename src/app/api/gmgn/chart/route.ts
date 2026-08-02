import { NextRequest, NextResponse } from "next/server";
import { fetchCandles, type GmgnCandle } from "@/lib/gmgn";

/**
 * GET /api/gmgn/chart?address=<mint>&resolution=15m&limit=200
 *
 * Returns OHLCV candle data from GMGN.
 * Resolutions: 1m, 5m, 15m, 1h, 4h, 1d
 */

function fallbackCandles(address: string, resolution: string, limit: number): GmgnCandle[] {
  let seed = 0;
  for (let i = 0; i < address.length; i++) seed = (seed * 31 + address.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const now = Math.floor(Date.now() / 1000);
  const stepSec =
    resolution === "1m" ? 60 :
    resolution === "5m" ? 300 :
    resolution === "15m" ? 900 :
    resolution === "1h" ? 3600 :
    resolution === "4h" ? 14400 :
    86400;

  const candles: GmgnCandle[] = [];
  let price = 0.5 + rng() * 5;
  let trend = (rng() - 0.5) * 0.02;

  for (let i = limit - 1; i >= 0; i--) {
    const t = now - i * stepSec;
    // Random walk with drift
    const volatility = price * 0.015;
    const change = (rng() - 0.5) * volatility * 2 + trend * price;
    const open = price;
    const close = Math.max(0.0001, open + change);
    const high = Math.max(open, close) * (1 + rng() * 0.005);
    const low = Math.min(open, close) * (1 - rng() * 0.005);
    const volume = Math.round(rng() * 500_000 + 10_000);
    candles.push({
      t,
      o: Number(open.toFixed(6)),
      h: Number(high.toFixed(6)),
      l: Number(low.toFixed(6)),
      c: Number(close.toFixed(6)),
      v: volume,
    });
    price = close;
    // Occasionally flip trend
    if (rng() > 0.92) trend = (rng() - 0.5) * 0.03;
  }
  return candles;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const resolution = (req.nextUrl.searchParams.get("resolution") || "15m") as
    | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "200", 10), 1000);
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  try {
    const candles = await fetchCandles(address, resolution, limit);
    if (candles && candles.length > 0) {
      return NextResponse.json({
        candles,
        count: candles.length,
        resolution,
        source: "gmgn",
        address,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  const fallback = fallbackCandles(address, resolution, limit);
  return NextResponse.json({
    candles: fallback,
    count: fallback.length,
    resolution,
    source: "simulated",
    address,
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated chart data.",
  });
}
