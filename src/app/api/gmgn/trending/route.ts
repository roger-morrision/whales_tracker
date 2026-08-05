import { NextRequest, NextResponse } from "next/server";
import { fetchTrending, type GmgnTrendingToken } from "@/lib/gmgn";
import { rateLimit, errors, createHealthResponse } from "@/lib/api-rate-limiter";

/**
 * GET /api/gmgn/trending?timeframe=1h&orderBy=volume&limit=30
 *
 * Returns trending tokens from GMGN by swaps in the given timeframe.
 * timeframes: 1m, 5m, 1h, 6h, 24h
 * orderBy: volume, tx_count, market_cap, smart_money
 */

// Rate limit config: 60 requests per minute per IP
const RATE_LIMIT_CONFIG = {
  windowMs: 60_000,
  maxRequests: 60,
  keyPrefix: 'gmgn:trending',
};

function fallbackTrending(timeframe: string, orderBy: string, limit: number): GmgnTrendingToken[] {
  const SYMBOLS = [
    ["BONK", "Bonk", "from-[#FFA500] to-[#FF6347]"],
    ["WIF", "dogwifhat", "from-[#F5B7B1] to-[#E8DAEF]"],
    ["POPCAT", "Popcat", "from-[#FFD700] to-[#FF8C00]"],
    ["MEW", "cat in a dogs world", "from-[#FFB6C1] to-[#FF69B4]"],
    ["MUMU", "Mumu", "from-[#90EE90] to-[#3CB371]"],
    ["BOME", "Book of Meme", "from-[#9370DB] to-[#4B0082]"],
    ["SLERF", "Slerf", "from-[#FF6347] to-[#DC143C]"],
    ["MYRO", "Myro", "from-[#FFA07A] to-[#FA8072]"],
    ["NAP", "Napcoin", "from-[#87CEEB] to-[#4682B4]"],
    ["PONKE", "Ponke", "from-[#FFD700] to-[#FFA500]"],
    ["HARAMBE", "Harambe", "from-[#8B4513] to-[#A0522D]"],
    ["MOBILE", "Helium Mobile", "from-[#00CED1] to-[#008B8B]"],
  ];

  let seed = Math.floor(Date.now() / 60_000); // changes every minute
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const out: GmgnTrendingToken[] = [];
  for (let i = 0; i < limit; i++) {
    const [symbol, name] = SYMBOLS[i % SYMBOLS.length];
    const marketCap = Math.round(50_000 + rng() * 50_000_000);
    const price = marketCap / 1_000_000_000;
    out.push({
      address: `${symbol.slice(0, 4)}${Math.floor(rng() * 1e12).toString(16).slice(0, 24)}${Math.floor(rng() * 1e8).toString(16).slice(0, 8)}`,
      symbol,
      name,
      decimals: 9,
      price,
      price_change_1h: Number(((rng() - 0.4) * 30).toFixed(2)),
      price_change_24h: Number(((rng() - 0.3) * 100).toFixed(2)),
      volume_24h: Math.round(marketCap * (0.5 + rng() * 1.5)),
      market_cap: marketCap,
      fdv: marketCap,
      liquidity: Math.round(marketCap * (0.1 + rng() * 0.3)),
      holders: Math.round(50 + rng() * 20000),
      total_supply: 1_000_000_000,
      top_10_holder_rate: Number((10 + rng() * 40).toFixed(2)),
      dev_holder_rate: Number((rng() * 15).toFixed(2)),
      create_timestamp: Date.now() / 1000 - rng() * 86400 * 30,
      last_trade_timestamp: Date.now() / 1000 - rng() * 600,
      tx_24h_buy: Math.round(rng() * 50000),
      tx_24h_sell: Math.round(rng() * 50000),
      is_alive: true,
      rank: i + 1,
      chain: "SOL",
      swaps_24h: Math.round(rng() * 100000),
      buyers_24h: Math.round(rng() * 30000),
      sellers_24h: Math.round(rng() * 30000),
      smart_money_holders: Math.round(rng() * 200),
      smart_money_inflow_24h: Math.round((rng() - 0.4) * 5_000_000),
    });
  }

  // Sort by orderBy
  if (orderBy === "tx_count") out.sort((a, b) => (b.swaps_24h ?? 0) - (a.swaps_24h ?? 0));
  else if (orderBy === "market_cap") out.sort((a, b) => b.market_cap - a.market_cap);
  else if (orderBy === "smart_money") out.sort((a, b) => (b.smart_money_inflow_24h ?? 0) - (a.smart_money_inflow_24h ?? 0));
  else out.sort((a, b) => b.volume_24h - a.volume_24h);

  // Re-rank
  out.forEach((t, i) => (t.rank = i + 1));
  return out;
}

export async function GET(req: NextRequest) {
  // Rate limiting
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
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', rateLimitResult.info.limit.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.info.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.info.resetTime / 1000).toString());
      
      return response;
    }
  } catch (error) {
    console.error('[trending] GMGN fetch failed:', error);
    // Fall through to simulated data
  }

  const fallback = fallbackTrending(timeframe, orderBy, limit);
  const response = NextResponse.json({
    tokens: fallback,
    count: fallback.length,
    timeframe,
    orderBy,
    source: "simulated",
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated trending tokens.",
  });
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', rateLimitResult.info.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.info.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.info.resetTime / 1000).toString());
  
  return response;
}
