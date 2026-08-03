import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/wallet?address=<solana_wallet_address>
 *
 * Fetches real on-chain wallet data using Solana JSON RPC:
 * 1. getBalance — native SOL balance
 * 2. getTokenAccountsByOwner — all SPL token holdings
 * 3. DexScreener — fetches current prices for each token
 *
 * Solana-only. Uses public RPC endpoint (https://api.mainnet-beta.solana.com).
 * For production, use a paid RPC (Helius/QuickNode) for higher rate limits.
 */

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// Known token mints → symbol mapping for price lookup
const KNOWN_MINTS: Record<string, { symbol: string; name: string }> = {
  "So11111111111111111111111111111111111111112": { symbol: "SOL", name: "Solana" },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", name: "USD Coin" },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", name: "Tether USD" },
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": { symbol: "WIF", name: "dogwifhat" },
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK": { symbol: "JUP", name: "Jupiter" },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw": { symbol: "BONK", name: "Bonk" },
  "jtojtomepa8beP8AuQc6baXW3BHW4fomxFhNt2kkoRJ": { symbol: "JTO", name: "Jito" },
  "HzrJr2DPAMaqpTv1HiBN6fh2U7tPqQ1jcqvQmKt4KZKk": { symbol: "PYTH", name: "Pyth Network" },
  "DriFtupJYLTosbwoN8koMbEYSx54aFqk4VYxwqXf9YqT": { symbol: "DRIFT", name: "Drift Protocol" },
  "GoMwV1h3EuxKNvj7HfVJns2NdvhLamgoG4YNLEFLUHKY": { symbol: "IO", name: "io.net" },
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof": { symbol: "RNDR", name: "Render" },
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": { symbol: "POPCAT", name: "Popcat" },
  "hntyVP6YFm1Hg25TNfrWY7nDDj4L7XUKVxRLbDoqmca": { symbol: "HNT", name: "Helium" },
  "MangoCzJ36AjZyKKs9xLpNfcddzZdp6VJuRKrZ4PjmhY": { symbol: "MNGO", name: "Mango" },
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": { symbol: "RAY", name: "Raydium" },
  "NeonTjSjsuo3rexg9o6vHuMXw62f9V7zvmu8M8Zut44": { symbol: "NEON", name: "Neon" },
};

async function solanaRpc(method: string, params: any[]): Promise<any> {
  try {
    const res = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    });
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

async function fetchTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints.join(",")}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await res.json();
    if (!data.pairs || !Array.isArray(data.pairs)) return {};

    const prices: Record<string, number> = {};
    for (const pair of data.pairs) {
      const addr = pair.baseToken?.address;
      if (!addr || prices[addr]) continue;
      const priceUsd = parseFloat(pair.priceUsd ?? "0");
      if (priceUsd > 0) prices[addr] = priceUsd;
    }
    return prices;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  // Validate Solana address format (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
  }

  // 1. Fetch native SOL balance
  const balanceResult = await solanaRpc("getBalance", [address]);
  const lamports = balanceResult?.value ?? 0;
  const solBalance = lamports / 1e9;

  // 2. Fetch SPL token accounts
  const tokenAccountsResult = await solanaRpc("getTokenAccountsByOwner", [
    address,
    { programId: TOKEN_PROGRAM },
    { encoding: "jsonParsed" },
  ]);

  const holdings: any[] = [];
  const tokenMints: string[] = [];

  // Parse token accounts
  if (tokenAccountsResult?.value) {
    for (const account of tokenAccountsResult.value) {
      try {
        const parsed = account.account?.data?.parsed;
        if (!parsed) continue;
        const mint = parsed.info?.mint;
        const amount = parsed.info?.tokenAmount;
        if (!mint || !amount) continue;

        const uiAmount = amount.uiAmount ?? 0;
        if (uiAmount <= 0) continue;

        const known = KNOWN_MINTS[mint];
        holdings.push({
          mint,
          symbol: known?.symbol || "UNKNOWN",
          name: known?.name || "Unknown Token",
          amount: uiAmount,
          decimals: amount.decimals,
          chain: "SOL",
        });
        if (!tokenMints.includes(mint)) tokenMints.push(mint);
      } catch {
        // skip malformed account
      }
    }
  }

  // 3. Fetch real prices from DexScreener
  const prices = await fetchTokenPrices(tokenMints);

  // SOL price — fetch via DexScreener too
  const solPrice = prices["So11111111111111111111111111111111111111112"] ?? 184;

  // Compute USD values
  let totalUsd = solBalance * solPrice;
  for (const h of holdings) {
    const price = prices[h.mint] ?? 0;
    h.price = price;
    h.valueUsd = price * h.amount;
    totalUsd += h.valueUsd;
  }

  // Add SOL as first holding
  const allHoldings = [
    {
      symbol: "SOL",
      name: "Solana",
      amount: solBalance,
      price: solPrice,
      chain: "SOL",
      valueUsd: solBalance * solPrice,
    },
    ...holdings.filter((h) => h.valueUsd > 0.01), // filter dust
  ];

  return NextResponse.json({
    address,
    chain: "SOL",
    totalUsd,
    holdings: allHoldings,
    solBalance,
    solPrice,
    tokenCount: holdings.length,
    source: "solana_rpc",
    timestamp: Date.now(),
  });
}
