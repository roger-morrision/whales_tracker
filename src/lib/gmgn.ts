/**
 * GMGN.ai client — fetches token metadata, holders, traders, smart money, KOL,
 * security, and chart data from GMGN's public API.
 *
 * All requests are proxied through this server module (never called from the browser
 * directly to avoid CORS, User-Agent blocking, and to enable caching/fallback).
 *
 * Every fetch attempts the real GMGN API first; on failure (network, 4xx/5xx,
 * timeout, or non-JSON) it returns null so the caller can synthesize fallback data
 * and tag it with source: "simulated".
 */

const GMGN_BASE = "https://gmgn.ai/defi/quotation/v1";
const DEFAULT_TIMEOUT_MS = 8000;

// In-memory cache (per-server-instance). TTL per key.
interface CacheEntry {
  ts: number;
  data: any;
}
const cache = new Map<string, CacheEntry>();

function getCached<T>(key: string, ttlMs: number): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return e.data as T;
}

function setCached(key: string, data: any) {
  // Cap cache size — evict oldest if needed
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { ts: Date.now(), data });
}

async function fetchJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // GMGN blocks bare fetches; mimic a real browser
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://gmgn.ai/",
      },
      // Disable Next.js fetch caching for GMGN — we manage our own cache
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// ===== Public typed fetchers =====

export interface GmgnTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: number;
  price_change_1h: number;
  price_change_24h: number;
  price_change_6h?: number;
  volume_24h: number;
  market_cap: number;
  fdv?: number;
  liquidity: number;
  holders: number;
  total_supply: number;
  top_10_holder_rate?: number;
  dev_holder_rate?: number;
  create_timestamp?: number;
  last_trade_timestamp?: number;
  tx_24h_buy?: number;
  tx_24h_sell?: number;
  is_alive?: boolean;
  twitter?: string;
  website?: string;
  telegram?: string;
  image_uri?: string;
}

export interface GmgnSecurity {
  address: string;
  is_mint_authority_revoked: boolean;
  is_freeze_authority_revoked: boolean;
  is_token_mintable: boolean;
  is_honeypot: boolean;
  is_open_source: boolean;
  is_proxy: boolean;
  is_canonical: boolean;
  personal_holder_rate?: number;
  top10_holder_rate: number;
  top10_holder_value_usd?: number;
  dev_holder_rate: number;
  dev_buy_tax_rate?: number;
  dev_sell_tax_rate?: number;
  lp_holder_rate?: number;
  liquidity_locked?: boolean;
  lp_locked_ratio?: number;
  risks: string[];
}

export interface GmgnHolder {
  address: string;
  balance: number;
  value_usd: number;
  holder_rate: number; // percent
  is_dev?: boolean;
  is_top10?: boolean;
  is_smart_money?: boolean;
  is_kol?: boolean;
  is_celebrity?: boolean;
  is_fund?: boolean;
  tags?: string[];
}

export interface GmgnTrader {
  address: string;
  pnl: number;
  pnl_rate?: number;
  buy_usd: number;
  sell_usd: number;
  tx_count?: number;
  is_smart_money?: boolean;
  is_kol?: boolean;
  first_buy_time?: number;
  last_active_time?: number;
  tags?: string[];
}

export interface GmgnSmartMoneyActivity {
  address: string;
  type: "buy" | "sell";
  amount_usd: number;
  amount_token: number;
  ts: number;
  wallet_tag?: string; // smart money, KOL, etc.
  wallet_label?: string;
  pnl_30d_usd?: number;
}

export interface GmgnKolHolder {
  address: string;
  twitter_handle: string;
  twitter_name: string;
  followers: number;
  balance: number;
  value_usd: number;
  buy_usd?: number;
  avg_buy_price?: number;
  pnl_usd?: number;
  last_buy_ts?: number;
}

export interface GmgnCandle {
  t: number; // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // volume in USD
}

