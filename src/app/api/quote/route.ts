import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/quote?inputMint=USDC&outputMint=SOL&amount=100&slippage=1
 *
 * Returns a simulated swap quote with realistic price impact, fees, and route.
 * In production, this would call Jupiter Ultra API: https://lite-api.jup.ag/swap/v1/quote
 */

const TOKEN_PRICES: Record<string, { symbol: string; price: number; liquidity: number; chain: string }> = {
  "So11111111111111111111111111111111111111112": { symbol: "SOL", price: 184.32, liquidity: 1_240_000_000, chain: "SOL" },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", price: 1.0, liquidity: 2_400_000_000, chain: "SOL" },
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8XKopjCt8m8psV6qEh": { symbol: "WIF", price: 2.84, liquidity: 84_000_000, chain: "SOL" },
  "JUPyiwrYJFskUPiHa7hkeR8VUtA71FoKhx7hc1zVyL": { symbol: "JUP", price: 0.842, liquidity: 48_000_000, chain: "SOL" },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", price: 0.0000284, liquidity: 56_000_000, chain: "SOL" },
};

const SYMBOL_TO_MINT: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8XKopjCt8m8psV6qEh",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtA71FoKhx7hc1zVyL",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inputMint = searchParams.get("inputMint") || "USDC";
  const outputMint = searchParams.get("outputMint") || "SOL";
  const amount = parseFloat(searchParams.get("amount") || "100");
  const slippage = parseFloat(searchParams.get("slippage") || "1");

  const inKey = SYMBOL_TO_MINT[inputMint] || inputMint;
  const outKey = SYMBOL_TO_MINT[outputMint] || outputMint;
  const inToken = TOKEN_PRICES[inKey] || { symbol: inputMint, price: 1, liquidity: 10_000_000, chain: "SOL" };
  const outToken = TOKEN_PRICES[outKey] || { symbol: outputMint, price: 1, liquidity: 10_000_000, chain: "SOL" };

  const inputUsd = amount * inToken.price;
  const baseOutput = inputUsd / outToken.price;
  const impactPct = Math.min(15, (inputUsd / Math.max(1, outToken.liquidity)) * 100);
  const afterImpact = baseOutput * (1 - impactPct / 100);
  const minReceived = afterImpact * (1 - slippage / 100);
  const platformFee = inputUsd * 0.0085;

  const route =
    inToken.symbol === "USDC"
      ? [inToken.symbol, outToken.symbol]
      : [inToken.symbol, "USDC", outToken.symbol];

  return NextResponse.json({
    inputMint: inKey,
    outputMint: outKey,
    inSymbol: inToken.symbol,
    outSymbol: outToken.symbol,
    inAmount: amount,
    inUsd: Number(inputUsd.toFixed(2)),
    outAmount: Number(afterImpact.toFixed(6)),
    outUsd: Number(inputUsd.toFixed(2)),
    priceImpactPct: Number(impactPct.toFixed(2)),
    minReceived: Number(minReceived.toFixed(6)),
    slippagePct: slippage,
    platformFeeUsd: Number(platformFee.toFixed(4)),
    route,
    mevProtected: true,
    quoteId: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    simulatedTx: `0x${Math.random().toString(16).slice(2, 42)}...`,
    expiresAt: Date.now() + 30_000,
  });
}
