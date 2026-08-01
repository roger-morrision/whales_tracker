import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/pumpfun?type=new|graduating|graduated|migrating
 *
 * Simulated pump.fun + multi-launchpad data.
 * In production, replace with:
 *   - Pump.fun: https://frontend-api-v3.pump.fun/coins?limit=50&offset=0
 *   - Bitquery/Shyft for migration tracking
 *   - Raydium Launch Lab API
 *   - letsbonk.fun API
 *   - Moonshot API
 */

// Seeded RNG for deterministic data
function seededRand(seed: number): number {
  let s = seed;
  s = (s * 9301 + 49297) % 233280;
  return s / 233280;
}

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface PumpFunToken {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  launchpad: "pump.fun" | "Raydium Launch Lab" | "letsbonk.fun" | "Moonshot" | "PumpSwap";
  status: "bonding" | "graduating" | "graduated" | "migrated";
  marketCap: number;
  bondingCurveProgress: number; // 0-100
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  ageMinutes: number;
  creator: string;
  creatorVerified: boolean;
  imageUrl?: string;
  description: string;
  migratedTo?: "PumpSwap" | "Raydium" | null;
  migrationProgress?: number; // 0-100 for migrating tokens
  socials?: { twitter?: string; telegram?: string; website?: string };
  topHolderPct: number;
  devHoldingPct: number;
  isLive: boolean;
}

const NAMES = [
  ["PEPE2", "Pepe 2.0", "The sequel nobody asked for but everyone needed"],
  ["DOGY", "DogY", "Doge but with a Y because why not"],
  ["WOJAK", "Wojak Finance", "For the bag holders, by the bag holders"],
  ["CHAD", "GigaChad", "Giga Chad energy on chain"],
  ["FROG", "PepeFrog", "Ribbit your way to riches"],
  ["MOON", "MoonRocket", "To the moon and beyond"],
  ["CAT", "CatCoin", "Cats > Dogs. It's science."],
  ["BANANA", "BananaGun", "Peel the competition"],
  ["WIF2", "WifHat 2", "The hat is back"],
  ["DEGEN", "DegenApe", "Apes together strong"],
  ["SHIB2", "Shib2", "Shiba's second coming"],
  ["TURBO", "TurboCoin", "Speed is everything"],
  ["NPC", "NPC Coin", "Non-player characters unite"],
  ["GM", "GM Coin", "Gm gm gm gm gm"],
  ["LAMBO", "LamboDAO", "When Lambo? Now."],
  ["KEK", "KekWif", "Kekwif the frog hat"],
  ["COPE", "CopeToken", "Cope harder"],
  ["CHAD2", "UltraChad", "Even more chad"],
  ["BABY", "BabyDoge", "The cutest degen play"],
  ["HODL", "HodlCoin", "Diamond hands only"],
];

const CREATORS = [
  "7xKp...3f2A", "9bNm...8c4D", "4hJk...1e9F", "2vQw...7a3B",
  "8cDe...5f1G", "6mNo...2b4H", "1aBc...9d8E", "3fGh...6j5K",
];