export interface GmgnTrendingToken extends GmgnTokenInfo {
  rank: number;
  chain: string;
  launched_at?: number;
  swaps_24h?: number;
  buyers_24h?: number;
  sellers_24h?: number;
  smart_money_holders?: number;
  smart_money_inflow_24h?: number;
}

// ===== Fetch implementations =====

export async function fetchTokenInfo(address: string): Promise<GmgnTokenInfo | null> {
  const cacheKey = `token:${address}`;
  const cached = getCached<GmgnTokenInfo>(cacheKey, 60_000); // 60s
  if (cached) return cached;
  const data = await fetchJson(`${GMGN_BASE}/tokens/sol/${address}`);
  if (!data || data.code !== 0 || !data.data) {
    // Try DexScreener as a fallback real-data source
    const ds = await fetchDexScreenerToken(address);
    if (ds) {
      setCached(cacheKey, ds);
      return ds;
    }
    return null;
  }
  const token = data.data as GmgnTokenInfo;
  setCached(cacheKey, token);
  return token;
}

/**
 * DexScreener fallback — fetches real token price/marketCap/volume/liquidity
 * from api.dexscreener.com (no auth required). Returns data shaped as GmgnTokenInfo.
 */
async function fetchDexScreenerToken(address: string): Promise<GmgnTokenInfo | null> {
  const data = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
  if (!data || !Array.isArray(data.pairs) || data.pairs.length === 0) return null;
  // Pick the Solana pair with the highest liquidity
  const solPairs = data.pairs.filter((p: any) => p.chainId === "solana");
  const pairs = solPairs.length > 0 ? solPairs : data.pairs;
  pairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const p = pairs[0];
  if (!p) return null;
  const priceUsd = parseFloat(p.priceUsd ?? "0");
  const marketCap = p.marketCap ?? p.fdv ?? 0;
  const volume24h = p.volume?.h24 ?? 0;
  const liquidity = p.liquidity?.usd ?? 0;
  const txns = p.txns?.h24 ?? {};
  const priceChange = p.priceChange?.h24 ?? 0;
  const priceChange1h = p.priceChange?.h1 ?? 0;
  const created = p.pairCreatedAt ? Math.floor(new Date(p.pairCreatedAt).getTime() / 1000) : undefined;
  const socials = (p.info?.socials ?? []) as any[];
  const twitter = socials.find((s) => s.type === "twitter")?.url;
  const website = p.info?.websites?.[0]?.url;
  const telegram = socials.find((s) => s.type === "telegram")?.url;
  const imageUri = p.info?.imageUrl;
  return {
    address,
    symbol: p.baseToken?.symbol ?? "",
    name: p.baseToken?.name ?? "",
    decimals: 9,
    price: priceUsd,
    price_change_1h: priceChange1h,
    price_change_24h: priceChange,
    volume_24h: volume24h,
    market_cap: marketCap,
    fdv: p.fdv ?? marketCap,
    liquidity,
    holders: 0, // DexScreener doesn't provide holder count
    total_supply: 0,
    create_timestamp: created,
    last_trade_timestamp: undefined,
    tx_24h_buy: txns.buys ?? 0,
    tx_24h_sell: txns.sells ?? 0,
    is_alive: true,
    twitter,
    website,
    telegram,
    image_uri: imageUri,
  };
}

export async function fetchSecurity(address: string): Promise<GmgnSecurity | null> {
  const cacheKey = `security:${address}`;
  const cached = getCached<GmgnSecurity>(cacheKey, 120_000); // 2 min
  if (cached) return cached;
  const data = await fetchJson(`${GMGN_BASE}/tokens/security/sol/${address}`);
  if (!data || data.code !== 0 || !data.data) return null;
  const sec = data.data as GmgnSecurity;
  setCached(cacheKey, sec);
  return sec;
}

