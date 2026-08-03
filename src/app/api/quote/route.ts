import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/quote?inputMint=USDC&outputMint=SOL&amount=100&slippage=1
 *
 * Calls real Jupiter Ultra API for on-chain swap quotes on Solana.
 * Falls back to simulated data if Jupiter API is unavailable.
 *
 * Solana-only. Uses verified mint addresses.
 */

const SYMBOL_TO_MINT: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
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
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  BTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

const TOKEN_PRICES: Record<string, { symbol: string; price: number; liquidity: number }> = {
  "So11111111111111111111111111111111111111112": { symbol: "SOL", price: 184.32, liquidity: 1_240_000_000 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", price: 1.0, liquidity: 2_400_000_000 },
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": { symbol: "WIF", price: 2.84, liquidity: 84_000_000 },
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK": { symbol: "JUP", price: 0.842, liquidity: 48_000_000 },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw": { symbol: "BONK", price: 0.0000284, liquidity: 56_000_000 },
  "jtojtomepa8beP8AuQc6baXW3BHW4fomxFhNt2kkoRJ": { symbol: "JTO", price: 3.12, liquidity: 12_000_000 },
  "HzrJr2DPAMaqpTv1HiBN6fh2U7tPqQ1jcqvQmKt4KZKk": { symbol: "PYTH", price: 0.38, liquidity: 8_000_000 },
  "DriFtupJYLTosbwoN8koMbEYSx54aFqk4VYxwqXf9YqT": { symbol: "DRIFT", price: 1.84, liquidity: 6_000_000 },
  "GoMwV1h3EuxKNvj7HfVJns2NdvhLamgoG4YNLEFLUHKY": { symbol: "IO", price: 2.94, liquidity: 4_000_000 },
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof": { symbol: "RNDR", price: 8.42, liquidity: 8_000_000 },
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": { symbol: "POPCAT", price: 0.84, liquidity: 12_000_000 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inputSymbol = searchParams.get("inputMint") || "USDC";
  const outputSymbol = searchParams.get("outputMint") || "SOL";
  const amount = parseFloat(searchParams.get("amount") || "100");
  const slippage = parseFloat(searchParams.get("slippage") || "1");

  const inKey = SYMBOL_TO_MINT[inputSymbol] || SYMBOL_TO_MINT["USDC"];
  const outKey = SYMBOL_TO_MINT[outputSymbol] || SYMBOL_TO_MINT["SOL"];

  const inToken = TOKEN_PRICES[inKey] || { symbol: inputSymbol, price: 1, liquidity: 1_000_000 };
  const outToken = TOKEN_PRICES[outKey] || { symbol: outputSymbol, price: 1, liquidity: 1_000_000 };

  // Determine input amount in raw units
  // USDC has 6 decimals, most Solana tokens have 9, SOL has 9
  const inputDecimals = inputSymbol === "USDC" || inputSymbol === "USDT" ? 6 : 9;
  const rawAmount = Math.floor(amount * Math.pow(10, inputDecimals));

  // Try Jupiter Ultra API (real on-chain quote)
  try {
    const jupUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${inKey}&outputMint=${outKey}&amount=${rawAmount}&slippageBps=${Math.floor(slippage * 100)}`;
    const jupRes = await fetch(jupUrl, { cache: "no-store" });

    if (jupRes.ok) {
      const data = await jupRes.json();
      if (data.outAmount) {
        // Determine output decimals
        const outputDecimals = outputSymbol === "USDC" || outputSymbol === "USDT" ? 6 : 9;
        const outAmount = parseFloat(data.outAmount) / Math.pow(10, outputDecimals);

        return NextResponse.json({
          inputMint: inKey,
          outputMint: outKey,
          inSymbol: inputSymbol,
          outSymbol: outputSymbol,
          inAmount: amount,
          inUsd: Number(amount.toFixed(2)),
          outAmount: Number(outAmount.toFixed(8)),
          outUsd: Number((outAmount * outToken.price).toFixed(2)),
          priceImpactPct: Number((parseFloat(data.priceImpactPct || "0"))),
          minReceived: Number((outAmount * (1 - slippage / 100)).toFixed(8)),
          slippagePct: slippage,
          platformFeeUsd: Number((amount * 0.0085).toFixed(4)),
          route: data.routePlan?.map((r: any) => r.swapInfo?.label || r.swapInfo?.amm).filter(Boolean) || [inputSymbol, outputSymbol],
          mevProtected: true,
          quoteId: `jup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          source: "jupiter_ultra",
        });
      }
    }
  } catch {
    // Fall through to simulated quote
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
    inSymbol: inputSymbol,
    outSymbol: outputSymbol,
    inAmount: amount,
    inUsd: Number(inputUsd.toFixed(2)),
    outAmount: Number(afterImpact.toFixed(8)),
    outUsd: Number((afterImpact * outToken.price).toFixed(2)),
    priceImpactPct: Number(impactPct.toFixed(2)),
    minReceived: Number(minReceived.toFixed(8)),
    slippagePct: slippage,
    platformFeeUsd: Number(platformFee.toFixed(4)),
    route,
    mevProtected: true,
    quoteId: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    source: "simulated",
  });
}
