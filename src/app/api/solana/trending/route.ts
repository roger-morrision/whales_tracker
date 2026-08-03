import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/gmgn";

/**
 * GET /api/solana/trending?limit=20&sort=volume
 *
 * Returns real trending Solana tokens from DexScreener boosted + searched tokens.
 * sort: "volume" | "tx_count" | "change" | "market_cap"
 */

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 50);
  const sort = req.nextUrl.searchParams.get("sort") || "volume";

  try {
    // Fetch top boosted tokens (community-financed visibility = strong signal)
    const boostsData = await fetchJson("https://api.dexscreener.com/token-boosts/top/v1");
    if (!Array.isArray(boostsData)) {
      return NextResponse.json({ tokens: [], source: "error" });
    }

    // Filter Solana only
    const solTokens = boostsData.filter((t: any) => t.chainId === "solana").slice(0, limit * 2);

    // For each, fetch the token pair data to get price/volume/liquidity
    const results: any[] = [];
    for (const t of solTokens) {
      if (results.length >= limit) break;
      const pairData = await fetchJson(
        `https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`
      );
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
        change_24h: p.priceChange?.h24 ?? 0,
        change_6h: p.priceChange?.h6 ?? 0,
        volume_24h: p.volume?.h24 ?? 0,
        volume_6h: p.volume?.h6 ?? 0,
        volume_1h: p.volume?.h1 ?? 0,
        market_cap: p.marketCap ?? p.fdv ?? 0,
        fdv: p.fdv ?? 0,
        liquidity: p.liquidity?.usd ?? 0,
        txns_24h_buys: p.txns?.h24?.buys ?? 0,
        txns_24h_sells: p.txns?.h24?.sells ?? 0,
        pair_address: p.pairAddress,
        dex: p.dexId,
        pair_url: p.url,
        created_at: p.pairCreatedAt,
        boosts_usd: t.totalAmount,
        image_uri: t.icon,
        socials: (t.links || []).map((l: any) => ({ type: l.type || "website", url: l.url })),
      });
    }

    // Sort by requested field
    if (sort === "volume") results.sort((a, b) => b.volume_24h - a.volume_24h);
    else if (sort === "change") results.sort((a, b) => b.change_24h - a.change_24h);
    else if (sort === "market_cap") results.sort((a, b) => b.market_cap - a.market_cap);
    else if (sort === "tx_count") results.sort((a, b) => (b.txns_24h_buys + b.txns_24h_sells) - (a.txns_24h_buys + a.txns_24h_sells));

    return NextResponse.json({
      tokens: results.slice(0, limit),
      count: results.length,
      sort,
      source: "dexscreener",
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ tokens: [], count: 0, source: "error" });
  }
}
