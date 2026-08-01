import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/prices?symbols=SOL,WIF,JUP,BONK
 *
 * Returns current token prices with 24h change.
 * In production, this would call CoinGecko or Birdeye API.
 */

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

  // Add small random variation to simulate live prices
  const ts = Date.now();
  const variation = (symbol: string) => {
    // Deterministic variation based on time + symbol
    let h = 0;
    const seed = `${symbol}-${Math.floor(ts / 5000)}`;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    return 1 + (Math.abs(h) % 100) / 5000; // ±0.2%
  };

  const prices: Record<string, { price: number; change24h: number; volume24h: number; marketCap: number; timestamp: number }> = {};
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
