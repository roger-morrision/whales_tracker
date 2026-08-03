import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/gmgn";

/**
 * GET /api/solana/gainers?limit=20&timeframe=24h
 *
 * Returns real top gainers on Solana from DexScreener search.
 * timeframe: "1h" | "6h" | "24h"
 */

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 50);
  const timeframe = req.nextUrl.searchParams.get("timeframe") || "24h";

  try {
    // DexScreener doesn't have a direct "gainers" endpoint, but we can search
    // for "SOL" on solana chain and sort by price change
    const data = await fetchJson("https://api.dexscreener.com/token-boosts/top/v1");
    if (!Array.isArray(data)) {
      return NextResponse.json({ tokens: [], source: "error" });
    }

    const solTokens = data.filter((t: any) => t.chainId === "solana").slice(0, limit * 3);

    const results: any[] = [];
    for (const t of solTokens) {
      if (results.length >= limit * 2) break;
      const pairData = await fetchJson(
        `https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`
      );
      if (!pairData?.pairs?.length) continue;
      const solPairs = pairData.pairs.filter((p: any) => p.chainId === "solana");
      const p = (solPairs.length > 0 ? solPairs : pairData.pairs).sort(
        (a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];
      if (!p) continue;

      const change = timeframe === "1h" ? (p.priceChange?.h1 ?? 0) :
                     timeframe === "6h" ? (p.priceChange?.h6 ?? 0) :
                     (p.priceChange?.h24 ?? 0);

      results.push({
        address: t.tokenAddress,
        symbol: p.baseToken?.symbol ?? "",
        name: p.baseToken?.name ?? "",
        price: parseFloat(p.priceUsd ?? "0"),
        change_1h: p.priceChange?.h1 ?? 0,
        change_6h: p.priceChange?.h6 ?? 0,
        change_24h: p.priceChange?.h24 ?? 0,
        volume_24h: p.volume?.h24 ?? 0,
        market_cap: p.marketCap ?? p.fdv ?? 0,
        liquidity: p.liquidity?.usd ?? 0,
        txns_24h_buys: p.txns?.h24?.buys ?? 0,
        txns_24h_sells: p.txns?.h24?.sells ?? 0,
        pair_url: p.url,
        dex: p.dexId,
        image_uri: t.icon,
      });
    }

    // Sort by change descending (top gainers)
    const changeField = timeframe === "1h" ? "change_1h" : timeframe === "6h" ? "change_6h" : "change_24h";
    results.sort((a, b) => b[changeField] - a[changeField]);

    return NextResponse.json({
      tokens: results.slice(0, limit),
      count: results.length,
      timeframe,
      source: "dexscreener",
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ tokens: [], count: 0, source: "error" });
  }
}
