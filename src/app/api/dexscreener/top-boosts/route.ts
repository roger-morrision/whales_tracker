import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/gmgn";

/**
 * GET /api/dexscreener/top-boosts?chain=solana&limit=10
 *
 * Returns tokens with the most active paid boosts on DexScreener.
 * Different signal than GMGN trending (which is volume-based) — this reflects
 * community financial commitment to a token's visibility.
 */

export async function GET(req: NextRequest) {
  const chainFilter = req.nextUrl.searchParams.get("chain") || "solana";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10), 30);

  try {
    const data = await fetchJson("https://api.dexscreener.com/token-boosts/top/v1");
    if (!Array.isArray(data)) {
      return NextResponse.json({ tokens: [], count: 0, source: "dexscreener" });
    }
    const filtered = data
      .filter((t: any) => t.chainId === chainFilter)
      .slice(0, limit);

    // For each boost, fetch the token pair to get price/marketCap
    const results: any[] = [];
    for (const t of filtered) {
      const pairData = await fetchJson(
        `https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`
      );
      if (!pairData?.pairs?.length) continue;
      const chainPairs = pairData.pairs.filter((p: any) => p.chainId === chainFilter);
      const p = (chainPairs.length > 0 ? chainPairs : pairData.pairs).sort(
        (a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];
      if (!p) continue;
      results.push({
        address: t.tokenAddress,
        symbol: p.baseToken?.symbol ?? "",
        name: p.baseToken?.name ?? "",
        price: parseFloat(p.priceUsd ?? "0"),
        price_change_24h: p.priceChange?.h24 ?? 0,
        volume_24h: p.volume?.h24 ?? 0,
        market_cap: p.marketCap ?? p.fdv ?? 0,
        liquidity: p.liquidity?.usd ?? 0,
        image_uri: t.icon,
        header_image_uri: t.header,
        description: t.description,
        total_boosts_usd: t.totalAmount,
        boosts_active: t.totalAmount,
        socials: (t.links || []).map((l: any) => ({ type: l.type || "website", url: l.url })),
        rank: results.length + 1,
        chain: chainFilter,
      });
    }

    return NextResponse.json({
      tokens: results,
      count: results.length,
      chain: chainFilter,
      source: "dexscreener",
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({
      tokens: [],
      count: 0,
      source: "error",
      note: "DexScreener API unavailable.",
    });
  }
}
