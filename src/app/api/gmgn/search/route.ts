import { NextRequest, NextResponse } from "next/server";
import { searchTokens, type GmgnTrendingToken } from "@/lib/gmgn";

/**
 * GET /api/gmgn/search?q=<query>&limit=10
 *
 * Searches Solana tokens by symbol or name via DexScreener (real data, no auth).
 * Returns GmgnTrendingToken[] shaped results.
 */

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10), 50);
  if (!q || q.trim().length < 1) {
    return NextResponse.json({ tokens: [], count: 0, source: "gmgn" });
  }

  try {
    const results = await searchTokens(q.trim(), limit);
    if (results && results.length > 0) {
      return NextResponse.json({
        tokens: results,
        count: results.length,
        query: q,
        source: "gmgn",
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  return NextResponse.json({
    tokens: [],
    count: 0,
    query: q,
    source: "gmgn",
    timestamp: Date.now(),
    note: "No results or DexScreener unavailable.",
  });
}
