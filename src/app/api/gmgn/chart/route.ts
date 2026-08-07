import { NextRequest, NextResponse } from "next/server";
import { fetchCandles } from "@/lib/gmgn";

/**
 * GET /api/gmgn/chart?address=<mint>&resolution=15m&limit=200
 *
 * Returns OHLCV candle data from GMGN.
 * Resolutions: 1m, 5m, 15m, 1h, 4h, 1d
 */

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

  return NextResponse.json({
    candles: [],
    count: 0,
    resolution,
    source: "error",
    address,
    timestamp: Date.now(),
    note: "Live GMGN chart data is currently unavailable.",
  }, { status: 503 });
}
