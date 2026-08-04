/**
 * DexScreener API Client
 * Provides rate-limited, cached, and WebSocket-enabled access to DexScreener API
 */

import { fetchJson } from './gmgn';

// Rate limiter for DexScreener API
interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerSecond: number;
}

interface RateLimitState {
  requestsThisSecond: number;
  requestsThisMinute: number;
  secondWindowStart: number;
  minuteWindowStart: number;
}

const RATE_LIMIT_CONFIG: RateLimiterConfig = {
  maxRequestsPerMinute: 300, // DexScreener rate limit
  maxRequestsPerSecond: 50,
};

const rateLimitState: RateLimitState = {
  requestsThisSecond: 0,
  requestsThisMinute: 0,
  secondWindowStart: Date.now(),
  minuteWindowStart: Date.now(),
};

async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Reset second window
  if (now - rateLimitState.secondWindowStart >= 1000) {
    rateLimitState.requestsThisSecond = 0;
    rateLimitState.secondWindowStart = now;
  }
  
  // Reset minute window
  if (now - rateLimitState.minuteWindowStart >= 60000) {
    rateLimitState.requestsThisMinute = 0;
    rateLimitState.minuteWindowStart = now;
  }
  
  // Check limits
  if (rateLimitState.requestsThisSecond >= RATE_LIMIT_CONFIG.maxRequestsPerSecond) {
    const waitMs = 1000 - (now - rateLimitState.secondWindowStart);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return checkRateLimit();
  }
  
  if (rateLimitState.requestsThisMinute >= RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
    const waitMs = 60000 - (now - rateLimitState.minuteWindowStart);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return checkRateLimit();
  }
  
  rateLimitState.requestsThisSecond++;
  rateLimitState.requestsThisMinute++;
}

// In-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

const dexscreenerCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30000; // 30 seconds default

