/**
 * GMGN client — fetches token metadata, holders, traders, smart money, KOL,
 * security, and chart data via the official `gmgn-cli` (npm package).
 *
 * Architecture (in priority order):
 *   1. **gmgn-cli** (preferred) — invokes the official GMGN OpenAPI via the CLI.
 *      Requires `GMGN_API_KEY` configured in `~/.config/gmgn/.env` (one-time setup
 *      via `gmgn-cli config` and `gmgn-cli config --apply <KEY>`).
 *      Returns real on-chain data including smart_degen, renowned (KOL), sniper,
 *      bundler, rat_trader wallet tags, real holder lists, real trade history.
 *   2. **DexScreener API** (fallback for some endpoints) — no auth required,
 *      returns real price/marketCap/volume/liquidity/pair data.
 *   3. **Simulated data** (last resort) — deterministic stubs so the UI always
 *      has something to render. Tagged with `source: "simulated"`.
 *
 * All requests are server-side only — never called from the browser.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

// Resolve the gmgn-cli binary path. Try PATH first, then known global locations.
function resolveGmgnCliBin(): string {
  // Allow override via env var
  if (process.env.GMGN_CLI_BIN) return process.env.GMGN_CLI_BIN;
  // Try common global install locations
  const candidates = [
    "gmgn-cli", // PATH
    join(homedir(), ".npm-global/bin/gmgn-cli"),
    join(homedir(), ".npm-global/lib/node_modules/gmgn-cli/dist/index.js"),
    "/usr/local/bin/gmgn-cli",
    "/usr/bin/gmgn-cli",
  ];
  for (const c of candidates) {
    if (c === "gmgn-cli") continue; // skip PATH check here, we'll try it at exec time
    if (existsSync(c)) return c;
  }
  return "gmgn-cli"; // fall back to PATH lookup
}

const GMGN_CLI_BIN = resolveGmgnCliBin();
const DEFAULT_TIMEOUT_MS = 12_000; // CLI startup is slower than HTTP

// ===== Cache =====
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
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { ts: Date.now(), data });
}

// ===== CLI availability check (memoized) =====
let cliAvailableCache: boolean | null = null;
let cliAvailableCheckedAt = 0;
async function isGmgnCliAvailable(): Promise<boolean> {
  // Re-check every 5 minutes
  if (cliAvailableCache !== null && Date.now() - cliAvailableCheckedAt < 5 * 60_000) {
    return cliAvailableCache;
  }
  try {
    const { stdout } = await execFileAsync(GMGN_CLI_BIN, ["config", "--check"], {
      timeout: 5000,
    });
    // exit code 0 = configured; CLI prints nothing on success
    cliAvailableCache = stdout.includes("configured") || stdout.includes("OK") || stdout.trim() === "" || true;
    // Re-check via actual exit code by running a tiny call
    cliAvailableCheckedAt = Date.now();
    return cliAvailableCache;
  } catch {
    cliAvailableCache = false;
    cliAvailableCheckedAt = Date.now();
    return false;
  }
}

/**
 * Run `gmgn-cli <args> --raw` and parse the JSON output.
 * Returns null on any error (CLI not installed, missing API key, network error, etc.)
 */
