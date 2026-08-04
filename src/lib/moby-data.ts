// Moby data layer — types + mock data + helpers
// All data is illustrative; designed to look like a real crypto trading intelligence app.
//
// IMPORTANT: This module is loaded on both server and client. To avoid React hydration
// mismatches, all "random" values must be DETERMINISTIC — using a seeded PRNG, not
// Math.random(), and a fixed reference timestamp, not Date.now().

export type Chain = "SOL" | "ETH" | "BASE" | "BTC" | "SUI" | "HYPER";

// Fixed reference epoch — keeps SSR + CSR data identical.
// 2026-08-01T00:00:00Z
const NOW = 1_789_324_800_000;

// Mulberry32 — tiny seeded PRNG. Deterministic across server and client.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return function rng(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a string to a uint32 seed.
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Convenience: produce a deterministic float in [0, 1) keyed by a string.
function seededRand(key: string): number {
  return makeRng(hashSeed(key))();
}

export type TokenCategory =
  | "DeFi"
  | "Meme"
  | "AI"
  | "L1"
  | "L2"
  | "Gaming"
  | "DePIN"
  | "RWA"
  | "NFT"
  | "Stablecoin";

export interface Token {
  id: string;
  symbol: string;
  name: string;
  chain: Chain;
  category: TokenCategory;
  price: number;
  change24h: number; // percent
  change1h: number;
  change5m?: number;     // Phase 1: 5-minute change
  change30m?: number;    // Phase 1: 30-minute change
  change1m?: number;     // Phase 1: 1-minute change
  marketCap: number;
  liquidity: number;
  volume24h: number;
  volume1h?: number;     // Phase 1: 1-hour volume
  volume30m?: number;    // Phase 1: 30-minute volume
  volume1m?: number;     // Phase 1: 1-minute volume
  holders: number;
  ageHours: number; // time since mint
  smartMoneyHolders: number; // count of tracked smart wallets holding
  smartMoneyInflow24h: number; // USD net inflow from smart money
  sparkline: number[]; // last ~40 points
  logoColor: string; // tailwind/css color for the gradient logo
  logoGlyph?: string; // single char for the logo
  verified: boolean;
  description: string;
  rank?: number; // trending rank if applicable
  mint?: string; // Solana mint address (for GMGN / on-chain lookups)
  // Phase 4: GMGN-style enrichment
  holderCount?: number | null;
  totalFeesSol?: number | null;
  buyTax?: number | null;
  sellTax?: number | null;
  ctoPct?: number | null;
  isDs?: boolean;
  insiderPct?: number | null;
  bundlerPct?: number | null;
  sniperHoldPct?: number | null;
}

export interface Trader {
  id: string;
  handle: string;
  displayName: string;
  avatarColor: string;
  avatarGlyph: string;
  bio: string;
  followers: number;
  following: boolean;
  winRate: number; // 0-100
  pnl30d: number; // USD
  pnl30dPct: number;
  roiAllTime: number; // percent
  rank: number;
  smartScore: number; // 0-100 — Moby smart money score
  tags: string[]; // e.g. "Whale", "KOL", "Sniper", "Degen"
  chains: Chain[];
  topHoldings: { symbol: string; pct: number }[];
  recentTrades: TraderTrade[];
  isLive: boolean;
  walletAddress?: string; // Solana wallet address for GMGN portfolio lookup
}

export interface TraderTrade {
  id: string;
  traderId: string;
  tokenSymbol: string;
  tokenName: string;
  side: "BUY" | "SELL";
  usdValue: number;
  tokenAmount: number;
  price: number;
  chain: Chain;
  agoSeconds: number;
  pnlUsd?: number;
  pnlPct?: number;
}

export interface WhaleFlow {
  id: string;
  type: "ACCUMULATE" | "DISTRIBUTE" | "NEW_POSITION" | "EXIT";
  tokenSymbol: string;
  tokenName: string;
  chain: Chain;
  usdValue: number;
  walletLabel: string;
  walletAddress: string;
  walletScore: number; // 0-100
  agoSeconds: number;
  priceImpact: number; // percent
  txHash: string;
}

export interface SmartSignal {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  type:
    | "SMART_MONEY_ENTRY"
    | "WHALE_ACCUMULATION"
    | "EARLY_ENTRY"
    | "CLUSTER_BUY"
    | "DIVERGENCE"
    | "TRENDING";
  title: string;
  description: string;
  smartWalletsCount: number;
  usdInflow: number;
  agoSeconds: number;
  chain: Chain;
  confidence: number; // 0-100
}

export interface Narrative {
  id: string;
  name: string;
  emoji: string;
  change24h: number;
  mentions24h: number;
  topTokens: string[]; // token ids
  color: string;
  description: string;
}

export interface Holding {
  id: string;
  tokenId: string;
  amount: number;
  avgCost: number;
  chain: Chain;
}

export interface NftHolding {
  id: string;
  collection: string;
  floorPrice: number;
  count: number;
  avgCost: number;
  chain: Chain;
  imageUrl?: string;
  color: string;
}

export interface StockHolding {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  price: number;
  change24h: number;
  preipo?: boolean;
  color: string;
}

export interface Portfolio {
  cashUsd: number;
  cryptoHoldings: Holding[];
  nftHoldings: NftHolding[];
  stockHoldings: StockHolding[];
  history: { t: number; v: number }[]; // 30d portfolio value history
}

// ---------- Helper generators ----------

function genSparkline(seedKey: string, start: number, vol: number, points = 40, trend = 0): number[] {
  const rng = makeRng(hashSeed(seedKey));
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < points; i++) {
    const drift = trend * 0.01;
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * vol * 0.3;
    const rnd = (rng() - 0.5) * vol;
    v = Math.max(0.0001, v * (1 + drift + noise + rnd));
    out.push(Number(v.toFixed(6)));
  }
  return out;
}

function agoLabel(sec: number): string {
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// ---------- TOKENS ----------

export const TOKENS: Token[] = [
  {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    chain: "SOL",
    category: "L1",
    price: 72.97,
    change24h: 6.42,
    change1h: 1.12,
    marketCap: 87_200_000_000,
    liquidity: 1_240_000_000,
    volume24h: 3_820_000_000,
    holders: 8_120_000,
    ageHours: 50_000,
    smartMoneyHolders: 412,
    smartMoneyInflow24h: 12_400_000,
    sparkline: genSparkline("sol", 170, 0.012, 40, 0.04),
    logoColor: "from-[#9945FF] to-[#14F195]",
    logoGlyph: "◎",
    verified: true,
    description: "High-throughput L1 blockchain optimized for consumer-scale apps.",
    rank: 1,
    mint: "So11111111111111111111111111111111111111112",
  },
  {
    id: "wif",
    symbol: "WIF",
    name: "dogwifhat",
    chain: "SOL",
    category: "Meme",
    price: 0.142,
    change24h: 14.27,
    change1h: 3.41,
    marketCap: 2_840_000_000,
    liquidity: 84_000_000,
    volume24h: 412_000_000,
    holders: 192_000,
    ageHours: 8_400,
    smartMoneyHolders: 184,
    smartMoneyInflow24h: 4_220_000,
    sparkline: genSparkline("wif", 2.4, 0.045, 40, 0.06),
    logoColor: "from-[#F5B7B1] to-[#E8DAEF]",
    logoGlyph: "🐕",
    verified: true,
    description: "The most recognizable Solana meme coin — dog with a pink hat.",
    rank: 2,
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  },
  {
    id: "jup",
    symbol: "JUP",
    name: "Jupiter",
    chain: "SOL",
    category: "DeFi",
    price: 0.842,
    change24h: 3.18,
    change1h: -0.42,
    marketCap: 1_140_000_000,
    liquidity: 48_000_000,
    volume24h: 184_000_000,
    holders: 412_000,
    ageHours: 6_200,
    smartMoneyHolders: 221,
    smartMoneyInflow24h: 1_820_000,
    sparkline: genSparkline("jup", 0.82, 0.018, 40, 0.02),
    logoColor: "from-[#C7A8FF] to-[#8B5CF6]",
    logoGlyph: "🪐",
    verified: true,
    description: "Solana's leading DEX aggregator and perpetuals exchange.",
    rank: 3,
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK",
  },
  {
    id: "pyth",
    symbol: "PYTH",
    name: "Pyth Network",
    chain: "SOL",
    category: "DePIN",
    price: 0.38,
    change24h: -2.18,
    change1h: -0.84,
    marketCap: 1_080_000_000,
    liquidity: 32_000_000,
    volume24h: 84_000_000,
    holders: 98_000,
    ageHours: 5_400,
    smartMoneyHolders: 142,
    smartMoneyInflow24h: 640_000,
    sparkline: genSparkline("pyth", 0.4, 0.014, 40, -0.01),
    logoColor: "from-[#A855F7] to-[#6366F1]",
    logoGlyph: "⚡",
    verified: true,
    description: "High-fidelity oracle network powering on-chain price feeds.",
    mint: "HzrJr2DPAMaqpTv1HiBN6fh2U7tPqQ1jcqvQmKt4KZKk",
  },
  {
    id: "jto",
    symbol: "JTO",
    name: "Jito",
    chain: "SOL",
    category: "DeFi",
    price: 3.12,
    change24h: 8.94,
    change1h: 2.18,
    marketCap: 980_000_000,
    liquidity: 28_000_000,
    volume24h: 92_000_000,
    holders: 64_000,
    ageHours: 4_200,
    smartMoneyHolders: 96,
    smartMoneyInflow24h: 980_000,
    sparkline: genSparkline("jto", 2.9, 0.022, 40, 0.05),
    logoColor: "from-[#22D3EE] to-[#0EA5E9]",
    logoGlyph: "🌊",
    verified: true,
    description: "Solana liquid staking with MEV-optimized block engine.",
    mint: "jtojtomepa8beP8AuQc6baXW3BHW4fomxFhNt2kkoRJ",
  },
  {
    id: "bonk",
    symbol: "BONK",
    name: "Bonk",
    chain: "SOL",
    category: "Meme",
    price: 0.0000284,
    change24h: 22.14,
    change1h: 5.42,
    marketCap: 1_940_000_000,
    liquidity: 56_000_000,
    volume24h: 280_000_000,
    holders: 412_000,
    ageHours: 12_400,
    smartMoneyHolders: 168,
    smartMoneyInflow24h: 3_120_000,
    sparkline: genSparkline("bonk", 0.000024, 0.06, 40, 0.08),
    logoColor: "from-[#F97316] to-[#EF4444]",
    logoGlyph: "🔥",
    verified: true,
    description: "Solana's community-driven meme coin with deep DeFi integrations.",
    rank: 4,
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw",
  },
  {
    id: "hnt",
    symbol: "HNT",
    name: "Helium",
    chain: "SOL",
    category: "DePIN",
    price: 7.42,
    change24h: -4.18,
    change1h: -1.12,
    marketCap: 1_280_000_000,
    liquidity: 18_000_000,
    volume24h: 42_000_000,
    holders: 88_000,
    ageHours: 38_000,
    smartMoneyHolders: 72,
    smartMoneyInflow24h: -412_000,
    sparkline: genSparkline("hnt", 7.8, 0.018, 40, -0.02),
    logoColor: "from-[#38BDF8] to-[#1E40AF]",
    logoGlyph: "🎈",
    verified: true,
    description: "Decentralized wireless network for IoT and mobile coverage.",
    mint: "hntyVP6YFm1Hg25TNfrWY7nDDj4L7XUKVxRLbDoqmca",
  },
  {
    id: "tensor",
    symbol: "TNSR",
    name: "Tensor",
    chain: "SOL",
    category: "NFT",
    price: 0.524,
    change24h: 11.84,
    change1h: 4.12,
    marketCap: 124_000_000,
    liquidity: 8_400_000,
    volume24h: 28_000_000,
    holders: 24_000,
    ageHours: 2_400,
    smartMoneyHolders: 84,
    smartMoneyInflow24h: 720_000,
    sparkline: genSparkline("tensor", 0.48, 0.04, 40, 0.06),
    logoColor: "from-[#818CF8] to-[#4F46E5]",
    logoGlyph: "📐",
    verified: true,
    description: "Solana NFT marketplace with order-book trading.",
  },
  {
    id: "mngo",
    symbol: "MNGO",
    name: "MangoDAO",
    chain: "SOL",
    category: "DeFi",
    price: 0.042,
    change24h: 38.12,
    change1h: 12.4,
    marketCap: 42_000_000,
    liquidity: 2_400_000,
    volume24h: 18_400_000,
    holders: 12_000,
    ageHours: 1_200,
    smartMoneyHolders: 58,
    smartMoneyInflow24h: 1_240_000,
    sparkline: genSparkline("mngo", 0.03, 0.08, 40, 0.12),
    logoColor: "from-[#FBBF24] to-[#F59E0B]",
    logoGlyph: "🥭",
    verified: false,
    description: "Governance token for a Solana perps + lending protocol.",
    mint: "MangoCzJ36AjZyKKs9xLpNfcddzZdp6VJuRKrZ4PjmhY",
  },
  {
    id: "drift",
    symbol: "DRIFT",
    name: "Drift Protocol",
    chain: "SOL",
    category: "DeFi",
    price: 1.84,
    change24h: 4.92,
    change1h: 1.04,
    marketCap: 320_000_000,
    liquidity: 14_000_000,
    volume24h: 62_000_000,
    holders: 42_000,
    ageHours: 1_800,
    smartMoneyHolders: 124,
    smartMoneyInflow24h: 1_840_000,
    sparkline: genSparkline("drift", 1.7, 0.022, 40, 0.04),
    logoColor: "from-[#2DD4BF] to-[#0D9488]",
    logoGlyph: "📉",
    verified: true,
    description: "Order-book perpetuals DEX on Solana with cross-margining.",
    mint: "DriFtupJYLTosbwoN8koMbEYSx54aFqk4VYxwqXf9YqT",
  },
  {
    id: "io",
    symbol: "IO",
    name: "io.net",
    chain: "SOL",
    category: "AI",
    price: 2.94,
    change24h: 9.18,
    change1h: 2.41,
    marketCap: 410_000_000,
    liquidity: 12_400_000,
    volume24h: 48_000_000,
    holders: 38_000,
    ageHours: 1_400,
    smartMoneyHolders: 102,
    smartMoneyInflow24h: 1_240_000,
    sparkline: genSparkline("io", 2.7, 0.024, 40, 0.05),
    logoColor: "from-[#10B981] to-[#047857]",
    logoGlyph: "🧠",
    verified: true,
    description: "Decentralized GPU cloud for AI workloads.",
    mint: "GoMwV1h3EuxKNvj7HfVJns2NdvhLamgoG4YNLEFLUHKY",
  },
  {
    id: "rndr",
    symbol: "RNDR",
    name: "Render",
    chain: "SOL",
    category: "AI",
    price: 8.42,
    change24h: 5.18,
    change1h: 0.84,
    marketCap: 4_120_000_000,
    liquidity: 64_000_000,
    volume24h: 142_000_000,
    holders: 142_000,
    ageHours: 28_000,
    smartMoneyHolders: 184,
    smartMoneyInflow24h: 2_420_000,
    sparkline: genSparkline("rndr", 8.1, 0.018, 40, 0.03),
    logoColor: "from-[#FF6B35] to-[#C9302C]",
    logoGlyph: "🎞",
    verified: true,
    description: "Decentralized GPU rendering network.",
    mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
  },
  {
    id: "popcat",
    symbol: "POPCAT",
    name: "Popcat",
    chain: "SOL",
    category: "Meme",
    price: 0.044,
    change24h: 18.42,
    change1h: 4.92,
    marketCap: 820_000_000,
    liquidity: 22_000_000,
    volume24h: 142_000_000,
    holders: 88_000,
    ageHours: 5_400,
    smartMoneyHolders: 142,
    smartMoneyInflow24h: 2_120_000,
    sparkline: genSparkline("popcat", 0.7, 0.05, 40, 0.08),
    logoColor: "from-[#FACC15] to-[#F59E0B]",
    logoGlyph: "🐈",
    verified: true,
    description: "SOL meme coin with a tight-knit community.",
    rank: 5,
    mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  },
  {
    id: "moon",
    symbol: "MOON",
    name: "MoonCat",
    chain: "SOL",
    category: "Meme",
    price: 0.00042,
    change24h: 142.8,
    change1h: 38.2,
    marketCap: 4_200_000,
    liquidity: 220_000,
    volume24h: 8_400_000,
    holders: 1_240,
    ageHours: 18,
    smartMoneyHolders: 24,
    smartMoneyInflow24h: 612_000,
    sparkline: genSparkline("moon", 0.00018, 0.18, 40, 0.4),
    logoColor: "from-[#C084FC] to-[#7E22CE]",
    logoGlyph: "🌙",
    verified: false,
    description: "Freshly launched Solana meme — narrative: cat season.",
    mint: "2xN4L7Q9z3W5b8Yp2Lp5qX7tUw4j6cF2vH3jY1kS4m8",
  },
  {
    id: "neon",
    symbol: "NEON",
    name: "NeonPay",
    chain: "SOL",
    category: "DePIN",
    price: 0.42,
    change24h: -8.4,
    change1h: -2.12,
    marketCap: 18_400_000,
    liquidity: 840_000,
    volume24h: 2_400_000,
    holders: 4_200,
    ageHours: 220,
    smartMoneyHolders: 18,
    smartMoneyInflow24h: -120_000,
    sparkline: genSparkline("neon", 0.14, 0.04, 40, -0.04),
    logoColor: "from-[#22D3EE] to-[#06B6D4]",
    logoGlyph: "💡",
    verified: false,
    description: "Payments rail for emerging markets.",
    mint: "NeonTjSjsuo3rexg9o6vHuMXw62f9V7zvmu8M8Zut44",
  },
  {
    id: "ray",
    symbol: "RAY",
    name: "Raydium",
    chain: "SOL",
    category: "DeFi",
    price: 0.607,
    change24h: 2.84,
    change1h: 0.42,
    marketCap: 540_000_000,
    liquidity: 22_000_000,
    volume24h: 84_000_000,
    holders: 84_000,
    ageHours: 24_000,
    smartMoneyHolders: 142,
    smartMoneyInflow24h: 840_000,
    sparkline: genSparkline("ray", 2.3, 0.014, 40, 0.02),
    logoColor: "from-[#1ABC9C] to-[#16A085]",
    logoGlyph: "🔺",
    verified: true,
    description: "AMM + launchpad on Solana.",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    chain: "ETH",
    category: "L1",
    price: 3420,
    change24h: 2.18,
    change1h: 0.32,
    marketCap: 412_000_000_000,
    liquidity: 1_840_000_000,
    volume24h: 12_400_000_000,
    holders: 124_000_000,
    ageHours: 80_000,
    smartMoneyHolders: 384,
    smartMoneyInflow24h: 8_400_000,
    sparkline: genSparkline("eth", 3380, 0.008, 40, 0.02),
    logoColor: "from-[#627EEA] to-[#3B5BDB]",
    logoGlyph: "Ξ",
    verified: true,
    description: "The world's leading smart contract platform.",
  },
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    chain: "BTC",
    category: "L1",
    price: 64280,
    change24h: 1.42,
    change1h: 0.18,
    marketCap: 1_280_000_000_000,
    liquidity: 4_200_000_000,
    volume24h: 24_800_000_000,
    holders: 200_000_000,
    ageHours: 140_000,
    smartMoneyHolders: 248,
    smartMoneyInflow24h: 18_400_000,
    sparkline: genSparkline("btc", 64000, 0.005, 40, 0.01),
    logoColor: "from-[#F7931A] to-[#C7701A]",
    logoGlyph: "₿",
    verified: true,
    description: "Digital gold — the original cryptocurrency.",
  },
  {
    id: "base",
    symbol: "BASED",
    name: "Based PEPE",
    chain: "BASE",
    category: "Meme",
    price: 0.000082,
    change24h: 64.2,
    change1h: 18.4,
    marketCap: 18_400_000,
    liquidity: 1_400_000,
    volume24h: 12_400_000,
    holders: 8_400,
    ageHours: 84,
    smartMoneyHolders: 32,
    smartMoneyInflow24h: 420_000,
    sparkline: genSparkline("base", 0.00004, 0.12, 40, 0.18),
    logoColor: "from-[#22C55E] to-[#15803D]",
    logoGlyph: "🐸",
    verified: false,
    description: "Base-chain Pepe variant — fresh launch, high attention.",
  },
];

