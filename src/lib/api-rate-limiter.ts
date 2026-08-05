/**
 * Rate Limiter & Circuit Breaker for API Routes
 * In-memory implementation with Redis-ready interface
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  decrement(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

// In-memory store (replace with Redis in production)
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const entry = this.store.get(key);
    
    if (!entry || now > entry.resetTime) {
      const newEntry = { count: 1, resetTime: now + windowMs };
      this.store.set(key, newEntry);
      return newEntry;
    }
    
    entry.count++;
    return entry;
  }

  async decrement(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (entry && entry.count > 0) {
      entry.count--;
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton store
let rateLimitStore: RateLimitStore = new MemoryRateLimitStore();

export function setRateLimitStore(store: RateLimitStore) {
  rateLimitStore = store;
}

export function getRateLimitStore(): RateLimitStore {
  return rateLimitStore;
}

// Cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (rateLimitStore instanceof MemoryRateLimitStore) {
      rateLimitStore.cleanup();
    }
  }, 60_000);
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; info: RateLimitInfo; response?: NextResponse }> {
  const key = `${config.keyPrefix || 'api'}:${getClientIdentifier(request)}`;
  const { count, resetTime } = await rateLimitStore.increment(key, config.windowMs);
  
  const remaining = Math.max(0, config.maxRequests - count);
  const success = count <= config.maxRequests;
  
  const info: RateLimitInfo = {
    limit: config.maxRequests,
    remaining,
    resetTime,
  };

  if (!success) {
    info.retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    const response = NextResponse.json(
      { 
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${info.retryAfter} seconds.`,
        retryAfter: info.retryAfter,
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
          'Retry-After': info.retryAfter.toString(),
        }
      }
    );
    return { success: false, info, response };
  }

  return { success: true, info };
}

function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from auth header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    return `user:${hashString(authHeader.slice(0, 50))}`;
  }

  // Fall back to IP
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `ip:${ip}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Standardized error responses
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createErrorResponse(error: Error | ApiError): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Unknown error
  console.error('[API Error]', error);
  return NextResponse.json(
    {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    },
    { status: 500 }
  );
}

// Common error helpers
export const errors = {
  notFound: (resource: string) => new ApiError(404, 'NotFound', `${resource} not found`),
  badRequest: (message: string, details?: any) => new ApiError(400, 'BadRequest', message, details),
  unauthorized: (message = 'Unauthorized') => new ApiError(401, 'Unauthorized', message),
  forbidden: (message = 'Forbidden') => new ApiError(403, 'Forbidden', message),
  tooManyRequests: (retryAfter: number) => new ApiError(429, 'TooManyRequests', 'Rate limit exceeded', { retryAfter }),
  internal: (message = 'Internal server error') => new ApiError(500, 'InternalServerError', message),
  serviceUnavailable: (service: string) => new ApiError(503, 'ServiceUnavailable', `${service} temporarily unavailable`),
};

// Request validation helper
export function validateRequest<T>(
  data: any,
  schema: { [key: string]: (v: any) => boolean },
  required: string[] = []
): { valid: boolean; errors: string[]; data?: T } {
  const errors: string[] = [];
  
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  for (const [field, validator] of Object.entries(schema)) {
    if (data[field] !== undefined && !validator(data[field])) {
      errors.push(`Invalid value for field: ${field}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined,
  };
}

// Health check response type
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latencyMs?: number;
    error?: string;
  }>;
  version?: string;
}

export function createHealthResponse(
  services: HealthCheckResponse['services'],
  version?: string
): HealthCheckResponse {
  const statuses = Object.values(services).map(s => s.status);
  const overallStatus = statuses.includes('unhealthy') ? 'unhealthy' :
                       statuses.includes('degraded') ? 'degraded' : 'healthy';
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
    version,
  };
}