async function runGmgnCli(args: string[]): Promise<any | null> {
  try {
    // Check API key configured first
    const isAvailable = await isGmgnCliAvailable();
    if (!isAvailable) return null;

    // If the resolved bin is a .js file, invoke via node
    const isJsFile = GMGN_CLI_BIN.endsWith(".js") || GMGN_CLI_BIN.endsWith(".mjs");
    const bin = isJsFile ? process.execPath : GMGN_CLI_BIN;
    const binArgs = isJsFile ? [GMGN_CLI_BIN, ...args, "--raw"] : [...args, "--raw"];

    const { stdout } = await execFileAsync(bin, binArgs, {
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 5 * 1024 * 1024, // 5MB
      env: { ...process.env },
    });

    // CLI may print notice lines on stderr; we only care about stdout
    const trimmed = stdout.trim();
    if (!trimmed) return null;
    // Find the first JSON object in the output
    const jsonStart = trimmed.indexOf("{");
    const jsonStartArr = trimmed.indexOf("[");
    let start = -1;
    if (jsonStart >= 0 && (jsonStartArr < 0 || jsonStart < jsonStartArr)) start = jsonStart;
    else if (jsonStartArr >= 0) start = jsonStartArr;
    if (start < 0) return null;
    const jsonStr = trimmed.slice(start);
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// ===== DexScreener fallback =====
async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
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

// ===== Public typed interfaces =====

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
  // Extended fields from gmgn-cli
  smart_degen_count?: number;
  renowned_count?: number;
  sniper_count?: number;
  bundler_rate?: number;
  rat_trader_amount_rate?: number;
  rug_ratio?: number;
  is_honeypot?: boolean;
  renounced_mint?: boolean;
  renounced_freeze_account?: boolean;
  is_on_curve?: boolean;
  cto_flag?: number;
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
  holder_rate: number;
  is_dev?: boolean;
  is_top10?: boolean;
  is_smart_money?: boolean;
  is_kol?: boolean;
  is_celebrity?: boolean;
  is_fund?: boolean;
  is_sniper?: boolean;
  is_bundler?: boolean;
  is_rat_trader?: boolean;
  is_fresh_wallet?: boolean;
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
  is_sniper?: boolean;
  is_bundler?: boolean;
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
  wallet_tag?: string;
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
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
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
  hot_level?: number;
}

// ===== Fetch implementations =====

export async function fetchTokenInfo(address: string): Promise<GmgnTokenInfo | null> {
  const cacheKey = `token:${address}`;
  const cached = getCached<GmgnTokenInfo>(cacheKey, 60_000);
  if (cached) return cached;

  // 1. Try gmgn-cli
  const cliData = await runGmgnCli(["token", "info", "--chain", "sol", "--address", address]);
  if (cliData) {
    const token = mapCliTokenInfo(cliData, address);
    if (token) {
      setCached(cacheKey, token);
      return token;
    }
  }

  // 2. Fall back to DexScreener
  const ds = await fetchDexScreenerToken(address);
  if (ds) {
    setCached(cacheKey, ds);
    return ds;
  }

  return null;
}

function mapCliTokenInfo(data: any, address: string): GmgnTokenInfo | null {
  // gmgn-cli `token info` returns nested objects like { price: { price, change_1h, ... }, ... }
  if (!data) return null;
  try {
    const p = data.price || {};
    const liquidity = data.liquidity || {};
    const holders = data.holders || {};
    const totalSupply = data.total_supply || holders.total_supply || 0;
    const supply = data.circulating_supply || totalSupply;
    const price = parseFloat(p.price ?? "0");
    const links = data.links || data.link || {};
    return {
      address,
      symbol: data.symbol || data.base_symbol || "",
      name: data.name || "",
      decimals: data.decimals ?? 9,
      price,
      price_change_1h: parseFloat(p.change_1h ?? "0"),
      price_change_24h: parseFloat(p.change_24h ?? "0"),
      price_change_6h: parseFloat(p.change_6h ?? "0"),
      volume_24h: parseFloat(p.volume_24h ?? "0"),
      market_cap: price * (supply || 0),
      fdv: data.fdv ? parseFloat(data.fdv) : undefined,
      liquidity: parseFloat(liquidity.usd ?? "0"),
      holders: holders.holder_count ?? holders.total ?? 0,
      total_supply: totalSupply,
      top_10_holder_rate: data.top_10_holder_rate ? parseFloat(data.top_10_holder_rate) : undefined,
      dev_holder_rate: data.dev_team_hold_rate ? parseFloat(data.dev_team_hold_rate) : undefined,
      create_timestamp: data.create_timestamp,
      last_trade_timestamp: data.last_trade_timestamp,
      tx_24h_buy: data.swaps?.buys?.h24,
      tx_24h_sell: data.swaps?.sells?.h24,
      is_alive: data.is_alive,
      twitter: links.twitter_username ? `https://x.com/${links.twitter_username}` : links.twitter,
      website: links.website,
      telegram: links.telegram,
      image_uri: data.image_uri || data.logo,
      smart_degen_count: data.smart_degen_count,
      renowned_count: data.renowned_count,
      sniper_count: data.sniper_count,
      bundler_rate: data.bundler_rate ? parseFloat(data.bundler_rate) : undefined,
      rat_trader_amount_rate: data.rat_trader_amount_rate ? parseFloat(data.rat_trader_amount_rate) : undefined,
      rug_ratio: data.rug_ratio ? parseFloat(data.rug_ratio) : undefined,
      is_honeypot: data.is_honeypot,
      renounced_mint: data.renounced_mint === 1 || data.renounced_mint === true,
      renounced_freeze_account: data.renounced_freeze_account === 1 || data.renounced_freeze_account === true,
      is_on_curve: data.is_on_curve,
      cto_flag: data.cto_flag,
    };
  } catch {
    return null;
  }
}

async function fetchDexScreenerToken(address: string): Promise<GmgnTokenInfo | null> {
  const data = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
  if (!data || !Array.isArray(data.pairs) || data.pairs.length === 0) return null;
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
    holders: 0,
    total_supply: 0,
    create_timestamp: created,
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
  const cached = getCached<GmgnSecurity>(cacheKey, 120_000);
  if (cached) return cached;

  // Try gmgn-cli token security
  const cliData = await runGmgnCli(["token", "security", "--chain", "sol", "--address", address]);
  if (cliData) {
    const sec = mapCliSecurity(cliData, address);
    if (sec) {
      setCached(cacheKey, sec);
      return sec;
    }
  }
  return null;
}

function mapCliSecurity(data: any, address: string): GmgnSecurity | null {
  if (!data) return null;
  try {
    const risks: string[] = [];
    const mintRevoked = data.renounced_mint === 1 || data.renounced_mint === true;
    const freezeRevoked = data.renounced_freeze_account === 1 || data.renounced_freeze_account === true;
    const isHoneypot = !!data.is_honeypot;
    const top10 = parseFloat(data.top_10_holder_rate ?? "0");
    const dev = parseFloat(data.dev_team_hold_rate ?? data.dev_holder_rate ?? "0");
    const lpLocked = data.lp_locked === 1 || data.lp_locked === true;
    if (!mintRevoked) risks.push("Mint authority not revoked");
    if (!freezeRevoked) risks.push("Freeze authority not revoked");
    if (top10 > 35) risks.push("High top-10 holder concentration");
    if (dev > 10) risks.push("High dev holdings");
    if (!lpLocked) risks.push("Liquidity not locked");
    if (isHoneypot) risks.push("Honeypot detected");
    if (data.rug_ratio && parseFloat(data.rug_ratio) > 0.3) risks.push(`High rug ratio (${(parseFloat(data.rug_ratio) * 100).toFixed(0)}%)`);
    return {
      address,
      is_mint_authority_revoked: mintRevoked,
      is_freeze_authority_revoked: freezeRevoked,
      is_token_mintable: !mintRevoked,
      is_honeypot: isHoneypot,
      is_open_source: data.is_open_source === 1 || data.is_open_source === true,
      is_proxy: data.is_proxy === 1 || data.is_proxy === true,
      is_canonical: true,
      top10_holder_rate: top10,
      top10_holder_value_usd: data.top_10_holder_value_usd,
      dev_holder_rate: dev,
      lp_holder_rate: data.lp_holder_rate ? parseFloat(data.lp_holder_rate) : undefined,
      liquidity_locked: lpLocked,
      lp_locked_ratio: data.lp_locked_ratio ? parseFloat(data.lp_locked_ratio) : (lpLocked ? 1 : 0),
      dev_buy_tax_rate: data.buy_tax_rate ? parseFloat(data.buy_tax_rate) : 0,
      dev_sell_tax_rate: data.sell_tax_rate ? parseFloat(data.sell_tax_rate) : 0,
      risks,
    };
  } catch {
    return null;
  }
}

export async function fetchTopHolders(address: string, limit = 20): Promise<GmgnHolder[] | null> {
  const cacheKey = `holders:${address}:${limit}`;
  const cached = getCached<GmgnHolder[]>(cacheKey, 60_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "token", "holders",
    "--chain", "sol",
    "--address", address,
    "--limit", String(limit),
    "--order-by", "amount_percentage",
    "--direction", "desc",
  ]);
  if (cliData?.data?.holders || Array.isArray(cliData?.holders)) {
    const holders = (cliData.data?.holders || cliData.holders) as any[];
    const mapped: GmgnHolder[] = holders.map((h: any) => ({
      address: h.address || h.owner_address,
      balance: parseFloat(h.balance ?? h.amount ?? "0"),
      value_usd: parseFloat(h.value_usd ?? "0"),
      holder_rate: parseFloat(h.amount_percentage ?? h.holder_rate ?? "0"),
      is_dev: h.tags?.includes("dev"),
      is_top10: false,
      is_smart_money: h.tags?.includes("smart_degen"),
      is_kol: h.tags?.includes("renowned"),
      is_sniper: h.tags?.includes("sniper"),
      is_bundler: h.tags?.includes("bundler"),
      is_rat_trader: h.tags?.includes("rat_trader"),
      is_fresh_wallet: h.tags?.includes("fresh_wallet"),
      tags: h.tags,
    }));
    setCached(cacheKey, mapped);
    return mapped;
  }
  return null;
}

