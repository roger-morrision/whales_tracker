/**
 * Public API + Rate Limiting
 * /api/v1/* with API keys, tiers, webhooks
 */

export interface ApiKey {
  id: string;
  name: string;
  key: string; // Hashed
  prefix: string; // First 8 chars for display
  userId: string;
  tier: 'free' | 'pro' | 'enterprise' | 'admin';
  permissions: ApiPermission[];
  rateLimit: RateLimitConfig;
  webhooks: WebhookConfig[];
  ipWhitelist?: string[];
  createdAt: number;
  lastUsed?: number;
  expiresAt?: number;
  revoked: boolean;
}

export interface ApiPermission {
  resource: string; // e.g., 'portfolio', 'trading', 'market', 'alerts'
  actions: ('read' | 'write' | 'delete')[];
  conditions?: Record<string, any>;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  customLimits?: Record<string, { windowMs: number; maxRequests: number }>;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  retryPolicy: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  createdAt: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    rateLimit: RateLimitInfo;
    requestId: string;
    timestamp: number;
  };
}

export interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: any;
  headers: Record<string, string>;
  ip: string;
  apiKey?: ApiKey;
  userId?: string;
}

class PublicApiManager {
  private apiKeys: Map<string, ApiKey> = new Map();
  private rateLimitStore: Map<string, RateLimitBucket[]> = new Map();
  private webhookQueue: WebhookDelivery[] = [];
  private subscribers: Set<(event: ApiEvent) => void> = new Set();
  private requestLog: ApiRequestLog[] = [];
  private config: PublicApiConfig;

  constructor(config?: Partial<PublicApiConfig>) {
    this.config = {
      defaultTier: 'free',
      tiers: {
        free: { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000, burstLimit: 10 },
        pro: { requestsPerMinute: 300, requestsPerHour: 10000, requestsPerDay: 100000, burstLimit: 50 },
        enterprise: { requestsPerMinute: 1000, requestsPerHour: 100000, requestsPerDay: 1000000, burstLimit: 200 },
        admin: { requestsPerMinute: 10000, requestsPerHour: 1000000, requestsPerDay: 10000000, burstLimit: 1000 },
      },
      webhookTimeoutMs: 10000,
      webhookMaxRetries: 5,
      logRetentionDays: 30,
      enableCors: true,
      corsOrigins: ['*'],
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    // Start webhook processor
    this.startWebhookProcessor();
    
    // Cleanup old rate limit entries
    setInterval(() => this.cleanupRateLimits(), 60000);
    
    // Cleanup old logs
    setInterval(() => this.cleanupLogs(), 3600000);
  }

  // API Key Management
  createApiKey(params: {
    name: string;
    userId: string;
    tier?: 'free' | 'pro' | 'enterprise' | 'admin';
    permissions?: ApiPermission[];
    expiresInDays?: number;
    ipWhitelist?: string[];
  }): ApiKey {
    const tier = params.tier || this.config.defaultTier;
    const tierConfig = this.config.tiers[tier];
    
    const rawKey = this.generateApiKey();
    const hashedKey = this.hashKey(rawKey);
    const prefix = rawKey.slice(0, 8);

    const apiKey: ApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: params.name,
      key: hashedKey,
      prefix,
      userId: params.userId,
      tier,
      permissions: params.permissions || this.getDefaultPermissions(tier),
      rateLimit: { ...tierConfig },
      webhooks: [],
      ipWhitelist: params.ipWhitelist,
      createdAt: Date.now(),
      expiresAt: params.expiresInDays ? Date.now() + params.expiresInDays * 86400000 : undefined,
      revoked: false,
    };

    this.apiKeys.set(apiKey.id, apiKey);
    this.notifySubscribers({ type: 'key_created', key: apiKey });
    
    // Return with raw key (only time it's shown)
    return { ...apiKey, key: rawKey };
  }

  validateApiKey(rawKey: string): ApiKey | null {
    const prefix = rawKey.slice(0, 8);
    const hashed = this.hashKey(rawKey);
    
    for (const key of this.apiKeys.values()) {
      if (key.prefix === prefix && key.key === hashed && !key.revoked) {
        if (key.expiresAt && key.expiresAt < Date.now()) {
          return null; // Expired
        }
        key.lastUsed = Date.now();
        return key;
      }
    }
    
    return null;
  }

  getApiKey(keyId: string): ApiKey | undefined {
    return this.apiKeys.get(keyId);
  }

