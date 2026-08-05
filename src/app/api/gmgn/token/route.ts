import { NextRequest, NextResponse } from "next/server";
import { fetchTokenInfo, fetchSecurity, type GmgnTokenInfo, type GmgnSecurity } from "@/lib/gmgn";
import { rateLimit, errors } from "@/lib/api-rate-limiter";

/**
 * GET /api/gmgn/token?address=<mint>
 *
 * Returns comprehensive token metadata from GMGN: price, market cap, liquidity,
 * volume, holders, supply, top-10 holder rate, dev holdings, social links, etc.
 *
 * Response shape:
 *   { token: GmgnTokenInfo, security?: GmgnSecurity, source: "gmgn" | "simulated", address }
 */

const RATE_LIMIT_CONFIG = {
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: 'gmgn:token',
};

// Fallback: synthesize a reasonable token info from address hash + known token list
function fallbackToken(address: string): { token: GmgnTokenInfo; source: "simulated" } {
  // Hash address for deterministic pseudo-random values
  let seed = 0;
  for (let i = 0; i < address.length; i++) seed = (seed * 31 + address.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const marketCap = Math.round(50_000 + rng() * 5_000_000);
  const price = marketCap / 1_000_000_000;
  const liquidity = Math.round(marketCap * (0.1 + rng() * 0.3));

  return {
    token: {
      address,
      symbol: address.slice(0, 4).toUpperCase(),
      name: `Token ${address.slice(0, 6)}`,
      decimals: 9,
      price,
      price_change_1h: Number(((rng() - 0.5) * 10).toFixed(2)),
      price_change_24h: Number(((rng() - 0.4) * 50).toFixed(2)),
      volume_24h: Math.round(marketCap * (0.2 + rng() * 0.8)),
      market_cap: marketCap,
      fdv: marketCap,
      liquidity,
      holders: Math.round(50 + rng() * 5000),
      total_supply: 1_000_000_000,
      top_10_holder_rate: Number((15 + rng() * 40).toFixed(2)),
      dev_holder_rate: Number((rng() * 20).toFixed(2)),
      create_timestamp: Date.now() / 1000 - rng() * 86400 * 30,
      last_trade_timestamp: Date.now() / 1000,
      tx_24h_buy: Math.round(rng() * 5000),
      tx_24h_sell: Math.round(rng() * 5000),
      is_alive: true,
    },
    source: "simulated",
  };
}

export async function GET(req: NextRequest) {
  // Rate limiting
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
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', rateLimitResult.info.limit.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.info.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.info.resetTime / 1000).toString());
      
      return response;
    }
  } catch (error) {
    console.error('[token] GMGN fetch failed:', error);
    // fall through to fallback
  }

  // Fallback
  const { token: fallback, source } = fallbackToken(address);
  const response = NextResponse.json({
    token: fallback,
    security: undefined,
    source,
    address,
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated data.",
  });
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', rateLimitResult.info.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.info.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.info.resetTime / 1000).toString());
  
  return response;
}