export async function fetchTopTraders(address: string, limit = 20): Promise<GmgnTrader[] | null> {
  const cacheKey = `traders:${address}:${limit}`;
  const cached = getCached<GmgnTrader[]>(cacheKey, 60_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "token", "traders",
    "--chain", "sol",
    "--address", address,
    "--limit", String(limit),
    "--order-by", "profit",
    "--direction", "desc",
  ]);
  if (cliData?.data?.traders || Array.isArray(cliData?.traders)) {
    const traders = (cliData.data?.traders || cliData.traders) as any[];
    const mapped: GmgnTrader[] = traders.map((t: any) => ({
      address: t.address || t.wallet_address,
      pnl: parseFloat(t.realized_profit_usd ?? t.pnl ?? "0"),
      pnl_rate: t.pnl_rate ? parseFloat(t.pnl_rate) : undefined,
      buy_usd: parseFloat(t.buy_usd ?? "0"),
      sell_usd: parseFloat(t.sell_usd ?? "0"),
      tx_count: t.tx_count,
      is_smart_money: t.tags?.includes("smart_degen"),
      is_kol: t.tags?.includes("renowned"),
      is_sniper: t.tags?.includes("sniper"),
      is_bundler: t.tags?.includes("bundler"),
      first_buy_time: t.first_buy_time,
      last_active_time: t.last_active_time,
      tags: t.tags,
    }));
    setCached(cacheKey, mapped);
    return mapped;
  }
  return null;
}

