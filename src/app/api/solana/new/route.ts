import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/gmgn";

/**
 * GET /api/solana/new?limit=20
 *
 * Returns newest Solana token pairs from DexScreener (latest boosted tokens).
 */

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 50);

  try {
    // Fetch latest boosted tokens (recently boosted = recently launched)
    const data = await fetchJson("https://api.dexscreener.com/token-boosts/latest/v1");
    if (!Array.isArray(data)) {
      return NextResponse.json({ tokens: [], source: "error" });
    }

    const solTokens = data.filter((t: any) => t.chainId === "solana").slice(0, limit * 3);

    const results: any[] = [];
    const pairResults = await Promise.all(solTokens.map(async (t: any) => ({
      t,
      pairData: await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`, 4000),
    })));
    for (const { t, pairData } of pairResults) {
      if (results.length >= limit * 2) break;
      if (!pairData?.pairs?.length) continue;
      const solPairs = pairData.pairs.filter((p: any) => p.chainId === "solana");
      const p = (solPairs.length > 0 ? solPairs : pairData.pairs).sort(
        (a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];
      if (!p) continue;

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
        created_at: p.pairCreatedAt,
        image_uri: t.icon,
      });
    }

    // Sort by creation time descending (newest first)
    results.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    return NextResponse.json({
      tokens: results.slice(0, limit),
      count: results.length,
      source: "dexscreener",
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ tokens: [], count: 0, source: "error" });
  }
}
