import { NextRequest, NextResponse } from "next/server";
import { fetchTopHolders } from "@/lib/gmgn";

/**
 * GET /api/gmgn/holders?address=<mint>&limit=20
 *
 * Returns top token holders from GMGN with smart-money/KOL/dev/whale tags.
 */

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

  return NextResponse.json({
    holders: [],
    count: 0,
    source: "error",
    address,
    timestamp: Date.now(),
    note: "Live GMGN holder data is currently unavailable.",
  }, { status: 503 });
}