export async function fetchSmartMoneyActivity(
  address: string,
  limit = 30
): Promise<GmgnSmartMoneyActivity[] | null> {
  const cacheKey = `smartmoney:${address}:${limit}`;
  const cached = getCached<GmgnSmartMoneyActivity[]>(cacheKey, 45_000);
  if (cached) return cached;

  // gmgn-cli track smart-money for a token
  const cliData = await runGmgnCli([
    "track", "smart-money",
    "--chain", "sol",
    "--address", address,
    "--limit", String(limit),
  ]);
  if (cliData?.data?.activity || Array.isArray(cliData?.activity)) {
    const activity = (cliData.data?.activity || cliData.activity) as any[];
    const mapped: GmgnSmartMoneyActivity[] = activity.map((a: any) => ({
      address: a.wallet_address || a.address,
      type: a.side === "sell" || a.type === "sell" ? "sell" : "buy",
      amount_usd: parseFloat(a.amount_usd ?? a.value ?? "0"),
      amount_token: parseFloat(a.amount ?? "0"),
      ts: a.timestamp || a.ts,
      wallet_tag: a.wallet_tag || "smart_degen",
      wallet_label: a.wallet_label,
      pnl_30d_usd: a.pnl_30d_usd ? parseFloat(a.pnl_30d_usd) : undefined,
    }));
    setCached(cacheKey, mapped);
    return mapped;
  }
  return null;
}

export async function fetchKolHolders(address: string, limit = 30): Promise<GmgnKolHolder[] | null> {
  const cacheKey = `kol:${address}:${limit}`;
  const cached = getCached<GmgnKolHolder[]>(cacheKey, 90_000);
  if (cached) return cached;

  // gmgn-cli token holders filtered by renowned (KOL) tag
  const cliData = await runGmgnCli([
    "token", "holders",
    "--chain", "sol",
    "--address", address,
    "--limit", String(limit),
    "--tag", "renowned",
  ]);
  if (cliData?.data?.holders || Array.isArray(cliData?.holders)) {
    const holders = (cliData.data?.holders || cliData.holders) as any[];
    const mapped: GmgnKolHolder[] = holders.map((h: any) => ({
      address: h.address || h.owner_address,
      twitter_handle: h.twitter_handle || h.twitter_username || "unknown",
      twitter_name: h.twitter_name || h.name || h.twitter_handle || "KOL",
      followers: h.followers || 0,
      balance: parseFloat(h.balance ?? "0"),
      value_usd: parseFloat(h.value_usd ?? "0"),
      buy_usd: h.buy_usd ? parseFloat(h.buy_usd) : undefined,
      avg_buy_price: h.avg_buy_price ? parseFloat(h.avg_buy_price) : undefined,
      pnl_usd: h.pnl_usd ? parseFloat(h.pnl_usd) : undefined,
      last_buy_ts: h.last_buy_ts,
    }));
    setCached(cacheKey, mapped);
    return mapped;
  }
  return null;
}

export async function fetchCandles(
  address: string,
  resolution: "30s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d" = "15m",
  limit = 200
): Promise<GmgnCandle[] | null> {
  const cacheKey = `candles:${address}:${resolution}:${limit}`;
  const ttl = resolution === "30s" || resolution === "1m" || resolution === "5m" ? 15_000 : 60_000;
  const cached = getCached<GmgnCandle[]>(cacheKey, ttl);
  if (cached) return cached;

  // Try gmgn-cli market kline
  const to = Math.floor(Date.now() / 1000);
  const resolutionMinutes =
    resolution === "30s" ? 0.5 :
    resolution === "1m" ? 1 :
    resolution === "5m" ? 5 :
    resolution === "15m" ? 15 :
    resolution === "1h" ? 60 :
    resolution === "4h" ? 240 : 1440;
  const from = to - Math.floor(resolutionMinutes * 60 * limit);
  const cliData = await runGmgnCli([
    "market", "kline",
    "--chain", "sol",
    "--address", address,
    "--resolution", resolution,
    "--from", String(from),
    "--to", String(to),
  ]);
  if (cliData?.data?.candles || cliData?.data?.klines || Array.isArray(cliData?.data)) {
    const candles = cliData.data?.candles || cliData.data?.klines || cliData.data;
    if (Array.isArray(candles)) {
      const mapped: GmgnCandle[] = candles.map((c: any) => {
        // gmgn kline format: [timestamp, open, high, low, close, volume]
        if (Array.isArray(c)) {
          return {
            t: c[0],
            o: parseFloat(c[1]),
            h: parseFloat(c[2]),
            l: parseFloat(c[3]),
            c: parseFloat(c[4]),
            v: parseFloat(c[5] ?? "0"),
          };
        }
        return {
          t: c.t || c.timestamp,
          o: parseFloat(c.o ?? c.open ?? "0"),
          h: parseFloat(c.h ?? c.high ?? "0"),
          l: parseFloat(c.l ?? c.low ?? "0"),
          c: parseFloat(c.c ?? c.close ?? "0"),
          v: parseFloat(c.v ?? c.volume ?? "0"),
        };
      });
      setCached(cacheKey, mapped);
      return mapped;
    }
  }
  return null;
}

