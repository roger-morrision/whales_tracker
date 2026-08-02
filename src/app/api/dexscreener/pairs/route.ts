import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/gmgn";

/**
 * GET /api/dexscreener/pairs?address=<mint>&chain=solana
 *
 * Returns ALL pairs (across DEXes) for a token, not just the highest-liquidity one.
 * Used by the multi-pair "All DEXes" tile view in token-detail-sheet.
 */

export interface DexScreenerPair {
  pairAddress: string;
  dexId: string;
  chainId: string;
  url: string;
  labels: string[];
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: { m5: number; h1: number; h6: number; h24: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { url: string; label?: string }[];
    socials?: { type: string; url: string }[];
  };
  boosts?: { active: number };
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const chainFilter = req.nextUrl.searchParams.get("chain") || "solana";
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  try {
    const data = await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    );
    if (!data || !Array.isArray(data.pairs)) {
      return NextResponse.json({ pairs: [], count: 0, source: "dexscreener" });
    }

    // Filter to specified chain (default solana)
    const chainPairs = data.pairs.filter((p: any) => p.chainId === chainFilter);
    const pairs = (chainPairs.length > 0 ? chainPairs : data.pairs) as DexScreenerPair[];

    // Sort by liquidity descending
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    return NextResponse.json({
      pairs: pairs.slice(0, 10), // top 10
      count: pairs.length,
      chain: chainFilter,
      source: "dexscreener",
      address,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({
      pairs: [],
      count: 0,
      source: "error",
      note: "DexScreener API unavailable.",
    });
  }
}
