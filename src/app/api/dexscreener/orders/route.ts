import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/gmgn";

/**
 * GET /api/dexscreener/orders?address=<mint>&chain=solana
 *
 * Returns paid-promotion disclosure: list of boost payments + token-ad / token-profile
 * payments from DexScreener's /orders/v1/{chain}/{token} endpoint.
 *
 * Transparency: traders want to know if a token's "trending" status is bought.
 */

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const chain = req.nextUrl.searchParams.get("chain") || "solana";
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  try {
    const data = await fetchJson(
      `https://api.dexscreener.com/orders/v1/${chain}/${address}`
    );
    if (!data) {
      return NextResponse.json({
        orders: [],
        boosts: [],
        totalBoostsUsd: 0,
        source: "dexscreener",
        note: "No paid-promotion data available.",
      });
    }

    const orders = (data.orders || []) as any[];
    const boosts = (data.boosts || []) as any[];
    const totalBoostsUsd = boosts.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

    return NextResponse.json({
      orders: orders.map((o) => ({
        type: o.type, // "tokenAd" | "tokenProfile"
        status: o.status,
        paymentTimestamp: o.paymentTimestamp,
      })),
      boosts: boosts.map((b) => ({
        id: b.id,
        amount: b.amount,
        paymentTimestamp: b.paymentTimestamp,
      })),
      totalBoostsUsd,
      count: orders.length + boosts.length,
      source: "dexscreener",
      address,
      chain,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({
      orders: [],
      boosts: [],
      totalBoostsUsd: 0,
      source: "error",
      note: "DexScreener API unavailable.",
    });
  }
}