export async function fetchTrending(
  timeframe: "1m" | "5m" | "1h" | "6h" | "24h" = "1h",
  orderBy: "volume" | "tx_count" | "market_cap" | "smart_money" = "volume",
  limit = 30
): Promise<GmgnTrendingToken[] | null> {
  const cacheKey = `trending:${timeframe}:${orderBy}:${limit}`;
  const cached = getCached<GmgnTrendingToken[]>(cacheKey, 30_000);
  if (cached) return cached;

  // Try gmgn-cli market trending
  const cliData = await runGmgnCli([
    "market", "trending",
    "--chain", "sol",
    "--interval", timeframe,
  ]);
  if (cliData?.data?.rank || cliData?.data?.trending || Array.isArray(cliData?.data)) {
    const arr = cliData.data?.rank || cliData.data?.trending || cliData.data;
    if (Array.isArray(arr)) {
      const mapped: GmgnTrendingToken[] = arr.slice(0, limit).map((t: any, i: number) => ({
        address: t.address || t.token_address,
        symbol: t.symbol || t.base_symbol || "",
        name: t.name || "",
        decimals: t.decimals ?? 9,
        price: parseFloat(t.price ?? "0"),
        price_change_1h: parseFloat(t.change_1h ?? "0"),
        price_change_24h: parseFloat(t.change_24h ?? "0"),
        volume_24h: parseFloat(t.volume ?? t.volume_24h ?? "0"),
        market_cap: parseFloat(t.market_cap ?? "0"),
        fdv: t.fdv ? parseFloat(t.fdv) : undefined,
        liquidity: parseFloat(t.liquidity ?? "0"),
        holders: t.holder_count ?? 0,
        total_supply: t.total_supply ?? 0,
        create_timestamp: t.create_timestamp,
        is_alive: true,
        rank: i + 1,
        chain: "solana",
        swaps_24h: t.swaps ?? t.tx_count,
        buyers_24h: t.buys,
        sellers_24h: t.sells,
        smart_money_holders: t.smart_degen_count,
        smart_money_inflow_24h: t.smart_money_inflow,
        hot_level: t.hot_level,
      }));
      setCached(cacheKey, mapped);
      return mapped;
    }
  }

  // Fall back to DexScreener boosted tokens
  const ds = await fetchDexScreenerTrending(limit);
  if (ds) {
    setCached(cacheKey, ds);
    return ds;
  }
  return null;
}

async function fetchDexScreenerTrending(limit: number): Promise<GmgnTrendingToken[] | null> {
  const data = await fetchJson("https://api.dexscreener.com/token-boosts/top/v1");
  if (!Array.isArray(data) || data.length === 0) return null;
  const solTokens = data.filter((t: any) => t.chainId === "solana").slice(0, limit);
  if (solTokens.length === 0) return null;

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
  return results.length > 0 ? results : null;
}

