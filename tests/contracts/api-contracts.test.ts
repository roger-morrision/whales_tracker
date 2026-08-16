import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ENDPOINT_SCHEMAS } from '@/lib/api-contracts';

// Test utilities
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

async function fetchEndpoint(path: string, params?: Record<string, string>) {
  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  }
  const response = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
  });
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
  };
}

describe('API Contract Tests', () => {
  let serverRunning = false;

  beforeAll(async () => {
    // Check if server is running
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { method: 'HEAD' });
      serverRunning = res.ok;
    } catch {
      serverRunning = false;
    }
  });

  const testEndpoint = (path: string, params?: Record<string, string>) => {
    const schema = ENDPOINT_SCHEMAS[path as keyof typeof ENDPOINT_SCHEMAS];
    if (!schema) {
      return it.skip(`${path} - no schema defined`, () => {});
    }

    it(`${path} should return valid response`, async () => {
      if (!serverRunning) {
        return console.log(`Skipping ${path} - server not running`);
      }
      
      const { status, data } = await fetchEndpoint(path, params);
      
      // Should return 200 or 400/500 with error structure
      expect([200, 400, 500]).toContain(status);
      
      // Validate against schema
      const result = schema.safeParse({ success: status === 200, data });
      
      if (!result.success) {
        console.error(`Schema validation failed for ${path}:`, result.error.format());
        // Print the actual response for debugging
        console.log('Actual response:', JSON.stringify(data, null, 2));
      }
      
      expect(result.success).toBe(true);
    });
  };

  // Core endpoints
  testEndpoint('/api/health');
  testEndpoint('/api/prices', { symbols: 'SOL,WIF,JUP' });
  testEndpoint('/api/quote', { 
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    amount: '1000000000',
    slippageBps: '100'
  });
  testEndpoint('/api/wallet', { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' });

  // GMGN endpoints
  testEndpoint('/api/gmgn/status');
  testEndpoint('/api/gmgn/token', { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' });
  testEndpoint('/api/gmgn/security', { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' });
  testEndpoint('/api/gmgn/holders', { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', limit: '20' });
  testEndpoint('/api/gmgn/traders', { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', limit: '20' });
  testEndpoint('/api/gmgn/trending', { timeframe: '1h', limit: '30' });
  testEndpoint('/api/gmgn/new-pairs', { limit: '30' });
  testEndpoint('/api/gmgn/search', { q: 'bonk', limit: '10' });
  testEndpoint('/api/gmgn/chart', { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', resolution: '15m', limit: '200' });
  testEndpoint('/api/gmgn/portfolio', { wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' });
  testEndpoint('/api/gmgn/wallet-activity', { wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', limit: '20' });
  testEndpoint('/api/gmgn/signals', { chain: 'sol', limit: '30' });
  testEndpoint('/api/gmgn/hot-searches', { chain: 'sol', interval: '1h', limit: '30' });
  testEndpoint('/api/gmgn/smart-money-feed', { chain: 'sol', limit: '30' });
  testEndpoint('/api/gmgn/kol-feed', { chain: 'sol', limit: '30' });

  // DexScreener endpoints
  testEndpoint('/api/dexscreener/pairs', { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', chain: 'solana' });
  testEndpoint('/api/dexscreener/orders', { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', chain: 'solana' });
  testEndpoint('/api/dexscreener/top-boosts', { chain: 'solana', limit: '10' });

  // Solana endpoints
  testEndpoint('/api/solana/trending', { sortBy: 'volume', limit: '30' });
  testEndpoint('/api/solana/gainers', { timeframe: '24h', limit: '30' });
  testEndpoint('/api/solana/new', { limit: '30' });

  // Pumpfun endpoint
  testEndpoint('/api/pumpfun', { type: 'new', limit: '30' });

  // Chat endpoint
  testEndpoint('/api/chat'); // GET for health check
});