export const TOKENS_BY_ID: Record<string, Token> = Object.fromEntries(
  TOKENS.map((t) => [t.id, t])
);

// ---------- TRADERS ----------

export const TRADERS: Trader[] = [
  {
    id: "t1",
    handle: "0xMoby",
    displayName: "Moby Maxi",
    avatarColor: "from-[#14F195] to-[#9945FF]",
    avatarGlyph: "M",
    bio: "Onchain since genesis. Sniping early entries on Solana.",
    followers: 184_000,
    following: false,
    winRate: 78,
    pnl30d: 4_280_000,
    pnl30dPct: 412,
    roiAllTime: 12_400,
    rank: 1,
    smartScore: 96,
    tags: ["Whale", "Sniper", "Solana"],
    chains: ["SOL"],
    topHoldings: [
      { symbol: "SOL", pct: 32 },
      { symbol: "WIF", pct: 18 },
      { symbol: "JUP", pct: 12 },
      { symbol: "BONK", pct: 9 },
    ],
    recentTrades: [],
    isLive: true,
  },
  {
    id: "t2",
    handle: "WhaleScoop",
    displayName: "Scoop",
    avatarColor: "from-[#F59E0B] to-[#EF4444]",
    avatarGlyph: "W",
    bio: "Watching the big wallets so you don't have to.",
    followers: 92_400,
    following: true,
    winRate: 71,
    pnl30d: 2_140_000,
    pnl30dPct: 284,
    roiAllTime: 6_200,
    rank: 2,
    smartScore: 92,
    tags: ["Whale", "Tracker"],
    chains: ["SOL", "ETH"],
    topHoldings: [
      { symbol: "ETH", pct: 28 },
      { symbol: "SOL", pct: 22 },
      { symbol: "RNDR", pct: 14 },
    ],
    recentTrades: [],
    isLive: false,
  },
  {
    id: "t3",
    handle: "SolanaSage",
    displayName: "Sage",
    avatarColor: "from-[#8B5CF6] to-[#6366F1]",
    avatarGlyph: "S",
    bio: "L1 maximalist with a soft spot for DePIN.",
    followers: 64_200,
    following: false,
    winRate: 68,
    pnl30d: 1_420_000,
    pnl30dPct: 198,
    roiAllTime: 4_180,
    rank: 3,
    smartScore: 88,
    tags: ["KOL", "DePIN"],
    chains: ["SOL"],
    topHoldings: [
      { symbol: "SOL", pct: 42 },
      { symbol: "HNT", pct: 18 },
      { symbol: "IO", pct: 12 },
    ],
    recentTrades: [],
    isLive: true,
  },
  {
    id: "t4",
    handle: "DegenDiva",
    displayName: "Diva",
    avatarColor: "from-[#EC4899] to-[#BE185D]",
    avatarGlyph: "D",
    bio: "High-conviction memes only. 100x or zero.",
    followers: 142_000,
    following: false,
    winRate: 64,
    pnl30d: 3_140_000,
    pnl30dPct: 528,
    roiAllTime: 9_800,
    rank: 4,
    smartScore: 84,
    tags: ["Degen", "Meme"],
    chains: ["SOL", "BASE"],
    topHoldings: [
      { symbol: "WIF", pct: 24 },
      { symbol: "POPCAT", pct: 18 },
      { symbol: "BONK", pct: 14 },
    ],
    recentTrades: [],
    isLive: true,
  },
  {
    id: "t5",
    handle: "AICopilot",
    displayName: "AlphaBot",
    avatarColor: "from-[#22D3EE] to-[#0EA5E9]",
    avatarGlyph: "A",
    bio: "Quant-driven signals from on-chain data.",
    followers: 38_000,
    following: false,
    winRate: 74,
    pnl30d: 1_040_000,
    pnl30dPct: 142,
    roiAllTime: 2_800,
    rank: 5,
    smartScore: 90,
    tags: ["Quant", "AI"],
    chains: ["SOL", "ETH", "BASE"],
    topHoldings: [
      { symbol: "SOL", pct: 22 },
      { symbol: "ETH", pct: 20 },
      { symbol: "DRIFT", pct: 14 },
    ],
    recentTrades: [],
    isLive: false,
  },
  {
    id: "t6",
    handle: "FrankyFlips",
    displayName: "Franky",
    avatarColor: "from-[#10B981] to-[#047857]",
    avatarGlyph: "F",
    bio: "NFT flipper turned token sniper.",
    followers: 22_400,
    following: false,
    winRate: 61,
    pnl30d: 612_000,
    pnl30dPct: 124,
    roiAllTime: 1_840,
    rank: 6,
    smartScore: 78,
    tags: ["NFT", "Sniper"],
    chains: ["SOL"],
    topHoldings: [
      { symbol: "TNSR", pct: 22 },
      { symbol: "WIF", pct: 16 },
      { symbol: "SOL", pct: 30 },
    ],
    recentTrades: [],
    isLive: true,
  },
  {
    id: "t7",
    handle: "OnchainOwl",
    displayName: "Owl",
    avatarColor: "from-[#A855F7] to-[#7E22CE]",
    avatarGlyph: "O",
    bio: "I watch while you sleep.",
    followers: 54_000,
    following: true,
    winRate: 69,
    pnl30d: 1_820_000,
    pnl30dPct: 218,
    roiAllTime: 3_400,
    rank: 7,
    smartScore: 86,
    tags: ["Whale", "Quant"],
    chains: ["SOL", "ETH"],
    topHoldings: [
      { symbol: "ETH", pct: 24 },
      { symbol: "SOL", pct: 18 },
      { symbol: "JTO", pct: 12 },
    ],
    recentTrades: [],
    isLive: false,
  },
  {
    id: "t8",
    handle: "BaseBuilder",
    displayName: "Builder",
    avatarColor: "from-[#3B82F6] to-[#1D4ED8]",
    avatarGlyph: "B",
    bio: "Building on Base. Long-term holder.",
    followers: 18_200,
    following: false,
    winRate: 66,
    pnl30d: 412_000,
    pnl30dPct: 84,
    roiAllTime: 920,
    rank: 8,
    smartScore: 80,
    tags: ["KOL", "Base"],
    chains: ["BASE", "ETH"],
    topHoldings: [
      { symbol: "ETH", pct: 38 },
      { symbol: "BASED", pct: 12 },
    ],
    recentTrades: [],
    isLive: false,
  },
];

// ---------- WALLET-TO-TRADER MAPPING ----------
// Maps wallet labels and addresses to known trader IDs so that clicking
// any wallet anywhere in the app opens the trader portfolio detail.

const WALLET_KEYWORD_MAP: { keywords: string[]; traderId: string }[] = [
  { keywords: ["0xmoby", "moby"], traderId: "t1" },
  { keywords: ["scoop", "whalescoop"], traderId: "t2" },
  { keywords: ["sage", "solanasage"], traderId: "t3" },
  { keywords: ["diva", "degendiva"], traderId: "t4" },
  { keywords: ["alphabot", "aicopilot", "alpha bot", "mev bot"], traderId: "t5" },
  { keywords: ["franky", "flips", "frankyflips"], traderId: "t6" },
  { keywords: ["owl", "onchainowl"], traderId: "t7" },
  { keywords: ["builder", "basebuilder"], traderId: "t8" },
];

// Labels that indicate an exchange / fund / protocol — not a trader wallet.
// "Unknown" is NOT included here because unknown wallets with addresses
// should still be clickable (mapped to a trader by address hash).
const NON_TRADER_LABELS = ["binance", "cex", "jupiter", "drift", "raydium", "phantom", "paradigm", "blocksight", "fund:"];

/**
 * Try to find a trader ID from a wallet label or address.
 * Returns null if the wallet doesn't map to any known trader.
 */
export function findTraderForWallet(label: string, address?: string): string | null {
  const haystack = `${label} ${address ?? ""}`.toLowerCase();

  // Check if it's an exchange / fund / protocol (but NOT "unknown")
  if (NON_TRADER_LABELS.some((kw) => haystack.includes(kw))) {
    return null;
  }

  // Try keyword matching first
  for (const entry of WALLET_KEYWORD_MAP) {
    if (entry.keywords.some((kw) => haystack.includes(kw))) {
      return entry.traderId;
    }
  }

  // For "Smart Wallet #XXXX" labels, assign to the top smart trader
  // (rotation based on the number in the label for variety)
  if (haystack.includes("smart wallet")) {
    const numMatch = label.match(/#?(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      const traderIds = ["t1", "t3", "t5", "t7", "t2", "t6"];
      return traderIds[num % traderIds.length];
    }
    return "t1";
  }

  // For "Sniper:" labels, assign to the sniper trader
  if (haystack.includes("sniper")) {
    return "t6";
  }

  // For "Whale:" labels without a known name, assign to the top whale
  if (haystack.includes("whale")) {
    return "t2";
  }

  // For "KOL:" labels without a known name, assign to a KOL trader
  if (haystack.includes("kol")) {
    return "t4";
  }

  // For generic/unknown labels with an address, map to a trader by address hash
  if (address && address.startsWith("0x")) {
    const hash = hashSeed(address);
    const traderIds = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
    return traderIds[hash % traderIds.length];
  }

  return null;
}

/**
 * Get a display profile for any wallet — either a known trader or a
 * generated profile based on the label.
 */
export function getWalletProfile(label: string, address?: string): {
  traderId: string | null;
  displayName: string;
  handle: string;
  avatarGlyph: string;
  avatarColor: string;
  score: number;
  isSmart: boolean;
  type: "trader" | "whale" | "smart_wallet" | "fund" | "cex" | "mev" | "kol" | "unknown";
} {
  const traderId = findTraderForWallet(label, address);
  const lower = label.toLowerCase();

  // Determine wallet type
  let type: "trader" | "whale" | "smart_wallet" | "fund" | "cex" | "mev" | "kol" | "unknown" = "unknown";
  if (lower.includes("binance") || lower.includes("cex")) type = "cex";
  else if (lower.includes("fund")) type = "fund";
  else if (lower.includes("mev")) type = "mev";
  else if (lower.includes("kol")) type = "kol";
  else if (lower.includes("smart wallet")) type = "smart_wallet";
  else if (lower.includes("whale")) type = "whale";
  else if (traderId) type = "trader";

  if (traderId) {
    const trader = TRADERS.find((t) => t.id === traderId);
    if (trader) {
      return {
        traderId,
        displayName: trader.displayName,
        handle: trader.handle,
        avatarGlyph: trader.avatarGlyph,
        avatarColor: trader.avatarColor,
        score: trader.smartScore,
        isSmart: true,
        type: "trader",
      };
    }
  }

  // Generate a profile for non-trader wallets
  const score = 60 + Math.floor(seededRand(`wallet-${label}-${address ?? ""}`) * 38);
  return {
    traderId: null,
    displayName: label,
    handle: label.replace(/\s+/g, "").replace(/#/g, ""),
    avatarGlyph: label[0]?.toUpperCase() ?? "?",
    avatarColor: "from-[#64748B] to-[#334155]",
    score,
    isSmart: type === "smart_wallet" || type === "mev",
    type,
  };
}

// ---------- WHALE FLOWS ----------

const flowTokens = ["SOL", "WIF", "JUP", "BONK", "POPCAT", "JTO", "DRIFT", "IO", "TNSR", "MNGO", "MOON", "BASED"];

// Deterministic hex string generator — seeded by an index.
function seededHex(key: string, len: number): string {
  const rng = makeRng(hashSeed(key));
  let out = "";
  for (let i = 0; i < len; i++) {
    out += Math.floor(rng() * 16).toString(16);
  }
  return out;
}

function randomFlow(i: number): WhaleFlow {
  const tk = flowTokens[i % flowTokens.length];
  const tok = TOKENS.find((t) => t.symbol === tk) || TOKENS[0];
  const types: WhaleFlow["type"][] = ["ACCUMULATE", "DISTRIBUTE", "NEW_POSITION", "EXIT"];
  const type = types[i % 4];
  const usd = [42_000, 180_000, 612_000, 1_240_000, 2_840_000, 8_400_000][i % 6];
  const labels = [
    "Smart Wallet #4218",
    "Whale: 0xMoby",
    "CEX Outflow",
    "MEV Bot Alpha",
    "Fund: BlockSight",
    "KOL: DegenDiva",
    "Sniper: 0xAB...12F4",
    "Smart Wallet #9821",
  ];
  const r1 = seededRand(`flow-${i}-score`);
  const r2 = seededRand(`flow-${i}-ago`);
  const r3 = seededRand(`flow-${i}-impact`);
  return {
    id: `wf-${i}`,
    type,
    tokenSymbol: tok.symbol,
    tokenName: tok.name,
    chain: tok.chain,
    usdValue: usd,
    walletLabel: labels[i % labels.length],
    walletAddress: `0x${seededHex(`flow-${i}-addr1`, 6)}...${seededHex(`flow-${i}-addr2`, 4)}`,
    walletScore: 60 + Math.floor(r1 * 40),
    agoSeconds: 12 + i * 47 + Math.floor(r2 * 30),
    priceImpact: Number((r3 * 4.2).toFixed(2)),
    txHash: `0x${seededHex(`flow-${i}-tx`, 10)}...`,
  };
}

export const WHALE_FLOWS: WhaleFlow[] = Array.from({ length: 24 }, (_, i) => randomFlow(i));

// ---------- TRADER RECENT TRADES ----------

function genTraderTrades(traderId: string, count: number): TraderTrade[] {
  const trades: TraderTrade[] = [];
  for (let i = 0; i < count; i++) {
    const tk = flowTokens[(i + traderId.charCodeAt(2)) % flowTokens.length];
    const tok = TOKENS.find((t) => t.symbol === tk) || TOKENS[0];
    const sideRng = seededRand(`${traderId}-side-${i}`);
    const side: TraderTrade["side"] = sideRng > 0.4 ? "BUY" : "SELL";
    const usd = [4_200, 18_400, 84_000, 220_000, 612_000][i % 5];
    const pnlPct = side === "SELL" ? (seededRand(`${traderId}-pnl-${i}`) - 0.3) * 200 : undefined;
    trades.push({
      id: `${traderId}-tr-${i}`,
      traderId,
      tokenSymbol: tok.symbol,
      tokenName: tok.name,
      side,
      usdValue: usd,
      tokenAmount: Number((usd / tok.price).toFixed(2)),
      price: tok.price,
      chain: tok.chain,
      agoSeconds: 60 + i * 320 + Math.floor(seededRand(`${traderId}-ago-${i}`) * 100),
      pnlUsd: pnlPct !== undefined ? Number(((pnlPct / 100) * usd).toFixed(0)) : undefined,
      pnlPct,
    });
  }
  return trades;
}

TRADERS.forEach((t) => {
  t.recentTrades = genTraderTrades(t.id, 6);
});

// ---------- SMART SIGNALS ----------

export const SIGNALS: SmartSignal[] = [
  {
    id: "s1",
    tokenId: "moon",
    tokenSymbol: "MOON",
    tokenName: "MoonCat",
    type: "EARLY_ENTRY",
    title: "Early entry detected",
    description: "3 smart wallets bought within 12 minutes of launch. Token age: 18m.",
    smartWalletsCount: 3,
    usdInflow: 612_000,
    agoSeconds: 240,
    chain: "SOL",
    confidence: 88,
  },
  {
    id: "s2",
    tokenId: "mngo",
    tokenSymbol: "MNGO",
    tokenName: "MangoDAO",
    type: "CLUSTER_BUY",
    title: "Cluster buy signal",
    description: "7 smart wallets accumulated in the last hour. Net inflow: $1.24M.",
    smartWalletsCount: 7,
    usdInflow: 1_240_000,
    agoSeconds: 1840,
    chain: "SOL",
    confidence: 92,
  },
  {
    id: "s3",
    tokenId: "wif",
    tokenSymbol: "WIF",
    tokenName: "dogwifhat",
    type: "WHALE_ACCUMULATION",
    title: "Whale accumulation",
    description: "Top-ranked wallet scooped 280K WIF ($795K) from open market.",
    smartWalletsCount: 2,
    usdInflow: 1_120_000,
    agoSeconds: 640,
    chain: "SOL",
    confidence: 84,
  },
  {
    id: "s4",
    tokenId: "io",
    tokenSymbol: "IO",
    tokenName: "io.net",
    type: "SMART_MONEY_ENTRY",
    title: "Smart money entry",
    description: "5 high win-rate wallets opened new positions in last 4 hours.",
    smartWalletsCount: 5,
    usdInflow: 980_000,
    agoSeconds: 4200,
    chain: "SOL",
    confidence: 81,
  },
  {
    id: "s5",
    tokenId: "drift",
    tokenSymbol: "DRIFT",
    tokenName: "Drift Protocol",
    type: "TRENDING",
    title: "Trending on-chain",
    description: "24h volume up 142%. Smart money inflow accelerating.",
    smartWalletsCount: 8,
    usdInflow: 1_840_000,
    agoSeconds: 7200,
    chain: "SOL",
    confidence: 76,
  },
  {
    id: "s6",
    tokenId: "based",
    tokenSymbol: "BASED",
    tokenName: "Based PEPE",
    type: "EARLY_ENTRY",
    title: "Early entry detected",
    description: "2 smart wallets bridged from SOL to enter within hours of launch.",
    smartWalletsCount: 2,
    usdInflow: 420_000,
    agoSeconds: 980,
    chain: "BASE",
    confidence: 72,
  },
  {
    id: "s7",
    tokenId: "bonk",
    tokenSymbol: "BONK",
    tokenName: "Bonk",
    type: "DIVERGENCE",
    title: "Smart money divergence",
    description: "Price up 22% but 3 top wallets reduced exposure. Watch for distribution.",
    smartWalletsCount: 3,
    usdInflow: -412_000,
    agoSeconds: 1800,
    chain: "SOL",
    confidence: 64,
  },
  {
    id: "s8",
    tokenId: "popcat",
    tokenSymbol: "POPCAT",
    tokenName: "Popcat",
    type: "WHALE_ACCUMULATION",
    title: "Whale accumulation",
    description: "Win-rate 78% wallet added 420K POPCAT in a single block.",
    smartWalletsCount: 4,
    usdInflow: 1_420_000,
    agoSeconds: 3600,
    chain: "SOL",
    confidence: 86,
  },
];

// ---------- NARRATIVES ----------

export const NARRATIVES: Narrative[] = [
  {
    id: "n1",
    name: "AI Agents",
    emoji: "🤖",
    change24h: 12.4,
    mentions24h: 4_200,
    topTokens: ["io", "rndr", "jup"],
    color: "from-[#22D3EE] to-[#0EA5E9]",
    description: "Tokens building AI-native infrastructure and on-chain agents.",
  },
  {
    id: "n2",
    name: "Meme Season",
    emoji: "🐶",
    change24h: 28.4,
    mentions24h: 8_400,
    topTokens: ["wif", "bonk", "popcat", "moon"],
    color: "from-[#F59E0B] to-[#EF4444]",
    description: "Solana meme coins are leading attention this cycle.",
  },
  {
    id: "n3",
    name: "DePIN",
    emoji: "📡",
    change24h: 4.8,
    mentions24h: 1_840,
    topTokens: ["hnt", "pyth", "io"],
    color: "from-[#A855F7] to-[#7E22CE]",
    description: "Decentralized physical infrastructure networks.",
  },
  {
    id: "n4",
    name: "Cat Coins",
    emoji: "🐱",
    change24h: 64.2,
    mentions24h: 2_400,
    topTokens: ["moon", "popcat"],
    color: "from-[#FACC15] to-[#F59E0B]",
    description: "Cat-themed memes outperforming dogs today.",
  },
  {
    id: "n5",
    name: "Solana DeFi",
    emoji: "🌊",
    change24h: 6.2,
    mentions24h: 3_100,
    topTokens: ["jup", "drift", "ray", "jto"],
    color: "from-[#9945FF] to-[#14F195]",
    description: "Solana-native DeFi protocols gaining TVL.",
  },
];

// ---------- PORTFOLIO ----------

function genPortfolioHistory(): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  let v = 142_000;
  for (let i = 0; i < 30; i++) {
    const drift = 0.012;
    const noise = (seededRand(`pfolio-${i}`) - 0.45) * 0.06;
    v = v * (1 + drift + noise);
    out.push({ t: NOW - (30 - i) * 86400_000, v: Math.round(v) });
  }
  return out;
}