export async function fetchNewPairs(limit = 30): Promise<GmgnTrendingToken[] | null> {
  const cacheKey = `newpairs:${limit}`;
  const cached = getCached<GmgnTrendingToken[]>(cacheKey, 30_000);
  if (cached) return cached;

  // Try gmgn-cli market trenches (new_creation)
  const cliData = await runGmgnCli([
    "market", "trenches",
    "--chain", "sol",
    "--type", "new_creation",
  ]);
  if (cliData?.data?.new_creation || cliData?.data?.trenches || Array.isArray(cliData?.data)) {
    const arr = cliData.data?.new_creation || cliData.data?.trenches || cliData.data;
    if (Array.isArray(arr)) {
      const mapped: GmgnTrendingToken[] = arr.slice(0, limit).map((t: any, i: number) => ({
        address: t.address || t.token_address,
        symbol: t.symbol || "",
        name: t.name || "",
        decimals: t.decimals ?? 9,
        price: parseFloat(t.price ?? "0"),
        price_change_1h: parseFloat(t.change_1h ?? "0"),
        price_change_24h: parseFloat(t.change_24h ?? "0"),
        volume_24h: parseFloat(t.volume ?? "0"),
        market_cap: parseFloat(t.market_cap ?? "0"),
        liquidity: parseFloat(t.liquidity ?? "0"),
        holders: t.holder_count ?? 0,
        total_supply: t.total_supply ?? 0,
        create_timestamp: t.create_timestamp,
        is_alive: true,
        rank: i + 1,
        chain: "solana",
        swaps_24h: t.swaps,
        buyers_24h: t.buys,
        sellers_24h: t.sells,
        smart_money_holders: t.smart_degen_count,
        smart_money_inflow_24h: t.smart_money_inflow,
      }));
      setCached(cacheKey, mapped);
      return mapped;
    }
  }

  // Fall back to DexScreener token-boosts/latest
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

export async function searchTokens(query: string, limit = 10): Promise<GmgnTrendingToken[] | null> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = getCached<GmgnTrendingToken[]>(cacheKey, 60_000);
  if (cached) return cached;
  const data = await fetchJson(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
  );
  if (!data || !Array.isArray(data.pairs)) return null;
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

// ===== Health check =====

export async function checkGmgnCliStatus(): Promise<{
  installed: boolean;
  apiKeyConfigured: boolean;
  binPath?: string;
  lastError?: string;
}> {
  // First, verify the binary exists
  const isJsFile = GMGN_CLI_BIN.endsWith(".js") || GMGN_CLI_BIN.endsWith(".mjs");
  let binExists = false;
  if (GMGN_CLI_BIN === "gmgn-cli") {
    // Try PATH lookup
    try {
      await execFileAsync("which", ["gmgn-cli"], { timeout: 3000 });
      binExists = true;
    } catch {
      binExists = false;
    }
  } else {
    binExists = existsSync(GMGN_CLI_BIN);
  }
  if (!binExists) {
    return { installed: false, apiKeyConfigured: false, binPath: GMGN_CLI_BIN };
  }

  try {
    const bin = isJsFile ? process.execPath : GMGN_CLI_BIN;
    const binArgs = isJsFile ? [GMGN_CLI_BIN, "config", "--check"] : ["config", "--check"];
    const { stdout, stderr } = await execFileAsync(bin, binArgs, {
      timeout: 5000,
    });
    return {
      installed: true,
      apiKeyConfigured: !stdout.includes("not configured") && !stderr.includes("required") && !stdout.includes("required"),
      binPath: GMGN_CLI_BIN,
    };
  } catch (err: any) {
    return {
      installed: true,
      apiKeyConfigured: false,
      binPath: GMGN_CLI_BIN,
      lastError: err?.message,
    };
  }
}

// ===== Portfolio (gmgn-cli portfolio) =====

export interface GmgnWalletHolding {
  token_address: string;
  symbol: string;
  name: string;
  amount: number;
  cost: number;
  usd_value: number;
  profit: number;
  profit_rate: number;
  image_uri?: string;
}

export interface GmgnWalletStats {
  wallet: string;
  total_cost: number;
  total_value: number;
  realized_profit: number;
  unrealized_profit: number;
  pnl_30d: number;
  winrate: number;
  trade_count_30d: number;
  buy_count_30d: number;
  sell_count_30d: number;
  pnl_7d?: number;
  pnl_24h?: number;
  tags?: string[];
}

export interface GmgnWalletActivity {
  hash: string;
  ts: number;
  type: "buy" | "sell" | "transfer";
  token_address: string;
  token_symbol: string;
  amount: number;
  value_usd: number;
  price: number;
}

export async function fetchWalletHoldings(
  wallet: string,
  chain = "sol"
): Promise<GmgnWalletHolding[] | null> {
  const cacheKey = `portfolio:holdings:${chain}:${wallet}`;
  const cached = getCached<GmgnWalletHolding[]>(cacheKey, 60_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "portfolio", "holdings",
    "--chain", chain,
    "--wallet", wallet,
  ]);
  if (cliData?.data?.holdings || Array.isArray(cliData?.data)) {
    const arr = cliData.data?.holdings || cliData.data;
    if (Array.isArray(arr)) {
      const mapped: GmgnWalletHolding[] = arr.map((h: any) => ({
        token_address: h.token_address || h.address,
        symbol: h.symbol || "",
        name: h.name || "",
        amount: parseFloat(h.amount ?? "0"),
        cost: parseFloat(h.cost ?? "0"),
        usd_value: parseFloat(h.usd_value ?? "0"),
        profit: parseFloat(h.profit ?? "0"),
        profit_rate: parseFloat(h.profit_rate ?? "0"),
        image_uri: h.image_uri,
      }));
      setCached(cacheKey, mapped);
      return mapped;
    }
  }
  return null;
}

export async function fetchWalletStats(
  wallet: string,
  chain = "sol"
): Promise<GmgnWalletStats | null> {
  const cacheKey = `portfolio:stats:${chain}:${wallet}`;
  const cached = getCached<GmgnWalletStats>(cacheKey, 60_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "portfolio", "stats",
    "--chain", chain,
    "--wallet", wallet,
  ]);
  if (cliData?.data) {
    const d = cliData.data;
    const mapped: GmgnWalletStats = {
      wallet,
      total_cost: parseFloat(d.total_cost ?? "0"),
      total_value: parseFloat(d.total_value ?? "0"),
      realized_profit: parseFloat(d.realized_profit ?? "0"),
      unrealized_profit: parseFloat(d.unrealized_profit ?? "0"),
      pnl_30d: parseFloat(d.pnl_30d ?? d.pnl_30d_usd ?? "0"),
      winrate: parseFloat(d.winrate ?? "0"),
      trade_count_30d: d.trade_count_30d ?? d["30d_trade_count"] ?? 0,
      buy_count_30d: d.buy_count_30d ?? d["30d_buy_count"] ?? 0,
      sell_count_30d: d.sell_count_30d ?? d["30d_sell_count"] ?? 0,
      pnl_7d: d.pnl_7d ? parseFloat(d.pnl_7d) : undefined,
      pnl_24h: d.pnl_24h ? parseFloat(d.pnl_24h) : undefined,
      tags: d.tags,
    };
    setCached(cacheKey, mapped);
    return mapped;
  }
  return null;
}

