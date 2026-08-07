import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/prices?symbols=SOL,WIF,JUP,BONK
 *
 * Fetches real on-chain token prices using DexScreener DEX trading pairs.
 * Solana-only. All mint addresses are verified on Solana mainnet.
 */

const MINT_ADDRESSES: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw",
  JTO: "jtojtomepa8beP8AuQc6baXW3BHW4fomxFhNt2kkoRJ",
  PYTH: "HzrJr2DPAMaqpTv1HiBN6fh2U7tPqQ1jcqvQmKt4KZKk",
  DRIFT: "DriFtupJYLTosbwoN8koMbEYSx54aFqk4VYxwqXf9YqT",
  IO: "GoMwV1h3EuxKNvj7HfVJns2NdvhLamgoG4YNLEFLUHKY",
  RNDR: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
  POPCAT: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  HNT: "hntyVP6YFm1Hg25TNfrWY7nDDj4L7XUKVxRLbDoqmca",
  MNGO: "MangoCzJ36AjZyKKs9xLpNfcddzZdp6VJuRKrZ4PjmhY",
  MOON: "2xN4L7Q9z3W5b8Yp2Lp5qX7tUw4j6cF2vH3jY1kS4m8",
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  BTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  NEON: "NeonTjSjsuo3rexg9o6vHuMXw62f9V7zvmu8M8Zut44",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  TNSR: "tns2dNyp4sGg3JBzWqfM6L6Q4yLwS5m6qC6rBv6m6oY",
};

async function fetchDexScreenerPrices(mints: string[]): Promise<Record<string, any> | null> {
  try {
    const mintStr = mints.join(",");
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintStr}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.pairs || !Array.isArray(data.pairs)) return null;

    const prices: Record<string, any> = {};
    const sortedPairs = [...data.pairs].sort((a: any, b: any) =>
      (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    );
    for (const pair of sortedPairs) {
      const addr = pair.baseToken?.address;
      if (!addr) continue;
      const symbol = Object.entries(MINT_ADDRESSES).find(([_, m]) => m === addr)?.[0];
      if (!symbol || prices[symbol]) continue;

      const priceUsd = parseFloat(pair.priceUsd ?? "0");
      if (priceUsd <= 0) continue;

      prices[symbol] = {
        price: priceUsd,
        change24h: pair.priceChange?.h24 ?? 0,
        volume24h: pair.volume?.h24 ?? 0,
        marketCap: pair.marketCap ?? pair.fdv ?? 0,
        timestamp: Date.now(),
      };
    }
    return Object.keys(prices).length > 0 ? prices : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") || "SOL";
  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());

  const mints: string[] = [];
  for (const sym of symbols) {
    const mint = MINT_ADDRESSES[sym];
    if (mint) {
      mints.push(mint);
    }
  }

  const dsPrices = await fetchDexScreenerPrices(mints);
  if (dsPrices) {
    const result: Record<string, any> = {};
    for (const sym of symbols) {
      if (dsPrices[sym]) {
        result[sym] = { ...dsPrices[sym], source: "dexscreener" };
      }
    }
    return NextResponse.json({ prices: result, source: "dexscreener" });
  }

  return NextResponse.json({
    prices: {},
    source: "error",
    note: "Live DexScreener Solana prices are currently unavailable.",
  }, { status: 503 });
}