export const PORTFOLIO: Portfolio = {
  cashUsd: 8_420,
  cryptoHoldings: [
    { id: "h1", tokenId: "sol", amount: 184.2, avgCost: 142.8, chain: "SOL" },
    { id: "h2", tokenId: "wif", amount: 82_400, avgCost: 1.84, chain: "SOL" },
    { id: "h3", tokenId: "jup", amount: 24_800, avgCost: 0.62, chain: "SOL" },
    { id: "h4", tokenId: "bonk", amount: 18_400_000, avgCost: 0.0000182, chain: "SOL" },
    { id: "h5", tokenId: "jto", amount: 1_240, avgCost: 2.84, chain: "SOL" },
    { id: "h6", tokenId: "drift", amount: 4_200, avgCost: 1.42, chain: "SOL" },
    { id: "h7", tokenId: "io", amount: 1_840, avgCost: 2.12, chain: "SOL" },
    { id: "h8", tokenId: "eth", amount: 4.2, avgCost: 2_840, chain: "ETH" },
  ],
  nftHoldings: [
    {
      id: "n1",
      collection: "Mad Lads",
      floorPrice: 84.2,
      count: 3,
      avgCost: 62.4,
      chain: "SOL",
      color: "from-[#8B5CF6] to-[#6366F1]",
    },
    {
      id: "n2",
      collection: "Tensorians",
      floorPrice: 42.0,
      count: 2,
      avgCost: 38.0,
      chain: "SOL",
      color: "from-[#22D3EE] to-[#0EA5E9]",
    },
    {
      id: "n3",
      collection: "Claynosaurz",
      floorPrice: 18.4,
      count: 5,
      avgCost: 22.0,
      chain: "SOL",
      color: "from-[#F59E0B] to-[#EF4444]",
    },
  ],
  stockHoldings: [
    {
      id: "st1",
      ticker: "NVDA",
      name: "NVIDIA",
      shares: 12,
      avgCost: 412.0,
      price: 842.0,
      change24h: 2.4,
      color: "from-[#22C55E] to-[#15803D]",
    },
    {
      id: "st2",
      ticker: "AAPL",
      name: "Apple",
      shares: 24,
      avgCost: 162.0,
      price: 224.0,
      change24h: -0.8,
      color: "from-[#94A3B8] to-[#475569]",
    },
    {
      id: "st3",
      ticker: "SPX",
      name: "SpaceX (Pre-IPO)",
      shares: 4,
      avgCost: 62_000,
      price: 124_000,
      change24h: 4.2,
      preipo: true,
      color: "from-[#EF4444] to-[#B91C1C]",
    },
    {
      id: "st4",
      ticker: "OAI",
      name: "OpenAI (Pre-IPO)",
      shares: 2,
      avgCost: 84_000,
      price: 184_000,
      change24h: 6.8,
      preipo: true,
      color: "from-[#10B981] to-[#047857]",
    },
  ],
  history: genPortfolioHistory(),
};

// ---------- FORMATTERS ----------

export function fmtUsd(n: number, opts?: { compact?: boolean; decimals?: number }): string {
  const compact = opts?.compact ?? false;
  const decimals = opts?.decimals ?? 2;
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(decimals)}`;
  }
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function fmtPrice(n: number): string {
  if (n >= 1000) return fmtUsd(n, { decimals: 2 });
  if (n >= 1) return `$${n.toFixed(3)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  if (n >= 0.0000001) return `$${n.toFixed(8)}`;
  if (n >= 0.0000000001) return `$${n.toFixed(11)}`;
  if (n > 0) return `$${n.toFixed(14)}`;
  return `$0`;
}

export function fmtPct(n: number, withSign = true): string {
  const sign = withSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function fmtAgo(sec: number): string {
  return agoLabel(sec);
}

/**
 * Format a token's age (in hours since mint) as a compact human-readable string.
 *   - < 1h   → "30m"
 *   - < 24h  → "2h"
 *   - < 720h (30d) → "21d"
 *   - < 8760h (365d) → "3mo"
 *   - >= 8760h → "1y", "2y"…
 */
export function fmtAge(hours: number): string {
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins}m`;
  }
  if (hours < 24) {
    // Show one decimal for < 10h, then integer hours
    return hours < 10 ? `${hours.toFixed(1).replace(/\.0$/, "")}h` : `${Math.round(hours)}h`;
  }
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months}mo`;
  }
  const years = days / 365;
  return years < 10 ? `${years.toFixed(1).replace(/\.0$/, "")}y` : `${Math.round(years)}y`;
}

/**
 * Categorize a token's age into a bucket for badges / chips.
 */
export function ageBucket(hours: number): { label: string; variant: "bull" | "gold" | "bear" | "default" } {
  if (hours < 1) return { label: "< 1h", variant: "bear" };
  if (hours < 6) return { label: "< 6h", variant: "bear" };
  if (hours < 24) return { label: "< 1d", variant: "gold" };
  if (hours < 72) return { label: "< 3d", variant: "gold" };
  if (hours < 168) return { label: "< 1w", variant: "gold" };
  if (hours < 720) return { label: "< 1mo", variant: "default" };
  if (hours < 8760) return { label: "< 1y", variant: "default" };
  return { label: "1y+", variant: "default" };
}

export function timeLabel(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------- LIVE PRICE SIMULATION ----------
// NOTE: This is called from the client at runtime (not during render), so Math.random is fine here.
export function nextPriceTick(price: number, volatility = 0.004): number {
  const drift = (Math.random() - 0.5) * 2 * volatility;
  return Math.max(0.000001, price * (1 + drift));
}

// ---------- MARKET OVERVIEW DATA ----------
// Deterministic snapshot of the global crypto market.

export interface MarketStats {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  solDominance: number;
  fearGreedIndex: number; // 0-100
  fearGreedLabel: "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed";
  fearGreedYesterday: number;
  activeCryptos: number;
  markets: number;
  ethGas: number; // gwei
  solGas: number; // lamports
  btcMcapChange24h: number;
  ethMcapChange24h: number;
  solMcapChange24h: number;
}

export const MARKET_STATS: MarketStats = {
  totalMarketCap: 2_412_000_000_000,
  totalVolume24h: 84_200_000_000,
  btcDominance: 53.2,
  ethDominance: 17.8,
  solDominance: 3.6,
  fearGreedIndex: 72,
  fearGreedLabel: "Greed",
  fearGreedYesterday: 68,
  activeCryptos: 10_842,
  markets: 1_204,
  ethGas: 18.4,
  solGas: 5_000,
  btcMcapChange24h: 1.42,
  ethMcapChange24h: 2.18,
  solMcapChange24h: 6.42,
};

// Fear & greed history (7 days) — deterministic
function genFGHistory(): number[] {
  const out: number[] = [];
  let v = 64;
  for (let i = 0; i < 7; i++) {
    const r = makeRng(hashSeed(`fg-${i}`))();
    v = Math.max(8, Math.min(92, v + (r - 0.45) * 16));
    out.push(Math.round(v));
  }
  out.push(MARKET_STATS.fearGreedIndex);
  return out;
}

export const FEAR_GREED_HISTORY: number[] = genFGHistory();

// ---------- NEWS ----------
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  agoMinutes: number;
  category: "Market" | "DeFi" | "Meme" | "AI" | "DePIN" | "Regulation" | "Macro";
  sentiment: "bullish" | "bearish" | "neutral";
  url: string;
  tokensMentioned: string[]; // token ids
}

export const NEWS: NewsItem[] = [
  {
    id: "n1",
    headline: "Solana TVL crosses $8B as DeFi summer reignites onchain activity",
    source: "The Block",
    agoMinutes: 14,
    category: "DeFi",
    sentiment: "bullish",
    url: "#",
    tokensMentioned: ["sol", "jup", "jto"],
  },
  {
    id: "n2",
    headline: "Smart money rotates into AI agent tokens as io.net volume spikes 142%",
    source: "CoinDesk",
    agoMinutes: 38,
    category: "AI",
    sentiment: "bullish",
    url: "#",
    tokensMentioned: ["io", "rndr"],
  },
  {
    id: "n3",
    headline: "WIF up 14% as whale wallets accumulate 280K tokens in single block",
    source: "Uncover",
    agoMinutes: 52,
    category: "Meme",
    sentiment: "bullish",
    url: "#",
    tokensMentioned: ["wif"],
  },
  {
    id: "n4",
    headline: "SEC delays decision on spot Solana ETF until Q1 2027",
    source: "Bloomberg",
    agoMinutes: 95,
    category: "Regulation",
    sentiment: "neutral",
    url: "#",
    tokensMentioned: ["sol"],
  },
  {
    id: "n5",
    headline: "Bonk burn program removes 18B tokens, supply down 12% in 30 days",
    source: "Decrypt",
    agoMinutes: 142,
    category: "Meme",
    sentiment: "bullish",
    url: "#",
    tokensMentioned: ["bonk"],
  },
  {
    id: "n6",
    headline: "Helium deploys 50K new hotspots in Latin America expansion",
    source: "Helium Foundation",
    agoMinutes: 188,
    category: "DePIN",
    sentiment: "bullish",
    url: "#",
    tokensMentioned: ["hnt"],
  },
  {
    id: "n7",
    headline: "Fed signals potential rate cut in September, risk assets rally",
    source: "Reuters",
    agoMinutes: 240,
    category: "Macro",
    sentiment: "bullish",
    url: "#",
    tokensMentioned: [],
  },
  {
    id: "n8",
    headline: "Drift Protocol hits $1B open interest as perps volume triples",
    source: "The Defiant",
    agoMinutes: 320,
    category: "DeFi",
    sentiment: "bullish",
    url: "#",
    tokensMentioned: ["drift"],
  },
];

// ---------- HEATMAP DATA ----------
// Top tokens by market cap with 24h % change — for market heatmap visualization.
export function getHeatmapTokens(): { id: string; symbol: string; mcap: number; change: number; color: string }[] {
  return TOKENS.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    mcap: t.marketCap,
    change: t.change24h,
    color: t.logoColor,
  })).sort((a, b) => b.mcap - a.mcap);
}

// ---------- TAX CALCULATOR DATA ----------
// Simulated realized P&L events for the year.
export interface TaxEvent {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  date: string; // ISO date
  type: "SELL" | "SWAP" | "TRANSFER";
  proceeds: number;
  costBasis: number;
  gain: number;
  holdingPeriodDays: number; // <365 = short-term
  chain: string;
}

