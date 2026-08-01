import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/wallet?address=0x7a3f...b9c2
 *
 * Returns simulated wallet balances for a given address.
 * In production, this would call Helius RPC: https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
 * with getConnectionAccountInfo + getTokenAccountsByOwner
 */

const TOKEN_HOLDINGS: Record<string, { symbol: string; amount: number; price: number; chain: string }[]> = {
  default: [
    { symbol: "SOL", amount: 42.4, price: 184.32, chain: "SOL" },
    { symbol: "USDC", amount: 8420.5, price: 1.0, chain: "SOL" },
    { symbol: "WIF", amount: 2840, price: 2.84, chain: "SOL" },
    { symbol: "JUP", amount: 12400, price: 0.842, chain: "SOL" },
    { symbol: "BONK", amount: 18_400_000, price: 0.0000284, chain: "SOL" },
    { symbol: "JTO", amount: 240, price: 3.12, chain: "SOL" },
    { symbol: "DRIFT", amount: 1200, price: 1.84, chain: "SOL" },
    { symbol: "IO", amount: 640, price: 2.94, chain: "SOL" },
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address") || "0x7a3f...b9c2";

  // Deterministic variation based on address hash
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
  }
  const variation = 0.8 + (Math.abs(hash) % 40) / 100; // 0.8 - 1.2x

  const holdings = TOKEN_HOLDINGS.default.map((h) => ({
    ...h,
    amount: Number((h.amount * variation).toFixed(2)),
    valueUsd: Number((h.amount * variation * h.price).toFixed(2)),
  }));

  const totalUsd = holdings.reduce((s, h) => s + h.valueUsd, 0);

  return NextResponse.json({
    address,
    chain: "SOL",
    totalUsd: Number(totalUsd.toFixed(2)),
    holdings,
    nftCount: 3 + (Math.abs(hash) % 5),
    stakePositions: [
      { validator: "Marinade", amount: 18.2, apy: 7.24, rewards: 0.42 },
      { validator: "Jito", amount: 12.4, apy: 7.18, rewards: 0.18 },
    ],
    defiPositions: [
      { protocol: "Kamino", type: "Lending", asset: "USDC", amount: 12000, apy: 8.2 },
      { protocol: "Raydium", type: "LP", asset: "SOL-USDC", amount: 4200, apy: 42.8 },
    ],
    lastUpdated: Date.now(),
  });
}
