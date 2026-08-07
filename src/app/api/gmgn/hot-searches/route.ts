import { NextRequest, NextResponse } from "next/server";
import { fetchHotSearches } from "@/lib/gmgn";

/**
 * GET /api/gmgn/hot-searches?chain=sol&interval=1h&limit=20
 *
 * Returns the most-searched tokens on gmgn.ai.
 */

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

  return NextResponse.json({
    hotSearches: [],
    count: 0,
    source: "error",
    chains,
    interval,
    timestamp: Date.now(),
    note: "Live GMGN hot searches are currently unavailable.",
  }, { status: 503 });
}
