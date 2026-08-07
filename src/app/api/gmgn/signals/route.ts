import { NextRequest, NextResponse } from "next/server";
import { fetchMarketSignals } from "@/lib/gmgn";

/**
 * GET /api/gmgn/signals?chain=sol&limit=30
 *
 * Returns market signals (smart money entries, large buys, price spikes, new listings).
 */

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

  return NextResponse.json({
    signals: [],
    count: 0,
    source: "error",
    chain,
    timestamp: Date.now(),
    note: "Live GMGN Solana signals are currently unavailable.",
  }, { status: 503 });
}
