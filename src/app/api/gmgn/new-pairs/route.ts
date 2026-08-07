import { NextRequest, NextResponse } from "next/server";
import { fetchNewPairs, fetchTrenches } from "@/lib/gmgn";

/**
 * GET /api/gmgn/new-pairs?limit=30&type=new_creation
 *
 * type: "new_creation" (default), "near_completion", "completed"
 *
 * Returns recently-launched token pairs from GMGN.
 */

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);
  const type = (req.nextUrl.searchParams.get("type") || "new_creation") as
    | "new_creation" | "near_completion" | "completed";

  if (type !== "new_creation") {
    try {
      const trenches = await fetchTrenches(type, "sol", limit);
      if (trenches && trenches.length > 0) {
        return NextResponse.json({
          tokens: trenches,
          count: trenches.length,
          type,
          source: "gmgn",
          timestamp: Date.now(),
        });
      }
    } catch {
      // fall through
    }
  }

  try {
    const pairs = await fetchNewPairs(limit);
    if (pairs && pairs.length > 0) {
      return NextResponse.json({
        tokens: pairs,
        count: pairs.length,
        type,
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
    type,
    source: "error",
    timestamp: Date.now(),
    note: "Live GMGN new pairs are currently unavailable.",
  }, { status: 503 });
}