export async function fetchTopHolders(address: string, limit = 20): Promise<GmgnHolder[] | null> {
  const cacheKey = `holders:${address}:${limit}`;
  const cached = getCCached<GmgnHolder[]>(cacheKey, 60_000);
  if (cached) return cached;
  const data = await fetchJson(`${GMGN_BASE}/tokens/top_holders/sol/${address}?limit=${limit}&offset=0`);
  if (!data || data.code !== 0 || !data.data?.holders) return null;
  const holders = data.data.holders as GmgnHolder[];
  setCached(cacheKey, holders);
  return holders;
}

// Wrapper to fix typo
function getCCached<T>(key: string, ttlMs: number): T | null {
  return getCached<T>(key, ttlMs);
}

export async function fetchTopTraders(address: string, limit = 20): Promise<GmgnTrader[] | null> {
  const cacheKey = `traders:${address}:${limit}`;
  const cached = getCached<GmgnTrader[]>(cacheKey, 60_000);
  if (cached) return cached;
  const data = await fetchJson(`${GMGN_BASE}/tokens/top_traders/sol/${address}?limit=${limit}&offset=0`);
  if (!data || data.code !== 0 || !data.data?.traders) return null;
  const traders = data.data.traders as GmgnTrader[];
  setCached(cacheKey, traders);
  return traders;
}

export async function fetchSmartMoneyActivity(
  address: string,
  limit = 30
): Promise<GmgnSmartMoneyActivity[] | null> {
  const cacheKey = `smartmoney:${address}:${limit}`;
  const cached = getCached<GmgnSmartMoneyActivity[]>(cacheKey, 45_000);
  if (cached) return cached;
  const data = await fetchJson(
    `${GMGN_BASE}/smartmoney/sol/walletActivity/${address}?limit=${limit}&offset=0`
  );
  if (!data || data.code !== 0 || !Array.isArray(data.data?.activity)) return null;
  const activity = data.data.activity as GmgnSmartMoneyActivity[];
  setCached(cacheKey, activity);
  return activity;
}

export async function fetchKolHolders(address: string, limit = 30): Promise<GmgnKolHolder[] | null> {
  const cacheKey = `kol:${address}:${limit}`;
  const cached = getCached<GmgnKolHolder[]>(cacheKey, 90_000);
  if (cached) return cached;
  const data = await fetchJson(`${GMGN_BASE}/tokens/kol/sol/${address}?limit=${limit}&offset=0`);
  if (!data || data.code !== 0 || !Array.isArray(data.data?.kols)) return null;
  const kols = data.data.kols as GmgnKolHolder[];
  setCached(cacheKey, kols);
  return kols;
}

export async function fetchCandles(
  address: string,
  resolution: "1m" | "5m" | "15m" | "1h" | "4h" | "1d" = "15m",
  limit = 200
): Promise<GmgnCandle[] | null> {
  const cacheKey = `candles:${address}:${resolution}:${limit}`;
  const ttl = resolution === "1m" || resolution === "5m" ? 15_000 : 60_000;
  const cached = getCached<GmgnCandle[]>(cacheKey, ttl);
  if (cached) return cached;
  const data = await fetchJson(
    `${GMGN_BASE}/charts/sol/${address}?resolution=${resolution}&limit=${limit}`
  );
  if (!data || data.code !== 0 || !Array.isArray(data.data?.candles)) return null;
  const candles = data.data.candles as GmgnCandle[];
  setCached(cacheKey, candles);
  return candles;
}

export async function fetchTrending(
  timeframe: "1m" | "5m" | "1h" | "6h" | "24h" = "1h",
  orderBy: "volume" | "tx_count" | "market_cap" | "smart_money" = "volume",
  limit = 30
): Promise<GmgnTrendingToken[] | null> {
  const cacheKey = `trending:${timeframe}:${orderBy}:${limit}`;
  const cached = getCached<GmgnTrendingToken[]>(cacheKey, 30_000);
  if (cached) return cached;
  const data = await fetchJson(
    `${GMGN_BASE}/rank/sol/swaps/${timeframe}?orderby=${orderBy}&direction=desc&limit=${limit}`
  );
  if (!data || data.code !== 0 || !Array.isArray(data.data?.rank)) {
    // Try DexScreener boosted tokens as a fallback
    const ds = await fetchDexScreenerTrending(limit);
    if (ds) {
      setCached(cacheKey, ds);
      return ds;
    }
    return null;
  }
  const trending = data.data.rank as GmgnTrendingToken[];
  setCached(cacheKey, trending);
  return trending;
}

