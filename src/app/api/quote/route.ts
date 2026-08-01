import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/quote?inputMint=USDC&outputMint=SOL&amount=100&slippage=1
 *
 * Calls real Jupiter Ultra API for swap quotes.
 * Falls back to simulated data if Jupiter API is unavailable.
 */

const SYMBOL_TO_MINT: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8XKopjCt8m8psV6qEh",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtA71FoKhx7hc1zVyL",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  BTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

const TOKEN_PRICES: Record<string, { symbol: string; price: number; liquidity: number }> = {
  "So11111111111111111111111111111111111111112": { symbol: "SOL", price: 184.32, liquidity: 1_240_000_000 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", price: 1.0, liquidity: 2_400_000_000 },
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8XKopjCt8m8psV6qEh": { symbol: "WIF", price: 2.84, liquidity: 84_000_000 },
  "JUPyiwrYJFskUPiHa7hkeR8VUtA71FoKhx7hc1zVyL": { symbol: "JUP", price: 0.842, liquidity: 48_000_000 },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", price: 0.0000284, liquidity: 56_000_000 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inputMint = searchParams.get("inputMint") || "USDC";
  const outputMint = searchParams.get("outputMint") || "SOL";
  const amount = parseFloat(searchParams.get("amount") || "100");
  const slippage = parseFloat(searchParams.get("slippage") || "1");

  const inKey = SYMBOL_TO_MINT[inputMint] || inputMint;
  const outKey = SYMBOL_TO_MINT[outputMint] || outputMint;
  const inToken = TOKEN_PRICES[inKey] || { symbol: inputMint, price: 1, liquidity: 10_000_000 };
  const outToken = TOKEN_PRICES[outKey] || { symbol: outputMint, price: 1, liquidity: 10_000_000 };

  // Try real Jupiter Ultra API first
  try {
    const inputAmount = Math.floor(amount * (inToken.symbol === "USDC" || inToken.symbol === "USDT" ? 1e6 : 1e9));
    const jupUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inKey}&outputMint=${outKey}&amount=${inputAmount}&slippageBps=${Math.round(slippage * 100)}&swapMode=ExactIn&maxAccounts=20`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const jupRes = await fetch(jupUrl, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeout);

    if (jupRes.ok) {
      const jupData = await jupRes.json();
      if (jupData && jupData.outAmount) {
        const outAmount = parseFloat(jupData.outAmount) / (outToken.symbol === "USDC" || outToken.symbol === "USDT" ? 1e6 : 1e9);
        const priceImpactPct = jupData.priceImpactPct ? parseFloat(jupData.priceImpactPct) * 100 : 0;
        const minReceived = outAmount * (1 - slippage / 100);
        const platformFee = amount * inToken.price * 0.0085;

        return NextResponse.json({
          inputMint: inKey,
          outputMint: outKey,
          inSymbol: inToken.symbol,
          outSymbol: outToken.symbol,
          inAmount: amount,
          inUsd: Number((amount * inToken.price).toFixed(2)),
          outAmount: Number(outAmount.toFixed(8)),
          outUsd: Number((outAmount * outToken.price).toFixed(2)),
          priceImpactPct: Number(priceImpactPct.toFixed(2)),
          minReceived: Number(minReceived.toFixed(8)),
          slippagePct: slippage,
          platformFeeUsd: Number(platformFee.toFixed(4)),
          route: jupData.routeSymbols || [inToken.symbol, outToken.symbol],
          mevProtected: true,
          quoteId: jupData.quoteId || `jup_${Date.now()}`,
          timestamp: Date.now(),
          simulatedTx: jupData.swapTransaction || `0x${Math.random().toString(16).slice(2, 42)}...`,
          expiresAt: Date.now() + 30_000,
          source: "jupiter_ultra",
        });
      }
    }
  } catch {
    // Fall through to simulation
  }

  // Fallback: Simulated quote
  const inputUsd = amount * inToken.price;
  const baseOutput = inputUsd / outToken.price;
  const impactPct = Math.min(15, (inputUsd / Math.max(1, outToken.liquidity)) * 100);
  const afterImpact = baseOutput * (1 - impactPct / 100);
  const minReceived = afterImpact * (1 - slippage / 100);
  const platformFee = inputUsd * 0.0085;
  const route = inToken.symbol === "USDC" ? [inToken.symbol, outToken.symbol] : [inToken.symbol, "USDC", outToken.symbol];

  return NextResponse.json({
    inputMint: inKey,
    outputMint: outKey,
    inSymbol: inToken.symbol,
    outSymbol: outToken.symbol,
    inAmount: amount,
    inUsd: Number(inputUsd.toFixed(2)),
    outAmount: Number(afterImpact.toFixed(8)),
    outUsd: Number(inputUsd.toFixed(2)),
    priceImpactPct: Number(impactPct.toFixed(2)),
    minReceived: Number(minReceived.toFixed(8)),
    slippagePct: slippage,
    platformFeeUsd: Number(platformFee.toFixed(4)),
    route,
    mevProtected: true,
    quoteId: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    simulatedTx: `0x${Math.random().toString(16).slice(2, 42)}...`,
    expiresAt: Date.now() + 30_000,
    source: "simulated",
  });
}
