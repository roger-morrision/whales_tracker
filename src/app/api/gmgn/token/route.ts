import { NextRequest, NextResponse } from "next/server";
import { fetchTokenInfo, fetchSecurity } from "@/lib/gmgn";
import { rateLimit } from "@/lib/api-rate-limiter";

/**
 * GET /api/gmgn/token?address=<mint>
 *
 * Returns comprehensive token metadata from GMGN: price, market cap, liquidity,
 * volume, holders, supply, top-10 holder rate, dev holdings, social links, etc.
 */

const RATE_LIMIT_CONFIG = {
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "gmgn:token",
};

export async function GET(req: NextRequest) {
  const rateLimitResult = await rateLimit(req, RATE_LIMIT_CONFIG);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9]{32,44}$/.test(address)) {
    return NextResponse.json({ error: "Invalid Solana mint address" }, { status: 400 });
  }

  try {
    const [token, security] = await Promise.all([
      fetchTokenInfo(address),
      fetchSecurity(address),
    ]);

    if (token) {
      const response = NextResponse.json({
        token,
        security: security ?? undefined,
        source: "gmgn",
        address,
        timestamp: Date.now(),
      });

      response.headers.set("X-RateLimit-Limit", rateLimitResult.info.limit.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimitResult.info.remaining.toString());
      response.headers.set("X-RateLimit-Reset", Math.ceil(rateLimitResult.info.resetTime / 1000).toString());

      return response;
    }
  } catch (error) {
    console.error("[token] GMGN fetch failed:", error);
  }

  const response = NextResponse.json({
    token: null,
    security: null,
    source: "error",
    address,
    timestamp: Date.now(),
    note: "Live GMGN token data is currently unavailable.",
  }, { status: 503 });

  response.headers.set("X-RateLimit-Limit", rateLimitResult.info.limit.toString());
  response.headers.set("X-RateLimit-Remaining", rateLimitResult.info.remaining.toString());
  response.headers.set("X-RateLimit-Reset", Math.ceil(rateLimitResult.info.resetTime / 1000).toString());

  return response;
}