  listApiKeys(userId: string): ApiKey[] {
    return Array.from(this.apiKeys.values())
      .filter(k => k.userId === userId && !k.revoked)
      .map(k => ({ ...k, key: k.prefix + '...' })); // Don't expose full key
  }

  revokeApiKey(keyId: string, userId: string): boolean {
    const key = this.apiKeys.get(keyId);
    if (!key || key.userId !== userId) return false;
    
    key.revoked = true;
    this.notifySubscribers({ type: 'key_revoked', keyId });
    return true;
  }

  updateApiKey(keyId: string, userId: string, updates: {
    name?: string;
    permissions?: ApiPermission[];
    rateLimit?: Partial<RateLimitConfig>;
    ipWhitelist?: string[];
  }): ApiKey | null {
    const key = this.apiKeys.get(keyId);
    if (!key || key.userId !== userId) return null;
    
    Object.assign(key, updates);
    this.notifySubscribers({ type: 'key_updated', key });
    return key;
  }

  // Rate Limiting
  checkRateLimit(key: string, config: RateLimitConfig): RateLimitInfo {
    const now = Date.now();
    const buckets = this.rateLimitStore.get(key) || [];
    
    // Clean old entries
    const validBuckets = buckets.filter(b => b.resetAt > now);
    
    // Check each tier
    const limits = [
      { window: 60000, max: config.requestsPerMinute, name: 'minute' },
      { window: 3600000, max: config.requestsPerHour, name: 'hour' },
      { window: 86400000, max: config.requestsPerDay, name: 'day' },
    ];
    
    let overallRemaining = Infinity;
    let earliestReset = 0;
    
    for (const limit of limits) {
      const bucket = validBuckets.find(b => b.windowMs === limit.window);
      const used = bucket ? bucket.count : 0;
      const remaining = Math.max(0, limit.max - used);
      overallRemaining = Math.min(overallRemaining, remaining);
      
      const resetAt = bucket ? bucket.resetAt : now + limit.window;
      if (!earliestReset || resetAt < earliestReset) {
        earliestReset = resetAt;
      }
    }
    
    // Check burst
    const burstBucket = validBuckets.find(b => b.windowMs === 1000); // 1 second burst
    const burstUsed = burstBucket ? burstBucket.count : 0;
    const burstRemaining = Math.max(0, config.burstLimit - burstUsed);
    overallRemaining = Math.min(overallRemaining, burstRemaining);
    
    return {
      limit: Math.min(config.requestsPerMinute, config.burstLimit),
      remaining: overallRemaining,
      resetAt: earliestReset,
      retryAfter: overallRemaining === 0 ? earliestReset - now : undefined,
    };
  }

  consumeRateLimit(key: string, config: RateLimitConfig): RateLimitInfo {
    const now = Date.now();
    const buckets = this.rateLimitStore.get(key) || [];
    
    // Clean old
    const validBuckets = buckets.filter(b => b.resetAt > now);
    
    // Increment counters
    const windows = [1000, 60000, 3600000, 86400000]; // 1s, 1m, 1h, 1d
    for (const windowMs of windows) {
      let bucket = validBuckets.find(b => b.windowMs === windowMs);
      if (!bucket) {
        bucket = { windowMs, count: 0, resetAt: now + windowMs };
        validBuckets.push(bucket);
      }
      bucket.count++;
    }
    
    this.rateLimitStore.set(key, validBuckets);
    return this.checkRateLimit(key, config);
  }

  // Webhooks
  registerWebhook(apiKeyId: string, config: Omit<WebhookConfig, 'id' | 'secret' | 'createdAt'>): WebhookConfig {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) throw new Error('API key not found');
    
    const webhook: WebhookConfig = {
      ...config,
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      secret: this.generateWebhookSecret(),
      createdAt: Date.now(),
    };
    