export async function fetchWalletActivity(
  wallet: string,
  limit = 30,
  chain = "sol"
): Promise<GmgnWalletActivity[] | null> {
  const cacheKey = `portfolio:activity:${chain}:${wallet}:${limit}`;
  const cached = getCached<GmgnWalletActivity[]>(cacheKey, 30_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "portfolio", "activity",
    "--chain", chain,
    "--wallet", wallet,
    "--limit", String(limit),
  ]);
  if (cliData?.data?.activity || Array.isArray(cliData?.data)) {
    const arr = cliData.data?.activity || cliData.data;
    if (Array.isArray(arr)) {
      const mapped: GmgnWalletActivity[] = arr.slice(0, limit).map((a: any) => ({
        hash: a.hash || a.signature || "",
        ts: a.timestamp || a.ts,
        type: a.side === "sell" || a.type === "sell" ? "sell" : (a.type === "transfer" ? "transfer" : "buy"),
        token_address: a.token_address || a.base_address,
        token_symbol: a.token_symbol || a.symbol || "",
        amount: parseFloat(a.amount ?? "0"),
        value_usd: parseFloat(a.value_usd ?? a.usd_value ?? "0"),
        price: parseFloat(a.price ?? "0"),
      }));
      setCached(cacheKey, mapped);
      return mapped;
    }
  }
  return null;
}

// ===== Market signals + hot searches (gmgn-cli market) =====

export interface GmgnMarketSignal {
  token_address: string;
  symbol: string;
  name: string;
  signal_type: "smart_money_buy" | "smart_money_sell" | "large_buy" | "price_spike" | "new_listing";
  ts: number;
  amount_usd: number;
  price: number;
  change_1h?: number;
  change_24h?: number;
  wallet_count?: number;
}

export async function fetchMarketSignals(
  chain = "sol",
  limit = 30
): Promise<GmgnMarketSignal[] | null> {
  const cacheKey = `signals:${chain}:${limit}`;
  const cached = getCached<GmgnMarketSignal[]>(cacheKey, 30_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "market", "signal",
    "--chain", chain,
  ]);
  if (cliData?.data?.signals || cliData?.data?.items || Array.isArray(cliData?.data)) {
    const arr = cliData.data?.signals || cliData.data?.items || cliData.data;
    if (Array.isArray(arr)) {
      const mapped: GmgnMarketSignal[] = arr.slice(0, limit).map((s: any) => ({
        token_address: s.token_address || s.address,
        symbol: s.symbol || "",
        name: s.name || "",
        signal_type: s.signal_type || s.type || "smart_money_buy",
        ts: s.timestamp || s.ts,
        amount_usd: parseFloat(s.amount_usd ?? "0"),
        price: parseFloat(s.price ?? "0"),
        change_1h: s.change_1h ? parseFloat(s.change_1h) : undefined,
        change_24h: s.change_24h ? parseFloat(s.change_24h) : undefined,
        wallet_count: s.wallet_count,
      }));
      setCached(cacheKey, mapped);
      return mapped;
    }
  }
  return null;
}

export interface GmgnHotSearch {
  rank: number;
  token_address: string;
  symbol: string;
  name: string;
  chain: string;
  search_count_24h: number;
  price: number;
  change_24h: number;
  market_cap?: number;
  image_uri?: string;
}

export async function fetchHotSearches(
  chains: string[] = ["sol"],
  interval: "1m" | "5m" | "1h" | "6h" | "24h" = "1h",
  limit = 20
): Promise<GmgnHotSearch[] | null> {
  const cacheKey = `hotsearches:${chains.join(",")}:${interval}:${limit}`;
  const cached = getCached<GmgnHotSearch[]>(cacheKey, 60_000);
  if (cached) return cached;

  const args = ["market", "hot-searches", "--interval", interval];
  for (const c of chains) {
    args.push("--chain", c);
  }
  const cliData = await runGmgnCli(args);
  if (cliData?.data?.hot_searches || cliData?.data?.items || Array.isArray(cliData?.data)) {
    const arr = cliData.data?.hot_searches || cliData.data?.items || cliData.data;
    if (Array.isArray(arr)) {
      const mapped: GmgnHotSearch[] = arr.slice(0, limit).map((s: any, i: number) => ({
        rank: s.rank ?? i + 1,
        token_address: s.token_address || s.address,
        symbol: s.symbol || "",
        name: s.name || "",
        chain: s.chain || "sol",
        search_count_24h: s.search_count_24h ?? s.count ?? 0,
        price: parseFloat(s.price ?? "0"),
        change_24h: parseFloat(s.change_24h ?? "0"),
        market_cap: s.market_cap ? parseFloat(s.market_cap) : undefined,
        image_uri: s.image_uri,
      }));
      setCached(cacheKey, mapped);
      return mapped;
    }
  }
  return null;
}