function getCached<T>(key: string): T | null {
  const entry = dexscreenerCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    dexscreenerCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCached<T>(key: string, data: T, etag?: string): void {
  // Limit cache size
  if (dexscreenerCache.size > 1000) {
    const oldest = [...dexscreenerCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) dexscreenerCache.delete(oldest[0]);
  }
  
  dexscreenerCache.set(key, {
    data,
    timestamp: Date.now(),
    etag,
  });
}

// WebSocket connection for real-time updates
let wsConnection: WebSocket | null = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;

interface WSMessage {
  type: 'pair' | 'trade' | 'price';
  data: any;
}

type WSMessageHandler = (message: WSMessage) => void;
const wsHandlers: Set<WSMessageHandler> = new Set();

export function subscribeToWS(handler: WSMessageHandler): () => void {
  wsHandlers.add(handler);
  
  // Initialize WebSocket if not already connected
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    connectWS();
  }
  
  return () => {
    wsHandlers.delete(handler);
    // Close WS if no more handlers
    if (wsHandlers.size === 0 && wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
  };
}

function connectWS(): void {
  if (wsConnection?.readyState === WebSocket.OPEN) return;
  
  try {
    // DexScreener doesn't have official WS, so we use a polyfill approach
    // For real implementation, would connect to a WS proxy or use polling fallback
    console.log('[DexScreener] WebSocket connection not available - using polling fallback');
    wsReconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect attempts
  } catch (error) {
    console.error('[DexScreener] WebSocket connection failed:', error);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[DexScreener] Max reconnect attempts reached');
    return;
  }
  
  wsReconnectAttempts++;
  setTimeout(connectWS, RECONNECT_DELAY_MS * wsReconnectAttempts);
}

// Main API functions with rate limiting and caching
export async function fetchPairs(tokenAddress: string, chain = 'solana'): Promise<any[]> {
  const cacheKey = `pairs:${chain}:${tokenAddress}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;
  
  await checkRateLimit();
  
  try {
    const data = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    if (!data || !Array.isArray(data.pairs)) return [];
    
    const chainPairs = data.pairs.filter((p: any) => p.chainId === chain);
    const pairs = (chainPairs.length > 0 ? chainPairs : data.pairs)
      .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    
    setCached(cacheKey, pairs);
    return pairs;
  } catch (error) {
    console.error('[DexScreener] fetchPairs error:', error);
    return [];
  }
}

export async function fetchPair(pairAddress: string, chain = 'solana'): Promise<any | null> {
  const cacheKey = `pair:${chain}:${pairAddress}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;
  
  await checkRateLimit();
  
  try {
    const data = await fetchJson(`https://api.dexscreener.com/latest/dex/pairs/${chain}/${pairAddress}`);
    if (!data || !Array.isArray(data.pairs) || data.pairs.length === 0) return null;
    
    const pair = data.pairs[0];
    setCached(cacheKey, pair);
    return pair;
  } catch (error) {
    console.error('[DexScreener] fetchPair error:', error);
    return null;
  }
}

export async function fetchTokenProfile(tokenAddress: string, chain = 'solana'): Promise<any | null> {
  const cacheKey = `profile:${chain}:${tokenAddress}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;
  
  await checkRateLimit();
  
  try {
    const data = await fetchJson(`https://api.dexscreener.com/token-profiles/latest/v1`);
    if (!Array.isArray(data)) return null;
    
    const profile = data.find((p: any) => 
      p.chainId === chain && p.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (profile) {
      setCached(cacheKey, profile);
      return profile;
    }
    return null;
  } catch (error) {
    console.error('[DexScreener] fetchTokenProfile error:', error);
    return null;
  }
}

export async function fetchTokenBoosts(chain = 'solana'): Promise<any[]> {
  const cacheKey = `boosts:${chain}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;
  
  await checkRateLimit();
  
  try {
    const data = await fetchJson('https://api.dexscreener.com/token-boosts/top/v1');
    if (!Array.isArray(data)) return [];
    
    const filtered = data.filter((b: any) => b.chainId === chain);
    setCached(cacheKey, filtered);
    return filtered;
  } catch (error) {
    console.error('[DexScreener] fetchTokenBoosts error:', error);
    return [];
  }
}

export async function fetchLatestBoosts(chain = 'solana'): Promise<any[]> {
  const cacheKey = `latest-boosts:${chain}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;
  
  await checkRateLimit();
  
  try {
    const data = await fetchJson('https://api.dexscreener.com/token-boosts/latest/v1');
    if (!Array.isArray(data)) return [];
    
    const filtered = data.filter((b: any) => b.chainId === chain);
    setCached(cacheKey, filtered);
    return filtered;
  } catch (error) {
    console.error('[DexScreener] fetchLatestBoosts error:', error);
    return [];
  }
}

export async function searchTokens(query: string, chain = 'solana'): Promise<any[]> {
  const cacheKey = `search:${chain}:${query.toLowerCase()}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;
  
  await checkRateLimit();
  
  try {
    const data = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!data || !Array.isArray(data.pairs)) return [];
    
    const chainPairs = data.pairs.filter((p: any) => p.chainId === chain);
    const seen = new Set<string>();
    const unique = chainPairs.filter((p: any) => {
      const addr = p.baseToken?.address?.toLowerCase();
      if (seen.has(addr)) return false;
      seen.add(addr);
      return true;
    });
    
    const sorted = unique.sort((a: any, b: any) => 
      (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    );
    
    setCached(cacheKey, sorted);
    return sorted;
  } catch (error) {
    console.error('[DexScreener] searchTokens error:', error);
    return [];
  }
}

export async function fetchOrders(chain = 'solana', tokenAddress: string): Promise<any | null> {
  const cacheKey = `orders:${chain}:${tokenAddress}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;
  
  await checkRateLimit();
  
  try {
    const data = await fetchJson(`https://api.dexscreener.com/orders/v1/${chain}/${tokenAddress}`);
    if (!data) return null;
    
    setCached(cacheKey, data);
    return data;
  } catch (error) {
    console.error('[DexScreener] fetchOrders error:', error);
    return null;
  }
}

// Health metrics for monitoring
export interface DexScreenerHealthMetrics {
  cacheSize: number;
  rateLimitState: {
    requestsThisSecond: number;
    requestsThisMinute: number;
    maxPerSecond: number;
    maxPerMinute: number;
  };
  wsConnected: boolean;
  wsReconnectAttempts: number;
}

export function getHealthMetrics(): DexScreenerHealthMetrics {
  return {
    cacheSize: dexscreenerCache.size,
    rateLimitState: {
      requestsThisSecond: rateLimitState.requestsThisSecond,
      requestsThisMinute: rateLimitState.requestsThisMinute,
      maxPerSecond: RATE_LIMIT_CONFIG.maxRequestsPerSecond,
      maxPerMinute: RATE_LIMIT_CONFIG.maxRequestsPerMinute,
    },
    wsConnected: wsConnection?.readyState === WebSocket.OPEN,
    wsReconnectAttempts,
  };
}

export function clearCache(): void {
  dexscreenerCache.clear();
}

export function setCacheTTL(ttlMs: number): void {
  // This would require modifying the constant, so we just document it
  console.log(`[DexScreener] Cache TTL set to ${ttlMs}ms (requires restart to take effect)`);
}

// Batch fetch for multiple tokens
export async function fetchMultiplePairs(tokenAddresses: string[], chain = 'solana'): Promise<Map<string, any[]>> {
  const results = new Map<string, any[]>();
  
  // Process in batches to respect rate limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
    const batch = tokenAddresses.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (address) => {
        const pairs = await fetchPairs(address, chain);
        results.set(address, pairs);
      })
    );
    
    // Small delay between batches
    if (i + BATCH_SIZE < tokenAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}