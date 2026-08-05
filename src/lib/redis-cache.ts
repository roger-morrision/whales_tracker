/**
 * Redis Cache Client with Fallback
 * Provides distributed caching with in-memory fallback
 */

import { createClient, RedisClientType } from 'redis';

interface CacheOptions {
  ttl?: number; // seconds
  prefix?: string;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private fallbackStore = new Map<string, { value: any; expiry: number }>();
  private fallbackRateLimit = new Map<string, { count: number; resetTime: number }>();
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = (async () => {
      try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = createClient({ url: redisUrl });
        
        this.client.on('error', (err) => {
          console.warn('[Redis] Connection error, using fallback:', err.message);
          this.isConnected = false;
        });

        this.client.on('connect', () => {
          this.isConnected = true;
          console.log('[Redis] Connected');
        });

        this.client.on('disconnect', () => {
          this.isConnected = false;
        });

        await this.client.connect();
      } catch (error) {
        console.warn('[Redis] Failed to connect, using in-memory fallback:', error);
        this.isConnected = false;
      }
    })();

    return this.connectionPromise;
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.connectionPromise) {
      this.init();
    }
    await this.connectionPromise;
    return this.isConnected;
  }

  // ===== Basic Cache Operations =====

  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = `moby:${key}`;
    
    const connected = await this.ensureConnected();
    if (connected && this.client) {
      try {
        const value = await this.client.get(prefixedKey);
        if (value) return JSON.parse(value);
      } catch (error) {
        console.warn('[Redis] Get error, using fallback:', error);
      }
    }

    // Fallback to in-memory
    const entry = this.fallbackStore.get(prefixedKey);
    if (entry && entry.expiry > Date.now()) {
      return entry.value;
    }
    if (entry) this.fallbackStore.delete(prefixedKey);
    return null;
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const prefixedKey = `moby:${key}`;
    const ttl = options.ttl || 3600; // default 1 hour
    const serialized = JSON.stringify(value);

    const connected = await this.ensureConnected();
    if (connected && this.client) {
      try {
        await this.client.setEx(prefixedKey, ttl, serialized);
        return;
      } catch (error) {
        console.warn('[Redis] Set error, using fallback:', error);
      }
    }

    // Fallback to in-memory
    this.fallbackStore.set(prefixedKey, {
      value,
      expiry: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    const prefixedKey = `moby:${key}`;

    const connected = await this.ensureConnected();
    if (connected && this.client) {
      try {
        await this.client.del(prefixedKey);
      } catch (error) {
        console.warn('[Redis] Delete error:', error);
      }
    }

    this.fallbackStore.delete(prefixedKey);
  }

  async exists(key: string): Promise<boolean> {
    const prefixedKey = `moby:${key}`;

    const connected = await this.ensureConnected();
    if (connected && this.client) {
      try {
        return await this.client.exists(prefixedKey) === 1;
      } catch (error) {
        console.warn('[Redis] Exists error:', error);
      }
    }

    const entry = this.fallbackStore.get(prefixedKey);
    return entry !== undefined && entry.expiry > Date.now();
  }

  // ===== Rate Limiting =====

  async incrementRateLimit(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<{ count: number; resetTime: number; allowed: boolean }> {
    const prefixedKey = `ratelimit:${key}`;
    const windowSec = Math.ceil(windowMs / 1000);
    const resetTime = Date.now() + windowMs;

    const connected = await this.ensureConnected();
    if (connected && this.client) {
      try {
        const count = await this.client.incr(prefixedKey);
        if (count === 1) {
          await this.client.expire(prefixedKey, windowSec);
        }
        const ttl = await this.client.ttl(prefixedKey);
        const actualResetTime = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
        return {
          count,
          resetTime: actualResetTime,
          allowed: count <= maxRequests,
        };
      } catch (error) {
        console.warn('[Redis] Rate limit error, using fallback:', error);
      }
    }

    // Fallback rate limiting
    const entry = this.fallbackRateLimit.get(prefixedKey);
    const now = Date.now();
    
    if (!entry || now > entry.resetTime) {
      const newEntry = { count: 1, resetTime };
      this.fallbackRateLimit.set(prefixedKey, newEntry);
      return { count: 1, resetTime, allowed: true };
    }

    entry.count++;
    return {
      count: entry.count,
      resetTime: entry.resetTime,
      allowed: entry.count <= maxRequests,
    };
  }

  async decrementRateLimit(key: string): Promise<void> {
    const prefixedKey = `ratelimit:${key}`;

    const connected = await this.ensureConnected();
    if (connected && this.client) {
      try {
        await this.client.decr(prefixedKey);
        return;
      } catch (error) {
        console.warn('[Redis] Decrement error:', error);
      }
    }

    const entry = this.fallbackRateLimit.get(prefixedKey);
    if (entry && entry.count > 0) {
      entry.count--;
    }
  }

  async resetRateLimit(key: string): Promise<void> {
    const prefixedKey = `ratelimit:${key}`;

    const connected = await this.ensureConnected();
    if (connected && this.client) {
      try {
        await this.client.del(prefixedKey);
      } catch (error) {
        console.warn('[Redis] Reset rate limit error:', error);
      }
    }

    this.fallbackRateLimit.delete(prefixedKey);
  }

  // ===== Session Management =====

  async setSession(sessionId: string, data: any, ttlSec = 86400): Promise<void> {
    await this.set(`session:${sessionId}`, data, { ttl: ttlSec });
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.delete(`session:${sessionId}`);
  }

  // ===== Health Check =====

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs?: number }> {
    const start = Date.now();
    const connected = await this.ensureConnected();
    
    if (!connected || !this.client) {
      return { status: 'degraded' };
    }

    try {
      await this.client.ping();
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'unhealthy', latencyMs: Date.now() - start };
    }
  }

  // ===== Cleanup =====

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Cleanup expired fallback entries periodically
  startCleanupInterval(intervalMs = 60000): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.fallbackStore.entries()) {
        if (entry.expiry <= now) {
          this.fallbackStore.delete(key);
        }
      }
      for (const [key, entry] of this.fallbackRateLimit.entries()) {
        if (entry.resetTime <= Date.now()) {
          this.fallbackRateLimit.delete(key);
        }
      }
    }, intervalMs);
  }
}

// Singleton
let redisCacheInstance: RedisCache | null = null;

export function getRedisCache(): RedisCache {
  if (!redisCacheInstance) {
    redisCacheInstance = new RedisCache();
    redisCacheInstance.startCleanupInterval();
  }
  return redisCacheInstance;
}

export type { CacheOptions, RateLimitInfo };