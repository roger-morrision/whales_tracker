import { NextRequest, NextResponse } from "next/server";
import { fetchTrending } from "@/lib/gmgn";
import { rateLimit } from "@/lib/api-rate-limiter";

/**
 * GET /api/gmgn/trending?timeframe=1h&orderBy=volume&limit=30
 *
 * Returns trending tokens from GMGN by swaps in the given timeframe.
 * timeframes: 1m, 5m, 1h, 6h, 24h
 * orderBy: volume, tx_count, market_cap, smart_money
 */

const RATE_LIMIT_CONFIG = {
  windowMs: 60_000,
  maxRequests: 60,
  keyPrefix: "gmgn:trending",
};

export async function GET(req: NextRequest) {
  const rateLimitResult = await rateLimit(req, RATE_LIMIT_CONFIG);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  const timeframe = (req.nextUrl.searchParams.get("timeframe") || "1h") as "1m" | "5m" | "1h" | "6h" | "24h";
  const orderBy = (req.nextUrl.searchParams.get("orderBy") || "volume") as "volume" | "tx_count" | "market_cap" | "smart_money";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30", 10), 100);

  try {
    const trending = await fetchTrending(timeframe, orderBy, limit);
    if (trending && trending.length > 0) {
      const response = NextResponse.json({
        tokens: trending,
        count: trending.length,
        timeframe,
        orderBy,
        source: "gmgn",
        timestamp: Date.now(),
      });

      response.headers.set("X-RateLimit-Limit", rateLimitResult.info.limit.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimitResult.info.remaining.toString());
      response.headers.set("X-RateLimit-Reset", Math.ceil(rateLimitResult.info.resetTime / 1000).toString());

      return response;
    }
  } catch (error) {
    console.error("[trending] GMGN fetch failed:", error);
  }

  const response = NextResponse.json({
    tokens: [],
    count: 0,
    timeframe,
    orderBy,
    source: "error",
    timestamp: Date.now(),
    note: "Live GMGN trending tokens are currently unavailable.",
  }, { status: 503 });

  response.headers.set("X-RateLimit-Limit", rateLimitResult.info.limit.toString());
  response.headers.set("X-RateLimit-Remaining", rateLimitResult.info.remaining.toString());
  response.headers.set("X-RateLimit-Reset", Math.ceil(rateLimitResult.info.resetTime / 1000).toString());

  return response;
}