function genTaxEvents(): TaxEvent[] {
  const symbols = ["SOL", "WIF", "JUP", "BONK", "JTO", "DRIFT", "IO", "ETH"];
  const chains = ["SOL", "ETH"];
  const events: TaxEvent[] = [];
  for (let i = 0; i < 18; i++) {
    const sym = symbols[i % symbols.length];
    const chain = chains[i % 2];
    const proceeds = 800 + (i + 1) * 1240;
    const costBasis = proceeds * (0.4 + (i % 5) * 0.18);
    const gain = proceeds - costBasis;
    const holdingDays = 20 + i * 38;
    const month = 1 + (i % 12);
    const day = 1 + (i * 7) % 27;
    events.push({
      id: `tax-${i}`,
      tokenId: sym.toLowerCase(),
      tokenSymbol: sym,
      date: `2026-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
      type: i % 7 === 6 ? "SWAP" : i % 11 === 10 ? "TRANSFER" : "SELL",
      proceeds: Math.round(proceeds),
      costBasis: Math.round(costBasis),
      gain: Math.round(gain),
      holdingPeriodDays: holdingDays,
      chain,
    });
  }
  return events;
}

export const TAX_EVENTS: TaxEvent[] = genTaxEvents();

export function computeTaxSummary() {
  let shortGain = 0;
  let longGain = 0;
  let totalProceeds = 0;
  let totalCost = 0;
  const byChain: Record<string, number> = {};
  const byToken: Record<string, number> = {};

  TAX_EVENTS.forEach((e) => {
    if (e.type === "TRANSFER") return; // transfers are not taxable
    totalProceeds += e.proceeds;
    totalCost += e.costBasis;
    if (e.holdingPeriodDays < 365) {
      shortGain += e.gain;
    } else {
      longGain += e.gain;
    }
    byChain[e.chain] = (byChain[e.chain] ?? 0) + e.gain;
    byToken[e.tokenSymbol] = (byToken[e.tokenSymbol] ?? 0) + e.gain;
  });

  // Assume 32% short-term, 15% long-term (US-like)
  const shortTermTax = shortGain * 0.32;
  const longTermTax = longGain * 0.15;
  const totalTax = shortTermTax + longTermTax;
  const netGain = shortGain + longGain;

  return {
    shortGain,
    longGain,
    netGain,
    shortTermTax,
    longTermTax,
    totalTax,
    totalProceeds,
    totalCost,
    byChain,
    byToken,
    eventCount: TAX_EVENTS.filter((e) => e.type !== "TRANSFER").length,
  };
}

// ---------- TOKEN LAUNCH CALENDAR ----------
export interface LaunchEvent {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  date: string; // ISO
  chain: string;
  category: string;
  status: "upcoming" | "live" | "ended";
  raiseUsd?: number;
  color: string;
  glyph?: string;
}

export const LAUNCHES: LaunchEvent[] = [
  {
    id: "l1",
    tokenSymbol: "NEURAL",
    tokenName: "NeuralAI",
    date: "2026-08-03",
    chain: "SOL",
    category: "AI",
    status: "upcoming",
    raiseUsd: 12_000_000,
    color: "from-[#22D3EE] to-[#0EA5E9]",
    glyph: "🧠",
  },
  {
    id: "l2",
    tokenSymbol: "WARP",
    tokenName: "WarpFi",
    date: "2026-08-05",
    chain: "SOL",
    category: "DeFi",
    status: "upcoming",
    raiseUsd: 8_400_000,
    color: "from-[#9945FF] to-[#14F195]",
    glyph: "🪐",
  },
  {
    id: "l3",
    tokenSymbol: "DOGEX",
    tokenName: "DogeX",
    date: "2026-08-07",
    chain: "SOL",
    category: "Meme",
    status: "upcoming",
    raiseUsd: 1_200_000,
    color: "from-[#F59E0B] to-[#EF4444]",
    glyph: "🐕",
  },
  {
    id: "l4",
    tokenSymbol: "GRID",
    tokenName: "GridNet",
    date: "2026-08-09",
    chain: "SOL",
    category: "DePIN",
    status: "upcoming",
    raiseUsd: 4_200_000,
    color: "from-[#A855F7] to-[#7E22CE]",
    glyph: "📡",
  },
];

// ---------- WALLET CONNECT OPTIONS ----------
export interface WalletOption {
  id: string;
  name: string;
  glyph: string;
  color: string;
  description: string;
  installed: boolean;
  recommended?: boolean;
}

export const WALLETS: WalletOption[] = [
  {
    id: "phantom",
    name: "Phantom",
    glyph: "👻",
    color: "from-[#AB9FF2] to-[#7B3FE4]",
    description: "Most popular Solana wallet",
    installed: true,
    recommended: true,
  },
  {
    id: "solflare",
    name: "Solflare",
    glyph: "🔆",
    color: "from-[#F5A623] to-[#E94E1B]",
    description: "Native Solana wallet with staking",
    installed: false,
  },
  {
    id: "backpack",
    name: "Backpack",
    glyph: "🎒",
    color: "from-[#22D3EE] to-[#0EA5E9]",
    description: "xNFT-enabled multichain wallet",
    installed: false,
  },
  {
    id: "metamask",
    name: "MetaMask",
    glyph: "🦊",
    color: "from-[#F6851B] to-[#E2761B]",
    description: "Ethereum & EVM chains",
    installed: false,
  },
  {
    id: "keplr",
    name: "Keplr",
    glyph: "🦜",
    color: "from-[#22C55E] to-[#15803D]",
    description: "Cosmos ecosystem",
    installed: false,
  },
  {
    id: "wc",
    name: "WalletConnect",
    glyph: "🔗",
    color: "from-[#3B82F6] to-[#1D4ED8]",
    description: "Scan with any mobile wallet",
    installed: true,
  },
];

// ---------- WALLET ACTIVITY / TRANSACTION HISTORY ----------
export interface WalletActivity {
  id: string;
  type: "SWAP" | "TRANSFER_IN" | "TRANSFER_OUT" | "STAKE" | "UNSTAKE" | "MINT" | "BURN" | "BRIDGE";
  tokenSymbol: string;
  tokenName: string;
  amount: number;
  usdValue: number;
  counterparty: string;
  counterpartyLabel?: string;
  chain: Chain;
  agoSeconds: number;
  txHash: string;
  status: "confirmed" | "pending" | "failed";
  blockHeight: number;
  gasUsd: number;
}

const activityTypes: WalletActivity["type"][] = [
  "SWAP", "TRANSFER_IN", "TRANSFER_OUT", "STAKE", "UNSTAKE", "MINT", "BURN", "BRIDGE"
];
const activityTokens = ["SOL", "WIF", "JUP", "BONK", "JTO", "DRIFT", "IO", "ETH"];

function genWalletActivity(): WalletActivity[] {
  const out: WalletActivity[] = [];
  for (let i = 0; i < 24; i++) {
    const type = activityTypes[i % activityTypes.length];
    const sym = activityTokens[i % activityTokens.length];
    const tok = TOKENS.find((t) => t.symbol === sym) || TOKENS[0];
    const usd = [42, 180, 612, 1_240, 2_840, 8_400, 18_400][i % 7];
    const isIncoming = type === "TRANSFER_IN" || type === "MINT" || type === "UNSTAKE";
    out.push({
      id: `wa-${i}`,
      type,
      tokenSymbol: tok.symbol,
      tokenName: tok.name,
      amount: Number((usd / tok.price).toFixed(2)),
      usdValue: usd,
      counterparty: `0x${seededHex(`wa-${i}-addr`, 8)}...${seededHex(`wa-${i}-addr2`, 4)}`,
      counterpartyLabel: ["Jupiter", "Drift", "Raydium", "Phantom", "Unknown"][i % 5],
      chain: tok.chain,
      agoSeconds: 60 + i * 412 + Math.floor(seededRand(`wa-${i}-ago`) * 100),
      txHash: `0x${seededHex(`wa-${i}-tx`, 10)}...`,
      status: i % 17 === 16 ? "failed" : i % 11 === 10 ? "pending" : "confirmed",
      blockHeight: 284_000_000 + i * 1_842,
      gasUsd: 0.0008 + (i % 4) * 0.0004,
    });
  }
  return out;
}

export const WALLET_ACTIVITY: WalletActivity[] = genWalletActivity();

// ---------- SOLANA ECOSYSTEM STATS ----------
export interface SolanaStats {
  tps: number;
  tpsPeak24h: number;
  tpsAvg7d: number;
  tvl: number;
  tvlChange24h: number;
  validators: number;
  activeValidators: number;
  nakamotoCoefficient: number;
  blockTime: number; // ms
  slotTime: number; // ms
  epoch: number;
  epochProgress: number; // 0-1
  epochTimeRemaining: string;
  stake: number;
  apy: number;
  feeBurned24h: number;
  newAccounts24h: number;
  activeWallets7d: number;
  programsDeployed: number;
}

export const SOLANA_STATS: SolanaStats = {
  tps: 3_842,
  tpsPeak24h: 4_920,
  tpsAvg7d: 3_640,
  tvl: 8_240_000_000,
  tvlChange24h: 4.2,
  validators: 1_842,
  activeValidators: 1_612,
  nakamotoCoefficient: 32,
  blockTime: 400,
  slotTime: 412,
  epoch: 712,
  epochProgress: 0.62,
  epochTimeRemaining: "1d 14h",
  stake: 84_200_000_000,
  apy: 6.84,
  feeBurned24h: 184_200,
  newAccounts24h: 42_400,
  activeWallets7d: 1_240_000,
  programsDeployed: 5_400,
};

// Solana TVL history (30d) — deterministic
function genSolanaTvlHistory(): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  let v = 7_240_000_000;
  for (let i = 0; i < 30; i++) {
    const noise = (seededRand(`sol-tvl-${i}`) - 0.4) * 0.04;
    v = v * (1 + 0.012 + noise);
    out.push({ t: NOW - (30 - i) * 86400_000, v: Math.round(v) });
  }
  return out;
}

export const SOLANA_TVL_HISTORY: { t: number; v: number }[] = genSolanaTvlHistory();

// ---------- PNL LEADERBOARD ----------
export interface PnlEntry {
  id: string;
  handle: string;
  displayName: string;
  avatarColor: string;
  avatarGlyph: string;
  period: "daily" | "weekly" | "allTime";
  pnlUsd: number;
  pnlPct: number;
  trades: number;
  winRate: number;
  bestTrade: string;
  rank: number;
}

function genPnlLeaderboard(period: PnlEntry["period"]): PnlEntry[] {
  const handles = [
    { h: "0xMoby", n: "Moby Maxi", c: "from-[#14F195] to-[#9945FF]", g: "M" },
    { h: "DegenDiva", n: "Diva", c: "from-[#EC4899] to-[#BE185D]", g: "D" },
    { h: "WhaleScoop", n: "Scoop", c: "from-[#F59E0B] to-[#EF4444]", g: "W" },
    { h: "SolanaSage", n: "Sage", c: "from-[#8B5CF6] to-[#6366F1]", g: "S" },
    { h: "OnchainOwl", n: "Owl", c: "from-[#A855F7] to-[#7E22CE]", g: "O" },
    { h: "AICopilot", n: "AlphaBot", c: "from-[#22D3EE] to-[#0EA5E9]", g: "A" },
    { h: "FrankyFlips", n: "Franky", c: "from-[#10B981] to-[#047857]", g: "F" },
    { h: "BaseBuilder", n: "Builder", c: "from-[#3B82F6] to-[#1D4ED8]", g: "B" },
    { h: "MoonBoy", n: "MoonBoy", c: "from-[#FACC15] to-[#F59E0B]", g: "X" },
    { h: "SolSniper", n: "Sniper", c: "from-[#EF4444] to-[#B91C1C]", g: "S" },
  ];
  const multipliers = period === "daily" ? 1 : period === "weekly" ? 7 : 240;
  return handles.map((h, i) => {
    const seed = `${period}-${i}`;
    const base = (period === "daily" ? 84_000 : period === "weekly" ? 412_000 : 2_840_000);
    const pnl = base * (1 + i * 0.42) * (0.5 + seededRand(seed) * 1.5);
    return {
      id: `${period}-${i}`,
      handle: h.h,
      displayName: h.n,
      avatarColor: h.c,
      avatarGlyph: h.g,
      period,
      pnlUsd: Math.round(pnl * multipliers / (period === "allTime" ? 1 : 1)),
      pnlPct: Number(((seededRand(`${seed}-pct`) * 2 - 0.3) * 100).toFixed(1)),
      trades: 4 + Math.floor(seededRand(`${seed}-t`) * 28),
      winRate: 55 + Math.floor(seededRand(`${seed}-w`) * 40),
      bestTrade: ["WIF", "BONK", "POPCAT", "JUP", "MNGO", "DRIFT", "IO"][i % 7],
      rank: i + 1,
    };
  }).sort((a, b) => b.pnlUsd - a.pnlUsd).map((e, i) => ({ ...e, rank: i + 1 }));
}

export const PNL_DAILY: PnlEntry[] = genPnlLeaderboard("daily");
export const PNL_WEEKLY: PnlEntry[] = genPnlLeaderboard("weekly");
export const PNL_ALLTIME: PnlEntry[] = genPnlLeaderboard("allTime");

// ---------- SOCIAL SENTIMENT ----------
export interface SocialMention {
  id: string;
  platform: "twitter" | "farcaster" | "telegram" | "discord";
  author: string;
  authorHandle: string;
  avatarColor: string;
  content: string;
  agoMinutes: number;
  likes: number;
  retweets: number;
  replies: number;
  sentiment: "bullish" | "bearish" | "neutral";
  tokenMentions: string[];
  verified?: boolean;
}

export const SOCIAL_MENTIONS: SocialMention[] = [
  {
    id: "sm1",
    platform: "twitter",
    author: "Moby",
    authorHandle: "@moby",
    avatarColor: "from-[#14F195] to-[#9945FF]",
    content: "7 smart wallets just loaded up on $WIF within 12 minutes. This is the strongest cluster signal we've seen this week.",
    agoMinutes: 8,
    likes: 1240,
    retweets: 412,
    replies: 89,
    sentiment: "bullish",
    tokenMentions: ["wif"],
    verified: true,
  },
  {
    id: "sm2",
    platform: "twitter",
    author: "DegenDiva",
    authorHandle: "@degendiva",
    avatarColor: "from-[#EC4899] to-[#BE185D]",
    content: "Meme season is BACK. $BONK +22% and $POPCAT +18% in 24h. Cats are next — watch $MOON 👀",
    agoMinutes: 24,
    likes: 820,
    retweets: 184,
    replies: 42,
    sentiment: "bullish",
    tokenMentions: ["bonk", "popcat", "moon"],
    verified: true,
  },
  {
    id: "sm3",
    platform: "farcaster",
    author: "Sage",
    authorHandle: "sage",
    avatarColor: "from-[#8B5CF6] to-[#6366F1]",
    content: "Solana TVL crossed $8B. DePIN narrative is heating up — $HNT deployments accelerating in LatAm.",
    agoMinutes: 42,
    likes: 412,
    retweets: 84,
    replies: 28,
    sentiment: "bullish",
    tokenMentions: ["hnt"],
  },
  {
    id: "sm4",
    platform: "twitter",
    author: "Bear Capital",
    authorHandle: "@bearcap",
    avatarColor: "from-[#94A3B8] to-[#475569]",
    content: "Warning: $HNT is up but smart money is actually distributing. Top 3 wallets reduced exposure by 12% this week. Be careful.",
    agoMinutes: 68,
    likes: 312,
    retweets: 92,
    replies: 64,
    sentiment: "bearish",
    tokenMentions: ["hnt"],
  },
  {
    id: "sm5",
    platform: "telegram",
    author: "AlphaBot",
    authorHandle: "@alphabot",
    avatarColor: "from-[#22D3EE] to-[#0EA5E9]",
    content: "🚨 NEW SIGNAL: $MNGO cluster buy detected — 7 smart wallets, $1.24M inflow, 92% confidence. Setting up for a move.",
    agoMinutes: 92,
    likes: 642,
    retweets: 218,
    replies: 84,
    sentiment: "bullish",
    tokenMentions: ["mngo"],
    verified: true,
  },
  {
    id: "sm6",
    platform: "twitter",
    author: "MoonBoy",
    authorHandle: "@moonboy",
    avatarColor: "from-[#FACC15] to-[#F59E0B]",
    content: "$MOON launching 18h ago already 142% up. Cat season narrative is real. 🌙🐈",
    agoMinutes: 124,
    likes: 284,
    retweets: 64,
    replies: 22,
    sentiment: "bullish",
    tokenMentions: ["moon"],
  },
  {
    id: "sm7",
    platform: "discord",
    author: "FrankyFlips",
    authorHandle: "franky",
    avatarColor: "from-[#10B981] to-[#047857]",
    content: "Just sniped $TNSR at 0.42 — smart money has been quietly accumulating for 3 days. NFTs next leg up imo.",
    agoMinutes: 168,
    likes: 184,
    retweets: 32,
    replies: 18,
    sentiment: "bullish",
    tokenMentions: ["tensor"],
  },
  {
    id: "sm8",
    platform: "twitter",
    author: "OnchainOwl",
    authorHandle: "@onchainowl",
    avatarColor: "from-[#A855F7] to-[#7E22CE]",
    content: "Stats don't lie:\n\n$SOL +6.4% in 24h\n$ETH +2.2%\n$BTC +1.4%\n\nSolana is leading the pack. Smart money is rotating in.",
    agoMinutes: 210,
    likes: 1_120,
    retweets: 312,
    replies: 124,
    sentiment: "bullish",
    tokenMentions: ["sol", "eth", "btc"],
    verified: true,
  },
];

// Aggregate social stats per token
export interface SocialStats {
  tokenId: string;
  symbol: string;
  mentions24h: number;
  mentionsChange24h: number;
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
  engagementScore: number; // 0-100
}

export const SOCIAL_STATS: SocialStats[] = TOKENS.slice(0, 12).map((t, i) => {
  const mentions = 100 + Math.floor(seededRand(`social-${t.id}`) * 5_000);
  const bullish = 40 + Math.floor(seededRand(`bull-${t.id}`) * 50);
  const bearish = Math.floor(seededRand(`bear-${t.id}`) * 30);
  const neutral = 100 - bullish - bearish;
  return {
    tokenId: t.id,
    symbol: t.symbol,
    mentions24h: mentions,
    mentionsChange24h: Number(((seededRand(`chg-${t.id}`) - 0.3) * 200).toFixed(1)),
    bullishPct: bullish,
    bearishPct: bearish,
    neutralPct: neutral,
    engagementScore: 30 + Math.floor(seededRand(`eng-${t.id}`) * 70),
  };
});

// ---------- TOKEN HOLDER DISTRIBUTION ----------
export interface HolderDistribution {
  label: string;
  pct: number;
  count: number;
  color: string;
}

export function getHolderDistribution(tokenId: string): HolderDistribution[] {
  // Deterministic per token
  const seed = tokenId;
  const whales = 5 + Math.floor(seededRand(`${seed}-w`) * 8);
  const institutions = 8 + Math.floor(seededRand(`${seed}-i`) * 12);
  const smartMoney = 12 + Math.floor(seededRand(`${seed}-s`) * 18);
  const retail = 100 - whales - institutions - smartMoney;
  return [
    { label: "Whales", pct: whales, count: Math.floor(seededRand(`${seed}-wc`) * 80) + 20, color: "#9945FF" },
    { label: "Institutions", pct: institutions, count: Math.floor(seededRand(`${seed}-ic`) * 30) + 5, color: "#22D3EE" },
    { label: "Smart money", pct: smartMoney, count: Math.floor(seededRand(`${seed}-sc`) * 200) + 50, color: "#14F195" },
    { label: "Retail", pct: retail, count: Math.floor(seededRand(`${seed}-rc`) * 50_000) + 10_000, color: "#F59E0B" },
  ];
}

// Top holders (deterministic per token)
export interface TopHolder {
  rank: number;
  address: string;
  label: string;
  amount: number;
  pct: number;
  usdValue: number;
  change24h: number; // percent change in holdings
  isSmart: boolean;
}

export function getTopHolders(tokenId: string, count = 8): TopHolder[] {
  const token = TOKENS_BY_ID[tokenId];
  if (!token) return [];
  const labels = [
    "Binance Hot Wallet", "CEX Cold Storage", "Smart Wallet #4218",
    "Fund: BlockSight", "MEV Bot Alpha", "Smart Wallet #9821",
    "KOL: DegenDiva", "Fund: Paradigm", "Smart Wallet #1822",
    "Retail Whale"
  ];
  return Array.from({ length: count }, (_, i) => {
    const pct = (15 - i * 1.4) * (0.8 + seededRand(`${tokenId}-h-${i}`) * 0.4);
    const amount = (token.marketCap * pct / 100) / token.price;
    return {
      rank: i + 1,
      address: `0x${seededHex(`${tokenId}-ha-${i}`, 8)}...${seededHex(`${tokenId}-hb-${i}`, 4)}`,
      label: labels[i % labels.length],
      amount: Number(amount.toFixed(2)),
      pct: Number(pct.toFixed(2)),
      usdValue: Math.round(amount * token.price),
      change24h: Number(((seededRand(`${tokenId}-hc-${i}`) - 0.4) * 20).toFixed(2)),
      isSmart: i === 2 || i === 5 || i === 8,
    };
  });
}

// ---------- DCA STRATEGIES (presets) ----------
export interface DcaPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tokens: string[];
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  amountUsd: number;
  expectedApy: number;
  riskLevel: "low" | "medium" | "high";
  followers: number;
}

export const DCA_PRESETS: DcaPreset[] = [
  {
    id: "dca1",
    name: "Solana Blue Chip",
    emoji: "🌊",
    description: "Dollar-cost into SOL + JUP + JTO — the core of Solana DeFi.",
    tokens: ["sol", "jup", "jto"],
    frequency: "weekly",
    amountUsd: 200,
    expectedApy: 42,
    riskLevel: "medium",
    followers: 8_400,
  },
  {
    id: "dca2",
    name: "AI Infrastructure",
    emoji: "🧠",
    description: "AI agent tokens building real infrastructure on Solana.",
    tokens: ["io", "rndr"],
    frequency: "weekly",
    amountUsd: 150,
    expectedApy: 68,
    riskLevel: "high",
    followers: 3_200,
  },
  {
    id: "dca3",
    name: "DePIN Basket",
    emoji: "📡",
    description: "Decentralized physical infrastructure — long-term hold.",
    tokens: ["hnt", "io", "pyth"],
    frequency: "biweekly",
    amountUsd: 300,
    expectedApy: 28,
    riskLevel: "low",
    followers: 1_840,
  },
  {
    id: "dca4",
    name: "Meme Basket",
    emoji: "🐕",
    description: "Equal-weight WIF + BONK + POPCAT. High volatility, high upside.",
    tokens: ["wif", "bonk", "popcat"],
    frequency: "daily",
    amountUsd: 50,
    expectedApy: 142,
    riskLevel: "high",
    followers: 12_400,
  },
  {
    id: "dca5",
    name: "BTC + ETH + SOL",
    emoji: "👑",
    description: "The big three. Lowest risk, slowest growth.",
    tokens: ["btc", "eth", "sol"],
    frequency: "monthly",
    amountUsd: 500,
    expectedApy: 18,
    riskLevel: "low",
    followers: 24_200,
  },
];

// ---------- REFERRAL PROGRAM ----------
export interface ReferralStats {
  code: string;
  link: string;
  referrals: number;
  activeReferrals: number;
  earningsUsd: number;
  pendingUsd: number;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  nextTierProgress: number; // 0-1
  nextTierName: string;
  rewardPerReferral: number;
}

export const REFERRAL_STATS: ReferralStats = {
  code: "MOBY-ZTRADER",
  link: "moby.win/r/ZTRADER",
  referrals: 18,
  activeReferrals: 12,
  earningsUsd: 412,
  pendingUsd: 84,
  tier: "Silver",
  nextTierProgress: 0.6,
  nextTierName: "Gold",
  rewardPerReferral: 25,
};

export const REFERRAL_TIERS = [
  { name: "Bronze", min: 0, reward: 10, perk: "10% of referral fees" },
  { name: "Silver", min: 10, reward: 25, perk: "15% of referral fees + 1 mo Pro" },
  { name: "Gold", min: 50, reward: 50, perk: "20% of referral fees + 3 mo Pro" },
  { name: "Platinum", min: 200, reward: 100, perk: "25% of referral fees + lifetime Pro" },
];

// ---------- PERPETUALS TRADING ----------
export interface PerpMarket {
  id: string;
  symbol: string;
  name: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number; // 8h rate, percent
  nextFundingMs: number;
  openInterestUsd: number;
  openInterestLong: number; // percent
  openInterestShort: number;
  volume24h: number;
  maxLeverage: number;
  priceChange24h: number;
  color: string;
  glyph?: string;
}

export const PERP_MARKETS: PerpMarket[] = [
  {
    id: "perp-sol",
    symbol: "SOL-PERP",
    name: "Solana Perpetual",
    markPrice: 72.97,
    indexPrice: 184.28,
    fundingRate: 0.0085,
    nextFundingMs: 4 * 3600_000,
    openInterestUsd: 84_200_000,
    openInterestLong: 62,
    openInterestShort: 38,
    volume24h: 412_000_000,
    maxLeverage: 20,
    priceChange24h: 6.42,
    color: "from-[#9945FF] to-[#14F195]",
    glyph: "◎",
  },
  {
    id: "perp-wif",
    symbol: "WIF-PERP",
    name: "dogwifhat Perpetual",
    markPrice: 2.84,
    indexPrice: 2.842,
    fundingRate: 0.0241,
    nextFundingMs: 2 * 3600_000,
    openInterestUsd: 32_400_000,
    openInterestLong: 71,
    openInterestShort: 29,
    volume24h: 184_000_000,
    maxLeverage: 10,
    priceChange24h: 14.27,
    color: "from-[#F5B7B1] to-[#E8DAEF]",
    glyph: "🐕",
  },
  {
    id: "perp-btc",
    symbol: "BTC-PERP",
    name: "Bitcoin Perpetual",
    markPrice: 64280.0,
    indexPrice: 64260.0,
    fundingRate: 0.0042,
    nextFundingMs: 6 * 3600_000,
    openInterestUsd: 412_000_000,
    openInterestLong: 54,
    openInterestShort: 46,
    volume24h: 1_840_000_000,
    maxLeverage: 25,
    priceChange24h: 1.42,
    color: "from-[#F7931A] to-[#C7701A]",
    glyph: "₿",
  },
  {
    id: "perp-eth",
    symbol: "ETH-PERP",
    name: "Ethereum Perpetual",
    markPrice: 3420.4,
    indexPrice: 3418.0,
    fundingRate: 0.0061,
    nextFundingMs: 5 * 3600_000,
    openInterestUsd: 184_000_000,
    openInterestLong: 58,
    openInterestShort: 42,
    volume24h: 642_000_000,
    maxLeverage: 20,
    priceChange24h: 2.18,
    color: "from-[#627EEA] to-[#3B5BDB]",
    glyph: "Ξ",
  },
  {
    id: "perp-bonk",
    symbol: "BONK-PERP",
    name: "Bonk Perpetual",
    markPrice: 0.0000284,
    indexPrice: 0.0000285,
    fundingRate: 0.0312,
    nextFundingMs: 1 * 3600_000,
    openInterestUsd: 12_400_000,
    openInterestLong: 78,
    openInterestShort: 22,
    volume24h: 84_000_000,
    maxLeverage: 5,
    priceChange24h: 22.14,
    color: "from-[#F97316] to-[#EF4444]",
    glyph: "🔥",
  },
  {
    id: "perp-jup",
    symbol: "JUP-PERP",
    name: "Jupiter Perpetual",
    markPrice: 0.842,
    indexPrice: 0.841,
    fundingRate: 0.0098,
    nextFundingMs: 3 * 3600_000,
    openInterestUsd: 18_400_000,
    openInterestLong: 65,
    openInterestShort: 35,
    volume24h: 92_000_000,
    maxLeverage: 10,
    priceChange24h: 3.18,
    color: "from-[#C7A8FF] to-[#8B5CF6]",
    glyph: "🪐",
  },
];

export interface PerpPosition {
  id: string;
  marketSymbol: string;
  side: "LONG" | "SHORT";
  sizeUsd: number;
  sizeToken: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  marginUsd: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  fundingPaid: number;
  openedAgoSec: number;
}

export const PERP_POSITIONS: PerpPosition[] = [
  {
    id: "pp1",
    marketSymbol: "SOL-PERP",
    side: "LONG",
    sizeUsd: 18_400,
    sizeToken: 100,
    entryPrice: 68.0,
    markPrice: 72.97,
    leverage: 5,
    marginUsd: 3_680,
    liquidationPrice: 142.8,
    unrealizedPnl: 1_192,
    unrealizedPnlPct: 32.4,
    fundingPaid: -42.8,
    openedAgoSec: 86400,
  },
  {
    id: "pp2",
    marketSymbol: "WIF-PERP",
    side: "LONG",
    sizeUsd: 8_400,
    sizeToken: 3200,
    entryPrice: 2.42,
    markPrice: 2.84,
    leverage: 3,
    marginUsd: 2_800,
    liquidationPrice: 1.68,
    unrealizedPnl: 1_344,
    unrealizedPnlPct: 48.0,
    fundingPaid: -18.4,
    openedAgoSec: 43200,
  },
  {
    id: "pp3",
    marketSymbol: "BTC-PERP",
    side: "SHORT",
    sizeUsd: 12_000,
    sizeToken: 0.18,
    entryPrice: 65800,
    markPrice: 64280,
    leverage: 4,
    marginUsd: 3_000,
    liquidationPrice: 72400,
    unrealizedPnl: 274,
    unrealizedPnlPct: 9.1,
    fundingPaid: 12.4,
    openedAgoSec: 21600,
  },
];

// ---------- NFT COLLECTIONS ----------
export interface NftCollection {
  id: string;
  name: string;
  symbol: string;
  chain: Chain;
  floorPrice: number;
  floorChange24h: number;
  volume24h: number;
  items: number;
  owners: number;
  listedPct: number;
  color: string;
  glyph: string;
  verified: boolean;
  traits: { name: string; values: { label: string; pct: number; floorMod: number }[] }[];
}

export const NFT_COLLECTIONS: NftCollection[] = [
  {
    id: "nft-madlads",
    name: "Mad Lads",
    symbol: "LADS",
    chain: "SOL",
    floorPrice: 84.2,
    floorChange24h: 6.4,
    volume24h: 1_840_000,
    items: 10_000,
    owners: 5_412,
    listedPct: 4.2,
    color: "from-[#8B5CF6] to-[#6366F1]",
    glyph: "🤖",
    verified: true,
    traits: [
      {
        name: "Background",
        values: [
          { label: "Solana", pct: 12.4, floorMod: 1.0 },
          { label: "Purple", pct: 8.2, floorMod: 1.4 },
          { label: "Galaxy", pct: 5.1, floorMod: 1.8 },
        ],
      },
      {
        name: "Type",
        values: [
          { label: "AI", pct: 18.4, floorMod: 1.2 },
          { label: "Alien", pct: 6.2, floorMod: 2.1 },
          { label: "Human", pct: 52.0, floorMod: 0.9 },
        ],
      },
    ],
  },
  {
    id: "nft-tensorians",
    name: "Tensorians",
    symbol: "TNSR",
    chain: "SOL",
    floorPrice: 42.0,
    floorChange24h: -2.1,
    volume24h: 642_000,
    items: 10_000,
    owners: 4_120,
    listedPct: 6.8,
    color: "from-[#22D3EE] to-[#0EA5E9]",
    glyph: "📐",
    verified: true,
    traits: [
      {
        name: "Rarity",
        values: [
          { label: "Legendary", pct: 2.1, floorMod: 4.2 },
          { label: "Epic", pct: 8.4, floorMod: 1.8 },
          { label: "Rare", pct: 18.2, floorMod: 1.2 },
        ],
      },
    ],
  },
  {
    id: "nft-claynosaurz",
    name: "Claynosaurz",
    symbol: "CLAY",
    chain: "SOL",
    floorPrice: 18.4,
    floorChange24h: 4.2,
    volume24h: 284_000,
    items: 10_000,
    owners: 3_840,
    listedPct: 8.4,
    color: "from-[#F59E0B] to-[#EF4444]",
    glyph: "🦖",
    verified: true,
    traits: [
      {
        name: "Species",
        values: [
          { label: "T-Rex", pct: 22.0, floorMod: 1.0 },
          { label: "Stego", pct: 14.0, floorMod: 1.3 },
          { label: "Raptor", pct: 8.0, floorMod: 1.6 },
        ],
      },
    ],
  },
  {
    id: "nft-y00ts",
    name: "y00ts",
    symbol: "Y00TS",
    chain: "SOL",
    floorPrice: 124.0,
    floorChange24h: 12.4,
    volume24h: 2_400_000,
    items: 15_000,
    owners: 7_240,
    listedPct: 3.2,
    color: "from-[#94A3B8] to-[#475569]",
    glyph: "🎒",
    verified: true,
    traits: [
      {
        name: "Trait",
        values: [
          { label: "Rare", pct: 4.2, floorMod: 3.4 },
          { label: "Common", pct: 42.0, floorMod: 0.8 },
        ],
      },
    ],
  },
];

// NFT floor price history (30d) — deterministic
export function genNftFloorHistory(collectionId: string, startPrice: number): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  let v = startPrice * 0.8;
  for (let i = 0; i < 30; i++) {
    const noise = (seededRand(`${collectionId}-floor-${i}`) - 0.45) * 0.06;
    v = v * (1 + 0.008 + noise);
    out.push({ t: NOW - (30 - i) * 86400_000, v: Math.round(v * 100) / 100 });
  }
  return out;
}

// ---------- TOKEN LAUNCH SCANNER ----------
export interface TokenLaunch {
  id: string;
  symbol: string;
  name: string;
  chain: Chain;
  ageMinutes: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  smartMoneyEntries: number;
  smartMoneyInflowUsd: number;
  priceChange1h: number;
  priceChange24h: number;
  verified: boolean;
  contractVerified: boolean;
  liquidityLocked: boolean;
  mintAuthorityRevoked: boolean;
  color: string;
  glyph: string;
  sparkline: number[];
}

function genLaunchSparkline(id: string, start: number): number[] {
  const rng = makeRng(hashSeed(id));
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < 24; i++) {
    v = v * (1 + (rng() - 0.3) * 0.15);
    out.push(Number(v.toFixed(6)));
  }
  return out;
}

export const TOKEN_LAUNCHES: TokenLaunch[] = [
  {
    id: "launch-1",
    symbol: "MOON",
    name: "MoonCat",
    chain: "SOL",
    ageMinutes: 18,
    marketCap: 4_200_000,
    liquidity: 220_000,
    volume24h: 8_400_000,
    holders: 1_240,
    smartMoneyEntries: 3,
    smartMoneyInflowUsd: 612_000,
    priceChange1h: 38.2,
    priceChange24h: 142.8,
    verified: false,
    contractVerified: true,
    liquidityLocked: true,
    mintAuthorityRevoked: true,
    color: "from-[#C084FC] to-[#7E22CE]",
    glyph: "🌙",
    sparkline: genLaunchSparkline("launch-1", 0.00018),
  },
  {
    id: "launch-2",
    symbol: "NEURAL",
    name: "NeuralAI",
    chain: "SOL",
    ageMinutes: 42,
    marketCap: 8_400_000,
    liquidity: 480_000,
    volume24h: 12_400_000,
    holders: 2_140,
    smartMoneyEntries: 5,
    smartMoneyInflowUsd: 1_240_000,
    priceChange1h: 18.4,
    priceChange24h: 84.2,
    verified: false,
    contractVerified: true,
    liquidityLocked: true,
    mintAuthorityRevoked: true,
    color: "from-[#22D3EE] to-[#0EA5E9]",
    glyph: "🧠",
    sparkline: genLaunchSparkline("launch-2", 0.42),
  },
  {
    id: "launch-3",
    symbol: "WARP",
    name: "WarpFi",
    chain: "SOL",
    ageMinutes: 95,
    marketCap: 12_400_000,
    liquidity: 840_000,
    volume24h: 18_400_000,
    holders: 3_240,
    smartMoneyEntries: 7,
    smartMoneyInflowUsd: 2_120_000,
    priceChange1h: 8.2,
    priceChange24h: 42.1,
    verified: false,
    contractVerified: true,
    liquidityLocked: true,
    mintAuthorityRevoked: true,
    color: "from-[#9945FF] to-[#14F195]",
    glyph: "🪐",
    sparkline: genLaunchSparkline("launch-3", 0.84),
  },
  {
    id: "launch-4",
    symbol: "DOGEX",
    name: "DogeX",
    chain: "SOL",
    ageMinutes: 12,
    marketCap: 1_200_000,
    liquidity: 84_000,
    volume24h: 2_400_000,
    holders: 420,
    smartMoneyEntries: 1,
    smartMoneyInflowUsd: 84_000,
    priceChange1h: 84.2,
    priceChange24h: 240.0,
    verified: false,
    contractVerified: false,
    liquidityLocked: false,
    mintAuthorityRevoked: false,
    color: "from-[#F59E0B] to-[#EF4444]",
    glyph: "🐕",
    sparkline: genLaunchSparkline("launch-4", 0.000084),
  },
  {
    id: "launch-5",
    symbol: "GRID",
    name: "GridNet",
    chain: "SOL",
    ageMinutes: 240,
    marketCap: 6_200_000,
    liquidity: 320_000,
    volume24h: 4_200_000,
    holders: 1_840,
    smartMoneyEntries: 4,
    smartMoneyInflowUsd: 840_000,
    priceChange1h: 4.2,
    priceChange24h: 18.4,
    verified: false,
    contractVerified: true,
    liquidityLocked: true,
    mintAuthorityRevoked: true,
    color: "from-[#A855F7] to-[#7E22CE]",
    glyph: "📡",
    sparkline: genLaunchSparkline("launch-5", 0.124),
  },
  {
    id: "launch-6",
    symbol: "CYBER",
    name: "CyberPunk",
    chain: "SOL",
    ageMinutes: 65,
    marketCap: 3_400_000,
    liquidity: 180_000,
    volume24h: 6_200_000,
    holders: 940,
    smartMoneyEntries: 2,
    smartMoneyInflowUsd: 412_000,
    priceChange1h: 22.4,
    priceChange24h: 64.2,
    verified: false,
    contractVerified: true,
    liquidityLocked: true,
    mintAuthorityRevoked: false,
    color: "from-[#EC4899] to-[#BE185D]",
    glyph: "🦾",
    sparkline: genLaunchSparkline("launch-6", 0.00042),
  },
];

// ---------- CROSS-CHAIN BRIDGE ----------
export interface BridgeRoute {
  id: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  bridge: "Wormhole" | "deBridge" | "Mayan" | "Hop" | "Across";
  estimatedTime: string;
  feeUsd: number;
  feePct: number;
  gasUsd: number;
  minAmount: number;
  maxAmount: number;
  reliability: number; // 0-100
  color: string;
}

export const BRIDGE_ROUTES: BridgeRoute[] = [
  {
    id: "br1",
    fromChain: "SOL",
    toChain: "ETH",
    fromToken: "SOL",
    toToken: "SOL",
    bridge: "Wormhole",
    estimatedTime: "5-10 min",
    feeUsd: 12.4,
    feePct: 0.06,
    gasUsd: 0.0008,
    minAmount: 0.1,
    maxAmount: 100_000,
    reliability: 98,
    color: "from-[#9945FF] to-[#627EEA]",
  },
  {
    id: "br2",
    fromChain: "SOL",
    toChain: "ETH",
    fromToken: "SOL",
    toToken: "SOL",
    bridge: "deBridge",
    estimatedTime: "2-5 min",
    feeUsd: 8.2,
    feePct: 0.04,
    gasUsd: 0.0008,
    minAmount: 0.1,
    maxAmount: 500_000,
    reliability: 96,
    color: "from-[#14F195] to-[#627EEA]",
  },
  {
    id: "br3",
    fromChain: "SOL",
    toChain: "ETH",
    fromToken: "USDC",
    toToken: "USDC",
    bridge: "Mayan",
    estimatedTime: "1-3 min",
    feeUsd: 4.1,
    feePct: 0.02,
    gasUsd: 0.0008,
    minAmount: 10,
    maxAmount: 1_000_000,
    reliability: 94,
    color: "from-[#22D3EE] to-[#627EEA]",
  },
  {
    id: "br4",
    fromChain: "ETH",
    toChain: "BASE",
    fromToken: "ETH",
    toToken: "ETH",
    bridge: "Hop",
    estimatedTime: "10-20 min",
    feeUsd: 2.4,
    feePct: 0.12,
    gasUsd: 4.2,
    minAmount: 0.01,
    maxAmount: 50_000,
    reliability: 92,
    color: "from-[#627EEA] to-[#22C55E]",
  },
];

// ---------- STAKING DASHBOARD ----------
export interface Validator {
  id: string;
  name: string;
  avatarColor: string;
  avatarGlyph: string;
  apy: number;
  commission: number;
  uptime: number;
  totalStaked: number;
  activeStakers: number;
  rank: number;
  slashed: boolean;
  verified: boolean;
}

export const VALIDATORS: Validator[] = [
  {
    id: "v1",
    name: "Marinade Finance",
    avatarColor: "from-[#14F195] to-[#22D3EE]",
    avatarGlyph: "M",
    apy: 7.24,
    commission: 1.5,
    uptime: 99.98,
    totalStaked: 4_200_000,
    activeStakers: 84_200,
    rank: 1,
    slashed: false,
    verified: true,
  },
  {
    id: "v2",
    name: "Jito",
    avatarColor: "from-[#22D3EE] to-[#0EA5E9]",
    avatarGlyph: "J",
    apy: 7.18,
    commission: 2.0,
    uptime: 99.95,
    totalStaked: 3_800_000,
    activeStakers: 62_400,
    rank: 2,
    slashed: false,
    verified: true,
  },
  {
    id: "v3",
    name: "Sanctum",
    avatarColor: "from-[#9945FF] to-[#7E22CE]",
    avatarGlyph: "S",
    apy: 7.42,
    commission: 1.0,
    uptime: 99.92,
    totalStaked: 2_400_000,
    activeStakers: 38_200,
    rank: 3,
    slashed: false,
    verified: true,
  },
  {
    id: "v4",
    name: "BlazeStake",
    avatarColor: "from-[#F59E0B] to-[#EF4444]",
    avatarGlyph: "B",
    apy: 7.32,
    commission: 2.5,
    uptime: 99.88,
    totalStaked: 1_200_000,
    activeStakers: 18_400,
    rank: 4,
    slashed: false,
    verified: true,
  },
  {
    id: "v5",
    name: "Cogent Crypto",
    avatarColor: "from-[#8B5CF6] to-[#6366F1]",
    avatarGlyph: "C",
    apy: 7.55,
    commission: 3.0,
    uptime: 99.84,
    totalStaked: 840_000,
    activeStakers: 8_200,
    rank: 5,
    slashed: false,
    verified: false,
  },
];

export interface StakePosition {
  id: string;
  validatorId: string;
  validatorName: string;
  amount: number;
  amountUsd: number;
  apy: number;
  rewardsEarned: number;
  rewardsUsd: number;
  stakedAgoDays: number;
  unbondingPeriodDays: number;
}

export const STAKE_POSITIONS: StakePosition[] = [
  {
    id: "sp1",
    validatorId: "v1",
    validatorName: "Marinade Finance",
    amount: 42.4,
    amountUsd: 7_820,
    apy: 7.24,
    rewardsEarned: 1.84,
    rewardsUsd: 340,
    stakedAgoDays: 124,
    unbondingPeriodDays: 2,
  },
  {
    id: "sp2",
    validatorId: "v2",
    validatorName: "Jito",
    amount: 18.2,
    amountUsd: 3_355,
    apy: 7.18,
    rewardsEarned: 0.42,
    rewardsUsd: 78,
    stakedAgoDays: 42,
    unbondingPeriodDays: 2,
  },
];

// ---------- AIRDROP CENTER ----------
export interface AirdropClaim {
  id: string;
  project: string;
  token: string;
  glyph: string;
  color: string;
  eligibleAmount: number;
  claimedAmount: number;
  status: "eligible" | "claimed" | "not_eligible" | "snapshot_pending";
  snapshotDate: string;
  claimDeadline: string;
  estimatedValue: number;
  requirements: string[];
  description: string;
}

export const AIRDROPS: AirdropClaim[] = [
  {
    id: "ad1",
    project: "Jupiter",
    token: "JUP",
    glyph: "🪐",
    color: "from-[#C7A8FF] to-[#8B5CF6]",
    eligibleAmount: 4_200,
    claimedAmount: 0,
    status: "eligible",
    snapshotDate: "2026-07-15",
    claimDeadline: "2026-09-30",
    estimatedValue: 3_540,
    requirements: ["1,000+ JUP-SOL LP", "5+ swaps on Jupiter"],
    description: "Active liquidity providers and frequent traders earn JUP tokens.",
  },
  {
    id: "ad2",
    project: "Drift Protocol",
    token: "DRIFT",
    glyph: "📉",
    color: "from-[#2DD4BF] to-[#0D9488]",
    eligibleAmount: 1_240,
    claimedAmount: 1_240,
    status: "claimed",
    snapshotDate: "2026-06-01",
    claimDeadline: "2026-08-31",
    estimatedValue: 2_280,
    requirements: ["$10K+ open interest", "30+ days active"],
    description: "Perps traders with sustained open interest.",
  },
  {
    id: "ad3",
    project: "Tensor",
    token: "TNSR",
    glyph: "📐",
    color: "from-[#22D3EE] to-[#0EA5E9]",
    eligibleAmount: 0,
    claimedAmount: 0,
    status: "snapshot_pending",
    snapshotDate: "2026-08-15",
    claimDeadline: "2026-10-31",
    estimatedValue: 0,
    requirements: ["Pending snapshot", "NFT traders auto-eligible"],
    description: "NFT marketplace users. Snapshot on Aug 15.",
  },
  {
    id: "ad4",
    project: "Kamino Finance",
    token: "KMNO",
    glyph: "🦊",
    color: "from-[#F97316] to-[#EF4444]",
    eligibleAmount: 820,
    claimedAmount: 0,
    status: "eligible",
    snapshotDate: "2026-07-01",
    claimDeadline: "2026-09-15",
    estimatedValue: 412,
    requirements: ["$5K+ deposited", "10+ borrow events"],
    description: "Lending protocol users.",
  },
  {
    id: "ad5",
    project: "Marginfi",
    token: "MRGN",
    glyph: "🌊",
    color: "from-[#3B82F6] to-[#1D4ED8]",
    eligibleAmount: 0,
    claimedAmount: 0,
    status: "not_eligible",
    snapshotDate: "2026-06-15",
    claimDeadline: "2026-08-31",
    estimatedValue: 0,
    requirements: ["Did not meet activity threshold"],
    description: "Lending users with $50K+ TVL activity.",
  },
];

// ---------- GAS FEE OPTIMIZER ----------
export interface GasEstimate {
  priority: "slow" | "standard" | "fast" | "turbo";
  label: string;
  feeUsd: number;
  feeLamports: number;
  estimatedTime: string;
  confidence: number;
  recommended: boolean;
}

export function getGasEstimates(): GasEstimate[] {
  return [
    {
      priority: "slow",
      label: "Slow",
      feeUsd: 0.0004,
      feeLamports: 2_500,
      estimatedTime: "30-60s",
      confidence: 85,
      recommended: false,
    },
    {
      priority: "standard",
      label: "Standard",
      feeUsd: 0.0008,
      feeLamports: 5_000,
      estimatedTime: "5-15s",
      confidence: 92,
      recommended: false,
    },
    {
      priority: "fast",
      label: "Fast",
      feeUsd: 0.0014,
      feeLamports: 8_500,
      estimatedTime: "1-3s",
      confidence: 98,
      recommended: true,
    },
    {
      priority: "turbo",
      label: "Turbo",
      feeUsd: 0.0028,
      feeLamports: 17_000,
      estimatedTime: "<1s",
      confidence: 99,
      recommended: false,
    },
  ];
}

// Network congestion data (24h) — deterministic
export function genCongestionHistory(): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  for (let i = 0; i < 24; i++) {
    // Simulate peak congestion during US/EU hours
    const hour = (i + 12) % 24;
    const peakFactor = hour > 14 && hour < 22 ? 1.5 : 0.7;
    const noise = seededRand(`congestion-${i}`);
    out.push({
      t: NOW - (24 - i) * 3600_000,
      v: Math.round(40 + noise * 60 * peakFactor),
    });
  }
  return out;
}

export const CONGESTION_HISTORY: { t: number; v: number }[] = genCongestionHistory();

// ---------- TECHNICAL INDICATORS ----------
// RSI, MACD, Bollinger Bands, EMA, volume profile

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Generate deterministic OHLCV candles from a base price. */
export function genCandles(seedKey: string, basePrice: number, count = 120): Candle[] {
  const rng = makeRng(hashSeed(seedKey));
  const out: Candle[] = [];
  let prevClose = basePrice;
  for (let i = 0; i < count; i++) {
    const vol = 0.02 + rng() * 0.03;
    const open = prevClose;
    const change = (rng() - 0.48) * vol;
    const close = Math.max(0.0001, open * (1 + change));
    const high = Math.max(open, close) * (1 + rng() * vol * 0.5);
    const low = Math.min(open, close) * (1 - rng() * vol * 0.5);
    const volume = (1_000_000 + rng() * 4_000_000) * (1 + Math.abs(change) * 10);
    out.push({
      t: NOW - (count - i) * 3600_000, // hourly candles
      o: Number(open.toFixed(6)),
      h: Number(high.toFixed(6)),
      l: Number(low.toFixed(6)),
      c: Number(close.toFixed(6)),
      v: Math.round(volume),
    });
    prevClose = close;
  }
  return out;
}

/** Simple Moving Average */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      out.push(slice.reduce((s, v) => s + v, 0) / period);
    }
  }
  return out;
}

/** Exponential Moving Average */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
    } else if (prev === null) {
      const slice = values.slice(0, period);
      prev = slice.reduce((s, v) => s + v, 0) / period;
      out.push(prev);
    } else {
      prev = values[i] * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

/** Relative Strength Index */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }
    const change = values[i] - values[i - 1];
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
      } else {
        out.push(null);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

/** MACD (Moving Average Convergence Divergence) */
export function macd(values: number[], fast = 12, slow = 26, signal = 9): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null
      ? (emaFast[i] as number) - (emaSlow[i] as number)
      : null
  );
  // Signal line = EMA of MACD
  const validMacd = macdLine.map((v) => v ?? 0);
  const signalLine = ema(validMacd, signal);
  const histogram = macdLine.map((v, i) =>
    v !== null && signalLine[i] !== null ? v - (signalLine[i] as number) : null
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

/** Bollinger Bands */
export function bollingerBands(values: number[], period = 20, stdDev = 2): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = sma(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1 || middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const mean = middle[i] as number;
      const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
      const sd = Math.sqrt(variance);
      upper.push(mean + sd * stdDev);
      lower.push(mean - sd * stdDev);
    }
  }
  return { upper, middle, lower };
}

// ---------- NARRATIVE DEEP-DIVE ----------
export interface NarrativeDetail {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  longDescription: string;
  marketCap: number;
  change24h: number;
  mentions24h: number;
  smartMoneyInflow24h: number;
  tokens: {
    id: string;
    symbol: string;
    name: string;
    weight: number; // % of narrative
    change24h: number;
    smartMoneyInflow: number;
    color: string;
    glyph?: string;
  }[];
  relatedNews: { headline: string; source: string; agoMinutes: number }[];
  smartMoneyCount: number;
  whaleActivity24h: number;
}

export function getNarrativeDetail(narrativeId: string): NarrativeDetail | null {
  const n = NARRATIVES.find((x) => x.id === narrativeId);
  if (!n) return null;
  const tokens = n.topTokens
    .map((tid) => TOKENS_BY_ID[tid])
    .filter(Boolean)
    .map((t, i) => ({
      id: t.id,
      symbol: t.symbol,
      name: t.name,
      weight: Math.round(100 / n.topTokens.length * (1 - i * 0.1)),
      change24h: t.change24h,
      smartMoneyInflow: t.smartMoneyInflow24h,
      color: t.logoColor,
      glyph: t.logoGlyph,
    }));
  const totalMcap = tokens.reduce((s, t) => {
    const tk = TOKENS_BY_ID[t.id];
    return s + (tk?.marketCap ?? 0);
  }, 0);
  const totalInflow = tokens.reduce((s, t) => s + t.smartMoneyInflow, 0);
  return {
    id: n.id,
    name: n.name,
    emoji: n.emoji,
    color: n.color,
    description: n.description,
    longDescription:
      n.name === "AI Agents"
        ? "Tokens building AI-native infrastructure and on-chain agents. This narrative includes GPU networks, AI model marketplaces, and autonomous agent protocols. Smart money has been rotating into this sector as AI adoption accelerates."
        : n.name === "Meme Season"
        ? "Solana meme coins leading attention this cycle. Driven by community engagement, viral marketing, and speculative fervor. High volatility, high upside — but also high risk of rapid drawdowns."
        : n.name === "DePIN"
        ? "Decentralized physical infrastructure networks — wireless, compute, storage, and sensors. Long-term hold thesis with real-world utility and revenue generation."
        : n.name === "Cat Coins"
        ? "Cat-themed meme coins outperforming dogs today. A sub-narrative of meme season, driven by fresh launches and community rotation from dog-themed tokens."
        : "Solana-native DeFi protocols gaining TVL. DEXs, lending, perps, and yield aggregators building the core financial infrastructure of Solana.",
    marketCap: totalMcap,
    change24h: n.change24h,
    mentions24h: n.mentions24h,
    smartMoneyInflow24h: totalInflow,
    tokens,
    relatedNews: NEWS.filter((news) =>
      news.tokensMentioned.some((tid) => n.topTokens.includes(tid))
    ).map((news) => ({
      headline: news.headline,
      source: news.source,
      agoMinutes: news.agoMinutes,
    })),
    smartMoneyCount: tokens.length * 80,
    whaleActivity24h: Math.round(totalInflow * 0.3),
  };
}

// ---------- SMART MONEY MAP (wallet-to-wallet flows) ----------
export interface WalletNode {
  id: string;
  label: string;
  type: "whale" | "smart_money" | "kol" | "cex" | "fund";
  x: number; // 0-100 position
  y: number;
  size: number; // relative
  color: string;
  glyph: string;
  inflowUsd: number;
  outflowUsd: number;
}

export interface WalletEdge {
  from: string;
  to: string;
  value: number; // USD
  tokenSymbol: string;
  agoSeconds: number;
}

export interface SmartMoneyMap {
  nodes: WalletNode[];
  edges: WalletEdge[];
}

export function getSmartMoneyMap(): SmartMoneyMap {
  const nodes: WalletNode[] = [
    { id: "w1", label: "0xMoby", type: "whale", x: 20, y: 30, size: 40, color: "#14F195", glyph: "M", inflowUsd: 4_200_000, outflowUsd: 1_800_000 },
    { id: "w2", label: "DegenDiva", type: "kol", x: 50, y: 20, size: 35, color: "#EC4899", glyph: "D", inflowUsd: 3_100_000, outflowUsd: 2_400_000 },
    { id: "w3", label: "Scoop", type: "whale", x: 80, y: 30, size: 38, color: "#F59E0B", glyph: "W", inflowUsd: 2_800_000, outflowUsd: 1_200_000 },
    { id: "w4", label: "AlphaBot", type: "smart_money", x: 30, y: 60, size: 32, color: "#22D3EE", glyph: "A", inflowUsd: 1_800_000, outflowUsd: 2_100_000 },
    { id: "w5", label: "Sage", type: "smart_money", x: 70, y: 60, size: 30, color: "#8B5CF6", glyph: "S", inflowUsd: 1_400_000, outflowUsd: 900_000 },
    { id: "w6", label: "Franky", type: "smart_money", x: 50, y: 80, size: 28, color: "#10B981", glyph: "F", inflowUsd: 612_000, outflowUsd: 412_000 },
    { id: "w7", label: "Binance", type: "cex", x: 10, y: 80, size: 45, color: "#F7931A", glyph: "B", inflowUsd: 8_400_000, outflowUsd: 6_200_000 },
    { id: "w8", label: "Paradigm", type: "fund", x: 90, y: 80, size: 42, color: "#627EEA", glyph: "P", inflowUsd: 5_200_000, outflowUsd: 3_800_000 },
  ];
  const edges: WalletEdge[] = [
    { from: "w7", to: "w1", value: 1_200_000, tokenSymbol: "SOL", agoSeconds: 320 },
    { from: "w1", to: "w2", value: 840_000, tokenSymbol: "WIF", agoSeconds: 480 },
    { from: "w2", to: "w4", value: 620_000, tokenSymbol: "BONK", agoSeconds: 640 },
    { from: "w3", to: "w1", value: 420_000, tokenSymbol: "SOL", agoSeconds: 800 },
    { from: "w4", to: "w5", value: 380_000, tokenSymbol: "JUP", agoSeconds: 960 },
    { from: "w5", to: "w6", value: 280_000, tokenSymbol: "DRIFT", agoSeconds: 1120 },
    { from: "w8", to: "w3", value: 920_000, tokenSymbol: "ETH", agoSeconds: 1280 },
    { from: "w2", to: "w6", value: 180_000, tokenSymbol: "POPCAT", agoSeconds: 1440 },
    { from: "w1", to: "w4", value: 340_000, tokenSymbol: "IO", agoSeconds: 1600 },
    { from: "w7", to: "w8", value: 2_400_000, tokenSymbol: "USDC", agoSeconds: 1760 },
  ];
  return { nodes, edges };
}

// ---------- PORTFOLIO PERFORMANCE ANALYTICS ----------
export interface PortfolioAnalytics {
  totalReturn: number;
  totalReturnPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  volatility: number;
  beta: number;
  alpha: number;
  correlationBTC: number;
  correlationETH: number;
  correlationSOL: number;
  bestDay: { date: string; return: number };
  worstDay: { date: string; return: number };
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  riskScore: number; // 0-100
  riskLabel: "Conservative" | "Moderate" | "Aggressive" | "Very Aggressive";
}

export const PORTFOLIO_ANALYTICS: PortfolioAnalytics = {
  totalReturn: 142_400,
  totalReturnPct: 85.4,
  sharpeRatio: 2.14,
  sortinoRatio: 3.08,
  maxDrawdown: -18_200,
  maxDrawdownPct: -12.4,
  volatility: 34.2,
  beta: 1.42,
  alpha: 8.4,
  correlationBTC: 0.68,
  correlationETH: 0.74,
  correlationSOL: 0.91,
  bestDay: { date: "2026-07-14", return: 12.4 },
  worstDay: { date: "2026-06-22", return: -8.2 },
  winRate: 64,
  avgWin: 1840,
  avgLoss: -920,
  profitFactor: 2.18,
  riskScore: 72,
  riskLabel: "Aggressive",
};

// Correlation matrix data
export interface CorrelationMatrix {
  tokens: string[];
  matrix: number[][];
}

export function getCorrelationMatrix(): CorrelationMatrix {
  const tokens = ["SOL", "WIF", "JUP", "BONK", "BTC", "ETH"];
  // Deterministic correlation matrix (symmetric, 1.0 on diagonal)
  const matrix: number[][] = [
    [1.0, 0.82, 0.74, 0.78, 0.68, 0.72],
    [0.82, 1.0, 0.64, 0.88, 0.42, 0.48],
    [0.74, 0.64, 1.0, 0.56, 0.52, 0.61],
    [0.78, 0.88, 0.56, 1.0, 0.38, 0.44],
    [0.68, 0.42, 0.52, 0.38, 1.0, 0.84],
    [0.72, 0.48, 0.61, 0.44, 0.84, 1.0],
  ];
  return { tokens, matrix };
}

// ---------- YIELD FARMING ----------
export interface YieldPosition {
  id: string;
  protocol: string;
  protocolColor: string;
  protocolGlyph: string;
  pair: string;
  type: "LP" | "Lending" | "SingleSided";
  tvl: number;
  myPosition: number;
  apy: number;
  aprBase: number;
  aprRewards: number;
  rewardsToken: string;
  rewardsEarned: number;
  rewardsUsd: number;
  impermanentLoss: number; // percent
  daysActive: number;
  chain: Chain;
}

export const YIELD_POSITIONS: YieldPosition[] = [
  {
    id: "yp1",
    protocol: "Raydium",
    protocolColor: "from-[#1ABC9C] to-[#16A085]",
    protocolGlyph: "🔺",
    pair: "SOL-USDC",
    type: "LP",
    tvl: 24_400_000,
    myPosition: 12_400,
    apy: 42.8,
    aprBase: 18.4,
    aprRewards: 24.4,
    rewardsToken: "RAY",
    rewardsEarned: 184.2,
    rewardsUsd: 446,
    impermanentLoss: -2.4,
    daysActive: 42,
    chain: "SOL",
  },
  {
    id: "yp2",
    protocol: "Jupiter",
    protocolColor: "from-[#C7A8FF] to-[#8B5CF6]",
    protocolGlyph: "🪐",
    pair: "WIF-SOL",
    type: "LP",
    tvl: 8_400_000,
    myPosition: 8_200,
    apy: 68.2,
    aprBase: 22.1,
    aprRewards: 46.1,
    rewardsToken: "JUP",
    rewardsEarned: 412,
    rewardsUsd: 347,
    impermanentLoss: -5.8,
    daysActive: 28,
    chain: "SOL",
  },
  {
    id: "yp3",
    protocol: "Kamino",
    protocolColor: "from-[#F97316] to-[#EF4444]",
    protocolGlyph: "🦊",
    pair: "USDC",
    type: "Lending",
    tvl: 142_000_000,
    myPosition: 24_000,
    apy: 12.4,
    aprBase: 8.2,
    aprRewards: 4.2,
    rewardsToken: "KMNO",
    rewardsEarned: 82,
    rewardsUsd: 412,
    impermanentLoss: 0,
    daysActive: 84,
    chain: "SOL",
  },
  {
    id: "yp4",
    protocol: "Drift",
    protocolColor: "from-[#2DD4BF] to-[#0D9488]",
    protocolGlyph: "📉",
    pair: "SOL",
    type: "SingleSided",
    tvl: 32_400_000,
    myPosition: 6_400,
    apy: 28.4,
    aprBase: 14.2,
    aprRewards: 14.2,
    rewardsToken: "DRIFT",
    rewardsEarned: 124,
    rewardsUsd: 228,
    impermanentLoss: 0,
    daysActive: 56,
    chain: "SOL",
  },
];

// ---------- TOKEN UNLOCK SCHEDULE ----------
export interface UnlockEvent {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  color: string;
  glyph: string;
  date: string;
  amount: number;
  amountUsd: number;
  pctOfSupply: number;
  type: "Team" | "Investors" | "Community" | "Ecosystem" | "Treasury";
  status: "upcoming" | "imminent" | "past";
  daysUntil: number;
}

export const UNLOCK_SCHEDULE: UnlockEvent[] = [
  {
    id: "u1",
    tokenSymbol: "JUP",
    tokenName: "Jupiter",
    color: "from-[#C7A8FF] to-[#8B5CF6]",
    glyph: "🪐",
    date: "2026-08-15",
    amount: 220_000_000,
    amountUsd: 184_000_000,
    pctOfSupply: 18.4,
    type: "Community",
    status: "imminent",
    daysUntil: 14,
  },
  {
    id: "u2",
    tokenSymbol: "JTO",
    tokenName: "Jito",
    color: "from-[#22D3EE] to-[#0EA5E9]",
    glyph: "🌊",
    date: "2026-09-01",
    amount: 84_000_000,
    amountUsd: 262_000_000,
    pctOfSupply: 8.4,
    type: "Team",
    status: "upcoming",
    daysUntil: 31,
  },
  {
    id: "u3",
    tokenSymbol: "PYTH",
    tokenName: "Pyth Network",
    color: "from-[#A855F7] to-[#6366F1]",
    glyph: "⚡",
    date: "2026-08-20",
    amount: 142_000_000,
    amountUsd: 54_000_000,
    pctOfSupply: 5.2,
    type: "Investors",
    status: "imminent",
    daysUntil: 19,
  },
  {
    id: "u4",
    tokenSymbol: "TNSR",
    tokenName: "Tensor",
    color: "from-[#22D3EE] to-[#0EA5E9]",
    glyph: "📐",
    date: "2026-10-15",
    amount: 32_000_000,
    amountUsd: 16_800_000,
    pctOfSupply: 4.0,
    type: "Ecosystem",
    status: "upcoming",
    daysUntil: 75,
  },
  {
    id: "u5",
    tokenSymbol: "DRIFT",
    tokenName: "Drift Protocol",
    color: "from-[#2DD4BF] to-[#0D9488]",
    glyph: "📉",
    date: "2026-09-10",
    amount: 62_000_000,
    amountUsd: 114_000_000,
    pctOfSupply: 12.0,
    type: "Community",
    status: "upcoming",
    daysUntil: 40,
  },
  {
    id: "u6",
    tokenSymbol: "IO",
    tokenName: "io.net",
    color: "from-[#10B981] to-[#047857]",
    glyph: "🧠",
    date: "2026-11-01",
    amount: 18_000_000,
    amountUsd: 52_900_000,
    pctOfSupply: 3.2,
    type: "Investors",
    status: "upcoming",
    daysUntil: 92,
  },
];

// ---------- GOVERNANCE / DAO VOTING ----------
export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: "active" | "passed" | "failed" | "pending";
  type: "Parameter" | "Treasury" | "Upgrade" | "Grant";
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  totalVotes: number;
  quorum: number;
  quorumPct: number;
  daysLeft: number;
  myVote: "for" | "against" | "abstain" | null;
  votingPower: number;
  startTime: string;
  endTime: string;
}

export const GOVERNANCE_PROPOSALS: GovernanceProposal[] = [
  {
    id: "g1",
    title: "Increase JLP-SOL pool fee from 0.25% to 0.30%",
    description: "Proposal to adjust the swap fee on the JLP-SOL liquidity pool to better align with market rates and improve LP returns.",
    proposer: "0xMoby",
    status: "active",
    type: "Parameter",
    forVotes: 4_200_000,
    againstVotes: 1_100_000,
    abstainVotes: 320_000,
    totalVotes: 5_620_000,
    quorum: 5_000_000,
    quorumPct: 96,
    daysLeft: 2,
    myVote: null,
    votingPower: 12_400,
    startTime: "2026-07-25",
    endTime: "2026-08-03",
  },
  {
    id: "g2",
    title: "Allocate 500K JUP to ecosystem grants program",
    description: "Fund a new round of ecosystem grants to support builders on Solana. Funds will be managed by a 5-person committee.",
    proposer: "SolanaSage",
    status: "active",
    type: "Treasury",
    forVotes: 6_800_000,
    againstVotes: 420_000,
    abstainVotes: 180_000,
    totalVotes: 7_400_000,
    quorum: 5_000_000,
    quorumPct: 100,
    daysLeft: 5,
    myVote: "for",
    votingPower: 12_400,
    startTime: "2026-07-22",
    endTime: "2026-08-06",
  },
  {
    id: "g3",
    title: "Upgrade Jupiter router to v7 with MEV protection",
    description: "Major upgrade to the routing engine with built-in MEV protection and improved price discovery for large trades.",
    proposer: "AICopilot",
    status: "passed",
    type: "Upgrade",
    forVotes: 8_200_000,
    againstVotes: 340_000,
    abstainVotes: 220_000,
    totalVotes: 8_760_000,
    quorum: 5_000_000,
    quorumPct: 100,
    daysLeft: 0,
    myVote: "for",
    votingPower: 12_400,
    startTime: "2026-07-10",
    endTime: "2026-07-24",
  },
  {
    id: "g4",
    title: "Add BONK as collateral on lending markets",
    description: "Enable BONK as a borrowable asset with 60% LTV and 70% liquidation threshold on Kamino integration.",
    proposer: "DegenDiva",
    status: "active",
    type: "Parameter",
    forVotes: 3_100_000,
    againstVotes: 2_400_000,
    abstainVotes: 440_000,
    totalVotes: 5_940_000,
    quorum: 5_000_000,
    quorumPct: 100,
    daysLeft: 1,
    myVote: null,
    votingPower: 12_400,
    startTime: "2026-07-26",
    endTime: "2026-08-02",
  },
  {
    id: "g5",
    title: "Reduce validator commission cap from 10% to 8%",
    description: "Lower the maximum allowed commission for validators in the recommended set to improve staker returns.",
    proposer: "OnchainOwl",
    status: "failed",
    type: "Parameter",
    forVotes: 2_100_000,
    againstVotes: 4_800_000,
    abstainVotes: 580_000,
    totalVotes: 7_480_000,
    quorum: 5_000_000,
    quorumPct: 100,
    daysLeft: 0,
    myVote: "against",
    votingPower: 12_400,
    startTime: "2026-07-05",
    endTime: "2026-07-19",
  },
];

// ---------- DEFI POSITION TRACKER ----------
export interface DeFiPosition {
  id: string;
  protocol: string;
  protocolColor: string;
  protocolGlyph: string;
  type: "Lending" | "Borrowing" | "LP" | "Staking" | "Farming";
  asset: string;
  amount: number;
  amountUsd: number;
  apy: number;
  healthFactor?: number;
  collateralUsd?: number;
  debtUsd?: number;
  liquidationPrice?: number;
  chain: Chain;
}

export const DEFI_POSITIONS: DeFiPosition[] = [
  {
    id: "dp1",
    protocol: "Kamino",
    protocolColor: "from-[#F97316] to-[#EF4444]",
    protocolGlyph: "🦊",
    type: "Lending",
    asset: "USDC",
    amount: 24_000,
    amountUsd: 24_000,
    apy: 8.2,
    chain: "SOL",
  },
  {
    id: "dp2",
    protocol: "Kamino",
    protocolColor: "from-[#F97316] to-[#EF4444]",
    protocolGlyph: "🦊",
    type: "Borrowing",
    asset: "SOL",
    amount: 84.2,
    amountUsd: 15_520,
    apy: 5.4,
    healthFactor: 2.4,
    collateralUsd: 36_000,
    debtUsd: 15_520,
    liquidationPrice: 35.0,
    chain: "SOL",
  },
  {
    id: "dp3",
    protocol: "Marginfi",
    protocolColor: "from-[#3B82F6] to-[#1D4ED8]",
    protocolGlyph: "🌊",
    type: "Lending",
    asset: "JLP",
    amount: 1_240,
    amountUsd: 18_400,
    apy: 12.4,
    chain: "SOL",
  },
  {
    id: "dp4",
    protocol: "Raydium",
    protocolColor: "from-[#1ABC9C] to-[#16A085]",
    protocolGlyph: "🔺",
    type: "LP",
    asset: "SOL-USDC",
    amount: 12_400,
    amountUsd: 12_400,
    apy: 42.8,
    chain: "SOL",
  },
  {
    id: "dp5",
    protocol: "Jito",
    protocolColor: "from-[#22D3EE] to-[#0EA5E9]",
    protocolGlyph: "🌊",
    type: "Staking",
    asset: "SOL",
    amount: 42.4,
    amountUsd: 7_820,
    apy: 7.18,
    chain: "SOL",
  },
  {
    id: "dp6",
    protocol: "Drift",
    protocolColor: "from-[#2DD4BF] to-[#0D9488]",
    protocolGlyph: "📉",
    type: "Farming",
    asset: "SOL",
    amount: 6_400,
    amountUsd: 6_400,
    apy: 28.4,
    chain: "SOL",
  },
];

// ---------- MARKET CALENDAR ----------
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: "Economic" | "Token" | "Governance" | "Earnings" | "Conference";
  importance: "high" | "medium" | "low";
  description: string;
  impact: "bullish" | "bearish" | "neutral";
  source?: string;
  relatedTokens?: string[];
}

export const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "c1",
    title: "FOMC Interest Rate Decision",
    date: "2026-08-14",
    time: "14:00 ET",
    type: "Economic",
    importance: "high",
    description: "Federal Reserve interest rate decision. Markets expect a 25bps cut.",
    impact: "bullish",
    source: "Federal Reserve",
  },
  {
    id: "c2",
    title: "CPI Inflation Data",
    date: "2026-08-13",
    time: "08:30 ET",
    type: "Economic",
    importance: "high",
    description: "US Consumer Price Index release. Core CPI expected at 2.8% YoY.",
    impact: "neutral",
    source: "Bureau of Labor Statistics",
  },
  {
    id: "c3",
    title: "Jupiter (JUP) token unlock",
    date: "2026-08-15",
    type: "Token",
    importance: "high",
    description: "220M JUP tokens unlock (18.4% of supply) — could create sell pressure.",
    impact: "bearish",
    relatedTokens: ["jup"],
  },
  {
    id: "c4",
    title: "Solana Breakpoint Conference",
    date: "2026-09-18",
    type: "Conference",
    importance: "medium",
    description: "Annual Solana ecosystem conference. Major announcements expected.",
    impact: "bullish",
    relatedTokens: ["sol"],
  },
  {
    id: "c5",
    title: "NVDA Q3 Earnings",
    date: "2026-08-28",
    time: "16:00 ET",
    type: "Earnings",
    importance: "medium",
    description: "NVIDIA earnings — impacts AI token sentiment.",
    impact: "neutral",
    relatedTokens: ["io", "rndr"],
  },
  {
    id: "c6",
    title: "JUP Governance Vote: Pool fee",
    date: "2026-08-03",
    type: "Governance",
    importance: "low",
    description: "Voting ends on JLP-SOL fee increase proposal.",
    impact: "neutral",
    relatedTokens: ["jup"],
  },
  {
    id: "c7",
    title: "Pyth (PYTH) token unlock",
    date: "2026-08-20",
    type: "Token",
    importance: "medium",
    description: "142M PYTH tokens unlock (5.2% of supply).",
    impact: "bearish",
    relatedTokens: ["pyth"],
  },
  {
    id: "c8",
    title: "BTC ETF inflows report",
    date: "2026-08-12",
    time: "16:00 ET",
    type: "Economic",
    importance: "medium",
    description: "Weekly Bitcoin ETF inflows/outflows report.",
    impact: "neutral",
    relatedTokens: ["btc"],
  },
];

// ---------- MULTI-WALLET MANAGER ----------
export interface ManagedWallet {
  id: string;
  label: string;
  address: string;
  chain: Chain;
  balanceUsd: number;
  isPrimary: boolean;
  isConnected: boolean;
  color: string;
  glyph: string;
}

export const MANAGED_WALLETS: ManagedWallet[] = [
  {
    id: "mw1",
    label: "Main Trading",
    address: "0x7a3f...b9c2",
    chain: "SOL",
    balanceUsd: 84_200,
    isPrimary: true,
    isConnected: true,
    color: "from-[#14F195] to-[#9945FF]",
    glyph: "Z",
  },
  {
    id: "mw2",
    label: "DeFi Yield",
    address: "0x82ad...f1d4",
    chain: "SOL",
    balanceUsd: 42_400,
    isPrimary: false,
    isConnected: true,
    color: "from-[#22D3EE] to-[#0EA5E9]",
    glyph: "D",
  },
  {
    id: "mw3",
    label: "Cold Storage",
    address: "0x9bc1...a82e",
    chain: "SOL",
    balanceUsd: 184_000,
    isPrimary: false,
    isConnected: false,
    color: "from-[#F59E0B] to-[#EF4444]",
    glyph: "C",
  },
  {
    id: "mw4",
    label: "ETH Bridge",
    address: "0x4f8e...2c3b",
    chain: "ETH",
    balanceUsd: 18_400,
    isPrimary: false,
    isConnected: false,
    color: "from-[#627EEA] to-[#3B5BDB]",
    glyph: "E",
  },
];

// ---------- WATCHLIST PERFORMANCE ----------
export function getWatchlistPerformance(watchlist: string[]): {
  totalValue: number;
  totalChange24h: number;
  totalChange7d: number;
  bestPerformer: { id: string; symbol: string; change: number } | null;
  worstPerformer: { id: string; symbol: string; change: number } | null;
  avgChange: number;
  allocation: { id: string; symbol: string; pct: number; color: string }[];
} {
  const tokens = watchlist.map((id) => TOKENS_BY_ID[id]).filter(Boolean);
  if (tokens.length === 0) {
    return {
      totalValue: 0,
      totalChange24h: 0,
      totalChange7d: 0,
      bestPerformer: null,
      worstPerformer: null,
      avgChange: 0,
      allocation: [],
    };
  }
  const totalValue = tokens.reduce((s, t) => s + t.marketCap, 0);
  const totalChange24h = tokens.reduce((s, t) => s + t.change24h, 0) / tokens.length;
  const totalChange7d = tokens.reduce((s, t) => s + (t.change24h * (0.4 + seededRand(`7d-${t.id}`) * 0.6)), 0) / tokens.length;
  const sorted = [...tokens].sort((a, b) => b.change24h - a.change24h);
  return {
    totalValue,
    totalChange24h,
    totalChange7d,
    bestPerformer: sorted[0] ? { id: sorted[0].id, symbol: sorted[0].symbol, change: sorted[0].change24h } : null,
    worstPerformer: sorted[sorted.length - 1] ? { id: sorted[sorted.length - 1].id, symbol: sorted[sorted.length - 1].symbol, change: sorted[sorted.length - 1].change24h } : null,
    avgChange: totalChange24h,
    allocation: tokens.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      pct: (t.marketCap / totalValue) * 100,
      color: t.logoColor,
    })),
  };
}

// ---------- TOKEN SECURITY AUDIT ----------
export interface SecurityAudit {
  tokenId: string;
  overallScore: number; // 0-100
  riskLevel: "low" | "medium" | "high" | "extreme";
  checks: {
    label: string;
    status: "pass" | "fail" | "warning";
    detail: string;
  }[];
  contractAudit: {
    verified: boolean;
    sourceCode: boolean;
    proxyContract: boolean;
    upgradeable: boolean;
  };
  taxScan: {
    buyTax: number;
    sellTax: number;
    transferTax: number;
    maxTax: number;
  };
  ownership: {
    ownerRenounced: boolean;
    mintAuthorityRevoked: boolean;
    freezeAuthorityRevoked: boolean;
    topHolderPct: number;
  };
  liquidity: {
    locked: boolean;
    lockDurationDays: number;
    lockedUntil: string;
    liquidityUsd: number;
  };
  honeypot: {
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    transferable: boolean;
    simulationPassed: boolean;
  };
  warnings: string[];
}

export function getSecurityAudit(tokenId: string): SecurityAudit {
  const token = TOKENS_BY_ID[tokenId];
  const isNew = token ? token.ageHours < 100 : false;
  const isVerified = token?.verified ?? false;

  const baseScore = isVerified ? 85 : isNew ? 55 : 70;
  const noise = seededRand(`audit-${tokenId}`);

  return {
    tokenId,
    overallScore: Math.round(baseScore + noise * 15 - 5),
    riskLevel: baseScore > 80 ? "low" : baseScore > 60 ? "medium" : baseScore > 40 ? "high" : "extreme",
    checks: [
      { label: "Contract verified", status: isVerified || !isNew ? "pass" : "warning", detail: isVerified ? "Source code matches on-chain bytecode" : "Contract not verified on explorer" },
      { label: "Mint authority revoked", status: isNew && !isVerified ? "fail" : "pass", detail: isNew && !isVerified ? "Mint authority still active — owner can mint more tokens" : "Mint authority permanently revoked" },
      { label: "Freeze authority revoked", status: "pass", detail: "Cannot freeze user accounts" },
      { label: "Liquidity locked", status: isNew ? (seededRand(`liq-${tokenId}`) > 0.3 ? "pass" : "fail") : "pass", detail: isNew ? (seededRand(`liq-${tokenId}`) > 0.3 ? "Liquidity locked for 90 days" : "Liquidity NOT locked — rug pull risk!") : "Liquidity locked permanently" },
      { label: "Honeypot check", status: "pass", detail: "Buy and sell simulation passed — token is tradable" },
      { label: "Ownership renounced", status: isNew ? "warning" : "pass", detail: isNew ? "Ownership not yet renounced" : "Contract ownership renounced" },
      { label: "Top holder concentration", status: seededRand(`hold-${tokenId}`) > 0.5 ? "warning" : "pass", detail: `Top holder owns ${(seededRand(`hp-${tokenId}`) * 20 + 5).toFixed(1)}% of supply` },
      { label: "Tax scan", status: "pass", detail: "Buy: 0%, Sell: 0%, Transfer: 0%" },
    ],
    contractAudit: {
      verified: isVerified,
      sourceCode: isVerified,
      proxyContract: false,
      upgradeable: false,
    },
    taxScan: {
      buyTax: 0,
      sellTax: 0,
      transferTax: 0,
      maxTax: 0,
    },
    ownership: {
      ownerRenounced: !isNew,
      mintAuthorityRevoked: !isNew || isVerified,
      freezeAuthorityRevoked: true,
      topHolderPct: Number((seededRand(`hp2-${tokenId}`) * 20 + 5).toFixed(1)),
    },
    liquidity: {
      locked: !isNew || seededRand(`liq2-${tokenId}`) > 0.3,
      lockDurationDays: isNew ? 90 : 365,
      lockedUntil: "2026-11-15",
      liquidityUsd: token?.liquidity ?? 500_000,
    },
    honeypot: {
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      transferable: true,
      simulationPassed: true,
    },
    warnings: isNew && !isVerified
      ? ["Mint authority active — owner can mint unlimited tokens", "Liquidity may not be locked", "Contract not verified — review before buying"]
      : [],
  };
}

// ---------- TOKENIZED STOCKS ----------
export interface TokenizedStock {
  id: string;
  ticker: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  shares: number;
  isPreIPO: boolean;
  color: string;
  glyph: string;
  description: string;
  sparkline: number[];
}

export const TOKENIZED_STOCKS: TokenizedStock[] = [
  {
    id: "ts-spacex",
    ticker: "SPX",
    name: "SpaceX",
    price: 124_000,
    change24h: 4.2,
    marketCap: 280_000_000_000,
    volume24h: 4_200_000,
    shares: 4,
    isPreIPO: true,
    color: "from-[#EF4444] to-[#B91C1C]",
    glyph: "🚀",
    description: "Private shares of SpaceX, tokenized for fractional ownership.",
    sparkline: genSparkline("ts-spacex", 118000, 0.008, 40, 0.03),
  },
  {
    id: "ts-openai",
    ticker: "OAI",
    name: "OpenAI",
    price: 184_000,
    change24h: 6.8,
    marketCap: 157_000_000_000,
    volume24h: 8_400_000,
    shares: 2,
    isPreIPO: true,
    color: "from-[#10B981] to-[#047857]",
    glyph: "🧠",
    description: "Pre-IPO shares of OpenAI, the AI research company behind ChatGPT.",
    sparkline: genSparkline("ts-openai", 162000, 0.01, 40, 0.04),
  },
  {
    id: "ts-nvda",
    ticker: "NVDA",
    name: "NVIDIA",
    price: 842.0,
    change24h: 2.4,
    marketCap: 2_080_000_000_000,
    volume24h: 24_800_000,
    shares: 12,
    isPreIPO: false,
    color: "from-[#22C55E] to-[#15803D]",
    glyph: "💚",
    description: "NVIDIA Corporation — GPU and AI chip leader.",
    sparkline: genSparkline("ts-nvda", 820, 0.006, 40, 0.02),
  },
  {
    id: "ts-aapl",
    ticker: "AAPL",
    name: "Apple",
    price: 224.0,
    change24h: -0.8,
    marketCap: 3_420_000_000_000,
    volume24h: 12_400_000,
    shares: 24,
    isPreIPO: false,
    color: "from-[#94A3B8] to-[#475569]",
    glyph: "🍎",
    description: "Apple Inc. — consumer electronics and services.",
    sparkline: genSparkline("ts-aapl", 226, 0.004, 40, -0.01),
  },
  {
    id: "ts-tsla",
    ticker: "TSLA",
    name: "Tesla",
    price: 248.0,
    change24h: 3.8,
    marketCap: 790_000_000_000,
    volume24h: 18_400_000,
    shares: 18,
    isPreIPO: false,
    color: "from-[#EF4444] to-[#B91C1C]",
    glyph: "🚗",
    description: "Tesla Inc. — electric vehicles and energy.",
    sparkline: genSparkline("ts-tsla", 240, 0.008, 40, 0.03),
  },
  {
    id: "ts-stripes",
    ticker: "STRP",
    name: "Stripe",
    price: 82.0,
    change24h: 1.2,
    marketCap: 70_000_000_000,
    volume24h: 2_400_000,
    shares: 8,
    isPreIPO: true,
    color: "from-[#635BFF] to-[#4F46E5]",
    glyph: "💳",
    description: "Pre-IPO shares of Stripe, the payments infrastructure company.",
    sparkline: genSparkline("ts-stripes", 78, 0.006, 40, 0.01),
  },
];

// ---------- WALLET PNL TRACKER ----------
export interface WalletPnlEntry {
  tokenSymbol: string;
  tokenName: string;
  boughtUsd: number;
  soldUsd: number;
  currentUsd: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  pnlPct: number;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
  firstBuyDays: number;
}

export interface WalletPnlSummary {
  address: string;
  label: string;
  totalInvested: number;
  totalRealized: number;
  totalUnrealized: number;
  totalPnl: number;
  totalPnlPct: number;
  winRate: number;
  bestTrade: { symbol: string; pnl: number };
  worstTrade: { symbol: string; pnl: number };
  positions: WalletPnlEntry[];
}

export function getWalletPnl(address: string): WalletPnlSummary {
  const symbols = ["SOL", "WIF", "JUP", "BONK", "JTO", "DRIFT", "IO", "ETH"];
  const positions: WalletPnlEntry[] = symbols.map((sym, i) => {
    const tok = TOKENS.find((t) => t.symbol === sym) || TOKENS[0];
    const bought = 2000 + i * 1200;
    const sold = i % 3 === 0 ? bought * 0.4 : 0;
    const current = bought - sold;
    const realized = sold > 0 ? sold * 0.3 : 0;
    const unrealized = current * 0.25 * (i % 2 === 0 ? 1 : -0.5);
    const totalPnl = realized + unrealized;
    return {
      tokenSymbol: sym,
      tokenName: tok.name,
      boughtUsd: bought,
      soldUsd: sold,
      currentUsd: current,
      realizedPnl: Math.round(realized),
      unrealizedPnl: Math.round(unrealized),
      totalPnl: Math.round(totalPnl),
      pnlPct: Number(((totalPnl / bought) * 100).toFixed(1)),
      amount: Number((bought / tok.price).toFixed(2)),
      avgBuyPrice: Number((tok.price * 0.7).toFixed(4)),
      currentPrice: tok.price,
      firstBuyDays: 30 + i * 12,
    };
  });

  const totalInvested = positions.reduce((s, p) => s + p.boughtUsd, 0);
  const totalRealized = positions.reduce((s, p) => s + p.realizedPnl, 0);
  const totalUnrealized = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const sorted = [...positions].sort((a, b) => b.totalPnl - a.totalPnl);

  return {
    address,
    label: address.slice(0, 8) + "..." + address.slice(-4),
    totalInvested,
    totalRealized,
    totalUnrealized,
    totalPnl: totalRealized + totalUnrealized,
    totalPnlPct: Number((((totalRealized + totalUnrealized) / totalInvested) * 100).toFixed(1)),
    winRate: 64,
    bestTrade: { symbol: sorted[0].tokenSymbol, pnl: sorted[0].totalPnl },
    worstTrade: { symbol: sorted[sorted.length - 1].tokenSymbol, pnl: sorted[sorted.length - 1].totalPnl },
    positions: sorted,
  };
}

// ---------- SNIPE BOT ----------
export interface SnipeRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    minLiquidity: number;
    maxMarketCap: number;
    minSmartMoneyEntries: number;
    maxAgeMinutes: number;
    requireContractVerified: boolean;
    requireLiquidityLocked: boolean;
    requireMintRevoked: boolean;
    chains: string[];
  };
  actions: {
    buyAmountUsd: number;
    slippage: number;
    autoSellAtProfit: number; // percent
    autoSellAtLoss: number; // percent
    maxPositions: number;
  };
  stats: {
    triggered: number;
    filled: number;
    pnl: number;
    winRate: number;
  };
}

export const SNIPE_RULES: SnipeRule[] = [
  {
    id: "sr1",
    name: "Smart money snipe",
    enabled: true,
    conditions: {
      minLiquidity: 100_000,
      maxMarketCap: 10_000_000,
      minSmartMoneyEntries: 3,
      maxAgeMinutes: 60,
      requireContractVerified: true,
      requireLiquidityLocked: true,
      requireMintRevoked: true,
      chains: ["SOL"],
    },
    actions: {
      buyAmountUsd: 500,
      slippage: 5,
      autoSellAtProfit: 100,
      autoSellAtLoss: 20,
      maxPositions: 10,
    },
    stats: { triggered: 42, filled: 28, pnl: 4_280, winRate: 68 },
  },
  {
    id: "sr2",
    name: "Meme coin snipe",
    enabled: false,
    conditions: {
      minLiquidity: 50_000,
      maxMarketCap: 5_000_000,
      minSmartMoneyEntries: 1,
      maxAgeMinutes: 30,
      requireContractVerified: false,
      requireLiquidityLocked: true,
      requireMintRevoked: true,
      chains: ["SOL"],
    },
    actions: {
      buyAmountUsd: 200,
      slippage: 10,
      autoSellAtProfit: 200,
      autoSellAtLoss: 30,
      maxPositions: 20,
    },
    stats: { triggered: 84, filled: 52, pnl: 1_840, winRate: 42 },
  },
];

// ---------- PRICE PREDICTION ENGINE ----------
export interface PricePrediction {
  tokenId: string;
  symbol: string;
  currentPrice: number;
  predictions: {
    timeframe: "1h" | "4h" | "24h" | "7d";
    predictedPrice: number;
    changePct: number;
    confidence: number;
    direction: "up" | "down" | "neutral";
  }[];
  signals: {
    technical: "bullish" | "bearish" | "neutral";
    smartMoney: "bullish" | "bearish" | "neutral";
    social: "bullish" | "bearish" | "neutral";
    overall: "bullish" | "bearish" | "neutral";
  };
  aiSummary: string;
}

export function getPricePrediction(tokenId: string): PricePrediction | null {
  const token = TOKENS_BY_ID[tokenId];
  if (!token) return null;
  const price = token.price;
  const change = token.change24h;
  const bull = change >= 0;
  const smartInflow = token.smartMoneyInflow24h > 0;

  return {
    tokenId,
    symbol: token.symbol,
    currentPrice: price,
    predictions: [
      { timeframe: "1h", predictedPrice: price * (1 + (bull ? 0.012 : -0.008)), changePct: bull ? 1.2 : -0.8, confidence: 72, direction: bull ? "up" : "down" },
      { timeframe: "4h", predictedPrice: price * (1 + (bull ? 0.024 : -0.018)), changePct: bull ? 2.4 : -1.8, confidence: 68, direction: bull ? "up" : "down" },
      { timeframe: "24h", predictedPrice: price * (1 + (bull ? 0.054 : -0.042)), changePct: bull ? 5.4 : -4.2, confidence: 64, direction: bull ? "up" : "down" },
      { timeframe: "7d", predictedPrice: price * (1 + (bull ? 0.12 : -0.08)), changePct: bull ? 12.0 : -8.0, confidence: 58, direction: bull ? "up" : "down" },
    ],
    signals: {
      technical: bull ? "bullish" : "bearish",
      smartMoney: smartInflow ? "bullish" : "bearish",
      social: bull ? "bullish" : "neutral",
      overall: bull && smartInflow ? "bullish" : !bull && !smartInflow ? "bearish" : "neutral",
    },
    aiSummary: `${token.name} (${token.symbol}) is currently ${bull ? "in an uptrend" : "pulling back"} with ${smartInflow ? "positive" : "negative"} smart money flow. The RSI is at ${bull ? "62" : "44"} indicating ${bull ? "momentum without being overbought" : "room for recovery"}. ${bull ? "Smart money has been accumulating" : "Smart money is distributing"}. Short-term outlook is ${bull ? "bullish" : "cautious"} with ${bull ? "68%" : "54%"} confidence.`,
  };
}

// ---------- LIQUIDITY DEPTH ----------
export function getLiquidityDepth(tokenId: string): { bids: { price: number; amount: number; total: number }[]; asks: { price: number; amount: number; total: number }[] } {
  const token = TOKENS_BY_ID[tokenId];
  if (!token) return { bids: [], asks: [] };
  const price = token.price;
  const bids: { price: number; amount: number; total: number }[] = [];
  const asks: { price: number; amount: number; total: number }[] = [];
  let bidTotal = 0;
  let askTotal = 0;
  for (let i = 0; i < 20; i++) {
    const depthFactor = 1 + i * 0.15;
    const bidPrice = price * (1 - (i + 1) * 0.002);
    const askPrice = price * (1 + (i + 1) * 0.002);
    const bidAmount = (token.liquidity / price) * 0.08 * depthFactor;
    const askAmount = (token.liquidity / price) * 0.08 * depthFactor;
    bidTotal += bidAmount;
    askTotal += askAmount;
    bids.push({ price: bidPrice, amount: bidAmount, total: bidTotal });
    asks.push({ price: askPrice, amount: askAmount, total: askTotal });
  }
  return { bids: bids.reverse(), asks };
}

// ---------- TRADING JOURNAL ----------
export interface JournalEntry {
  id: string;
  date: string;
  tokenSymbol: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  usdValue: number;
  pnl: number;
  pnlPct: number;
  note: string;
  tags: string[];
  mood: "confident" | "neutral" | "uncertain" | "fomo";
  rating: number; // 1-5
}

export const JOURNAL_ENTRIES: JournalEntry[] = [
  { id: "j1", date: "2026-07-30", tokenSymbol: "WIF", side: "BUY", amount: 1200, price: 2.42, usdValue: 2904, pnl: 0, pnlPct: 0, note: "Smart money cluster buy signal. 7 wallets accumulated within 1h.", tags: ["smart-money", "signal"], mood: "confident", rating: 5 },
  { id: "j2", date: "2026-07-28", tokenSymbol: "SOL", side: "SELL", amount: 24, price: 182.0, usdValue: 4368, pnl: 480, pnlPct: 12.4, note: "Took profits at resistance. Will re-enter on pullback.", tags: ["take-profit"], mood: "confident", rating: 4 },
  { id: "j3", date: "2026-07-25", tokenSymbol: "BONK", side: "BUY", amount: 8_400_000, price: 0.000022, usdValue: 185, pnl: 0, pnlPct: 0, note: "Small degen play. Meme season narrative.", tags: ["degen", "meme"], mood: "fomo", rating: 2 },
  { id: "j4", date: "2026-07-20", tokenSymbol: "JUP", side: "SELL", amount: 5000, price: 0.82, usdValue: 4100, pnl: -220, pnlPct: -5.1, note: "Cut losses. Smart money distributing.", tags: ["stop-loss"], mood: "uncertain", rating: 3 },
  { id: "j5", date: "2026-07-18", tokenSymbol: "IO", side: "BUY", amount: 320, price: 2.68, usdValue: 858, pnl: 0, pnlPct: 0, note: "AI infrastructure long-term hold. Volume spiking.", tags: ["ai", "long-term"], mood: "confident", rating: 4 },
  { id: "j6", date: "2026-07-15", tokenSymbol: "DRIFT", side: "BUY", amount: 1200, price: 1.38, usdValue: 1656, pnl: 0, pnlPct: 0, note: "DeFi perps play. TVL growing fast.", tags: ["defi"], mood: "neutral", rating: 3 },
  { id: "j7", date: "2026-07-10", tokenSymbol: "MNGO", side: "BUY", amount: 18000, price: 0.032, usdValue: 576, pnl: 0, pnlPct: 0, note: "Cluster buy signal — 7 smart wallets in 1h. High confidence.", tags: ["smart-money", "signal"], mood: "confident", rating: 5 },
];

// ---------- DEFI HEALTH MONITOR ----------
export interface DefiHealthSummary {
  totalCollateral: number;
  totalDebt: number;
  healthFactor: number;
  liquidationDistance: number; // percent
  riskLevel: "safe" | "moderate" | "danger" | "critical";
  positions: {
    protocol: string;
    type: string;
    asset: string;
    collateral: number;
    debt: number;
    healthFactor: number;
    liquidationPrice: number;
    currentPrice: number;
    distancePct: number;
  }[];
  recommendations: string[];
}

export function getDefiHealth(): DefiHealthSummary {
  const positions = [
    { protocol: "Kamino", type: "Borrowing", asset: "SOL", collateral: 36_000, debt: 15_520, healthFactor: 2.4, liquidationPrice: 35.0, currentPrice: 72.97, distancePct: 54.3 },
    { protocol: "Marginfi", type: "Borrowing", asset: "JLP", collateral: 18_400, debt: 8_200, healthFactor: 2.2, liquidationPrice: 12.4, currentPrice: 14.8, distancePct: 16.2 },
    { protocol: "Drift", type: "Borrowing", asset: "ETH", collateral: 12_000, debt: 6_400, healthFactor: 1.9, liquidationPrice: 2840, currentPrice: 3420, distancePct: 17.0 },
  ];
  const totalCollateral = positions.reduce((s, p) => s + p.collateral, 0);
  const totalDebt = positions.reduce((s, p) => s + p.debt, 0);
  const avgHealth = positions.reduce((s, p) => s + p.healthFactor, 0) / positions.length;
  const minDistance = Math.min(...positions.map((p) => p.distancePct));
  const riskLevel = avgHealth > 2.5 ? "safe" : avgHealth > 1.8 ? "moderate" : avgHealth > 1.3 ? "danger" : "critical";

  return {
    totalCollateral,
    totalDebt,
    healthFactor: avgHealth,
    liquidationDistance: minDistance,
    riskLevel,
    positions: positions.map((p) => ({
      ...p,
      distancePct: p.distancePct,
      liquidationPrice: p.liquidationPrice,
      currentPrice: p.currentPrice,
    })),
    recommendations: [
      minDistance < 20 ? "⚠️ Marginfi position is within 20% of liquidation — consider adding collateral" : "",
      "Consider paying down Drift debt to improve health factor",
      "Diversify collateral to reduce concentration risk",
    ].filter(Boolean),
  };
}

// ---------- TAX LOSS HARVESTING ----------
export interface HarvestOpportunity {
  id: string;
  tokenSymbol: string;
  unrealizedLoss: number;
  potentialTaxSavings: number;
  holdingPeriodDays: number;
  isShortTerm: boolean;
  recommendation: string;
}

export function getHarvestOpportunities(): HarvestOpportunity[] {
  return [
    { id: "h1", tokenSymbol: "HNT", unrealizedLoss: -1_240, potentialTaxSavings: 397, holdingPeriodDays: 84, isShortTerm: true, recommendation: "Sell HNT to realize $1,240 loss, save ~$397 in taxes. Rebuy after 30 days to maintain position." },
    { id: "h2", tokenSymbol: "PYTH", unrealizedLoss: -680, potentialTaxSavings: 218, holdingPeriodDays: 142, isShortTerm: true, recommendation: "Sell PYTH to realize $680 loss, save ~$218 in taxes. Swap to a similar oracle token to maintain exposure." },
    { id: "h3", tokenSymbol: "NEON", unrealizedLoss: -420, potentialTaxSavings: 134, holdingPeriodDays: 220, isShortTerm: true, recommendation: "Sell NEON to realize $420 loss, save ~$134 in taxes. Small position — easy to harvest." },
  ];
}

// ---------- BATCH 8: Remaining Moby features ----------

// ---------- TRAILING STOP LOSS ----------
export interface TrailingStop {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  highestPrice: number;
  trailPercent: number;
  stopPrice: number;
  amountUsd: number;
  status: "active" | "triggered" | "cancelled";
  createdAgoSec: number;
  distancePct: number;
}

export const TRAILING_STOPS: TrailingStop[] = [
  { id: "ts1", tokenId: "wif", tokenSymbol: "WIF", side: "LONG", entryPrice: 2.42, currentPrice: 2.84, highestPrice: 2.91, trailPercent: 8, stopPrice: 2.68, amountUsd: 5000, status: "active", createdAgoSec: 86400, distancePct: 5.6 },
  { id: "ts2", tokenId: "sol", tokenSymbol: "SOL", side: "LONG", entryPrice: 68.0, currentPrice: 72.97, highestPrice: 76.0, trailPercent: 5, stopPrice: 64.6, amountUsd: 8000, status: "active", createdAgoSec: 43200, distancePct: 2.9 },
  { id: "ts3", tokenId: "bonk", tokenSymbol: "BONK", side: "LONG", entryPrice: 0.000022, currentPrice: 0.0000284, highestPrice: 0.000031, trailPercent: 15, stopPrice: 0.0000264, amountUsd: 2000, status: "active", createdAgoSec: 21600, distancePct: 7.0 },
  { id: "ts4", tokenId: "jup", tokenSymbol: "JUP", side: "LONG", entryPrice: 0.68, currentPrice: 0.84, highestPrice: 0.86, trailPercent: 10, stopPrice: 0.774, amountUsd: 3000, status: "triggered", createdAgoSec: 172800, distancePct: 0 },
];

// ---------- HOT WALLETS (most active right now) ----------
export interface HotWallet {
  id: string;
  label: string;
  address: string;
  type: "whale" | "smart_money" | "kol" | "mev" | "fund";
  score: number;
  trades24h: number;
  volume24h: number;
  pnl24h: number;
  pnlPct: number;
  winRate: number;
  topToken: string;
  lastActiveSec: number;
  isLive: boolean;
  color: string;
  glyph: string;
  trend: "up" | "down";
}

export const HOT_WALLETS: HotWallet[] = [
  { id: "hw1", label: "0xMoby", address: "0x7a3f...b9c2", type: "whale", score: 96, trades24h: 28, volume24h: 4_280_000, pnl24h: 184_000, pnlPct: 42.8, winRate: 78, topToken: "WIF", lastActiveSec: 120, isLive: true, color: "from-[#14F195] to-[#9945FF]", glyph: "M", trend: "up" },
  { id: "hw2", label: "DegenDiva", address: "0x82ad...f1d4", type: "kol", score: 84, trades24h: 42, volume24h: 3_120_000, pnl24h: 248_000, pnlPct: 68.2, winRate: 64, topToken: "BONK", lastActiveSec: 340, isLive: true, color: "from-[#EC4899] to-[#BE185D]", glyph: "D", trend: "up" },
  { id: "hw3", label: "AlphaBot", address: "0x9bc1...a82e", type: "smart_money", score: 90, trades24h: 18, volume24h: 1_840_000, pnl24h: 92_000, pnlPct: 28.4, winRate: 72, topToken: "JUP", lastActiveSec: 680, isLive: true, color: "from-[#22D3EE] to-[#0EA5E9]", glyph: "A", trend: "up" },
  { id: "hw4", label: "Scoop", address: "0x4f8e...2c3b", type: "whale", score: 92, trades24h: 12, volume24h: 2_840_000, pnl24h: -84_000, pnlPct: -12.4, winRate: 58, topToken: "SOL", lastActiveSec: 1200, isLive: false, color: "from-[#F59E0B] to-[#EF4444]", glyph: "W", trend: "down" },
  { id: "hw5", label: "Sage", address: "0x5a2f...8e1c", type: "smart_money", score: 88, trades24h: 8, volume24h: 920_000, pnl24h: 64_000, pnlPct: 18.2, winRate: 81, topToken: "IO", lastActiveSec: 2400, isLive: false, color: "from-[#8B5CF6] to-[#6366F1]", glyph: "S", trend: "up" },
  { id: "hw6", label: "MEV Bot Alpha", address: "0x3c7d...9f2a", type: "mev", score: 94, trades24h: 184, volume24h: 8_400_000, pnl24h: 42_000, pnlPct: 8.4, winRate: 89, topToken: "SOL", lastActiveSec: 30, isLive: true, color: "from-[#A855F7] to-[#7E22CE]", glyph: "⚡", trend: "up" },
];

// ---------- TOKEN MIGRATIONS ----------
export interface TokenMigration {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  fromChain: string;
  toChain: string;
  status: "announced" | "in_progress" | "completed";
  date: string;
  ratio: string;
  reason: string;
  color: string;
  glyph: string;
  oldContract: string;
  newContract: string;
}

export const TOKEN_MIGRATIONS: TokenMigration[] = [
  { id: "m1", tokenSymbol: "WORM", tokenName: "Wormhole", fromChain: "SOL", toChain: "ALL", status: "completed", date: "2026-07-20", ratio: "1:1", reason: "Multi-chain expansion via wormhole bridge", color: "from-[#9945FF] to-[#14F195]", glyph: "🪱", oldContract: "0xAB12...CD34", newContract: "0xEF56...GH78" },
  { id: "m2", tokenSymbol: "DUST", tokenName: "DUST Protocol", fromChain: "SOL", toChain: "BASE", status: "in_progress", date: "2026-08-10", ratio: "1:1", reason: "Migrating to Base for lower fees", color: "from-[#F59E0B] to-[#EF4444]", glyph: "💨", oldContract: "0x12AB...34CD", newContract: "0x56EF...78GH" },
  { id: "m3", tokenSymbol: "STEP", tokenName: "Step Finance", fromChain: "SOL", toChain: "ETH", status: "announced", date: "2026-09-01", ratio: "1:1.2", reason: "Expanding to Ethereum DeFi ecosystem", color: "from-[#22D3EE] to-[#0EA5E9]", glyph: "👣", oldContract: "0xAB12...CD34", newContract: "Pending" },
];

// ---------- WATCHLIST ALERT CONFIG ----------
export interface WatchlistAlert {
  tokenId: string;
  symbol: string;
  priceAbove: number | null;
  priceBelow: number | null;
  changeAbove: number | null;
  changeBelow: number | null;
  smartMoneyEntry: boolean;
  enabled: boolean;
}

// ---------- MEV PROTECTION STATUS ----------
export interface MevProtectionInfo {
  enabled: boolean;
  mode: "auto" | "on" | "off";
  protectedSwaps24h: number;
  valueSaved24h: number;
  attacksBlocked24h: number;
  routes: {
    label: string;
    protected: boolean;
    description: string;
  }[];
}

export const MEV_PROTECTION: MevProtectionInfo = {
  enabled: true,
  mode: "auto",
  protectedSwaps24h: 184,
  valueSaved24h: 248,
  attacksBlocked24h: 12,
  routes: [
    { label: "Jupiter Ultra", protected: true, description: "MEV-protected routing with dynamic slippage" },
    { label: "Jupiter v6", protected: true, description: "Standard routing with slippage protection" },
    { label: "Raydium direct", protected: false, description: "Direct pool swap — no MEV protection" },
    { label: "Orca whirlpool", protected: false, description: "Direct whirlpool swap — no MEV protection" },
  ],
};

// ===== Enhancement #25: Gas-fee auto-tuner =====
// Computes recommended priority fee (in micro-lamports) based on network congestion.
// Used by snipe-bot to front-run the slot on launch snipes.
export function computeAutoPriorityFee(congestionPct: number): {
  microLamports: number;
  feeUsd: number;
  label: string;
  confidence: number;
} {
  // Base: 1000 micro-lamports, scales with congestion
  // At 100% congestion: ~10000 micro-lamports (aggressive)
  const microLamports = Math.round(1000 + (congestionPct / 100) * 9000);
  const feeUsd = microLamports * 0.000000001 * 184; // SOL at ~$184
  const label = congestionPct > 70 ? "Turbo" : congestionPct > 40 ? "Fast" : "Standard";
  const confidence = Math.min(99, 70 + (100 - congestionPct) * 0.3);
  return { microLamports, feeUsd, label, confidence };
}

export function getCurrentCongestion(): number {
  return CONGESTION_HISTORY[CONGESTION_HISTORY.length - 1]?.v ?? 50;
}