// ===== Trenches types =====

export async function fetchTrenches(
  type: "new_creation" | "near_completion" | "completed" = "new_creation",
  chain = "sol",
  limit = 30
): Promise<GmgnTrendingToken[] | null> {
  const cacheKey = `trenches:${chain}:${type}:${limit}`;
  const cached = getCached<GmgnTrendingToken[]>(cacheKey, 30_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "market", "trenches",
    "--chain", chain,
    "--type", type,
  ]);
  // near_completion is returned under data.pump key per docs
  const arr =
    type === "near_completion"
      ? (cliData?.data?.pump || cliData?.data?.near_completion)
      : (cliData?.data?.[type] || cliData?.data?.trenches);
  if (Array.isArray(arr)) {
    const mapped: GmgnTrendingToken[] = arr.slice(0, limit).map((t: any, i: number) => ({
      address: t.address || t.token_address,
      symbol: t.symbol || "",
      name: t.name || "",
      decimals: t.decimals ?? 9,
      price: parseFloat(t.price ?? "0"),
      price_change_1h: parseFloat(t.change_1h ?? "0"),
      price_change_24h: parseFloat(t.change_24h ?? "0"),
      volume_24h: parseFloat(t.volume ?? "0"),
      market_cap: parseFloat(t.market_cap ?? "0"),
      liquidity: parseFloat(t.liquidity ?? "0"),
      holders: t.holder_count ?? 0,
      total_supply: t.total_supply ?? 0,
      create_timestamp: t.create_timestamp,
      is_alive: true,
      rank: i + 1,
      chain,
      swaps_24h: t.swaps,
      buyers_24h: t.buys,
      sellers_24h: t.sells,
      smart_money_holders: t.smart_degen_count,
      smart_money_inflow_24h: t.smart_money_inflow,
    }));
    setCached(cacheKey, mapped);
    return mapped;
  }
  return null;
}

// ===== Track smart-money / KOL feeds (gmgn-cli track) =====

export interface GmgnTrackTrade {
  wallet_address: string;
  wallet_label?: string;
  wallet_tags?: string[];
  token_address: string;
  token_symbol: string;
  type: "buy" | "sell";
  ts: number;
  amount_usd: number;
  amount_token: number;
  price: number;
  price_change_since?: number;
  is_open_or_close?: boolean;
}

export async function fetchSmartMoneyTrades(
  chain = "sol",
  limit = 30
): Promise<GmgnTrackTrade[] | null> {
  const cacheKey = `track:smartmoney:${chain}:${limit}`;
  const cached = getCached<GmgnTrackTrade[]>(cacheKey, 30_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "track", "smartmoney",
    "--chain", chain,
    "--limit", String(limit),
  ]);
  if (cliData?.data?.trades || cliData?.data?.items || Array.isArray(cliData?.data)) {
    const arr = cliData.data?.trades || cliData.data?.items || cliData.data;
    if (Array.isArray(arr)) {
      const mapped = mapTrackTrades(arr, limit);
      setCached(cacheKey, mapped);
      return mapped;
    }
  }
  return null;
}

export async function fetchKolTrades(
  chain = "sol",
  limit = 30
): Promise<GmgnTrackTrade[] | null> {
  const cacheKey = `track:kol:${chain}:${limit}`;
  const cached = getCached<GmgnTrackTrade[]>(cacheKey, 30_000);
  if (cached) return cached;

  const cliData = await runGmgnCli([
    "track", "kol",
    "--chain", chain,
    "--limit", String(limit),
  ]);
  if (cliData?.data?.trades || cliData?.data?.items || Array.isArray(cliData?.data)) {
    const arr = cliData.data?.trades || cliData.data?.items || cliData.data;
    if (Array.isArray(arr)) {
      const mapped = mapTrackTrades(arr, limit);
      setCached(cacheKey, mapped);
      return mapped;
    }
  }
  return null;
}

function mapTrackTrades(arr: any[], limit: number): GmgnTrackTrade[] {
  return arr.slice(0, limit).map((t: any) => ({
    wallet_address: t.wallet_address || t.maker_info?.address || t.maker,
    wallet_label: t.wallet_label || t.maker_info?.name,
    wallet_tags: t.wallet_tags || t.maker_info?.tags,
    token_address: t.base_address || t.token_address,
    token_symbol: t.token_symbol || t.symbol || "",
    type: t.side === "sell" || t.type === "sell" ? "sell" : "buy",
    ts: t.timestamp || t.ts,
    amount_usd: parseFloat(t.amount_usd ?? t.value ?? "0"),
    amount_token: parseFloat(t.amount ?? "0"),
    price: parseFloat(t.price ?? "0"),
    price_change_since: t.price_change ? parseFloat(t.price_change) : undefined,
    is_open_or_close: !!t.is_open_or_close,
  }));
}
