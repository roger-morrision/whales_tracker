import { NextRequest, NextResponse } from "next/server";
import { fetchSmartMoneyTrades } from "@/lib/gmgn";

/**
 * GET /api/gmgn/smart-money-feed?chain=sol&limit=30
 *
 * Returns recent trades from GMGN-tagged smart money wallets (not token-specific).
 * Differs from /api/gmgn/smart-money?address=<token> which is per-token.
 */

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get("chain") || "sol";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);

  try {
    const trades = await fetchSmartMoneyTrades(chain, limit);
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

  return NextResponse.json({
    trades: [],
    count: 0,
    source: "error",
    chain,
    timestamp: Date.now(),
    note: "Live GMGN smart money feed is currently unavailable.",
  }, { status: 503 });
}
