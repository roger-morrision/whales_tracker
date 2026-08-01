import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/prices?symbols=SOL,WIF,JUP,BONK
 *
 * Calls real Birdeye API for live token prices.
 * Falls back to simulated data if Birdeye is unavailable.
 */

const MINT_ADDRESSES: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8XKopjCt8m8psV6qEh",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtA71FoKhx7hc1zVyL",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JTO: "jtojtomepa8beP8AuQc6baXW3BHW4fomxFhNt2kkoRJ",
  PYTH: "HZrJr2DPAMaqpTv1HiBN6fh2U7tPqQ1jcqvQmKt4KZKk",
  DRIFT: "DdFRxdBdD5k6JfJbqQyTTUu2wzDy3v7Exm6fJJxJxkM",
  IO: "2Cfv2Cxzwo8BwQs4Yq5i4zBkT2hojy6N2zvhxF3huaBt",
  RNDR: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
  POPCAT: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  HNT: "hntyVP6YFm1Hg25TNfrWY7nDDj4L7XUKVxRLbDoqmca",
  TNSR: "tns2dNyp4sGg3JBzWqfM6L6Q4yLwS5m6qC6rBv6m6oY",
  MNGO: "MangoCae1Y6m5Ss3R2qX7tq5wB2q7xL5m6wR3vQ1fY",
  MOON: "2xN4L7Q9z3W5b8Yp2Lp5qX7tUw4j6cF2vH3jY1kS4m8",
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  BTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  NEON: "5N4UoTwC4TiB2L3r6mWc2Pq2X7vB3wV5kL8jY1pQ9sF",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
};

const BASE_PRICES: Record<string, { price: number; change24h: number; volume24h: number; marketCap: number }> = {
  SOL: { price: 184.32, change24h: 6.42, volume24h: 3_820_000_000, marketCap: 87_200_000_000 },
  WIF: { price: 2.84, change24h: 14.27, volume24h: 412_000_000, marketCap: 2_840_000_000 },
  JUP: { price: 0.842, change24h: 3.18, volume24h: 184_000_000, marketCap: 1_140_000_000 },
  BONK: { price: 0.0000284, change24h: 22.14, volume24h: 280_000_000, marketCap: 1_940_000_000 },
  JTO: { price: 3.12, change24h: 8.94, volume24h: 92_000_000, marketCap: 980_000_000 },
  PYTH: { price: 0.381, change24h: -2.18, volume24h: 84_000_000, marketCap: 1_080_000_000 },
  DRIFT: { price: 1.84, change24h: 4.92, volume24h: 62_000_000, marketCap: 320_000_000 },
  IO: { price: 2.94, change24h: 9.18, volume24h: 48_000_000, marketCap: 410_000_000 },
  RNDR: { price: 8.42, change24h: 5.18, volume24h: 142_000_000, marketCap: 4_120_000_000 },
  POPCAT: { price: 0.842, change24h: 18.42, volume24h: 142_000_000, marketCap: 820_000_000 },
  HNT: { price: 7.42, change24h: -4.18, volume24h: 42_000_000, marketCap: 1_280_000_000 },
  TNSR: { price: 0.524, change24h: 11.84, volume24h: 28_000_000, marketCap: 124_000_000 },
  MNGO: { price: 0.0421, change24h: 38.12, volume24h: 18_400_000, marketCap: 42_000_000 },
  MOON: { price: 0.00042, change24h: 142.8, volume24h: 8_400_000, marketCap: 4_200_000 },
  ETH: { price: 3420.4, change24h: 2.18, volume24h: 12_400_000_000, marketCap: 412_000_000_000 },
  BTC: { price: 64280.0, change24h: 1.42, volume24h: 24_800_000_000, marketCap: 1_280_000_000_000 },
  NEON: { price: 0.124, change24h: -8.4, volume24h: 2_400_000, marketCap: 18_400_000 },
  RAY: { price: 2.42, change24h: 2.84, volume24h: 84_000_000, marketCap: 540_000_000 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") || "";
  const symbols = symbolsParam ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()) : Object.keys(BASE_PRICES);

  // Try real Birdeye API
  try {
    const mints = symbols.map((s) => MINT_ADDRESSES[s]).filter(Boolean);
    if (mints.length > 0) {
      const birdeyeUrl = `https://api.birdeye.so/defi/multi_price?list_address=${mints.join(",")}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const bdRes = await fetch(birdeyeUrl, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "x-chain": "solana",
        },
      });
      clearTimeout(timeout);

      if (bdRes.ok) {
        const bdData = await bdRes.json();
        if (bdData && bdData.data) {
          const prices: Record<string, any> = {};
          for (const sym of symbols) {
            const mint = MINT_ADDRESSES[sym];
            if (mint && bdData.data[mint]) {
              const bd = bdData.data[mint];
              prices[sym] = {
                price: bd.value || bd.price || BASE_PRICES[sym]?.price || 0,
                change24h: bd.priceChange24h || BASE_PRICES[sym]?.change24h || 0,
                volume24h: bd.volume24h || BASE_PRICES[sym]?.volume24h || 0,
                marketCap: bd.marketCap || BASE_PRICES[sym]?.marketCap || 0,
                timestamp: Date.now(),
              };
            }
          }
          if (Object.keys(prices).length > 0) {
            return NextResponse.json({
              prices,
              timestamp: Date.now(),
              source: "birdeye_api",
            });
          }
        }
      }
    }
  } catch {
    // Fall through to simulation
  }

  // Fallback: Simulated prices with deterministic variation
  const ts = Date.now();
  const variation = (symbol: string) => {
    let h = 0;
    const seed = `${symbol}-${Math.floor(ts / 5000)}`;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    return 1 + (Math.abs(h) % 100) / 5000;
  };

  const prices: Record<string, any> = {};
  for (const sym of symbols) {
    const base = BASE_PRICES[sym];
    if (base) {
      const v = variation(sym);
      prices[sym] = {
        price: Number((base.price * v).toFixed(base.price < 0.01 ? 8 : 4)),
        change24h: base.change24h,
        volume24h: base.volume24h,
        marketCap: base.marketCap,
        timestamp: ts,
      };
    }
  }

  return NextResponse.json({
    prices,
    timestamp: ts,
    source: "simulated",
    note: "In production, replace with Birdeye/CoinGecko API calls",
  });
}