const LAUNCHPADS: PumpFunToken["launchpad"][] = ["pump.fun", "pump.fun", "pump.fun", "pump.fun", "letsbonk.fun", "Raydium Launch Lab", "Moonshot"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "new";
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
  const launchpad = searchParams.get("launchpad");

  const tokens: PumpFunToken[] = [];
  const now = Date.now();

  for (let i = 0; i < limit; i++) {
    const seed = hashStr(`${type}-${i}-${Math.floor(now / 60000)}`); // Changes every minute
    const r1 = seededRand(seed);
    const r2 = seededRand(seed + 1);
    const r3 = seededRand(seed + 2);
    const r4 = seededRand(seed + 3);
    const r5 = seededRand(seed + 4);

    const [symbol, name, desc] = NAMES[i % NAMES.length];
    const lp = launchpad
      ? (launchpad as PumpFunToken["launchpad"])
      : LAUNCHPADS[Math.floor(r1 * LAUNCHPADS.length)];

    let status: PumpFunToken["status"];
    let bondingCurveProgress: number;
    let marketCap: number;
    let ageMinutes: number;
    let migratedTo: PumpFunToken["migratedTo"] = null;
    let migrationProgress: number | undefined;

    if (type === "new") {
      status = "bonding";
      bondingCurveProgress = Math.round(r2 * 60);
      marketCap = Math.round(5000 + r3 * 60000);
      ageMinutes = Math.round(r4 * 180) + 1;
    } else if (type === "graduating") {
      status = "graduating";
      bondingCurveProgress = Math.round(85 + r2 * 14);
      marketCap = Math.round(60000 + r3 * 20000);
      ageMinutes = Math.round(120 + r4 * 600);
    } else if (type === "graduated") {
      status = "graduated";
      bondingCurveProgress = 100;
      marketCap = Math.round(80000 + r3 * 500000);
      ageMinutes = Math.round(300 + r4 * 2880);
      migratedTo = r5 > 0.5 ? "PumpSwap" : "Raydium";
    } else if (type === "migrating") {
      status = "migrated";
      bondingCurveProgress = 100;
      marketCap = Math.round(100000 + r3 * 1000000);
      ageMinutes = Math.round(600 + r4 * 5760);
      migratedTo = r5 > 0.5 ? "PumpSwap" : "Raydium";
      migrationProgress = Math.round(r2 * 100);
    } else {
      status = "bonding";
      bondingCurveProgress = Math.round(r2 * 100);
      marketCap = Math.round(5000 + r3 * 200000);
      ageMinutes = Math.round(r4 * 4320);
    }

    const price = marketCap / 1_000_000_000; // Approximate price from mcap
    const creatorIdx = Math.floor(r4 * CREATORS.length);

    tokens.push({
      id: `pf-${type}-${i}`,
      symbol: symbol + (i >= NAMES.length ? Math.floor(i / NAMES.length) : ""),
      name,
      mint: `${symbol.slice(0, 4)}${r1.toString(16).slice(2, 8)}...${r2.toString(16).slice(2, 6)}`,
      launchpad: lp,
      status,
      marketCap,
      bondingCurveProgress,
      price: Number(price.toFixed(price < 0.001 ? 8 : 4)),
      priceChange1h: Number(((r3 - 0.4) * 100).toFixed(1)),
      priceChange24h: Number(((r4 - 0.3) * 200).toFixed(1)),
      volume24h: Math.round(marketCap * (0.2 + r5 * 0.8)),
      liquidity: Math.round(marketCap * 0.15),
      holders: Math.round(50 + r1 * 2000),
      ageMinutes,
      creator: CREATORS[creatorIdx],
      creatorVerified: r5 > 0.7,
      description: desc,
      migratedTo,
      migrationProgress,
      socials: r1 > 0.6 ? { twitter: `https://x.com/${symbol.toLowerCase()}`, telegram: r2 > 0.5 ? `https://t.me/${symbol.toLowerCase()}` : undefined } : {},
      topHolderPct: Number((5 + r2 * 25).toFixed(1)),
      devHoldingPct: Number((r3 * 15).toFixed(1)),
      isLive: ageMinutes < 30,
    });
  }

  return NextResponse.json({
    type,
    tokens,
    count: tokens.length,
    timestamp: now,
    launchpads: {
      "pump.fun": tokens.filter((t) => t.launchpad === "pump.fun").length,
      "letsbonk.fun": tokens.filter((t) => t.launchpad === "letsbonk.fun").length,
      "Raydium Launch Lab": tokens.filter((t) => t.launchpad === "Raydium Launch Lab").length,
      Moonshot: tokens.filter((t) => t.launchpad === "Moonshot").length,
    },
    note: "Simulated data. In production, replace with pump.fun API + Bitquery + Raydium APIs.",
  });
}