    apiKey.webhooks.push(webhook);
    this.notifySubscribers({ type: 'webhook_registered', apiKeyId, webhook });
    return webhook;
  }

  unregisterWebhook(apiKeyId: string, webhookId: string): boolean {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) return false;
    
    const index = apiKey.webhooks.findIndex(w => w.id === webhookId);
    if (index === -1) return false;
    
    apiKey.webhooks.splice(index, 1);
    this.notifySubscribers({ type: 'webhook_unregistered', apiKeyId, webhookId });
    return true;
  }

  // Emit event to webhooks
  async emitEvent(event: string, data: any): Promise<void> {
    const deliveries: WebhookDelivery[] = [];
    
    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.revoked) continue;
      
      for (const webhook of apiKey.webhooks) {
        if (!webhook.active || !webhook.events.includes(event)) continue;
        
        deliveries.push({
          id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          webhookId: webhook.id,
          apiKeyId: apiKey.id,
          event,
          payload: data,
          signature: this.signPayload(data, webhook.secret),
          attempts: 0,
          createdAt: Date.now(),
        });
      }
    }
    
    this.webhookQueue.push(...deliveries);
  }

  private async processWebhooks(): Promise<void> {
    if (this.webhookQueue.length === 0) return;
    
    const batch = this.webhookQueue.splice(0, 10);
    
    for (const delivery of batch) {
      try {
        await this.deliverWebhook(delivery);
      } catch (error) {
        delivery.attempts++;
        if (delivery.attempts < this.config.webhookMaxRetries) {
          // Re-queue with delay
          const delay = Math.min(
            1000 * Math.pow(2, delivery.attempts),
            60000
          );
          setTimeout(() => this.webhookQueue.push(delivery), delay);
        } else {
          this.logger.error(`Webhook ${delivery.webhookId} failed after ${delivery.attempts} attempts`);
        }
      }
    }
  }

  private async deliverWebhook(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.findWebhook(delivery.apiKeyId, delivery.webhookId);
    if (!webhook) return;
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Whales-Event': delivery.event,
        'X-Whales-Signature': delivery.signature,
        'X-Whales-Delivery': delivery.id,
        'User-Agent': 'Whales-Tracker-Webhook/1.0',
      },
      body: JSON.stringify({
        event: delivery.event,
        data: delivery.payload,
        timestamp: delivery.createdAt,
      }),
      signal: AbortSignal.timeout(this.config.webhookTimeoutMs),
    });
    
    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  }

  private findWebhook(apiKeyId: string, webhookId: string): WebhookConfig | null {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) return null;
    return apiKey.webhooks.find(w => w.id === webhookId) || null;
  }

  private signPayload(payload: any, secret: string): string {
    // HMAC-SHA256
    return 'sha256=' + btoa(JSON.stringify(payload)); // Simplified
  }

  // Request logging
  logRequest(request: ApiRequest): void {
    this.requestLog.push({
      ...request,
      timestamp: Date.now(),
    });
    
    // Keep last 10000
    if (this.requestLog.length > 10000) {
      this.requestLog.shift();
    }
  }

  getRequestLogs(filters?: {
    userId?: string;
    apiKeyId?: string;
    path?: string;
    method?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): ApiRequestLog[] {
    let logs = [...this.requestLog];
    
    if (filters) {
      if (filters.userId) logs = logs.filter(l => l.userId === filters.userId);
      if (filters.apiKeyId) logs = logs.filter(l => l.apiKey?.id === filters.apiKeyId);
      if (filters.path) logs = logs.filter(l => l.path.includes(filters.path!));
      if (filters.method) logs = logs.filter(l => l.method === filters.method);
      if (filters.startTime) logs = logs.filter(l => l.timestamp >= filters.startTime!);
      if (filters.endTime) logs = logs.filter(l => l.timestamp <= filters.endTime!);
    }
    
    logs.sort((a, b) => b.timestamp - a.timestamp);
    return logs.slice(0, filters?.limit || 100);
  }

  // Permissions
  checkPermission(apiKey: ApiKey, resource: string, action: 'read' | 'write' | 'delete'): boolean {
    for (const perm of apiKey.permissions) {
      if (perm.resource === resource || perm.resource === '*') {
        if (perm.actions.includes(action) || perm.actions.includes('*')) {
          // Check conditions
          if (perm.conditions) {
            // Evaluate conditions
            return true; // Simplified
          }
          return true;
        }
      }
    }
    return false;
  }

  private getDefaultPermissions(tier: string): ApiPermission[] {
    const base: ApiPermission[] = [
      { resource: 'portfolio', actions: ['read'] },
      { resource: 'market', actions: ['read'] },
      { resource: 'alerts', actions: ['read', 'write'] },
    ];
    
    if (tier === 'pro' || tier === 'enterprise' || tier === 'admin') {
      base.push(
        { resource: 'trading', actions: ['read', 'write'] },
        { resource: 'portfolio', actions: ['read', 'write'] },
        { resource: 'workflows', actions: ['read', 'write'] },
      );
    }
    
    if (tier === 'enterprise' || tier === 'admin') {
      base.push(
        { resource: 'trading', actions: ['read', 'write', 'delete'] },
        { resource: 'webhooks', actions: ['read', 'write', 'delete'] },
        { resource: 'analytics', actions: ['read'] },
      );
    }
    
    if (tier === 'admin') {
      base.push({ resource: '*', actions: ['read', 'write', 'delete'] });
    }
    
    return base;
  }

  // Utility
  private generateApiKey(): string {
    return 'wtr_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private generateWebhookSecret(): string {
    return 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hashKey(key: string): string {
    // In production, use bcrypt or argon2
    return btoa(key).slice(0, 64);
  }

  private cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, buckets] of this.rateLimitStore.entries()) {
      const valid = buckets.filter(b => b.resetAt > now);
      if (valid.length === 0) {
        this.rateLimitStore.delete(key);
      } else {
        this.rateLimitStore.set(key, valid);
      }
    }
  }

  private cleanupLogs(): void {
    const cutoff = Date.now() - this.config.logRetentionDays * 86400000;
    this.requestLog = this.requestLog.filter(l => l.timestamp > cutoff);
  }

  private startWebhookProcessor(): void {
    setInterval(() => this.processWebhooks(), 5000);
  }

  private logger = {
    error: (msg: string, meta?: any) => console.error(`[PublicAPI] ${msg}`, meta),
  };

  // Subscriptions
  onApiEvent(callback: (event: ApiEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(event: ApiEvent): void {
    for (const sub of this.subscribers) {
      try { sub(event); } catch (e) { console.error('[PublicAPI] Subscriber error:', e); }
    }
  }
}

export interface PublicApiConfig {
  defaultTier: 'free' | 'pro' | 'enterprise' | 'admin';
  tiers: Record<string, RateLimitConfig>;
  webhookTimeoutMs: number;
  webhookMaxRetries: number;
  logRetentionDays: number;
  enableCors: boolean;
  corsOrigins: string[];
}

export interface RateLimitBucket {
  windowMs: number;
  count: number;
  resetAt: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  apiKeyId: string;
  event: string;
  payload: any;
  signature: string;
  attempts: number;
  createdAt: number;
}

export interface ApiEvent {
  type: 'key_created' | 'key_revoked' | 'key_updated' | 'webhook_registered' | 'webhook_unregistered';
  key?: ApiKey;
  keyId?: string;
  apiKeyId?: string;
  webhook?: WebhookConfig;
  webhookId?: string;
}

export interface ApiRequestLog extends ApiRequest {
  timestamp: number;
}

// Singleton
let publicApiManagerInstance: PublicApiManager | null = null;

export function getPublicApiManager(config?: Partial<PublicApiConfig>): PublicApiManager {
  if (!publicApiManagerInstance) {
    publicApiManagerInstance = new PublicApiManager(config);
  }
  return publicApiManagerInstance;
}

// React hook
export function usePublicApi(config?: Partial<PublicApiConfig>) {
  const manager = getPublicApiManager(config);
  
  return {
    createApiKey: (params: any) => manager.createApiKey(params),
    validateApiKey: (key: string) => manager.validateApiKey(key),
    getApiKey: (id: string) => manager.getApiKey(id),
    listApiKeys: (userId: string) => manager.listApiKeys(userId),
    revokeApiKey: (keyId: string, userId: string) => manager.revokeApiKey(keyId, userId),
    updateApiKey: (keyId: string, userId: string, updates: any) => manager.updateApiKey(keyId, userId, updates),
    checkRateLimit: (key: string, config: RateLimitConfig) => manager.checkRateLimit(key, config),
    consumeRateLimit: (key: string, config: RateLimitConfig) => manager.consumeRateLimit(key, config),
    registerWebhook: (apiKeyId: string, config: any) => manager.registerWebhook(apiKeyId, config),
    unregisterWebhook: (apiKeyId: string, webhookId: string) => manager.unregisterWebhook(apiKeyId, webhookId),
    emitEvent: (event: string, data: any) => manager.emitEvent(event, data),
    logRequest: (request: ApiRequest) => manager.logRequest(request),
    getRequestLogs: (filters?: any) => manager.getRequestLogs(filters),
    checkPermission: (apiKey: ApiKey, resource: string, action: 'read' | 'write' | 'delete') => 
      manager.checkPermission(apiKey, resource, action),
    onApiEvent: (callback: (event: ApiEvent) => void) => manager.onApiEvent(callback),
  };
}

export type { ApiKey, ApiPermission, RateLimitConfig, WebhookConfig, RateLimitInfo, ApiResponse, ApiRequest };