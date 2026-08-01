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
  marketCap: number;
  liquidity: number;
  volume24h: number;
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
    price: 184.32,
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
  },
  {
    id: "wif",
    symbol: "WIF",
    name: "dogwifhat",
    chain: "SOL",
    category: "Meme",
    price: 2.84,
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
  },
  {
    id: "pyth",
    symbol: "PYTH",
    name: "Pyth Network",
    chain: "SOL",
    category: "DePIN",
    price: 0.381,
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
    price: 0.0421,
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
    description: "Governance token for aSolana perps + lending protocol.",
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
  },
  {
    id: "popcat",
    symbol: "POPCAT",
    name: "Popcat",
    chain: "SOL",
    category: "Meme",
    price: 0.842,
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
  },
  {
    id: "neon",
    symbol: "NEON",
    name: "NeonPay",
    chain: "SOL",
    category: "DePIN",
    price: 0.124,
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
  },
  {
    id: "ray",
    symbol: "RAY",
    name: "Raydium",
    chain: "SOL",
    category: "DeFi",
    price: 2.42,
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
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    chain: "ETH",
    category: "L1",
    price: 3420.4,
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
    price: 64280.0,
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
      { symbol: "BASD", pct: 12 },
    ],
    recentTrades: [],
    isLive: false,
  },
];

// ---------- WHALE FLOWS ----------

const flowTokens = ["SOL", "WIF", "JUP", "BONK", "POPCAT", "JTO", "DRIFT", "IO", "TNSR", "MNGO", "MOON", "BASD"];

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
    tokenSymbol: "BASD",
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
  return `$${n.toExponential(2)}`;
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