/**
 * DexScreener trending fallback — uses the top boosted tokens endpoint.
 * Returns GmgnTrendingToken[] with whatever real data is available.
 */
async function fetchDexScreenerTrending(limit: number): Promise<GmgnTrendingToken[] | null> {
  const data = await fetchJson("https://api.dexscreener.com/token-boosts/top/v1");
  if (!Array.isArray(data) || data.length === 0) return null;
  // Filter Solana only and take top `limit`
  const solTokens = data.filter((t: any) => t.chainId === "solana").slice(0, limit);
  if (solTokens.length === 0) return null;

  // For each, fetch the token pair data
  const results: GmgnTrendingToken[] = [];
  for (let i = 0; i < Math.min(solTokens.length, limit); i++) {
    const t = solTokens[i];
    const pairData = await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`
    );
    if (!pairData || !Array.isArray(pairData.pairs) || pairData.pairs.length === 0) continue;
    const solPairs = pairData.pairs.filter((p: any) => p.chainId === "solana");
    const pairs = solPairs.length > 0 ? solPairs : pairData.pairs;
    pairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const p = pairs[0];
    if (!p) continue;
    const priceUsd = parseFloat(p.priceUsd ?? "0");
    const marketCap = p.marketCap ?? p.fdv ?? 0;
    results.push({
      address: t.tokenAddress,
      symbol: p.baseToken?.symbol ?? "",
      name: p.baseToken?.name ?? "",
      decimals: 9,
      price: priceUsd,
      price_change_1h: p.priceChange?.h1 ?? 0,
      price_change_24h: p.priceChange?.h24 ?? 0,
      volume_24h: p.volume?.h24 ?? 0,
      market_cap: marketCap,
      fdv: p.fdv ?? marketCap,
      liquidity: p.liquidity?.usd ?? 0,
      holders: 0,
      total_supply: 0,
      create_timestamp: p.pairCreatedAt ? Math.floor(new Date(p.pairCreatedAt).getTime() / 1000) : undefined,
      last_trade_timestamp: undefined,
      tx_24h_buy: p.txns?.h24?.buys ?? 0,
      tx_24h_sell: p.txns?.h24?.sells ?? 0,
      is_alive: true,
      rank: i + 1,
      chain: "solana",
      swaps_24h: (p.txns?.h24?.buys ?? 0) + (p.txns?.h24?.sells ?? 0),
      buyers_24h: p.txns?.h24?.buys ?? 0,
      sellers_24h: p.txns?.h24?.sells ?? 0,
      smart_money_holders: 0,
      smart_money_inflow_24h: 0,
    });
  }
  if (results.length === 0) return null;
  // Sort by orderBy field — but we already have them in DexScreener boost order, which is its own signal
  return results;
}

export async function fetchNewPairs(limit = 30): Promise<GmgnTrendingToken[] | null> {
  const cacheKey = `newpairs:${limit}`;
  const cached = getCached<GmgnTrendingToken[]>(cacheKey, 30_000);
  if (cached) return cached;
  const data = await fetchJson(
    `${GMGN_BASE}/rank/sol/swaps/1h?orderby=created_timestamp&direction=asc&limit=${limit}`
  );
  if (!data || data.code !== 0 || !Array.isArray(data.data?.rank)) {
    // Fallback: DexScreener token-boosts/latest (recently boosted = recently launched)
    const ds = await fetchJson("https://api.dexscreener.com/token-boosts/latest/v1");
    if (Array.isArray(ds)) {
      const solTokens = ds.filter((t: any) => t.chainId === "solana").slice(0, limit);
      const results: GmgnTrendingToken[] = [];
      for (let i = 0; i < solTokens.length; i++) {
        const t = solTokens[i];
        const pairData = await fetchJson(
          `https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`
        );
        if (!pairData?.pairs?.length) continue;
        const solPairs = pairData.pairs.filter((p: any) => p.chainId === "solana");
        const p = (solPairs.length > 0 ? solPairs : pairData.pairs).sort(
          (a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
        )[0];
        if (!p) continue;
        const priceUsd = parseFloat(p.priceUsd ?? "0");
        const marketCap = p.marketCap ?? p.fdv ?? 0;
        results.push({
          address: t.tokenAddress,
          symbol: p.baseToken?.symbol ?? "",
          name: p.baseToken?.name ?? "",
          decimals: 9,
          price: priceUsd,
          price_change_1h: p.priceChange?.h1 ?? 0,
          price_change_24h: p.priceChange?.h24 ?? 0,
          volume_24h: p.volume?.h24 ?? 0,
          market_cap: marketCap,
          fdv: p.fdv ?? marketCap,
          liquidity: p.liquidity?.usd ?? 0,
          holders: 0,
          total_supply: 0,
          create_timestamp: p.pairCreatedAt ? Math.floor(new Date(p.pairCreatedAt).getTime() / 1000) : undefined,
          is_alive: true,
          rank: i + 1,
          chain: "solana",
          swaps_24h: (p.txns?.h24?.buys ?? 0) + (p.txns?.h24?.sells ?? 0),
          buyers_24h: p.txns?.h24?.buys ?? 0,
          sellers_24h: p.txns?.h24?.sells ?? 0,
        });
      }
      if (results.length > 0) {
        setCached(cacheKey, results);
        return results;
      }
    }
    return null;
  }
  const pairs = data.data.rank as GmgnTrendingToken[];
  setCached(cacheKey, pairs);
  return pairs;
}

/**
 * Search for tokens by symbol or name via DexScreener.
 * Returns up to `limit` Solana-only matches.
 */
export async function searchTokens(query: string, limit = 10): Promise<GmgnTrendingToken[] | null> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = getCached<GmgnTrendingToken[]>(cacheKey, 60_000);
  if (cached) return cached;
  const data = await fetchJson(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
  );
  if (!data || !Array.isArray(data.pairs)) return null;
  // Filter Solana, deduplicate by tokenAddress, sort by liquidity
  const seen = new Set<string>();
  const filtered = data.pairs
    .filter((p: any) => p.chainId === "solana")
    .filter((p: any) => {
      if (seen.has(p.baseToken?.address)) return false;
      seen.add(p.baseToken?.address);
      return true;
    })
    .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .slice(0, limit);
  const out: GmgnTrendingToken[] = filtered.map((p: any, i: number) => {
    const priceUsd = parseFloat(p.priceUsd ?? "0");
    const marketCap = p.marketCap ?? p.fdv ?? 0;
    return {
      address: p.baseToken?.address ?? "",
      symbol: p.baseToken?.symbol ?? "",
      name: p.baseToken?.name ?? "",
      decimals: 9,
      price: priceUsd,
      price_change_1h: p.priceChange?.h1 ?? 0,
      price_change_24h: p.priceChange?.h24 ?? 0,
      volume_24h: p.volume?.h24 ?? 0,
      market_cap: marketCap,
      fdv: p.fdv ?? marketCap,
      liquidity: p.liquidity?.usd ?? 0,
      holders: 0,
      total_supply: 0,
      create_timestamp: p.pairCreatedAt ? Math.floor(new Date(p.pairCreatedAt).getTime() / 1000) : undefined,
      is_alive: true,
      rank: i + 1,
      chain: "solana",
      swaps_24h: (p.txns?.h24?.buys ?? 0) + (p.txns?.h24?.sells ?? 0),
      buyers_24h: p.txns?.h24?.buys ?? 0,
      sellers_24h: p.txns?.h24?.sells ?? 0,
    };
  });
  setCached(cacheKey, out);
  return out;
}
